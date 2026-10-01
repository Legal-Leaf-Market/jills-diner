// Tests the order function against a fake Supabase. Run: npm test
// (needs a build first so the generated catalog exists; npm test does that).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleOrder } from '../netlify/functions/order/order.mjs';
import { catalog, site } from '../netlify/functions/order/catalog.generated.mjs';
import { pickupSlots } from '../src/order-core.mjs';

const NOW = Date.parse('2026-10-07T09:00:00-04:00'); // a Wednesday morning
const ENV = { SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'eyJservice' };
const slot = pickupSlots(site, NOW)[2];

function fakeSupabase({ pending = [], fail = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (fail) return new Response('relation "orders" does not exist', { status: 500 });
    if ((init.method ?? 'GET') === 'GET') return Response.json(pending);
    const row = JSON.parse(init.body);
    return Response.json([{ id: 'u1', order_number: 41, pickup_time: row.pickup_time }], { status: 201 });
  };
  return { calls, fetchImpl };
}

const request = (body, headers = {}) =>
  new Request('https://jills-diner.netlify.app/api/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://jills-diner.netlify.app', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const good = {
  firstName: 'Kat',
  lastName: 'Copeland',
  phone: '(812) 555-0142',
  pickupTime: new Date(slot).toISOString(),
  notes: 'Eggs over medium',
  items: [
    { id: 'breakfast--jill-s-big-breakfast', qty: 2 },
    { id: 'breakfast--french-toast--half', qty: 1 },
    { id: 'sides--onion-rings', qty: 1 },
  ],
};

const on = { ...site, ordering: true };
const run = (req, sb, opts = {}) => handleOrder(req, { env: ENV, fetchImpl: sb.fetchImpl, now: NOW, siteOverride: on, ...opts });

test('a good order is priced by the server and inserted as pending', async () => {
  const sb = fakeSupabase();
  const res = await run(request({ ...good, items: good.items.map((i) => ({ ...i, price: 1 })) }), sb);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, orderNumber: 41, pickupTime: new Date(slot).toISOString() });
  const insert = sb.calls.find((c) => c.init.method === 'POST');
  const row = JSON.parse(insert.init.body);
  assert.equal(row.status, 'pending');
  assert.equal(row.customer_name, 'Kat Copeland');
  assert.equal(row.customer_phone, '+18125550142');
  assert.equal(row.subtotal_cents, 999 * 2 + 350 + 275);
  assert.deepEqual(row.order_items.map((l) => [l.id, l.qty, l.price_cents]), [
    ['breakfast--jill-s-big-breakfast', 2, 999],
    ['breakfast--french-toast--half', 1, 350],
    ['sides--onion-rings', 1, 275],
  ]);
  assert.equal(insert.init.headers.apikey, 'eyJservice');
  assert.equal(insert.init.headers.authorization, 'Bearer eyJservice');
});

test('new-style secret keys stay out of the Authorization header', async () => {
  const sb = fakeSupabase();
  await run(request(good), sb, { env: { ...ENV, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' } });
  assert.equal(sb.calls[0].init.headers.authorization, undefined);
});

for (const [why, patch, status] of [
  ['unknown item', { items: [{ id: 'breakfast--lobster', qty: 1 }] }, 422],
  ['zero quantity', { items: [{ id: 'sides--corn', qty: 0 }] }, 422],
  ['huge quantity', { items: [{ id: 'sides--corn', qty: 500 }] }, 422],
  ['empty cart', { items: [] }, 422],
  ['bad phone', { phone: '555-1234' }, 422],
  ['missing last name', { lastName: '  ' }, 422],
  ['pickup off the grid', { pickupTime: new Date(slot + 7 * 60000).toISOString() }, 422],
  ['pickup on a Monday', { pickupTime: '2026-10-12T14:00:00.000Z' }, 422],
  ['pickup in the past', { pickupTime: new Date(NOW - 3600000).toISOString() }, 422],
]) {
  test(`refuses: ${why}`, async () => {
    const sb = fakeSupabase();
    const res = await run(request({ ...good, ...patch }), sb);
    assert.equal(res.status, status);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.ok(body.error.length > 10);
    assert.equal(sb.calls.length, 0, 'nothing reaches the database');
  });
}

test('honeypot: bots get a quiet fake success and nothing is stored', async () => {
  const sb = fakeSupabase();
  const res = await run(request({ ...good, company: 'Acme' }), sb);
  assert.equal(res.status, 200);
  assert.equal(sb.calls.length, 0);
});

test('a phone with 3 orders already waiting is told to call', async () => {
  const sb = fakeSupabase({ pending: [{ id: 1 }, { id: 2 }, { id: 3 }] });
  const res = await run(request(good), sb);
  assert.equal(res.status, 429);
  assert.equal(sb.calls.filter((c) => c.init.method === 'POST').length, 0);
});

test('other websites cannot post orders', async () => {
  const sb = fakeSupabase();
  const res = await run(request(good, { origin: 'https://evil.example' }), sb);
  assert.equal(res.status, 403);
  assert.equal(sb.calls.length, 0);
});

test('closed when ordering is off or Supabase is not configured', async () => {
  for (const opts of [{ siteOverride: { ...site, ordering: false } }, { env: {} }]) {
    const sb = fakeSupabase();
    const res = await run(request(good), sb, opts);
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /call/);
  }
});

test('database errors are logged, never shown to the customer', async () => {
  const sb = fakeSupabase({ fail: true });
  const errors = [];
  const orig = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try {
    const res = await run(request(good), sb);
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.doesNotMatch(body.error, /relation|orders|500/);
    assert.match(errors.join(' '), /does not exist/);
  } finally {
    console.error = orig;
  }
});

test('garbage and oversized bodies are refused', async () => {
  const sb = fakeSupabase();
  assert.equal((await run(request('{not json'), sb)).status, 400);
  assert.equal((await run(request('x'.repeat(30000)), sb)).status, 413);
  assert.equal((await handleOrder(new Request('https://x.test/api/order'), { env: ENV })).status, 405);
});
