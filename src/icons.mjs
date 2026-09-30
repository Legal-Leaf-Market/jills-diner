// Hand-drawn style illustrations for the house favorites, plus the small UI
// icons. Everything is inline SVG so the page needs no image requests.

const INK = '#211C18';
const s = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

const plate = (cy = 84, rx = 50, ry = 16) => `
  <ellipse cx="60" cy="${cy}" rx="${rx}" ry="${ry}" fill="#FFFFFF" ${s()}/>
  <ellipse cx="60" cy="${cy - 1}" rx="${rx - 14}" ry="${ry - 6}" fill="none" stroke="${INK}" stroke-opacity=".18" stroke-width="2"/>`;

// A breaded edge: an ellipse whose radius wobbles, smoothed through midpoints.
// Deterministic, so the drawing is identical on every build.
function crumbly(cx, cy, rx, ry, points = 44) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const wobble = 1 + 0.035 * Math.sin(i * 2.7) + 0.025 * Math.cos(i * 5.3);
    pts.push([cx + Math.cos(t) * rx * wobble, cy + Math.sin(t) * ry * wobble]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const f = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  let d = `M${f(mid(pts[points - 1], pts[0]))}`;
  for (let i = 0; i < points; i++) d += `Q${f(pts[i])} ${f(mid(pts[i], pts[(i + 1) % points]))}`;
  return d + 'Z';
}

const steam = (x) => `
  <path d="M${x} 30c-5-5 5-8 0-14" fill="none" ${s(2.5)} stroke-opacity=".55"/>
  <path d="M${x + 12} 27c-5-5 5-8 0-14" fill="none" ${s(2.5)} stroke-opacity=".55"/>`;

export const art = {
  biscuits: `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  ${steam(50)}
  ${plate(86)}
  <path d="M24 80c-3-14 4-24 18-24s21 9 18 24z" fill="#E2A75A" ${s()}/>
  <path d="M58 80c-3-16 5-27 20-27s23 10 20 27z" fill="#E9B468" ${s()}/>
  <path d="M26 66c2-12 16-15 25-10 6-9 24-12 36-5 9 5 11 12 7 17-2 3-2 8-6 8s-3-6-7-6-4 5-8 5-4-6-9-5-4 7-9 7-4-6-8-6-5 5-9 5-4-5-8-5c-3 0-5-2-4-5z" fill="#F4EDE0" ${s()}/>
  <g fill="${INK}">
    <circle cx="40" cy="61" r="1.5"/><circle cx="52" cy="58" r="1.3"/><circle cx="63" cy="54" r="1.5"/>
    <circle cx="74" cy="56" r="1.3"/><circle cx="85" cy="60" r="1.5"/><circle cx="47" cy="66" r="1.2"/>
    <circle cx="69" cy="63" r="1.3"/><circle cx="80" cy="66" r="1.2"/><circle cx="58" cy="65" r="1.2"/>
  </g>
</svg>`,

  mush: `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  ${plate(86)}
  <rect x="20" y="60" width="36" height="22" rx="5" fill="#DE9A35" ${s()} transform="rotate(-9 38 71)"/>
  <rect x="64" y="60" width="36" height="22" rx="5" fill="#DE9A35" ${s()} transform="rotate(8 82 71)"/>
  <rect x="41" y="52" width="38" height="23" rx="5" fill="#EDB24C" ${s()} transform="rotate(-3 60 63)"/>
  <g stroke="#B8741F" stroke-width="2" stroke-linecap="round" opacity=".8">
    <path d="M47 58l5 1M66 57l6 1M50 69l4 0M68 68l5 0"/>
    <path d="M27 67l4 0M30 75l4 0M77 69l5 1M83 76l4 0"/>
  </g>
  <rect x="53" y="45" width="15" height="11" rx="2.5" fill="#F9DF83" ${s(2.5)} transform="rotate(-10 60 50)"/>
  <path d="M55 47l9-1" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8" transform="rotate(-10 60 50)"/>
</svg>`,

  big: `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <ellipse cx="60" cy="70" rx="54" ry="34" fill="#FFFFFF" ${s()}/>
  <ellipse cx="60" cy="70" rx="42" ry="25" fill="none" stroke="${INK}" stroke-opacity=".18" stroke-width="2"/>
  <path d="M73 78l24-6 5 18-24 6z" fill="#D8964A" ${s()}/>
  <path d="M77 80l17-4 3 11-17 4z" fill="#EFC27E" stroke="none"/>
  <path d="M60 50c5-7 11 1 16-5s11 1 16-4" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
  <path d="M60 50c5-7 11 1 16-5s11 1 16-4" fill="none" stroke="#A9412B" stroke-width="6" stroke-linecap="round"/>
  <path d="M60 50c5-7 11 1 16-5s11 1 16-4" fill="none" stroke="#EDA58D" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M62 61c5-7 11 1 16-5s11 1 16-4" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
  <path d="M62 61c5-7 11 1 16-5s11 1 16-4" fill="none" stroke="#A9412B" stroke-width="6" stroke-linecap="round"/>
  <path d="M62 61c5-7 11 1 16-5s11 1 16-4" fill="none" stroke="#EDA58D" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M20 64c-4-10 8-17 16-12 9-6 20 2 16 11 5 8-5 15-14 11-9 5-22-2-18-10z" fill="#FFFFFF" ${s()}/>
  <circle cx="36" cy="64" r="7" fill="#F2B632" ${s(2.5)}/>
  <circle cx="34" cy="62" r="2" fill="#FFF3C4"/>
  <path d="M34 84c-3-8 6-13 13-9 7-5 16 1 13 9 4 6-4 12-11 9-7 4-18-2-15-9z" fill="#FFFFFF" ${s()}/>
  <circle cx="47" cy="84" r="6" fill="#F2B632" ${s(2.5)}/>
  <circle cx="45.5" cy="82.5" r="1.7" fill="#FFF3C4"/>
</svg>`,

  tenderloin: `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <path d="M34 76h52c0 10-6 14-26 14s-26-4-26-14z" fill="#E6AD5E" ${s()}/>
  <path d="${crumbly(60, 64, 53, 15)}" fill="#D18D38" ${s()}/>
  <g fill="#9C5E1E" opacity=".75">
    <circle cx="18" cy="62" r="1.6"/><circle cx="28" cy="69" r="1.4"/><circle cx="40" cy="58" r="1.5"/>
    <circle cx="96" cy="60" r="1.6"/><circle cx="104" cy="67" r="1.4"/><circle cx="86" cy="71" r="1.5"/>
    <circle cx="14" cy="69" r="1.2"/><circle cx="108" cy="61" r="1.2"/><circle cx="24" cy="57" r="1.2"/>
  </g>
  <path d="M34 56c4-4 8 0 12-3s8 1 12-2 8 1 12-2 8 1 12-2 6 2 6 4" fill="none" stroke="#5E9B45" stroke-width="5" stroke-linecap="round"/>
  <path d="M33 55c0-18 13-26 27-26s27 8 27 26z" fill="#E9B266" ${s()}/>
  <g fill="#FFF6E2" stroke="${INK}" stroke-width="1.2">
    <ellipse cx="50" cy="39" rx="2.4" ry="1.4" transform="rotate(-20 50 39)"/>
    <ellipse cx="62" cy="36" rx="2.4" ry="1.4"/>
    <ellipse cx="72" cy="42" rx="2.4" ry="1.4" transform="rotate(25 72 42)"/>
    <ellipse cx="58" cy="46" rx="2.4" ry="1.4" transform="rotate(10 58 46)"/>
  </g>
</svg>`,

  shake: `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <path d="M72 44l18-34" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
  <path d="M72 44l18-34" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
  <path d="M74.5 39l3-5.5M79.5 29.5l3-5.5M84.5 20l3-5.5" stroke="#C2302A" stroke-width="5" stroke-linecap="butt"/>
  <path d="M36 50h48l-9 56H45z" fill="#F4B7C1" ${s()}/>
  <path d="M50 58l3 42M70 58l-3 42" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
  <path d="M40 108h40" ${s(5)}/>
  <path d="M31 51c-4-8 4-15 12-12 1-10 16-14 22-6 8-5 20 1 18 11 6 1 7 7 4 9z" fill="#FFFFFF" ${s()}/>
  <path d="M60 28c0-7 4-12 10-15" fill="none" ${s(2.5)}/>
  <circle cx="59" cy="31" r="7.5" fill="#C2302A" ${s()}/>
  <circle cx="56.5" cy="28.5" r="2" fill="#FFFFFF" opacity=".75"/>
</svg>`,

  pie: `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  ${plate(90, 52, 15)}
  <path d="M14 76l92-16v16L14 94z" fill="#F6D56F" ${s()}/>
  <path d="M14 94l92-18v8L14 101z" fill="#D39247" ${s()}/>
  <path d="M100 54c6 0 8 4 6 8l-4 2" fill="#D39247" ${s()}/>
  <path d="M12 77c5-6 10-4 15-8 5-5 10-1 15-6 5-6 11-1 16-7 5-5 11 0 16-6 6-6 12 0 18-5 5-3 12 0 14 5L14 78z" fill="#FFF9EE" ${s()}/>
  <path d="M29 67c2-2 5-2 7-1M49 60c2-2 5-2 7-1M68 54c2-2 5-2 7-1M86 49c2-2 5-2 7-1" fill="none" stroke="#E0A659" stroke-width="3" stroke-linecap="round"/>
</svg>`,
};

// UI icons: 24px grid, drawn with currentColor so they follow the text color.
const ui = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}${extra}</svg>`;

export const icon = {
  phone: ui('<path d="M6.6 3.5h2.8l1.5 4.2-2.1 1.5a12.5 12.5 0 0 0 6 6l1.5-2.1 4.2 1.5v2.8a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>'),
  pin: ui('<path d="M12 21.5s-7-6.3-7-11.5a7 7 0 1 1 14 0c0 5.2-7 11.5-7 11.5z"/><circle cx="12" cy="10" r="2.6"/>'),
  clock: ui('<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>'),
  menu: ui('<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2.2 1.4-3.5 4-3.5 7.3 0 2 1.2 3.2 3.5 3.2"/>'),
  arrow: ui('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  print: ui('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  facebook: ui('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M15.5 8H14a2 2 0 0 0-2 2v11M9.5 13h5"/>'),
  car: ui('<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3.5 16h17v3h-3v-1.5h-11V19h-3z"/><circle cx="8" cy="13" r="1"/><circle cx="16" cy="13" r="1"/>'),
};
