# Jill's Diner

Website for **Jill's Diner**, 3005 N. National Road, Columbus, Indiana.
Breakfast and lunch, Tuesday to Sunday.

This is a **preview build** made to show Jill. Every page is marked `noindex`, so
Google won't list it, and the footer says it's a preview. Nothing here collects
information or takes payments. The phone and directions buttons go to the real
diner.

## What's on the site

- **Home page** (`/`): the "we moved" banner, live open/closed badge, house
  favorites, the full menu, hours with today highlighted, map and directions,
  and the diner's story back to 1952.
- **Menu page** (`/menu/`): the same menu on its own page, easy to text to
  someone, and it prints on one sheet of paper.
- **Phone-first**: a sticky Call / Directions / Menu bar on phones. Directions
  open Apple Maps on iPhones and Google Maps everywhere else.
- **The letter board**: the sign in the header art reads from
  `content/site.json`, so it can say whatever the real board at the diner says.

## Changing things

Everything a person might want to change lives in two files:

| File | What's in it |
| --- | --- |
| `content/site.json` | Phone, address, hours, the letter board, the story timeline, the Facebook link, preview on/off |
| `content/menu.json` | The menu sections and items, and the six "house favorites" cards |

Menu items take an optional `desc` (one short line), `tag` (a small badge like
"Regulars' pick") and `price` (just the number, like `"6.49"`). A price only
shows up if it's filled in.

Hours use the 24-hour clock (`"06:00"`, `"14:00"`, `"12:45"`). The open/closed
badge always uses Indiana time, wherever the visitor is.

The build checks your edits and stops with a plain-English message if something
is off, like a closing time before an opening time or a misspelled day.

## Running it

No installs needed, just Node 18 or newer.

```bash
npm run build   # writes the finished site to dist/
npm run dev     # build, then preview at http://localhost:4321
```

## Hosting

The repo is linked to Vercel: every push to `main` redeploys the site in about
half a minute. `netlify.toml` is also included, so the same repo can go on
Netlify with no changes.

## Before it goes live

1. **Confirm the facts with Jill.** Everything on the site came from public
   listings and newspaper coverage, not from the diner itself:
   - Phone (812) 418-8970, the long-time downtown number, which listings show
     carried over to National Road.
   - Hours: Tuesday to Friday 6 AM to 2 PM, Saturday 7 AM to 12:45 PM, Sunday
     8 AM to 12:45 PM, closed Monday.
   - Menu names and what's actually on the menu today. The 7th Street Special,
     Washington St. Special and Downtown Sampler come from the downtown menu
     and may have been renamed. Descriptions for those three are placeholders.
   - Prices are deliberately left off. The only prices online are from 2020.
2. **Ask Jill about the story section.** The timeline (Gerald I. Davis in 1952,
   the Stotts, Sadie Cress, the Kramers, Jill in 2008) comes from reporting in
   *The Republic*. She may want to add to it or tell it differently.
3. **Photos.** Real photos of the food, the counter and the family (with their
   permission) will do more than any drawing.
4. **Flip the switch.** In `content/site.json` set `"preview": false`. That
   removes `noindex` and the preview note, and adds `robots.txt` and a sitemap.
5. **Domain.** Buy one, point it at Vercel, and update `"url"` in
   `content/site.json`.
6. **Google Business Profile and Facebook.** Make sure both show the National
   Road address and hours, and link to the new site. The Google profile is what
   people see when they search "diner near me", so it matters most.

## Deliberately left out

- Jill's health, and the circumstances of leaving Seventh Street. Those are hers
  to share if she wants to.
- Star ratings and quoted reviews. Rating markup without real reviews shown on
  the page breaks Google's rules, and the reviews online are mostly from the
  downtown days anyway.
- Old prices, for the reason above.

## Sources used for the preview

- *The Republic*: "Decades of a diner" (Feb 2017), "A tribute to a true American
  diner, right here in Columbus" (Oct 2024), "Moving on: Jill's Downtown Diner
  evicted" (Feb 2025), "Jill's Downtown Diner finds new home" (Jul 2025).
- Yelp, Tripadvisor, Checkle and The Menyu App listings for menu items, hours
  and the phone number.
- Rural King (2985 N. National Rd) and Disc Replay (3015 N. National Rd)
  listings to pin down the landmark and ZIP code.

## Under the hood

- `build.mjs`: reads `content/`, renders `src/render.mjs`, copies `public/` into
  `dist/`. No dependencies.
- `src/icons.mjs`: the dish drawings and small icons, all inline SVG.
- `public/styles.css`, `public/app.js`: styling and the small bits of behavior
  (open/closed badge, menu jump bar, Apple Maps on iPhone, print button).
- `public/fonts/`: Oswald, Libre Franklin and Yellowtail, self-hosted so the
  site makes no third-party font requests. Licenses sit next to the files.
- `public/og.png`: the preview image that shows up when the link is texted or
  shared.
