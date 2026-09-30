// Jill's Diner: small progressive enhancements. The page works without any
// of this; the script only adds the live open/closed badge, today's row in the
// hours table, the menu jump-bar highlight, and Apple Maps links on Apple
// devices.
(function () {
  'use strict';

  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function readHours() {
    var el = document.getElementById('hours-data');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  function toMinutes(hhmm) {
    var p = hhmm.split(':');
    return Number(p[0]) * 60 + Number(p[1]);
  }

  function fmt(hhmm) {
    var p = hhmm.split(':');
    var h = Number(p[0]);
    var m = Number(p[1]);
    var suffix = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return m ? h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + suffix : h12 + ' ' + suffix;
  }

  // Current weekday and minute-of-day at the diner, whatever the visitor's
  // own time zone is.
  function nowAt(tz) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, weekday: 'long', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
      }).formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      return { dow: DAY_NAMES.indexOf(map.weekday), min: (Number(map.hour) % 24) * 60 + Number(map.minute) };
    } catch (e) {
      var d = new Date();
      return { dow: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function computeStatus(hours, now) {
    var byDow = {};
    hours.days.forEach(function (d) { byDow[d.dow] = d; });
    var today = byDow[now.dow];

    if (today && !today.closed) {
      var open = toMinutes(today.open);
      var close = toMinutes(today.close);
      if (now.min < open) {
        return { state: 'soon', text: 'Closed now. Opens today at ' + fmt(today.open) + '.' };
      }
      if (now.min < close) {
        if (close - now.min <= 30) return { state: 'soon', text: 'Closing soon, at ' + fmt(today.close) + '.' };
        return { state: 'open', text: 'Open now until ' + fmt(today.close) + '.' };
      }
    }

    for (var i = 1; i <= 7; i++) {
      var dow = (now.dow + i) % 7;
      var next = byDow[dow];
      if (next && !next.closed) {
        var when = i === 1 ? 'tomorrow' : DAY_NAMES[dow];
        return { state: 'closed', text: 'Closed now. Opens ' + when + ' at ' + fmt(next.open) + '.' };
      }
    }
    return null;
  }

  function paintStatus() {
    var hours = readHours();
    if (!hours) return;
    var now = nowAt(hours.tz);
    var status = computeStatus(hours, now);

    document.querySelectorAll('[data-status]').forEach(function (el) {
      if (!status) return;
      el.classList.remove('is-open', 'is-soon', 'is-closed');
      el.classList.add('is-' + status.state);
      var text = el.querySelector('[data-status-text]');
      if (text) text.textContent = status.text;
    });

    document.querySelectorAll('.hours-table tr[data-dow]').forEach(function (row) {
      row.classList.toggle('is-today', Number(row.getAttribute('data-dow')) === now.dow);
    });
  }

  // Menu jump bar: highlight the section in view and keep its chip visible.
  function watchMenu() {
    var nav = document.querySelector('.menu-nav');
    if (!nav || !('IntersectionObserver' in window)) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#m-"]'));
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var visible = {};

    function setCurrent(id) {
      links.forEach(function (a) {
        if (a === byId[id]) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      var chip = byId[id];
      var list = nav.querySelector('ul');
      if (chip && list) {
        var left = chip.offsetLeft - list.clientWidth / 2 + chip.clientWidth / 2;
        list.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      }
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      for (var i = 0; i < links.length; i++) {
        var id = links[i].getAttribute('href').slice(1);
        if (visible[id]) { setCurrent(id); return; }
      }
    }, { rootMargin: '-35% 0px -55% 0px' });

    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  // On iPhones and iPads, send "Directions" to Apple Maps instead.
  function preferAppleMaps() {
    var ua = navigator.userAgent || '';
    var apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (!apple) return;
    document.querySelectorAll('[data-directions]').forEach(function (a) {
      var url = a.getAttribute('data-directions');
      if (url) a.setAttribute('href', url);
    });
  }

  function wirePrint() {
    document.querySelectorAll('[data-print]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.print(); });
    });
  }

  function init() {
    paintStatus();
    setInterval(paintStatus, 60 * 1000);
    watchMenu();
    preferAppleMaps();
    wirePrint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
