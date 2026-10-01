# Set up online ordering for Jill's Diner

**For Claude in Chrome.** You're setting up the online pickup ordering that's
already built into the Jill's Diner website. All the code is done and live
behind an off switch. Your job is the account setup in three websites:
Supabase (database), Netlify (hosting) and GitHub (the code).

Work through the parts in order. Each one ends with a check; don't move on
until it passes. **Stop and ask the user** wherever this says **ASK**. Never
pick a paid plan, never delete anything, and never paste a secret key anywhere
except the one Netlify field named below.

## What you need to know

- Code: GitHub repo **`Legal-Leaf-Market/jills-diner`**, branch `main`.
- Hosting: the Netlify site connected to that repo (probably named
  `jills-diner`). Every push to `main` redeploys it automatically.
- The database rules are in the repo at `supabase/schema.sql`:
  https://github.com/Legal-Leaf-Market/jills-diner/blob/main/supabase/schema.sql
- Three values move from Supabase to Netlify:

  | Netlify variable name | Where it comes from in Supabase | Secret? |
  | --- | --- | --- |
  | `SUPABASE_URL` | Project URL, like `https://abcdxyz.supabase.co` | No |
  | `SUPABASE_ANON_KEY` | The **anon** key or the **publishable** key (`sb_publishable_...`) | No, public by design |
  | `SUPABASE_SERVICE_ROLE_KEY` | The **service_role** key or a **secret** key (`sb_secret_...`) | **Yes** |

---

## Part 1: Create the Supabase project

1. Go to https://supabase.com/dashboard and sign in. If the user has no
   account, **ASK** them to sign up (GitHub sign-in is easiest) and tell you
   when they're done.
2. Create a new project:
   - Organization: the user's existing one, or create one called
     `Legal Leaf`, on the **Free** plan. If anything asks for a card or a paid
     plan, **stop and ASK**.
   - Project name: `jills-diner`
   - Database password: use Supabase's **Generate a password** button. Then
     **ASK** the user to save it in their password manager before you
     continue. It won't be shown again, and you don't need it for anything
     else.
   - Region: **East US (Ohio)**, or the closest US East option offered.
3. Wait until the project finishes setting up (a minute or two).

**Check:** the project dashboard loads and doesn't say it's still provisioning.

## Part 2: Create the tables and security rules

1. In a new tab, open
   https://github.com/Legal-Leaf-Market/jills-diner/blob/main/supabase/schema.sql
   and click the **Raw** button. Select all the text and copy it. (The repo is
   private; the user is signed in to GitHub in this browser.)
2. Back in Supabase, open **SQL Editor** in the left sidebar and start a new
   query.
3. Paste the whole file and click **Run**.
4. If Supabase warns that the query includes destructive operations
   (`drop policy if exists`, `drop trigger if exists`), confirm. Those lines
   only replace rules this same file creates; the database is brand new.

**Check:** the result says "Success. No rows returned" (notices are fine). Then
open **Table Editor** and confirm the tables `orders` and `staff` exist.

## Part 3: Lock down sign-ups

1. Go to **Authentication**, then **Sign In / Providers** (on older layouts it
   may be under Authentication > Providers or Settings).
2. Turn **off** "Allow new users to sign up" and save.

**Check:** the setting shows as off after reloading the page.

## Part 4: Create the tablet login

1. **ASK** the user what email and password the diner tablet should sign in
   with. Suggest an address the diner controls, and a password of at least 12
   characters. Let the user type the password themselves if they prefer.
2. Go to **Authentication > Users**, click **Add user > Create new user**,
   enter that email and password, and tick **Auto Confirm User**. Create it.
3. Open **SQL Editor**, start a new query, and run this with the real email in
   place of the placeholder:

   ```sql
   insert into public.staff (user_id, name)
   select id, 'Diner tablet' from auth.users where email = 'THE-TABLET-EMAIL'
   on conflict do nothing;

   select s.name, u.email from public.staff s join auth.users u on u.id = s.user_id;
   ```

**Check:** the second statement returns one row showing `Diner tablet` and the
tablet's email. If it returns nothing, the email didn't match exactly; fix it
and run the insert again.

## Part 5: Collect the three values

1. Go to **Project Settings** (the gear), then **Data API** or **API**, and
   copy the **Project URL**. That's `SUPABASE_URL`.
2. Go to **Project Settings > API Keys**.
   - If you see **Publishable and secret API keys**, use the publishable key
     (`sb_publishable_...`) for `SUPABASE_ANON_KEY`. For
     `SUPABASE_SERVICE_ROLE_KEY`, create a secret key named `netlify-orders`
     if none exists, and reveal and copy it (`sb_secret_...`).
   - If you only see **Legacy API keys**, use `anon` for `SUPABASE_ANON_KEY`
     and `service_role` (click Reveal) for `SUPABASE_SERVICE_ROLE_KEY`.
3. Keep these in the browser only long enough to paste them into Netlify in
   the next part. Don't put the secret key in a note, a doc, a chat, or a
   GitHub file.

## Part 6: Add the values to Netlify

1. Go to https://app.netlify.com, find the site connected to
   `Legal-Leaf-Market/jills-diner`, and open it. Note the site's address (like
   `https://jills-diner.netlify.app`) for later.
2. Open **Site configuration > Environment variables** and click **Add a
   variable** (choose "Add a single variable") for each:

   | Key | Value | Settings |
   | --- | --- | --- |
   | `SUPABASE_URL` | the Project URL | All scopes, same value for all deploy contexts |
   | `SUPABASE_ANON_KEY` | the anon or publishable key | All scopes, same value for all deploy contexts |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role or secret key | Tick **Contains secret values**. Scope: **Functions** only. Same value for all deploy contexts |

3. Redeploy so the build picks them up: **Deploys > Trigger deploy > Clear
   cache and deploy site**. Wait until it shows **Published**.

**Check:** open the deploy log and find a line near the end of the build that
says `dashboard configured`. If it says `dashboard not configured`, one of the
two non-secret variables is missing or misspelled; fix it and redeploy.

## Part 7: Test the tablet screen

1. Open `https://<the site address>/dashboard/`.
2. Sign in with the tablet email and password from Part 4.
3. Tap **Start taking orders**. You should hear a short chime.

**Check:** the screen shows three columns (New, Accepted, Done today) and a
green **Live** light at the top. If it says "This account isn't on the staff
list", redo Part 4, step 3. If it says "Not set up yet", redo Part 6.

At this point everything is ready, but customers still can't order: the
**+ Add** buttons only appear once ordering is switched on.

## Part 8: Switch ordering on (only with the user's go-ahead)

**ASK the user before doing this part:** "Everything is set up. Turning
ordering on makes the + Add buttons live for real customers. Only do it once
Jill has agreed and someone will keep the tablet on and watch it during open
hours. Turn it on now?" If they say no or not yet, stop here and tell them
this part is the only thing left.

If they say yes:

1. Open
   https://github.com/Legal-Leaf-Market/jills-diner/edit/main/content/site.json
2. Change the line `"ordering": false,` to `"ordering": true,`. Change nothing
   else.
3. Click **Commit changes**, use the message `Turn on online ordering`, and
   commit directly to `main`.
4. Wait for Netlify to show the new deploy as **Published** (about a minute).

**Check with a test order:**

1. Open the site's home page and confirm the menu items now show **+ Add**
   buttons.
2. Add one cheap item (a side, $2.75), open **Your order**, and fill in the
   name `Test Order`, the user's own phone number (**ASK** for it), the
   earliest pickup time, and the note `TEST, please ignore`. Place the order.
3. Confirm the page says "Order #1 is in!" (or another number).
4. On the tablet screen from Part 7, confirm the order appeared within a few
   seconds with a chime. Tap **Cancel**, then tap it again to confirm, so the
   kitchen never sees it as real.

## When you're done

Tell the user, in plain words:

- The site address and the tablet address (`/dashboard/`).
- The tablet email (never the password).
- Whether ordering is on or still off.
- That to pause ordering any time, they change `"ordering": true` back to
  `false` in `content/site.json` on GitHub, same as Part 8.
- That the database password and tablet password should be in their password
  manager, and the secret key exists only in Netlify.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| SQL run fails with an error | Copy the exact error message to the user and stop. Don't try to edit the SQL. |
| Customer checkout says "Online ordering isn't open right now" | `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_URL` is missing from Netlify (or wasn't scoped to Functions), or ordering is off. Fix the variable and redeploy. |
| Checkout says "We couldn't send your order" | The service key is wrong, or the schema wasn't run. Check Part 2's tables exist and re-copy the key into Netlify, then redeploy. |
| Tablet light stays red ("Reconnecting") | Reload the page. If it persists, check in Supabase that **Database > Publications > supabase_realtime** includes the `orders` table; if not, rerun the schema from Part 2. |
| Any page asks for payment or a plan upgrade | Stop and ASK the user. |
