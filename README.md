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
"Local favorite"), and either `price` (just the number, like `"6.75"`) or
`prices` for labeled ones (cup and bowl, small and large). A section can have
one `price` for everything in it, `notes` under its heading, and `extras` for
add-ons.

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

Netlify, connected to this repo: every push to `main` redeploys in under a
minute. `netlify.toml` holds the build settings. If the Netlify site name
isn't `jills-diner`, update `"url"` in `content/site.json` to match.

## Online ordering (pickup, pay at the counter)

Customers add items from the menu to a cart, pick a pickup time and send the
order. It lands on a tablet at the diner (`/dashboard/`) the moment it's
placed, with a loud chime that repeats every 30 seconds until someone taps
**Accept** or **Cancel**. Each ticket has a big **Call** button that dials the
customer. Nobody pays online.

**It is switched off** until the steps below are done and Jill is ready to
watch the tablet. While it's off, the site looks exactly as before.

### How it fits together

| Piece | Where |
| --- | --- |
| Cart and checkout (saved in the browser, survives page changes) | `public/order.js` |
| Order endpoint `/api/order` (Netlify Function) | `netlify/functions/order/order.mjs` |
| Shared rules: what's orderable, prices, pickup times, validation | `src/order-core.mjs` |
| Staff tablet | `public/dashboard.js`, `public/dashboard.css`, page at `/dashboard/` |
| Database tables, access rules, realtime | `supabase/schema.sql` |

The server never trusts the browser. It re-prices every line from
`content/menu.json`, re-checks the pickup time against `content/site.json`
hours, normalizes the phone number, and refuses anything else. Pickup slots run
every 15 minutes, starting 15 minutes after opening and ending 15 minutes
before close, at least 20 minutes out, over the next two open days.

### Turning it on

1. **Create a Supabase project** at supabase.com (the free tier is plenty).
2. **Run the schema.** In the project, open SQL Editor, paste all of
   `supabase/schema.sql`, and run it. It's safe to run again later.
3. **Lock down sign-ups.** Authentication > Sign In / Providers: turn off
   "Allow new users to sign up". (Even if someone signs up, they see nothing
   unless they're on the staff list, but there's no reason to allow it.)
4. **Make the tablet login.** Authentication > Users > Add user, with an email
   and a strong password, auto-confirmed. Then in SQL Editor:
   ```sql
   insert into public.staff (user_id, name)
   select id, 'Diner tablet' from auth.users where email = 'THE-EMAIL-YOU-USED'
   on conflict do nothing;
   ```
5. **Add three environment variables in Netlify** (Site configuration >
   Environment variables). From Supabase, Project Settings > API:
   | Netlify variable | Supabase value | Secret? |
   | --- | --- | --- |
   | `SUPABASE_URL` | Project URL | no |
   | `SUPABASE_ANON_KEY` | anon / publishable key | no, it's public by design |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key | **yes**: mark it secret, scope it to Functions |
6. **Flip the switch.** In `content/site.json` set `"ordering": true`, commit
   and push. Netlify rebuilds and the **+ Add** buttons appear.
7. **Set up the tablet.** Open `https://<the-site>/dashboard/` on the diner's
   tablet, sign in, tap **Start taking orders** (browsers only allow sound
   after a tap), and turn the volume up. Add it to the home screen. Keep it
   plugged in; the page asks the screen to stay on.

To pause ordering any time (closed for a holiday, short-staffed), set
`"ordering": false` and push, or remove `SUPABASE_URL` in Netlify and
redeploy.

### Security, in short

- The service key exists only in Netlify's environment and the order function.
  It never reaches a browser or this repo.
- Customers can't read or write the database at all. Orders go in only through
  the function, which checks everything first and only accepts posts from the
  site itself.
- Staff can read orders and change an order's status, and nothing else. Being
  logged in isn't enough; the account must be on the staff list. Tested
  against a real Postgres: anonymous users, logged-in strangers and staff each
  get exactly the access above.
- Everything travels over HTTPS. Phone numbers are stored only to call about
  the order, and `public.purge_old_orders()` deletes orders older than 30 days
  (instructions for scheduling it daily are in `supabase/schema.sql`).
- Basic abuse limits: a hidden field that only bots fill in, size and quantity
  caps, and at most three waiting orders per phone number.

### Testing

`npm test` runs the order function against a fake Supabase (pricing,
validation, pickup times, the security checks). The cart and the tablet were
tested end to end in headless Chromium, including the realtime arrival, chime,
Accept, two-tap Cancel, and Picked up.

## Before it goes live

1. **Show Jill.** The menu, prices, phone number and hours now come straight
   from the diner's own printed menu (summer 2026). The phone on that menu is
   (812) 799-0016, and Saturday and Sunday close at 12:45 PM (per Google; the printed
   menu says 1 PM). If anything has
   changed since it was printed, edit `content/menu.json` or `content/site.json`.
2. **Ask Jill about the story section.** The timeline (Gerald I. Davis in 1952,
   the Stotts, Sadie Cress, the Kramers, Jill in 2008) comes from reporting in
   *The Republic*. She may want to add to it or tell it differently.
3. **Photos.** Real photos of the food, the counter and the family (with their
   permission) will do more than any drawing.
4. **Flip the switch.** In `content/site.json` set `"preview": false`. That
   removes `noindex` and the preview note, and adds `robots.txt` and a sitemap.
5. **Domain.** Buy one, point it at Netlify, and update `"url"` in
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

## Sources used for the preview

- *The Republic*: "Decades of a diner" (Feb 2017), "A tribute to a true American
  diner, right here in Columbus" (Oct 2024), "Moving on: Jill's Downtown Diner
  evicted" (Feb 2025), "Jill's Downtown Diner finds new home" (Jul 2025).
- The diner's own printed menu (summer 2026) for every item, price, the phone
  number and the hours.
- Rural King (2985 N. National Rd) and Disc Replay (3015 N. National Rd)
  listings to pin down the landmark and ZIP code.

## Under the hood

- `build.mjs`: reads `content/`, renders `src/render.mjs`, copies `public/` into
  `dist/`. No dependencies.
- `src/icons.mjs`: the dish drawings and small icons, all inline SVG.
- `public/styles.css`, `public/app.js`: styling and the small bits of behavior
  (open/closed badge, menu jump bar, Apple Maps on iPhone, print button).
- `public/vendor/`: supabase-js 2.117.2 (MIT), served from the site itself for
  the staff tablet.
- `public/fonts/`: Oswald, Libre Franklin and Yellowtail, self-hosted so the
  site makes no third-party font requests. Licenses sit next to the files.
- `public/og.png`: the preview image that shows up when the link is texted or
  shared.
