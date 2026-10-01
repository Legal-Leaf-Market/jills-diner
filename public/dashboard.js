// Jill's Diner staff tablet: live pickup orders.
//   * Staff sign in with a Supabase account that's on the staff list.
//   * New orders arrive over Supabase Realtime the moment they're placed,
//     with a loud chime that repeats until someone accepts or cancels.
//   * The board also refetches every minute and whenever the tablet wakes,
//     so a dropped connection can never hide an order for long.
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var config = null;
  try { config = JSON.parse($('#dash-config').textContent); } catch (e) { /* fall through */ }

  function show(view) {
    $$('[data-view]').forEach(function (el) { el.hidden = el.getAttribute('data-view') !== view; });
  }

  if (!config || !window.supabase) { show('unconfigured'); setLive('off', 'Not set up'); return; }

  var TZ = config.timezone;
  var client = window.supabase.createClient(config.url, config.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'jills-dash-auth' }
  });

  var orders = {}; // id -> row
  var channel = null;
  var started = false;

  // ---------- Clock + connection light ----------

  var clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' });
  function tick() { $('[data-clock]').textContent = clockFmt.format(new Date()); }
  tick();
  setInterval(tick, 15000);

  function setLive(state, text) {
    var el = $('[data-live]');
    el.className = 'dash-live is-' + state;
    $('[data-live-text]').textContent = text;
  }

  // ---------- Sound ----------

  var audio = null;
  function unlockAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio = audio || new Ctx();
    if (audio.state === 'suspended') audio.resume();
  }
  // A bright three-note diner bell, loud enough to hear over the flattop.
  function chime() {
    if (!audio) return;
    var t0 = audio.currentTime + 0.02;
    [[1318.5, 0], [1046.5, 0.22], [1568, 0.44]].forEach(function (n) {
      [1, 2.01].forEach(function (mult, k) {
        var osc = audio.createOscillator();
        var gain = audio.createGain();
        osc.type = k === 0 ? 'triangle' : 'sine';
        osc.frequency.value = n[0] * mult;
        var start = t0 + n[1];
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(k === 0 ? 0.9 : 0.25, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
        osc.connect(gain).connect(audio.destination);
        osc.start(start);
        osc.stop(start + 0.95);
      });
    });
  }

  // Keep nagging while anything is waiting on a decision.
  setInterval(function () {
    if (started && pendingCount() > 0) { chime(); flash(); }
  }, 30000);

  function flash() {
    var el = $('[data-alert]');
    el.hidden = false;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
    clearTimeout(flash.t);
    flash.t = setTimeout(function () { el.hidden = true; }, 2600);
  }

  // Screen stays on while the board is up.
  var wakeLock = null;
  function keepAwake() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
  }

  // ---------- Data ----------

  function pendingCount() {
    return Object.keys(orders).filter(function (id) { return orders[id].status === 'pending'; }).length;
  }

  function startOfToday() {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    var mins = (+p.hour % 24) * 60 + +p.minute;
    return new Date(Date.now() - mins * 60000 - new Date().getSeconds() * 1000);
  }

  function refetch() {
    var since = new Date(Math.min(startOfToday().getTime(), Date.now() - 12 * 3600000)).toISOString();
    return client
      .from('orders')
      .select('*')
      .or('status.in.(pending,accepted),created_at.gte."' + since + '"')
      .order('pickup_time', { ascending: true })
      .limit(200)
      .then(function (res) {
        if (res.error) throw res.error;
        var next = {};
        res.data.forEach(function (row) { next[row.id] = row; });
        orders = next;
        draw();
      })
      .catch(function (err) {
        console.error('[dashboard] refetch failed', err);
        setLive('bad', 'Can’t reach orders');
      });
  }

  function subscribe() {
    if (channel) client.removeChannel(channel);
    channel = client
      .channel('orders-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, function (payload) {
        if (payload.eventType === 'DELETE') {
          delete orders[payload.old.id];
        } else {
          var row = payload.new;
          var isNew = payload.eventType === 'INSERT' && row.status === 'pending';
          orders[row.id] = row;
          if (isNew) { chime(); flash(); }
        }
        draw();
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') { setLive('ok', 'Live'); refetch(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setLive('bad', 'Reconnecting…');
      });
  }

  function setStatus(id, status, btn) {
    btn.disabled = true;
    return client
      .from('orders')
      .update({ status: status })
      .eq('id', id)
      .select()
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) throw res.error || new Error('not updated');
        orders[id] = res.data[0];
        draw();
      })
      .catch(function (err) {
        console.error('[dashboard] update failed', err);
        btn.disabled = false;
        alert('That didn’t save. Check the internet connection and try again.');
      });
  }

  // ---------- Drawing ----------

  var timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
  var dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
  var money = function (c) { return '$' + (c / 100).toFixed(2); };
  function prettyPhone(e164) {
    var d = String(e164).replace(/\D/g, '').slice(-10);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function card(o) {
    var c = el('article', 'ticket is-' + o.status);
    var pickup = new Date(o.pickup_time);
    var mins = Math.round((pickup - Date.now()) / 60000);
    var today = dayFmt.format(pickup) === dayFmt.format(new Date());

    var head = el('header', 'ticket-head');
    head.appendChild(el('span', 'ticket-num', '#' + o.order_number));
    var when = el('span', 'ticket-when');
    when.appendChild(el('strong', null, timeFmt.format(pickup)));
    var open = o.status === 'pending' || o.status === 'accepted';
    var rel = !today ? dayFmt.format(pickup)
      : !open ? ''
      : mins < 0 ? Math.abs(mins) + ' min late' : mins === 0 ? 'now' : 'in ' + mins + ' min';
    when.appendChild(el('span', 'ticket-rel' + (today && open && mins < 0 ? ' late' : ''), rel));
    head.appendChild(when);
    c.appendChild(head);

    c.appendChild(el('p', 'ticket-name', o.customer_name));

    var list = el('ul', 'ticket-items');
    (o.order_items || []).forEach(function (it) {
      var li = el('li');
      li.appendChild(el('span', 'q', it.qty + '×'));
      var label = String(it.name).replace(/'/g, '\u2019');
      var name = el('span', 'n', it.section && /kids/i.test(it.section) ? 'Kids: ' + label : label);
      li.appendChild(name);
      list.appendChild(li);
    });
    c.appendChild(list);

    if (o.special_notes) c.appendChild(el('p', 'ticket-notes', o.special_notes));
    c.appendChild(el('p', 'ticket-total', money(o.subtotal_cents) + ' before add-ons · pay at counter'));

    var actions = el('div', 'ticket-actions');
    var call = el('a', 'tk-btn tk-call', 'Call');
    call.appendChild(el('small', null, prettyPhone(o.customer_phone)));
    call.href = 'tel:' + o.customer_phone;
    if (o.status === 'pending') {
      actions.appendChild(button('Accept', 'tk-accept', function (b) { setStatus(o.id, 'accepted', b); }));
      actions.appendChild(call);
      actions.appendChild(confirmButton('Cancel', o.id));
    } else if (o.status === 'accepted') {
      actions.appendChild(button('Picked up', 'tk-done', function (b) { setStatus(o.id, 'completed', b); }));
      actions.appendChild(call);
      actions.appendChild(confirmButton('Cancel', o.id));
    } else {
      c.appendChild(el('p', 'ticket-final', o.status === 'completed' ? 'Picked up' : 'Cancelled'));
    }
    if (actions.children.length) c.appendChild(actions);
    return c;
  }

  function button(label, cls, onTap) {
    var b = el('button', 'tk-btn ' + cls, label);
    b.type = 'button';
    b.addEventListener('click', function () { onTap(b); });
    return b;
  }
  // Two taps to cancel, so a brushed screen can't lose an order.
  function confirmButton(label, id) {
    var b = button(label, 'tk-cancel', function () {
      if (b.classList.contains('armed')) { setStatus(id, 'cancelled', b); return; }
      b.classList.add('armed');
      b.textContent = 'Tap again to cancel';
      setTimeout(function () { b.classList.remove('armed'); b.textContent = label; }, 4000);
    });
    return b;
  }

  function draw() {
    var groups = { pending: [], accepted: [], done: [] };
    var dayStart = startOfToday().getTime();
    Object.keys(orders).forEach(function (id) {
      var o = orders[id];
      if (o.status === 'pending' || o.status === 'accepted') groups[o.status].push(o);
      else if (new Date(o.status_changed_at || o.created_at).getTime() >= dayStart) groups.done.push(o);
    });
    var byPickup = function (a, b) { return new Date(a.pickup_time) - new Date(b.pickup_time); };
    groups.pending.sort(byPickup);
    groups.accepted.sort(byPickup);
    groups.done.sort(function (a, b) { return new Date(b.status_changed_at || 0) - new Date(a.status_changed_at || 0); });

    Object.keys(groups).forEach(function (key) {
      var list = $('[data-list="' + key + '"]');
      var none = $('.dash-none', list);
      $$('.ticket', list).forEach(function (n) { n.remove(); });
      groups[key].forEach(function (o) { list.appendChild(card(o)); });
      none.hidden = groups[key].length > 0;
      var count = $('[data-count="' + key + '"]');
      if (count) count.textContent = groups[key].length;
    });
    document.title = (groups.pending.length ? '(' + groups.pending.length + ') ' : '') + 'Orders | Jill’s Diner';
    document.body.classList.toggle('has-pending', groups.pending.length > 0);
  }

  // Relative times ("in 12 min") stay fresh.
  setInterval(function () { if (started) draw(); }, 30000);

  // ---------- Auth flow ----------

  function afterLogin() {
    return client.rpc('is_staff').then(function (res) {
      if (res.error) throw res.error;
      if (!res.data) {
        client.auth.signOut();
        loginError('This account isn’t on the staff list. Ask the owner to add it.');
        show('login');
        return;
      }
      $('[data-signout]').hidden = false;
      show('start');
    });
  }

  function loginError(msg) {
    var e = $('[data-login-error]');
    e.textContent = msg;
    e.hidden = !msg;
  }

  $('[data-login]').addEventListener('submit', function (ev) {
    ev.preventDefault();
    loginError('');
    var f = ev.target.elements;
    var btn = $('button[type=submit]', ev.target);
    btn.disabled = true;
    client.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value })
      .then(function (res) {
        if (res.error) throw res.error;
        f.password.value = '';
        return afterLogin();
      })
      .catch(function () { loginError('That email and password didn’t match.'); })
      .then(function () { btn.disabled = false; });
  });

  $('[data-start]').addEventListener('click', function () {
    unlockAudio();
    chime();
    keepAwake();
    started = true;
    show('board');
    subscribe();
    refetch();
    setInterval(refetch, 60000);
  });

  $('[data-signout]').addEventListener('click', function () {
    client.auth.signOut().then(function () { location.reload(); });
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !started) return;
    unlockAudio();
    if (!wakeLock || wakeLock.released) keepAwake();
    refetch();
  });
  window.addEventListener('online', function () { if (started) { subscribe(); refetch(); } });

  setLive('off', 'Signed out');
  client.auth.getSession().then(function (res) {
    if (res.data && res.data.session) afterLogin().catch(function () { show('login'); });
    else show('login');
  });
  client.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_OUT') { setLive('off', 'Signed out'); show('login'); }
  });
})();
