-- Run once in Supabase → SQL Editor.
-- Adds a "loaned" flag to books, plus a private "loaned to" note that only the book's owner can see.
-- The note lives in its own table because Row Level Security hides rows, not columns:
-- a column on books would be readable by every signed-in user.

alter table public.books add column if not exists loaned boolean not null default false;

create table if not exists public.book_loans (
  book_id   bigint primary key references public.books (id) on delete cascade,
  owner     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  loaned_to text check (char_length(loaned_to) <= 200)
);

alter table public.book_loans enable row level security;

drop policy if exists "owners manage their loan notes" on public.book_loans;
create policy "owners manage their loan notes"
  on public.book_loans for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid()
              and exists (select 1 from public.books b where b.id = book_id and b.created_by = auth.uid()));
