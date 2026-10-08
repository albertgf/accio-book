# Book Catalog

A small book catalog that runs entirely on free tiers:

| Piece | Service | Free tier |
|---|---|---|
| Hosting | GitHub Pages | Free for public repos |
| Database + REST API | Supabase (Postgres) | 500 MB DB, 2 projects |
| Login | Supabase Auth (email + password) | 50k monthly users |
| Cover images | Open Library Covers API | Free, no key needed |

The site is static (HTML, CSS, and JavaScript, with no build step). Anyone can browse it. Signed-in users can add books and can edit or delete only the books they added. Row Level Security in Postgres enforces those rules (see `schema.sql`), so it's safe for the anon key to be public.

## 1. Create the database (Supabase)

1. Sign up at https://supabase.com and create a **New project** (Free plan).
2. Open **SQL Editor → New query**, paste the contents of `schema.sql`, and click **Run**.
3. Go to **Project Settings → API Keys**. Copy the **Publishable key** (or the legacy **anon** key) and the **Project URL** into `config.js`.

### Login

Users sign up and sign in with their email and a password. By default, Supabase sends a confirmation email after sign-up. The built-in sender only sends a few emails per hour. To skip confirmation, turn off **Confirm email** under **Authentication → Sign In / Providers → Email**.

**Invite-only:** to stop strangers from creating accounts, turn off **Allow new users to sign up** under **Authentication → Sign In / Providers**. Then add users yourself under **Authentication → Users → Add user**, with **Auto Confirm User** checked.

## 2. Try it locally

```bash
cd book-catalog
python3 -m http.server 8000
```

Open http://localhost:8000.

## 3. Deploy (GitHub Pages)

1. Create a new public GitHub repo, for example `book-catalog`, and push these files to it:
   ```bash
   git init && git add . && git commit -m "Book catalog"
   git branch -M main
   git remote add origin https://github.com/<you>/book-catalog.git
   git push -u origin main
   ```
2. In the repo, go to **Settings → Pages**. Set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, then save.
3. After about a minute the site is live at `https://<you>.github.io/book-catalog/`.

Cloudflare Pages and Netlify also work. Point either one at the repo with no build command and `/` as the output directory.

## Notes

- **Inactive projects pause:** Supabase pauses free projects after about a week with no activity. Click **Restore** in the dashboard to bring yours back.
- **Restricting who can add books:** change the insert policy in `schema.sql`, for example to `with check (auth.uid() = created_by and auth.email() = 'you@example.com')`.
