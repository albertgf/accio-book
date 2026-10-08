-- Run once in Supabase → SQL Editor.
-- Makes the catalog private: only signed-in users can read books.

drop policy if exists "books are public" on public.books;
drop policy if exists "signed-in users can read" on public.books;
create policy "signed-in users can read"
  on public.books for select to authenticated
  using (true);
