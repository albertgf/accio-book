import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = (sel) => document.querySelector(sel);
const els = {
  banner: $("#banner"), status: $("#status"), list: $("#books"),
  search: $("#search"), genre: $("#genre-filter"), sort: $("#sort"), genres: $("#genres"),
  main: $("main"), signedOut: $("#signed-out"), addBtn: $("#add-btn"), loginForm: $("#login-form"), loginUser: $("#login-user"), loginPass: $("#login-pass"),
  logoutBtn: $("#logout-btn"), userEmail: $("#user-email"),
  dialog: $("#book-dialog"), form: $("#book-form"), dialogTitle: $("#dialog-title"),
  cancelBtn: $("#cancel-btn"),
};

let books = [];
let user = null;
let editingId = null;

const configured = !SUPABASE_URL.includes("YOUR-PROJECT") && !SUPABASE_ANON_KEY.includes("YOUR-ANON");
const db = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function showBanner(msg) {
  els.banner.textContent = msg;
  els.banner.hidden = !msg;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------- Auth ----------

function setUser(u) {
  const changed = user?.id !== u?.id;
  user = u;
  els.userEmail.textContent = u ? `Signed in as ${u.email}` : "";
  els.loginForm.hidden = !!u;
  els.logoutBtn.hidden = !u;
  els.addBtn.hidden = !u;
  // The catalog is only for signed-in users (also enforced by the database, see schema.sql).
  els.main.hidden = !u;
  els.signedOut.hidden = !!u;
  if (!changed) return;
  books = [];
  render();
  // Deferred: Supabase advises against calling it from inside onAuthStateChange.
  if (u) setTimeout(loadBooks, 0);
}

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = els.loginForm.querySelector("button");
  btn.disabled = true;
  const { error } = await db.auth.signInWithPassword({
    email: els.loginUser.value.trim(),
    password: els.loginPass.value,
  });
  btn.disabled = false;

  if (error) {
    const msg = error.message === "Invalid login credentials" ? "Wrong email or password." : error.message;
    showBanner(`Sign-in failed: ${msg}`);
  } else {
    showBanner("");
    els.loginForm.reset();
  }
});

els.logoutBtn.addEventListener("click", () => db.auth.signOut());

// ---------- Data ----------

async function loadBooks() {
  els.status.textContent = "Loading…";
  const [booksRes, loansRes] = await Promise.all([
    db.from("books").select("*"),
    // RLS only returns the current user's own loan notes.
    db.from("book_loans").select("book_id, loaned_to"),
  ]);
  if (booksRes.error) {
    els.status.textContent = `Could not load books: ${booksRes.error.message}`;
    return;
  }
  const loanedTo = new Map((loansRes.data ?? []).map((l) => [l.book_id, l.loaned_to]));
  books = booksRes.data.map((b) => ({ ...b, loaned_to: loanedTo.get(b.id) ?? null }));
  refreshGenres();
  render();
}

function refreshGenres() {
  const genres = [...new Set(books.map((b) => b.genre).filter(Boolean))].sort();
  const current = els.genre.value;
  els.genre.innerHTML = `<option value="">All genres</option>` +
    genres.map((g) => `<option>${escapeHtml(g)}</option>`).join("");
  els.genre.value = genres.includes(current) ? current : "";
  els.genres.innerHTML = genres.map((g) => `<option value="${escapeHtml(g)}">`).join("");
}

function visibleBooks() {
  const q = els.search.value.trim().toLowerCase();
  const genre = els.genre.value;
  const sortKey = els.sort.value.replace("-", "");
  const dir = els.sort.value.startsWith("-") ? -1 : 1;

  return books
    .filter((b) => !genre || b.genre === genre)
    .filter((b) => !q || [b.title, b.author, b.genre, b.notes, b.isbn, b.added_by, b.loaned_to].some((f) => f?.toLowerCase().includes(q)))
    .sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * dir;
    });
}

function coverHtml(b) {
  if (!b.isbn) return `<div class="cover">📕</div>`;
  const isbn = encodeURIComponent(b.isbn.replace(/-/g, ""));
  // ?default=false makes Open Library return 404 instead of a blank image, so onerror kicks in.
  return `<img class="cover" loading="lazy" alt=""
    src="https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false"
    onerror="this.outerHTML='<div class=&quot;cover&quot;>📕</div>'">`;
}

// The edition page when we have an ISBN, otherwise an Open Library search for title + author.
function openLibraryUrl(b) {
  if (b.isbn) return `https://openlibrary.org/isbn/${encodeURIComponent(b.isbn.replace(/-/g, ""))}`;
  const q = new URLSearchParams({ title: b.title, author: b.author });
  return `https://openlibrary.org/search?${q}`;
}

function loanHtml(b) {
  if (user?.id !== b.created_by) return b.loaned ? `<span class="tag loaned">On loan</span>` : "";
  return `
    <div class="loan">
      <label><input type="checkbox" data-loan-toggle="${b.id}" ${b.loaned ? "checked" : ""}> Loaned</label>
      ${b.loaned ? `
        <form class="loan-form" data-loan-form="${b.id}">
          <input class="loan-to" name="loaned_to" maxlength="200"
            placeholder="To whom?" value="${escapeHtml(b.loaned_to)}">
          <button type="submit">Save</button>
        </form>` : ""}
    </div>`;
}

function render() {
  const list = visibleBooks();
  els.status.textContent = books.length === 0
    ? (configured ? "No books yet." + (user ? " Add the first one!" : "") : "")
    : `${list.length} of ${books.length} books`;

  els.list.innerHTML = list.map((b) => `
    <li class="book" data-url="${escapeHtml(openLibraryUrl(b))}">
      ${coverHtml(b)}
      <div>
        <h3><a href="${escapeHtml(openLibraryUrl(b))}" target="_blank" rel="noopener">${escapeHtml(b.title)}</a></h3>
        <p class="meta">${escapeHtml(b.author)}${b.year ? ` · ${b.year}` : ""}</p>
        ${b.genre ? `<span class="tag">${escapeHtml(b.genre)}</span>` : ""}
        ${loanHtml(b)}
        ${b.notes ? `<p class="notes">${escapeHtml(b.notes)}</p>` : ""}
        <p class="small">
          ${b.isbn ? `ISBN ${escapeHtml(b.isbn)}<br>` : ""}
          ${b.added_by ? `Added by ${escapeHtml(b.added_by)}` : ""}
        </p>
        ${user?.id === b.created_by ? `
          <div class="actions">
            <button data-edit="${b.id}">Edit</button>
            <button class="danger" data-delete="${b.id}">Delete</button>
          </div>` : ""}
      </div>
    </li>`).join("");
}

// ---------- Add / edit / delete ----------

function openDialog(book = null) {
  editingId = book?.id ?? null;
  els.dialogTitle.textContent = book ? "Edit book" : "Add book";
  els.form.reset();
  for (const [k, v] of Object.entries(book ?? {})) {
    if (els.form.elements[k]) els.form.elements[k].value = v ?? "";
  }
  els.dialog.showModal();
}

els.addBtn.addEventListener("click", () => openDialog());
els.cancelBtn.addEventListener("click", () => els.dialog.close());

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(els.form);
  const row = {
    title: f.get("title").trim(),
    author: f.get("author").trim(),
    year: f.get("year") ? Number(f.get("year")) : null,
    genre: f.get("genre").trim() || null,
    isbn: f.get("isbn").trim() || null,
    notes: f.get("notes").trim() || null,
  };
  const query = editingId
    ? db.from("books").update(row).eq("id", editingId)
    : db.from("books").insert(row);
  const { error } = await query;
  if (error) return alert(`Save failed: ${error.message}`);
  els.dialog.close();
  loadBooks();
});

els.list.addEventListener("click", async (e) => {
  // Tapping anywhere on a card (except its buttons and the title link itself) opens Open Library.
  const card = e.target.closest(".book");
  if (card && !e.target.closest("button, a, input, label")) {
    window.open(card.dataset.url, "_blank", "noopener");
    return;
  }
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.delete;
  if (editId) openDialog(books.find((b) => b.id == editId));
  if (delId && confirm("Delete this book?")) {
    const { error } = await db.from("books").delete().eq("id", delId);
    if (error) return alert(`Delete failed: ${error.message}`);
    loadBooks();
  }
});

// Loan controls on the cards: no dialog needed.
els.list.addEventListener("change", async (e) => {
  const toggleId = e.target.dataset.loanToggle;
  if (toggleId) {
    const b = books.find((x) => x.id == toggleId);
    const prev = { loaned: b.loaned, loaned_to: b.loaned_to };
    b.loaned = e.target.checked;
    if (!b.loaned) b.loaned_to = null;
    render();
    if (b.loaned) els.list.querySelector(`[data-loan-form="${b.id}"] input`)?.focus();

    const { error } = await db.from("books").update({ loaned: b.loaned }).eq("id", b.id);
    const { error: noteError } = !error && !b.loaned
      ? await db.from("book_loans").delete().eq("book_id", b.id)
      : {};
    if (error || noteError) {
      Object.assign(b, prev);
      render();
      alert(`Could not update loan: ${(error ?? noteError).message}`);
    }
  }
});

// "To whom" is saved with its Save button (or Enter).
els.list.addEventListener("submit", async (e) => {
  const form = e.target.closest("[data-loan-form]");
  if (!form) return;
  e.preventDefault();
  const b = books.find((x) => x.id == form.dataset.loanForm);
  const btn = form.querySelector("button");
  const loanedTo = form.elements.loaned_to.value.trim() || null;
  btn.disabled = true;
  const { error } = await db.from("book_loans").upsert({ book_id: b.id, loaned_to: loanedTo });
  btn.disabled = false;
  if (error) return alert(`Could not save who has it: ${error.message}`);
  b.loaned_to = loanedTo;
  btn.textContent = "Saved ✓";
  setTimeout(() => (btn.textContent = "Save"), 1500);
});

[els.search, els.genre, els.sort].forEach((el) => el.addEventListener("input", render));

// ---------- Start ----------

if (!configured) {
  showBanner("Not connected yet: put your Supabase URL and anon key in config.js (see README).");
  els.loginForm.hidden = true;
  els.signedOut.hidden = true;
} else {
  db.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
}
