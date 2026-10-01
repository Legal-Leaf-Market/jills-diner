// Ordering rules shared by the browser cart, the build and the order
// function. The server never trusts a price or a pickup time from the
// browser: it rebuilds the catalog from content/menu.json and recomputes the
// pickup slots from content/site.json, using this same code.

export const LIMITS = {
  maxLines: 40,
  maxQty: 20,
  nameMax: 40,
  notesMax: 500,
  leadMinutes: 20, // earliest pickup is this far from now
  slotMinutes: 15,
  daysAhead: 2, // today plus the next open days, up to this many
  maxPendingPerPhone: 3,
};

const slug = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const toCents = (v) => Math.round(Number(String(v).replace(/^\$/, '')) * 100);

export const itemId = (section, item, variant) =>
  [section.id, slug(item.name), variant ? slug(variant.label) : null].filter(Boolean).join('--');

// Every orderable thing on the menu, keyed by a stable id. An item is
// orderable when it has a price of its own, labeled prices (each one becomes
// its own line), or sits in a section with one shared price.
export function buildCatalog(menu) {
  const catalog = {};
  for (const section of menu.sections) {
    for (const item of section.items) {
      if (item.orderable === false) continue;
      if (item.prices?.length) {
        for (const v of item.prices) {
          const id = itemId(section, item, v);
          catalog[id] = { id, name: `${item.name} (${v.label})`, section: section.title, cents: toCents(v.price) };
        }
        continue;
      }
      const price = item.price ?? section.price;
      if (!price) continue;
      const id = itemId(section, item);
      catalog[id] = { id, name: item.name, section: section.title, cents: toCents(price) };
    }
  }
  return catalog;
}

// ---- Time: hours are wall clock in the diner's time zone ----

const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

function partsAt(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23', weekday: 'long',
  });
  const p = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, dow: DAY_INDEX[p.weekday] };
}

// Wall clock in tz -> epoch ms. Two passes so the offset is right across
// daylight saving changes.
export function zonedToEpoch(y, mo, d, h, mi, tz) {
  const want = Date.UTC(y, mo - 1, d, h, mi);
  let guess = want;
  for (let i = 0; i < 2; i++) {
    const p = partsAt(guess, tz);
    const seen = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    guess += want - seen;
  }
  return guess;
}

const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Pickup slots, as epoch ms, from now through the next few open days.
// First slot of a day is 15 minutes after opening; last is 15 before close.
export function pickupSlots(site, nowMs, { lead = LIMITS.leadMinutes } = {}) {
  const tz = site.timezone;
  const byDow = {};
  for (const d of site.hours) byDow[DAY_INDEX[d.day]] = d;
  const step = LIMITS.slotMinutes;
  const earliest = nowMs + lead * 60_000;
  const slots = [];
  let openDays = 0;
  const today = partsAt(nowMs, tz);
  for (let offset = 0; offset < 8 && openDays < LIMITS.daysAhead; offset++) {
    const noon = zonedToEpoch(today.y, today.mo, today.d, 12, 0, tz) + offset * 86_400_000;
    const day = partsAt(noon, tz);
    const hours = byDow[day.dow];
    if (!hours || hours.closed) continue;
    const first = minutesOf(hours.open) + step;
    const last = minutesOf(hours.close) - step;
    let any = false;
    for (let m = first; m <= last; m += step) {
      const at = zonedToEpoch(day.y, day.mo, day.d, Math.floor(m / 60), m % 60, tz);
      if (at >= earliest) {
        slots.push(at);
        any = true;
      }
    }
    if (any) openDays++;
  }
  return slots;
}

// ---- Validating an order (runs on the server) ----

export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return null;
  return `+1${ten}`;
}

const cleanText = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

// Returns { ok: true, order } ready to insert, or { ok: false, error } with a
// message a customer can act on.
export function validateOrder(body, { catalog, site, nowMs }) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Something went wrong sending your order. Please try again.' };

  const first = cleanText(body.firstName, LIMITS.nameMax);
  const last = cleanText(body.lastName, LIMITS.nameMax);
  if (!first || !last) return { ok: false, error: 'Please enter your first and last name.' };

  const phone = normalizePhone(body.phone);
  if (!phone) return { ok: false, error: 'Please enter a 10-digit phone number so we can call about your order.' };

  const notes = cleanText(body.notes, LIMITS.notesMax);

  if (!Array.isArray(body.items) || body.items.length === 0) return { ok: false, error: 'Your order is empty.' };
  if (body.items.length > LIMITS.maxLines) return { ok: false, error: 'That order is bigger than we can take online. Please call the diner.' };
  const lines = [];
  let subtotal = 0;
  for (const raw of body.items) {
    const entry = catalog[raw?.id];
    const qty = Number(raw?.qty);
    if (!entry) return { ok: false, error: 'Part of your order is no longer on the menu. Please refresh the page and check your cart.' };
    if (!Number.isInteger(qty) || qty < 1 || qty > LIMITS.maxQty) return { ok: false, error: `Please pick between 1 and ${LIMITS.maxQty} of each item.` };
    if (lines.some((l) => l.id === entry.id)) return { ok: false, error: 'Your cart has a duplicate line. Please refresh and try again.' };
    lines.push({ id: entry.id, name: entry.name, section: entry.section, qty, price_cents: entry.cents });
    subtotal += entry.cents * qty;
  }

  // Generous lead on the server so a customer who took a few minutes at
  // checkout isn't refused for a slot that was fine when they picked it.
  const pickup = Number(new Date(body.pickupTime).getTime());
  const allowed = pickupSlots(site, nowMs, { lead: 5 });
  if (!Number.isFinite(pickup) || !allowed.includes(pickup)) {
    return { ok: false, error: 'That pickup time isn’t available anymore. Please choose another.' };
  }

  return {
    ok: true,
    order: {
      customer_name: `${first} ${last}`,
      customer_phone: phone,
      pickup_time: new Date(pickup).toISOString(),
      order_items: lines,
      special_notes: notes || null,
      subtotal_cents: subtotal,
      status: 'pending',
    },
  };
}
