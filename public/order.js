// Jill's Diner pickup orders: the cart and checkout.
// The cart lives in localStorage, so it survives jumping around the menu,
// reloading, or switching between the home page and /menu/. Prices shown here
// are for the customer's convenience only; the order function reprices
// everything from the real menu.
(function () {
  'use strict';

  var dataEl = document.getElementById('order-data');
  var dialog = document.querySelector('[data-cart]');
  if (!dataEl || !dialog || typeof dialog.showModal !== 'function') return;

  var DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var CATALOG = DATA.catalog;
  var KEY = 'jills-cart-v1';
  var MAX_AGE = 3 * 24 * 60 * 60 * 1000;
  var MAX_QTY = 20;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var money = function (cents) { return '$' + (cents / 100).toFixed(2); };

  // ---------- Cart state ----------

  // { lines: [{ id, qty }], savedAt }. Items no longer on the menu are dropped.
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || !Array.isArray(raw.lines) || Date.now() - raw.savedAt > MAX_AGE) return [];
      return raw.lines.filter(function (l) {
        return CATALOG[l.id] && Number.isInteger(l.qty) && l.qty > 0;
      }).map(function (l) { return { id: l.id, qty: Math.min(l.qty, MAX_QTY) }; });
    } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ lines: lines, savedAt: Date.now() })); } catch (e) { /* private mode: cart still works for this page */ }
  }

  var lines = load();

  function setQty(id, qty) {
    var line = lines.find(function (l) { return l.id === id; });
    if (qty <= 0) lines = lines.filter(function (l) { return l.id !== id; });
    else if (line) line.qty = Math.min(qty, MAX_QTY);
    else lines.push({ id: id, qty: Math.min(qty, MAX_QTY) });
    save();
    render();
  }
  function qtyOf(id) {
    var line = lines.find(function (l) { return l.id === id; });
    return line ? line.qty : 0;
  }
  function count() { return lines.reduce(function (n, l) { return n + l.qty; }, 0); }
  function subtotal() { return lines.reduce(function (n, l) { return n + CATALOG[l.id].cents * l.qty; }, 0); }

  // Another tab changed the cart.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { lines = load(); render(); }
  });

  // ---------- Rendering ----------

  var fab = $('[data-cart-open]');
  var listEl = $('[data-cart-lines]', dialog);
  var form = $('[data-checkout]', dialog);
  var errorEl = $('[data-error]', dialog);
  var pickupEl = $('[data-pickup]', dialog);

  function render() {
    var n = count();
    $('[data-cart-count]').textContent = n;
    $('[data-cart-total]').textContent = money(subtotal());
    fab.hidden = n === 0;
    document.body.classList.toggle('has-cart', n > 0);

    $('[data-cart-empty]', dialog).hidden = n > 0;
    $('[data-cart-sum]', dialog).hidden = n === 0;
    form.hidden = n === 0;
    $('[data-cart-subtotal]', dialog).textContent = money(subtotal());

    listEl.innerHTML = '';
    lines.forEach(function (l) {
      var item = CATALOG[l.id];
      var li = document.createElement('li');
      li.className = 'cart-line';
      var name = document.createElement('div');
      name.className = 'cart-line-name';
      name.textContent = item.name.replace(/'/g, '\u2019');
      var section = document.createElement('span');
      section.className = 'cart-line-section';
      section.textContent = item.section;
      name.appendChild(section);
      var qty = document.createElement('div');
      qty.className = 'qty';
      qty.innerHTML =
        '<button type="button" class="qty-btn" data-dec aria-label="One fewer ' + escapeAttr(item.name) + '">−</button>' +
        '<span class="qty-n" aria-live="polite">' + l.qty + '</span>' +
        '<button type="button" class="qty-btn" data-inc aria-label="One more ' + escapeAttr(item.name) + '">+</button>';
      $('[data-dec]', qty).addEventListener('click', function () { setQty(l.id, l.qty - 1); });
      $('[data-inc]', qty).addEventListener('click', function () { setQty(l.id, l.qty + 1); });
      var price = document.createElement('div');
      price.className = 'cart-line-price';
      price.textContent = money(item.cents * l.qty);
      li.appendChild(name); li.appendChild(qty); li.appendChild(price);
      listEl.appendChild(li);
    });

    // Badge each Add button with how many are in the cart.
    $$('[data-add]').forEach(function (btn) {
      var q = qtyOf(btn.getAttribute('data-add'));
      btn.classList.toggle('in-cart', q > 0);
      if (q > 0) btn.setAttribute('data-qty', q); else btn.removeAttribute('data-qty');
    });
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // ---------- Pickup times (mirrors src/order-core.mjs pickupSlots) ----------

  var DAY = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  function partsAt(ms) {
    var p = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: DATA.timezone, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'long'
    }).formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, dow: DAY[p.weekday] };
  }
  function zoned(y, mo, d, h, mi) {
    var want = Date.UTC(y, mo - 1, d, h, mi), guess = want;
    for (var i = 0; i < 2; i++) {
      var p = partsAt(guess);
      guess += want - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    }
    return guess;
  }
  function slots(now) {
    var byDow = {};
    DATA.hours.forEach(function (d) { byDow[DAY[d.day]] = d; });
    var earliest = now + 20 * 60000, out = [], openDays = 0, today = partsAt(now);
    for (var off = 0; off < 8 && openDays < 2; off++) {
      var day = partsAt(zoned(today.y, today.mo, today.d, 12, 0) + off * 86400000);
      var h = byDow[day.dow];
      if (!h || h.closed) continue;
      var first = toMin(h.open) + 15, last = toMin(h.close) - 15, any = false;
      for (var m = first; m <= last; m += 15) {
        var at = zoned(day.y, day.mo, day.d, Math.floor(m / 60), m % 60);
        if (at >= earliest) { out.push(at); any = true; }
      }
      if (any) openDays++;
    }
    return out;
  }
  function toMin(hhmm) { var p = hhmm.split(':'); return +p[0] * 60 + +p[1]; }

  var dayLabel = new Intl.DateTimeFormat('en-US', { timeZone: DATA.timezone, weekday: 'long', month: 'short', day: 'numeric' });
  var timeLabel = new Intl.DateTimeFormat('en-US', { timeZone: DATA.timezone, hour: 'numeric', minute: '2-digit' });
  function whenLabel(ms) {
    var now = Date.now();
    var day = dayLabel.format(ms);
    if (day === dayLabel.format(now)) day = 'Today';
    else if (day === dayLabel.format(now + 86400000)) day = 'Tomorrow';
    return { day: day, time: timeLabel.format(ms) };
  }

  function fillPickup() {
    var keep = pickupEl.value;
    pickupEl.innerHTML = '';
    var groups = {};
    slots(Date.now()).forEach(function (ms) {
      var w = whenLabel(ms);
      if (!groups[w.day]) {
        groups[w.day] = document.createElement('optgroup');
        groups[w.day].label = w.day;
        pickupEl.appendChild(groups[w.day]);
      }
      var o = document.createElement('option');
      o.value = new Date(ms).toISOString();
      o.textContent = w.day + ', ' + w.time;
      groups[w.day].appendChild(o);
    });
    if (keep && $('option[value="' + keep + '"]', pickupEl)) pickupEl.value = keep;
  }

  // ---------- Open / close ----------

  function showView(name) {
    $$('[data-cart-view]', dialog).forEach(function (v) { v.hidden = v.getAttribute('data-cart-view') !== name; });
    $('[data-cart-title]', dialog).textContent = name === 'done' ? 'Thank you!' : 'Your order';
  }
  function open() {
    showView('cart');
    fillPickup();
    render();
    dialog.showModal();
  }
  fab.addEventListener('click', open);
  $$('[data-cart-close]', dialog).forEach(function (b) { b.addEventListener('click', function () { dialog.close(); }); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });

  $$('[data-add]').forEach(function (btn) {
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-add');
      if (!CATALOG[id]) return;
      setQty(id, qtyOf(id) + 1);
      fab.classList.remove('bump');
      void fab.offsetWidth;
      fab.classList.add('bump');
    });
  });

  // ---------- Checkout ----------

  function fail(msg, field) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    if (field) { var el = form.elements[field]; if (el) el.focus(); }
  }

  var sending = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    errorEl.hidden = true;
    var f = form.elements;
    var first = f.firstName.value.trim(), last = f.lastName.value.trim();
    var digits = f.phone.value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (!first) return fail('Please enter your first name.', 'firstName');
    if (!last) return fail('Please enter your last name.', 'lastName');
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return fail('Please enter a 10-digit phone number.', 'phone');
    if (!f.pickupTime.value) return fail('Online orders are full for now. Please call ' + DATA.phone + '.');
    if (!lines.length) return fail('Your order is empty.');

    var submit = $('[data-submit]', form);
    sending = true;
    submit.disabled = true;
    submit.textContent = 'Sending…';
    fetch(DATA.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: first,
        lastName: last,
        phone: digits,
        pickupTime: f.pickupTime.value,
        notes: f.notes.value.trim(),
        company: f.company.value,
        items: lines.map(function (l) { return { id: l.id, qty: l.qty }; })
      })
    })
      .then(function (res) { return res.json().catch(function () { return { ok: false }; }); })
      .then(function (body) {
        if (!body.ok) {
          fillPickup();
          return fail(body.error || ('We couldn’t send your order. Please call ' + DATA.phone + '.'));
        }
        var w = whenLabel(new Date(body.pickupTime || f.pickupTime.value).getTime());
        $('[data-done-number]', dialog).textContent = body.orderNumber ? '#' + body.orderNumber : '';
        $('[data-done-when]', dialog).textContent = 'Pickup ' + (w.day === 'Today' ? 'today' : w.day === 'Tomorrow' ? 'tomorrow' : w.day) + ' at ' + w.time + '.';
        lines = [];
        save();
        form.reset();
        render();
        showView('done');
      })
      .catch(function () {
        fail('No connection. Check your signal and try again, or call ' + DATA.phone + '.');
      })
      .then(function () {
        sending = false;
        submit.disabled = false;
        submit.textContent = 'Place pickup order';
      });
  });

  render();
})();
