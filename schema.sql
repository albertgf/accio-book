-- Run this once in Supabase: Dashboard → SQL Editor → New query → Run.

create table if not exists public.books (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 300),
  author      text not null check (char_length(author) between 1 and 200),
  year        int  check (year between 0 and 2100),
  isbn        text check (isbn ~ '^[0-9Xx-]{10,17}$'),
  genre       text,
  notes       text check (char_length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Shown on the card as "added by". The part of the user's email before "@".
  added_by    text default split_part(auth.jwt() ->> 'email', '@', 1)
);

alter table public.books enable row level security;

-- Anyone (even logged out) can browse the catalog.
create policy "books are public"
  on public.books for select
  using (true);

-- Only signed-in users can add books, and only as themselves.
create policy "signed-in users can add"
  on public.books for insert to authenticated
  with check (auth.uid() = created_by
              and added_by = split_part(auth.jwt() ->> 'email', '@', 1));

-- Users can only change or remove the books they added.
create policy "owners can update"
  on public.books for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by
              and added_by = split_part(auth.jwt() ->> 'email', '@', 1));

create policy "owners can delete"
  on public.books for delete to authenticated
  using (auth.uid() = created_by);
