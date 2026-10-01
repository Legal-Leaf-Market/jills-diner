// Page templates. Plain template strings, no framework: the site is two static
// pages and should stay easy for anyone to read and change.

import { art, icon } from './icons.mjs';
import { itemId } from './order-core.mjs';

const DOW = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

export const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Curly apostrophes for anything a person reads. URLs and JSON-LD keep the
// straight ones.
const typo = (v) => String(v ?? '').replace(/'/g, '\u2019');
const t = (v) => esc(typo(v));

export function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

const range = (d) => (d.closed ? 'Closed' : `${fmtTime(d.open)} \u2013 ${fmtTime(d.close)}`);

// Collapse consecutive days with identical hours: "Tuesday to Friday".
export function hoursSummary(hours) {
  const groups = [];
  for (const d of hours) {
    const key = range(d);
    const last = groups[groups.length - 1];
    if (last && last.key === key && !d.closed) last.days.push(d.day);
    else groups.push({ key, days: [d.day] });
  }
  const open = groups.filter((g) => g.key !== 'Closed');
  const closed = groups.filter((g) => g.key === 'Closed');
  return [...open, ...closed].map((g) => ({
    days: g.days.length > 1 ? `${g.days[0]} to ${g.days[g.days.length - 1]}` : g.days[0],
    hours: g.key,
  }));
}

const fullAddress = (a) => `${a.street}, ${a.city}, ${a.state} ${a.zip}`;
const addressQuery = (a) => encodeURIComponent(`${a.street.replace(/\./g, '')}, ${a.city}, ${a.state} ${a.zip}`);

export const links = (site) => ({
  tel: `tel:${site.phoneE164}`,
  google: `https://www.google.com/maps/dir/?api=1&destination=${addressQuery(site.address)}`,
  apple: `https://maps.apple.com/?daddr=${addressQuery(site.address)}`,
  embed: `https://www.google.com/maps?q=${addressQuery(site.address)}&z=15&output=embed`,
});

function jsonLd(site) {
  const spec = [];
  for (const d of site.hours) {
    if (d.closed) continue;
    const same = spec.find((s) => s.opens === d.open && s.closes === d.close);
    if (same) same.dayOfWeek.push(d.day);
    else spec.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: [d.day], opens: d.open, closes: d.close });
  }
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: site.name,
    url: `${site.url}/`,
    image: `${site.url}/og.png`,
    telephone: site.phoneE164,
    priceRange: '$',
    servesCuisine: ['American', 'Breakfast', 'Diner'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.state,
      postalCode: site.address.zip,
      addressCountry: 'US',
    },
    openingHoursSpecification: spec,
    hasMenu: `${site.url}/menu/`,
    sameAs: [site.facebook],
  };
  // "<" can never appear raw inside a script element.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// The letterboard: every letter is its own span with a tiny, repeatable
// wobble, the way real press-in letters never sit perfectly straight.
function letterboard(lines) {
  const rand = (n) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  return lines
    .map((line, li) => {
      const chars = [...typo(line).toUpperCase()]
        .map((ch, ci) => {
          if (ch === ' ') return '<span class="sp"></span>';
          const n = li * 97 + ci * 13 + 7;
          const dy = ((rand(n) - 0.5) * 2.4).toFixed(2);
          const r = ((rand(n + 3) - 0.5) * 3.2).toFixed(2);
          return `<span style="--dy:${dy}px;--r:${r}deg">${esc(ch)}</span>`;
        })
        .join('');
      return `<p class="board-line">${chars}</p>`;
    })
    .join('');
}

const header = (site, base) => `
<a class="skip-link" href="#main">Skip to content</a>
<p class="announce"><a href="${base}#visit"><strong>We\u2019ve moved!</strong> <span class="announce-long">Find us at ${t(site.address.street)}, next to Rural King</span><span class="announce-short">Now at ${t(site.address.street)}</span> ${icon.arrow}</a></p>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/" aria-label="${t(site.name)}, home"><span class="brand-script">Jill\u2019s</span><span class="brand-block">Diner</span></a>
    <nav class="site-nav" aria-label="Main">
      <a href="#menu">Menu</a>
      <a href="${base}#visit">Hours &amp; Directions</a>
      <a href="${base}#story">Our Story</a>
    </nav>
    <a class="btn btn-red btn-sm header-call" href="${links(site).tel}">${icon.phone}<span>${esc(site.phone)}</span></a>
  </div>
</header>`;

const statusBadge = () => `
<p class="status" data-status>
  <span class="status-dot" aria-hidden="true"></span>
  <span class="status-text" data-status-text>Open Tuesday to Sunday. Closed Mondays.</span>
</p>`;

const hero = (site) => `
<section class="hero" aria-labelledby="hero-title">
  <div class="wrap hero-inner">
    <div class="hero-copy">
      <p class="eyebrow">Breakfast &amp; lunch <span aria-hidden="true">\u00b7</span> Columbus, Indiana</p>
      <h1 class="wordmark" id="hero-title"><span class="wm-script">Jill\u2019s</span> <span class="wm-block">Diner</span></h1>
      <p class="hero-lede">Biscuits and gravy, fried mush, a tenderloin at lunch and a hot cup of coffee. Now serving at our new home on National Road.</p>
      ${statusBadge()}
      <div class="hero-actions">
        <a class="btn btn-red" href="#menu">${icon.menu}<span>See the menu</span></a>
        <a class="btn btn-ink" href="${links(site).tel}">${icon.phone}<span>Call ${esc(site.phone)}</span></a>
        <a class="btn btn-ghost" href="${links(site).google}" data-directions="${links(site).apple}" target="_blank" rel="noopener">${icon.pin}<span>Directions</span></a>
      </div>
    </div>
    <div class="hero-art">
      <svg class="starburst" viewBox="0 0 200 200" aria-hidden="true" focusable="false">${starburst()}</svg>
      <figure class="board-frame" role="img" aria-label="Letter board sign: ${esc(typo(site.letterboard.join(', ')))}">
        <div class="board">${letterboard(site.letterboard)}</div>
      </figure>
    </div>
  </div>
</section>`;

function starburst(points = 18, tilt = 8) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2 + (tilt * Math.PI) / 180;
    const r = i % 2 === 0 ? 96 : 70;
    pts.push(`${(100 + Math.cos(a) * r).toFixed(1)},${(100 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="#F2C14E" stroke="#211C18" stroke-width="3" stroke-linejoin="round"/>`;
}

const favorites = (menu) => `
<section class="favorites" aria-labelledby="fav-title">
  <div class="wrap">
    <header class="section-head">
      <p class="kicker">What to order</p>
      <h2 id="fav-title">House favorites</h2>
    </header>
    <ul class="fav-grid" role="list">
      ${menu.favorites
        .map(
          (f) => `
      <li class="fav-card">
        <div class="fav-art">${art[f.icon] ?? ''}</div>
        <h3>${t(f.name)}</h3>
        <p>${t(f.text)}</p>
      </li>`,
        )
        .join('')}
    </ul>
  </div>
</section>`;

const money = (v) => `$${esc(String(v).replace(/^\$/, ''))}`;

// An item shows one price ("6.75") or several labeled ones (Cup 2.99, Bowl 4.25).
function priceTag(i) {
  if (i.prices?.length) {
    const parts = i.prices.map((p) => `<span class="price-label">${t(p.label)}</span> ${money(p.price)}`).join(' <span class="price-sep" aria-hidden="true">/</span> ');
    return `<span class="leader" aria-hidden="true"></span><span class="price">${parts}</span>`;
  }
  return i.price ? `<span class="leader" aria-hidden="true"></span><span class="price">${money(i.price)}</span>` : '';
}

// "Add" buttons ship hidden; public/order.js reveals them once the cart is
// ready, so a page without working JavaScript never shows a dead button.
function addButtons(s, i, compact) {
  if (i.orderable === false) return '';
  if (i.prices?.length) {
    return `<div class="item-add">${i.prices
      .map((v) => `<button type="button" class="add-btn" data-add="${esc(itemId(s, i, v))}" aria-label="Add ${t(i.name)}, ${t(v.label)}" hidden>+ ${t(v.label)}</button>`)
      .join('')}</div>`;
  }
  if (!(i.price ?? s.price)) return '';
  if (compact) return `<button type="button" class="add-btn add-btn-sm" data-add="${esc(itemId(s, i))}" aria-label="Add ${t(i.name)}" hidden>+</button>`;
  return `<div class="item-add"><button type="button" class="add-btn" data-add="${esc(itemId(s, i))}" aria-label="Add ${t(i.name)}" hidden>+ Add</button></div>`;
}

function item(i, s, ordering) {
  const price = priceTag(i);
  const compact = s.layout === 'compact';
  const add = ordering ? addButtons(s, i, compact) : '';
  return `
          <li class="item">
            <div class="item-top"><span class="item-name">${t(i.name)}</span>${i.tag ? ` <span class="tag">${t(i.tag)}</span>` : ''}${price}${compact ? add : ''}</div>
            ${i.desc ? `<p class="item-desc">${t(i.desc)}</p>` : ''}${compact ? '' : add}
          </li>`;
}

const menuCard = (menu, { standalone, ordering }) => `
<div class="menu-card">
  <nav class="menu-nav" aria-label="Jump to a part of the menu">
    <ul role="list">
      ${menu.sections.map((s) => `<li><a href="#m-${esc(s.id)}">${t(s.short ?? s.title)}</a></li>`).join('')}
    </ul>
  </nav>
  <div class="menu-cols">
    ${menu.sections
      .map(
        (s) => `
    <section class="menu-group" id="m-${esc(s.id)}" aria-labelledby="m-${esc(s.id)}-h">
      <h3 id="m-${esc(s.id)}-h"><span>${t(s.title)}</span>${s.price ? `<span class="group-price">${money(s.price)}</span>` : ''}</h3>
      ${(s.notes ?? []).map((n) => `<p class="group-note">${t(n)}</p>`).join('')}
      <ul class="items${s.layout === 'compact' ? ' items-compact' : ''}" role="list">${s.items.map((i) => item(i, s, ordering)).join('')}
      </ul>
      ${(s.extras ?? []).map((n) => `<p class="group-extra">${t(n)}</p>`).join('')}
    </section>`,
      )
      .join('')}
  </div>
  <div class="menu-foot">
    <div class="menu-fine">${(menu.footnotes ?? []).map((n) => `<p>${t(n)}</p>`).join('')}</div>
    ${
      standalone
        ? `<button class="btn btn-ghost btn-sm" type="button" data-print>${icon.print}<span>Print this menu</span></button>`
        : `<a class="btn btn-ghost btn-sm" href="/menu/">${icon.print}<span>Printable menu</span></a>`
    }
  </div>
</div>`;

const menuSection = (site, menu, ordering) => `
<section class="menu-section" id="menu" aria-labelledby="menu-title">
  <div class="wrap">
    <header class="section-head on-red">
      <p class="kicker">Breakfast all day &amp; lunch till close</p>
      <h2 id="menu-title">The Menu</h2>
    </header>
    ${menuCard(menu, { standalone: false, ordering })}
  </div>
</section>`;

const hoursTable = (site) => `
<table class="hours-table">
  <caption class="sr-only">Hours</caption>
  <tbody>
    ${site.hours
      .map(
        (d) =>
          `<tr data-dow="${DOW[d.day]}"${d.closed ? ' class="is-closed"' : ''}><th scope="row">${esc(d.day)}</th><td>${range(d)}</td></tr>`,
      )
      .join('\n    ')}
  </tbody>
</table>`;

const visit = (site) => {
  const l = links(site);
  return `
<section class="visit" id="visit" aria-labelledby="visit-title">
  <div class="wrap visit-grid">
    <div class="visit-info">
      <header class="section-head align-left">
        <p class="kicker">Come see us</p>
        <h2 id="visit-title">Find us on National Road</h2>
      </header>
      <p class="moved-note"><strong>We moved!</strong> After 73 years on Seventh Street downtown, the diner has a new home.</p>
      <address class="address-card">
        <span class="addr-street">${t(site.address.street)}</span>
        <span class="addr-city">${t(site.address.city)}, ${esc(site.address.state)} ${esc(site.address.zip)}</span>
        <span class="addr-landmark">${icon.car}<span>${t(site.address.landmark)}</span></span>
      </address>
      <div class="visit-actions">
        <a class="btn btn-red" href="${l.google}" target="_blank" rel="noopener">${icon.pin}<span>Google Maps</span></a>
        <a class="btn btn-ghost" href="${l.apple}" target="_blank" rel="noopener">${icon.pin}<span>Apple Maps</span></a>
        <a class="btn btn-ink" href="${l.tel}">${icon.phone}<span>${esc(site.phone)}</span></a>
      </div>
      <div class="hours-block">
        <h3>${icon.clock}<span>Hours</span></h3>
        ${statusBadge()}
        ${hoursTable(site)}
      </div>
    </div>
    <div class="visit-map">
      <a class="map-fallback" href="${l.google}" target="_blank" rel="noopener">${icon.pin}<span>${t(fullAddress(site.address))}</span><span class="btn btn-ghost btn-sm">Open the map</span></a>
      <iframe title="Map showing ${esc(fullAddress(site.address))}" src="${l.embed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
  </div>
</section>`;
};

const story = (site) => `
<section class="story" id="story" aria-labelledby="story-title">
  <div class="wrap story-grid">
    <header class="story-head">
      <p class="kicker">Our story</p>
      <h2 id="story-title">${t(site.story.title)}</h2>
      <p class="story-lede">${t(site.story.lede)}</p>
      <p class="story-regulars">${t(site.regulars)}</p>
    </header>
    <ol class="timeline" role="list">
      ${site.story.timeline
        .map(
          (e) => `
      <li>
        <span class="year">${esc(e.year)}</span>
        <div class="event">
          <h3>${t(e.title)}</h3>
          <p>${t(e.text)}</p>
        </div>
      </li>`,
        )
        .join('')}
    </ol>
  </div>
</section>`;

const footer = (site, base) => {
  const l = links(site);
  return `
<section class="cta-band" aria-labelledby="cta-title">
  <div class="wrap cta-inner">
    <h2 id="cta-title"><span class="cta-script">Coffee\u2019s on.</span> Come on in.</h2>
    <div class="cta-actions">
      <a class="btn btn-ink" href="${l.google}" data-directions="${l.apple}" target="_blank" rel="noopener">${icon.pin}<span>Get directions</span></a>
      <a class="btn btn-ghost" href="${l.tel}">${icon.phone}<span>${esc(site.phone)}</span></a>
    </div>
  </div>
</section>
<div class="checker" aria-hidden="true"></div>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="foot-brand">
      <a class="brand brand-light" href="/" aria-label="${t(site.name)}, home"><span class="brand-script">Jill\u2019s</span><span class="brand-block">Diner</span></a>
      <p>${t(site.address.street)}<br>${t(site.address.city)}, ${esc(site.address.state)} ${esc(site.address.zip)}</p>
      <p><a href="${l.tel}">${esc(site.phone)}</a></p>
    </div>
    <div>
      <h2 class="foot-h">Hours</h2>
      <ul class="foot-hours" role="list">
        ${hoursSummary(site.hours)
          .map((g) => `<li><span>${esc(g.days)}</span><span>${esc(g.hours)}</span></li>`)
          .join('\n        ')}
      </ul>
    </div>
    <div>
      <h2 class="foot-h">Around here</h2>
      <ul class="foot-links" role="list">
        <li><a href="#menu">The menu</a></li>
        <li><a href="/menu/">Printable menu</a></li>
        <li><a href="${base}#story">Our story</a></li>
        <li><a href="${esc(site.facebook)}" target="_blank" rel="noopener">${icon.facebook}<span>Jill\u2019s on Facebook</span></a></li>
      </ul>
    </div>
  </div>
  <div class="wrap foot-bottom">
    <p>\u00a9 ${new Date().getFullYear()} ${t(site.name)}, Columbus, Indiana</p>
    ${site.preview ? '<p class="preview-note">Preview site made for Jill\u2019s Diner. Menu and prices from the diner\u2019s current printed menu.</p>' : ''}
  </div>
</footer>
<nav class="action-bar" aria-label="Quick actions">
  <a href="${l.tel}">${icon.phone}<span>Call</span></a>
  <a href="${l.google}" data-directions="${l.apple}" target="_blank" rel="noopener">${icon.pin}<span>Directions</span></a>
  <a href="#menu">${icon.menu}<span>Menu</span></a>
</nav>`;
};

function page({ site, assets, path, title, description, body, head = '' }) {
  const canonical = `${site.url}${path}`;
  const hoursData = JSON.stringify({
    tz: site.timezone,
    days: site.hours.map((d) => (d.closed ? { dow: DOW[d.day], closed: true } : { dow: DOW[d.day], open: d.open, close: d.close })),
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${site.preview ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="#C2302A">
<meta name="format-detection" content="telephone=no">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${t(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(site.url)}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Jill\u2019s Diner, now at ${esc(site.address.street)}, Columbus, Indiana">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/libre-franklin-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/oswald-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/yellowtail-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css?v=${assets.css}">
<script type="application/ld+json">${jsonLd(site)}</script>
<script type="application/json" id="hours-data">${hoursData.replace(/</g, '\\u003c')}</script>
<script src="/app.js?v=${assets.js}" defer></script>
${head}
</head>
${body}
</html>
`;
}

// The cart and checkout. Only rendered when ordering is switched on and
// Supabase is configured; public/order.js drives it.
const cartUi = (site) => `
<button type="button" class="cart-fab" data-cart-open hidden>
  <span class="cart-fab-count" data-cart-count>0</span>
  <span class="cart-fab-label">Your order</span>
  <span class="cart-fab-total" data-cart-total>$0.00</span>
</button>
<dialog class="cart" aria-labelledby="cart-title" data-cart>
  <div class="cart-inner">
    <header class="cart-head">
      <h2 id="cart-title" data-cart-title>Your order</h2>
      <button type="button" class="cart-x" data-cart-close aria-label="Close">\u00d7</button>
    </header>
    <div data-cart-view="cart">
      <p class="cart-empty" data-cart-empty>Nothing here yet. Tap <strong>+ Add</strong> on anything on the menu.</p>
      <ul class="cart-lines" role="list" data-cart-lines></ul>
      <div class="cart-sum" data-cart-sum><span>Subtotal</span><strong data-cart-subtotal>$0.00</strong></div>
      <p class="cart-pay">Pay at the counter when you pick up. Want it changed or added to? Say so in the notes and it gets rung up at the counter.</p>
      <form class="checkout" data-checkout novalidate>
        <div class="field-row">
          <label class="field"><span>First name</span><input name="firstName" autocomplete="given-name" maxlength="40" required></label>
          <label class="field"><span>Last name</span><input name="lastName" autocomplete="family-name" maxlength="40" required></label>
        </div>
        <label class="field"><span>Phone</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(812) 555-0123" required></label>
        <label class="field"><span>Pickup time</span><select name="pickupTime" required data-pickup></select></label>
        <label class="field"><span>Notes <em>(optional)</em></span><textarea name="notes" rows="3" maxlength="500" placeholder="Eggs over medium, wheat toast, no onions\u2026"></textarea></label>
        <label class="hp" aria-hidden="true">Company<input name="company" tabindex="-1" autocomplete="off"></label>
        <p class="form-error" role="alert" data-error hidden></p>
        <button type="submit" class="btn btn-red checkout-submit" data-submit>Place pickup order</button>
        <p class="cart-fine">We only use your number to call about this order.</p>
      </form>
    </div>
    <div class="cart-done" data-cart-view="done" hidden>
      <p class="done-big">Order <span data-done-number></span> is in!</p>
      <p data-done-when></p>
      <p>Pay at the counter when you get here. If anything\u2019s out or unclear, we\u2019ll call you.</p>
      <p class="done-call">Need to change it? Call <a href="${links(site).tel}">${esc(site.phone)}</a>.</p>
      <button type="button" class="btn btn-ink" data-cart-close>Done</button>
    </div>
  </div>
</dialog>`;

function orderHead({ assets, orderData }) {
  if (!orderData) return '';
  return `<script type="application/json" id="order-data">${JSON.stringify(orderData).replace(/</g, '\\u003c')}</script>
<script src="/order.js?v=${assets.order}" defer></script>`;
}

export function renderHome({ site, menu, assets, orderData }) {
  const ordering = Boolean(orderData);
  return page({
    site,
    assets,
    path: '/',
    head: orderHead({ assets, orderData }),
    title: `${typo(site.name)} | Breakfast & Lunch in Columbus, Indiana`,
    description: `Breakfast and lunch at ${site.address.street}, Columbus, Indiana: biscuits and gravy, fried mush, tenderloins, burgers and hot coffee. Open Tuesday to Sunday.`,
    body: `<body class="home">
${header(site, '')}
<main id="main">
${hero(site)}
<div class="checker" aria-hidden="true"></div>
${favorites(menu)}
${menuSection(site, menu, ordering)}
${visit(site)}
${story(site)}
</main>
${footer(site, '')}
${ordering ? cartUi(site) : ''}
</body>`,
  });
}

export function renderMenuPage({ site, menu, assets, orderData }) {
  const ordering = Boolean(orderData);
  return page({
    site,
    assets,
    path: '/menu/',
    head: orderHead({ assets, orderData }),
    title: `Menu | ${typo(site.name)}, Columbus, Indiana`,
    description: `The ${typo(site.name)} menu with prices: all-day breakfast, biscuits and gravy, omelettes, burgers, tenderloins, homestyle meals and floats. ${site.address.street}, Columbus, Indiana.`,
    body: `<body class="menu-page">
${header(site, '/')}
<main id="main">
<section class="menu-section" id="menu" aria-labelledby="menu-title">
  <div class="wrap">
    <header class="section-head on-red">
      <p class="kicker">Breakfast all day &amp; lunch till close</p>
      <h1 id="menu-title">The Menu</h1>
      <p class="menu-page-sub"><span>${t(site.address.street)}, ${t(site.address.city)}</span> <span class="sub-dot" aria-hidden="true">\u00b7</span> <a href="${links(site).tel}">${esc(site.phone)}</a></p>
    </header>
    <div class="print-head" aria-hidden="true">
      <p class="print-name">Jill\u2019s Diner</p>
      <p>${t(fullAddress(site.address))} \u00b7 ${esc(site.phone)}</p>
      <p>${hoursSummary(site.hours).map((g) => `${esc(g.days)}: ${esc(g.hours)}`).join(' \u00b7 ')}</p>
    </div>
    ${menuCard(menu, { standalone: true, ordering })}
  </div>
</section>
</main>
${footer(site, '/')}
${ordering ? cartUi(site) : ''}
</body>`,
  });
}

// The staff tablet. Never linked from the site and never indexed; the data
// itself is protected by Supabase login plus row level security, not by
// this page being hard to find.
export function renderDashboard({ site, assets, dashboardConfig }) {
  const config = JSON.stringify(dashboardConfig ?? null).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Orders | ${t(site.name)}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#211C18">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/styles.css?v=${assets.css}">
<link rel="stylesheet" href="/dashboard.css?v=${assets.dashCss}">
<script type="application/json" id="dash-config">${config}</script>
<script src="/vendor/supabase-2.117.2.js" defer></script>
<script src="/dashboard.js?v=${assets.dash}" defer></script>
</head>
<body class="dash">
<header class="dash-bar">
  <p class="dash-brand"><span class="brand-script">Jill\u2019s</span> <span>Orders</span></p>
  <p class="dash-live" data-live><span class="dot"></span><span data-live-text>Connecting\u2026</span></p>
  <p class="dash-clock" data-clock></p>
  <button type="button" class="btn btn-ghost btn-sm" data-signout hidden>Sign out</button>
</header>

<main>
  <section class="dash-panel" data-view="unconfigured" hidden>
    <h1>Not set up yet</h1>
    <p>Online ordering needs a Supabase project. See <code>README.md</code>, section \u201cOnline ordering\u201d.</p>
  </section>

  <section class="dash-panel" data-view="login" hidden>
    <h1>Staff sign in</h1>
    <form data-login>
      <label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>
      <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
      <p class="form-error" role="alert" data-login-error hidden></p>
      <button class="btn btn-red" type="submit">Sign in</button>
    </form>
  </section>

  <section class="dash-panel" data-view="start" hidden>
    <h1>Ready for orders</h1>
    <p>Tap below so the tablet can play the order chime and keep its screen on.</p>
    <button type="button" class="btn btn-red dash-start" data-start>Start taking orders</button>
  </section>

  <section class="dash-board" data-view="board" hidden>
    <div class="dash-col">
      <h2>New <span class="count" data-count="pending">0</span></h2>
      <div class="dash-list" data-list="pending"><p class="dash-none">No new orders.</p></div>
    </div>
    <div class="dash-col">
      <h2>Accepted <span class="count" data-count="accepted">0</span></h2>
      <div class="dash-list" data-list="accepted"><p class="dash-none">Nothing in progress.</p></div>
    </div>
    <div class="dash-col dash-col-done">
      <h2>Done today</h2>
      <div class="dash-list" data-list="done"><p class="dash-none">Nothing yet today.</p></div>
    </div>
  </section>
</main>
<div class="dash-alert" data-alert hidden><p>New order!</p></div>
</body>
</html>
`;
}
