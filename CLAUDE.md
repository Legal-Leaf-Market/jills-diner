# CLAUDE.md: Jill's Diner website

Static site for Jill's Diner (3005 N. National Road, Columbus, IN), built as a
free preview to pitch to the owner, Jill. See README.md for the full picture.

## Standing rules

- **No em dashes anywhere a person reads** (owner of this repo's directive).
  Restructure the sentence instead. The only dash allowed is the en dash inside
  numeric or time ranges (6 AM – 2 PM). `build.mjs` fails the build if an em
  dash lands in `content/`.
- **Facts live in `content/site.json` and `content/menu.json` only.** The page,
  hours table, open/closed badge and JSON-LD all read from there. Never hardcode
  a phone number, address or hour in a template.
- **Never invent facts about the diner.** No made-up prices, dish descriptions,
  quotes, reviews, awards or history. If something isn't confirmed, leave it
  out or mark it for Jill to confirm. No `AggregateRating` markup unless real
  reviews are shown on the page.
- **Keep Jill's health and the eviction off the site** unless she asks for them.
- **Stay dependency-free.** The build is plain Node; don't add a framework or
  npm packages without a real reason.
- `"preview": true` in `site.json` keeps the pages `noindex` and shows the
  preview note. Only flip it once Jill has approved the site.

## Checking work

- `npm run build` must pass.
- Layout changes get checked in headless Chromium at 360, 390, 768, 1280 and
  1440 px wide with no horizontal scroll, and `/menu/` must still print on one
  Letter page.
- The open/closed badge uses Indiana time regardless of the visitor's time
  zone; test edge times (just before open, 30 minutes before close, Monday,
  Sunday night) after touching `public/app.js`.

## Unconfirmed (verify with Jill before launch)

- Phone (812) 418-8970 carried over from downtown.
- Hours: Tue to Fri 6:00 to 14:00, Sat 7:00 to 12:45, Sun 8:00 to 12:45, Mon closed.
- Whether the 7th Street Special, Washington St. Special and Downtown Sampler
  kept their names, and what's in them.
- Current prices (none shown).
