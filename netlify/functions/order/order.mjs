// POST /api/order: takes the customer's cart, checks every part of it
// against the real menu and hours, and inserts one "pending" row into
// Supabase. The service key lives only in Netlify environment variables and
// never reaches the browser.

import { catalog, site as builtSite } from './catalog.generated.mjs';
import { LIMITS, validateOrder } from '../../../src/order-core.mjs';

export const config = { path: '/api/order' };

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// Supabase's legacy service_role key is a JWT and goes in both headers; the
// newer sb_secret_ keys go in apikey only.
function supabaseHeaders(key, extra = {}) {
  const h = { apikey: key, 'content-type': 'application/json', ...extra };
  if (key.startsWith('eyJ')) h.authorization = `Bearer ${key}`;
  return h;
}

export async function handleOrder(req, { env = process.env, fetchImpl = fetch, now = Date.now(), siteOverride } = {}) {
  const site = siteOverride ?? builtSite;
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!site.ordering || !url || !key) {
    return json(503, { ok: false, error: `Online ordering isn’t open right now. Please call ${site.phone}.` });
  }

  // Same-origin only: a form on another site can't post orders here.
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(req.url).host) return json(403, { ok: false, error: 'Not allowed.' });

  const text = await req.text();
  if (text.length > 20_000) return json(413, { ok: false, error: 'That order is too large to send.' });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { ok: false, error: 'Something went wrong sending your order. Please try again.' });
  }

  // Bots fill every field, people never see this one.
  if (body.company) return json(200, { ok: true, orderNumber: null });

  const result = validateOrder(body, { catalog, site, nowMs: now });
  if (!result.ok) return json(422, result);
  const order = result.order;

  const base = url.replace(/\/+$/, '');
  try {
    const pendingRes = await fetchImpl(
      `${base}/rest/v1/orders?select=id&status=eq.pending&customer_phone=eq.${encodeURIComponent(order.customer_phone)}`,
      { headers: supabaseHeaders(key) },
    );
    if (!pendingRes.ok) throw new Error(`pending check ${pendingRes.status}: ${await pendingRes.text()}`);
    const pending = await pendingRes.json();
    if (pending.length >= LIMITS.maxPendingPerPhone) {
      return json(429, { ok: false, error: `You already have orders waiting. Please call ${site.phone} to add to them.` });
    }

    const insertRes = await fetchImpl(`${base}/rest/v1/orders?select=id,order_number,pickup_time`, {
      method: 'POST',
      headers: supabaseHeaders(key, { prefer: 'return=representation' }),
      body: JSON.stringify(order),
    });
    if (!insertRes.ok) throw new Error(`insert ${insertRes.status}: ${await insertRes.text()}`);
    const [row] = await insertRes.json();
    return json(200, { ok: true, orderNumber: row.order_number, pickupTime: row.pickup_time });
  } catch (err) {
    // Log the cause server-side; never echo database details to the customer.
    console.error('[order] Supabase request failed:', err);
    return json(502, { ok: false, error: `We couldn’t send your order. Please call ${site.phone}.` });
  }
}

export default (req) => handleOrder(req);
