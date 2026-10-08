import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = (sel) => document.querySelector(sel);
const els = {
  banner: $("#banner"), status: $("#status"), list: $("#books"),
  search: $("#search"), genre: $("#genre-filter"), sort: $("#sort"), genres: $("#genres"),
  addBtn: $("#add-btn"), loginForm: $("#login-form"), loginUser: $("#login-user"), loginPass: $("#login-pass"),
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
  user = u;
  els.userEmail.textContent = u ? `Signed in as ${u.email}` : "";
  els.loginForm.hidden = !!u;
  els.logoutBtn.hidden = !u;
  els.addBtn.hidden = !u;
  render();
}

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const buttons = els.loginForm.querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  const creds = { email: els.loginUser.value.trim(), password: els.loginPass.value };
  const isSignup = e.submitter?.value === "signup";
  const { data, error } = isSignup
    ? await db.auth.signUp(creds)
    : await db.auth.signInWithPassword(creds);
  buttons.forEach((b) => (b.disabled = false));

  if (error) {
    const msg = error.message === "Invalid login credentials" ? "Wrong email or password." : error.message;
    showBanner(`${isSignup ? "Sign-up" : "Sign-in"} failed: ${msg}`);
  } else if (isSignup && !data.session) {
    showBanner("Account created! Check your inbox to confirm your email, then sign in.");
  } else {
    showBanner("");
    els.loginForm.reset();
  }
});

els.logoutBtn.addEventListener("click", () => db.auth.signOut());

// ---------- Data ----------

async function loadBooks() {
  els.status.textContent = "Loading…";
  const { data, error } = await db.from("books").select("*");
  if (error) {
    els.status.textContent = `Could not load books: ${error.message}`;
    return;
  }
  books = data;
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
    .filter((b) => !q || [b.title, b.author, b.genre, b.notes, b.isbn, b.added_by].some((f) => f?.toLowerCase().includes(q)))
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

function render() {
  const list = visibleBooks();
  els.status.textContent = books.length === 0
    ? (configured ? "No books yet." + (user ? " Add the first one!" : " Sign in to add one.") : "")
    : `${list.length} of ${books.length} books`;

  els.list.innerHTML = list.map((b) => `
    <li class="book">
      ${coverHtml(b)}
      <div>
        <h3>${escapeHtml(b.title)}</h3>
        <p class="meta">${escapeHtml(b.author)}${b.year ? ` · ${b.year}` : ""}</p>
        ${b.genre ? `<span class="tag">${escapeHtml(b.genre)}</span>` : ""}
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
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.delete;
  if (editId) openDialog(books.find((b) => b.id == editId));
  if (delId && confirm("Delete this book?")) {
    const { error } = await db.from("books").delete().eq("id", delId);
    if (error) return alert(`Delete failed: ${error.message}`);
    loadBooks();
  }
});

[els.search, els.genre, els.sort].forEach((el) => el.addEventListener("input", render));

// ---------- Start ----------

if (!configured) {
  showBanner("Not connected yet: put your Supabase URL and anon key in config.js (see README).");
  els.loginForm.hidden = true;
  els.status.textContent = "";
} else {
  db.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
  loadBooks();
}
