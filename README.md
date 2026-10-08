# Book Catalog

A small book catalog that runs entirely on free tiers:

| Piece | Service | Free tier |
|---|---|---|
| Hosting | GitHub Pages | Free for public repos |
| Database + REST API | Supabase (Postgres) | 500 MB DB, 2 projects |
| Login | Supabase Auth (email + password) | 50k monthly users |
| Cover images | Open Library Covers API | Free, no key needed |

The site is static (HTML, CSS, and JavaScript, with no build step). Only signed-in users can see the catalog. They can add books and can edit or delete only the books they added. Row Level Security in Postgres enforces those rules (see `schema.sql`), so it's safe for the anon key to be public.

## 1. Create the database (Supabase)

1. Sign up at https://supabase.com and create a **New project** (Free plan).
2. Open **SQL Editor → New query**, paste the contents of `schema.sql`, and click **Run**. If you set the database up before `migrations/` existed, run each file in `migrations/` the same way.
3. Go to **Project Settings → API Keys**. Copy the **Publishable key** (or the legacy **anon** key) and the **Project URL** into `config.js`.

### Login

There's no sign-up on the site. Only people you add can sign in:

1. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". This also blocks sign-ups made by calling the API directly.
2. Add each user under **Authentication → Users → Add user → Create new user**. Enter their email and a password, and check **Auto Confirm User**.

To reset someone's password, open their user in **Authentication → Users**.

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
