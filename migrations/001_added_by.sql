-- Run once in Supabase → SQL Editor if you already ran the original schema.sql.
-- Stores who added each book (the part of their email before "@"), filled in by the database.

alter table public.books
  add column if not exists added_by text
  default split_part(auth.jwt() ->> 'email', '@', 1);

-- Don't let users claim someone else's name.
drop policy if exists "signed-in users can add" on public.books;
create policy "signed-in users can add"
  on public.books for insert to authenticated
  with check (auth.uid() = created_by
              and added_by = split_part(auth.jwt() ->> 'email', '@', 1));

drop policy if exists "owners can update" on public.books;
create policy "owners can update"
  on public.books for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by
              and added_by = split_part(auth.jwt() ->> 'email', '@', 1));

-- Fill in "added by" for books that existed before this column.
update public.books b
  set added_by = split_part(u.email, '@', 1)
  from auth.users u
  where u.id = b.created_by and b.added_by is null;
