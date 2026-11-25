// URL de la API publicada en Render
const API_BASE_URL = "https://biblioteca-api-l1hv.onrender.com/api/v1/libros";

// Géneros que se pueden elegir con un clic. "Otro" permite escribir cualquier género.
const GENRES = [
  { name: "Novela", emoji: "📕", color: "#fde2e2" },
  { name: "Fantasía", emoji: "🐉", color: "#e3f4e6" },
  { name: "Ciencia ficción", emoji: "🚀", color: "#e3ebfc" },
  { name: "Historia", emoji: "🏛️", color: "#f6efdc" },
  { name: "Poesía", emoji: "✒️", color: "#efe5fb" },
  { name: "Otro", emoji: "📚", color: "#e6eef5" },
];

const ANIO_ACTUAL = new Date().getFullYear();

// ---------- Estado de la aplicación ----------
const state = {
  libros: [],
  search: "",
  sort: "recientes",
  dispFilter: "todas", // todas | si | no
  genreFilter: null, // null = todos los géneros
  deletingId: null,
};

// ---------- Referencias al DOM ----------
const $ = (id) => document.getElementById(id);

const grid = $("pet-grid");
const loadingEl = $("loading");
const loadingText = $("loading-text");
const emptyEl = $("empty");
const chipsEl = $("species-chips");

const formModal = $("form-modal");
const form = $("pet-form");
const formTitle = $("form-title");
const submitBtn = $("submit-btn");
const idInput = $("pet-id");
const tituloInput = $("titulo");
const autorInput = $("autor");
const anioInput = $("anio");
const disponibleInput = $("disponible");
const generoOtroInput = $("genero-otro");
const genrePicker = $("genre-picker");

const confirmModal = $("confirm-modal");
let selectedGenre = "Novela";

// ---------- Utilidades ----------
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function normalize(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function genreInfo(genero) {
  const found = GENRES.find((g) => normalize(g.name) === normalize(genero));
  return found || GENRES[GENRES.length - 1];
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = message;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---------- Comunicación con la API ----------
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch (_) {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const api = {
  list: () => apiRequest(API_BASE_URL),
  create: (data) => apiRequest(API_BASE_URL, { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`${API_BASE_URL}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => apiRequest(`${API_BASE_URL}/${id}`, { method: "DELETE" }),
};

// ---------- Carga inicial ----------
async function loadBooks() {
  loadingEl.hidden = false;
  emptyEl.hidden = true;
  loadingText.textContent = "Cargando libros...";

  // En el plan gratis de Render la API se "duerme"; avisamos si tarda.
  const slowTimer = setTimeout(() => {
    loadingText.textContent = "Despertando el servidor de Render… puede tardar hasta un minuto ☕";
  }, 4000);

  try {
    state.libros = (await api.list()) || [];
    render();
  } catch (error) {
    grid.innerHTML = "";
    showEmpty("😕", "No se pudo conectar con la API", error.message);
  } finally {
    clearTimeout(slowTimer);
    loadingEl.hidden = true;
  }
}

// ---------- Renderizado ----------
function getVisibleBooks() {
  const term = normalize(state.search);

  const list = state.libros.filter((l) => {
    const matchesText = !term || normalize(l.titulo).includes(term) || normalize(l.autor).includes(term);
    const matchesDisp =
      state.dispFilter === "todas" ||
      (state.dispFilter === "si" && l.disponible) ||
      (state.dispFilter === "no" && !l.disponible);
    const matchesGenre = !state.genreFilter || normalize(l.genero) === normalize(state.genreFilter);
    return matchesText && matchesDisp && matchesGenre;
  });

  const sorters = {
    recientes: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    titulo: (a, b) => a.titulo.localeCompare(b.titulo, "es"),
    "anio-asc": (a, b) => a.anio - b.anio,
    "anio-desc": (a, b) => b.anio - a.anio,
  };
  return [...list].sort(sorters[state.sort]);
}

function render() {
  renderStats();
  renderChips();

  const visible = getVisibleBooks();
  grid.innerHTML = "";
  visible.forEach((l) => grid.appendChild(createCard(l)));

  if (state.libros.length === 0) {
    showEmpty("📖", "Aún no hay libros", "Registra el primero con el botón “Nuevo libro”.");
  } else if (visible.length === 0) {
    showEmpty("🔎", "Sin resultados", "Ningún libro coincide con la búsqueda o los filtros.");
  } else {
    emptyEl.hidden = true;
  }
}

function showEmpty(icon, title, text) {
  emptyEl.querySelector(".empty__icon").textContent = icon;
  $("empty-title").textContent = title;
  $("empty-text").textContent = text;
  emptyEl.hidden = false;
}

function renderStats() {
  const list = state.libros;
  const total = list.length;
  const disponibles = list.filter((l) => l.disponible).length;
  const autores = new Set(list.map((l) => normalize(l.autor))).size;

  const conteo = {};
  list.forEach((l) => (conteo[l.genero] = (conteo[l.genero] || 0) + 1));
  const top = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];

  $("stat-total").textContent = total;
  $("stat-disponibles").textContent = total ? `${Math.round((disponibles / total) * 100)}%` : "0%";
  $("stat-autores").textContent = autores;
  $("stat-genero").textContent = top ? `${genreInfo(top[0]).emoji} ${top[0]}` : "—";
}

function renderChips() {
  const conteo = {};
  state.libros.forEach((l) => (conteo[l.genero] = (conteo[l.genero] || 0) + 1));

  // Si el género filtrado ya no existe (se borró), quitamos el filtro
  if (state.genreFilter && !conteo[state.genreFilter]) state.genreFilter = null;

  const chips = [`<button type="button" class="chip ${!state.genreFilter ? "is-active" : ""}" data-genre="">
      Todos <span>${state.libros.length}</span></button>`];

  Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .forEach(([genero, n]) => {
      const active = state.genreFilter === genero ? "is-active" : "";
      chips.push(`<button type="button" class="chip ${active}" data-genre="${escapeHtml(genero)}">
        ${genreInfo(genero).emoji} ${escapeHtml(genero)} <span>${n}</span></button>`);
    });

  chipsEl.innerHTML = state.libros.length ? chips.join("") : "";
}

function createCard(l) {
  const info = genreInfo(l.genero);
  const antiguedad = ANIO_ACTUAL - l.anio;
  const epoca = l.anio < 1950 ? "Clásico" : l.anio < 2000 ? "Siglo XX" : "Contemporáneo";

  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = l._id;
  card.innerHTML = `
    <div class="card__top">
      <div class="avatar" style="background:${info.color}">${info.emoji}</div>
      <div>
        <h3 class="card__name">${escapeHtml(l.titulo)}</h3>
        <p class="card__sub">${escapeHtml(l.autor)} · ${escapeHtml(l.genero)}</p>
      </div>
    </div>
    <div class="card__tags">
      <span class="tag">📅 ${l.anio} (${antiguedad} ${antiguedad === 1 ? "año" : "años"})</span>
      <span class="tag">${epoca}</span>
      ${l.disponible
        ? '<span class="tag tag--ok">✔ Disponible</span>'
        : '<span class="tag tag--warn">⏳ Prestado</span>'}
    </div>
    <div class="card__foot">
      <span class="card__date">Registrado el ${formatDate(l.createdAt)}</span>
      <div class="card__actions">
        <button type="button" class="icon-btn icon-btn--vac ${l.disponible ? "is-on" : ""}" data-action="toggle"
          title="${l.disponible ? "Marcar como prestado" : "Marcar como devuelto"}">📖</button>
        <button type="button" class="icon-btn" data-action="edit" title="Editar">✏️</button>
        <button type="button" class="icon-btn icon-btn--danger" data-action="delete" title="Eliminar">🗑️</button>
      </div>
    </div>`;
  return card;
}

// ---------- Selector de género del formulario ----------
function renderGenrePicker() {
  genrePicker.innerHTML = GENRES.map(
    (g) => `<button type="button" class="species-opt ${g.name === selectedGenre ? "is-active" : ""}"
      data-name="${g.name}">${g.emoji} ${g.name}</button>`
  ).join("");
  generoOtroInput.hidden = selectedGenre !== "Otro";
}

genrePicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".species-opt");
  if (!btn) return;
  selectedGenre = btn.dataset.name;
  renderGenrePicker();
  if (selectedGenre === "Otro") generoOtroInput.focus();
});

// ---------- Modal de formulario (crear / editar) ----------
function openForm(libro = null) {
  form.reset();
  clearErrors();

  if (libro) {
    formTitle.textContent = "Editar libro";
    submitBtn.textContent = "Guardar cambios";
    idInput.value = libro._id;
    tituloInput.value = libro.titulo;
    autorInput.value = libro.autor;
    anioInput.value = libro.anio;
    disponibleInput.checked = libro.disponible;

    const known = GENRES.find((g) => g.name !== "Otro" && normalize(g.name) === normalize(libro.genero));
    selectedGenre = known ? known.name : "Otro";
    generoOtroInput.value = known ? "" : libro.genero;
  } else {
    formTitle.textContent = "Nuevo libro";
    submitBtn.textContent = "Guardar libro";
    idInput.value = "";
    anioInput.value = ANIO_ACTUAL;
    disponibleInput.checked = true;
    selectedGenre = "Novela";
  }

  renderGenrePicker();
  formModal.hidden = false;
  tituloInput.focus();
}

function closeModals() {
  formModal.hidden = true;
  confirmModal.hidden = true;
  state.deletingId = null;
}

document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModals));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModals();
});
$("open-form-btn").addEventListener("click", () => openForm());

// Botones + y − del año
document.querySelectorAll(".stepper__btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    const next = (parseInt(anioInput.value, 10) || ANIO_ACTUAL) + Number(btn.dataset.step);
    anioInput.value = Math.min(ANIO_ACTUAL, Math.max(1000, next));
  })
);

// ---------- Validación ----------
function setError(field, message) {
  const small = form.querySelector(`.field__error[data-for="${field}"]`);
  small.textContent = message;
  small.closest(".field").classList.add("has-error");
}

function clearErrors() {
  form.querySelectorAll(".field__error").forEach((el) => (el.textContent = ""));
  form.querySelectorAll(".has-error").forEach((el) => el.classList.remove("has-error"));
}

function readForm() {
  clearErrors();
  const data = {
    titulo: tituloInput.value.trim(),
    autor: autorInput.value.trim(),
    genero: selectedGenre === "Otro" ? generoOtroInput.value.trim() : selectedGenre,
    anio: Number(anioInput.value),
    disponible: disponibleInput.checked,
  };

  let ok = true;
  if (data.titulo.length < 2) { setError("titulo", "Escribe un título de al menos 2 letras."); ok = false; }
  if (data.autor.length < 3) { setError("autor", "Escribe el nombre del autor."); ok = false; }
  if (!data.genero) { setError("genero", "Escribe cuál es el género."); ok = false; }
  if (!Number.isInteger(data.anio) || data.anio < 1000 || data.anio > ANIO_ACTUAL) {
    setError("anio", `El año debe estar entre 1000 y ${ANIO_ACTUAL}.`);
    ok = false;
  }

  // Evitar el mismo libro (título + autor) repetido
  const repetido = state.libros.find(
    (l) => l._id !== idInput.value &&
      normalize(l.titulo) === normalize(data.titulo) &&
      normalize(l.autor) === normalize(data.autor)
  );
  if (ok && repetido) { setError("titulo", `“${repetido.titulo}” de ${repetido.autor} ya está registrado.`); ok = false; }

  return ok ? data : null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = readForm();
  if (!data) return;

  const id = idInput.value;
  submitBtn.disabled = true;
  submitBtn.textContent = "Guardando...";

  try {
    if (id) {
      const updated = await api.update(id, data);
      state.libros = state.libros.map((l) => (l._id === id ? updated : l));
      toast(`“${data.titulo}” se actualizó ✏️`, "ok");
    } else {
      const created = await api.create(data);
      state.libros.unshift(created);
      toast(`“${data.titulo}” quedó registrado 🎉`, "ok");
    }
    closeModals();
    render();
  } catch (error) {
    toast(`No se pudo guardar: ${error.message}`, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = id ? "Guardar cambios" : "Guardar libro";
  }
});

// ---------- Acciones de cada tarjeta ----------
grid.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.closest(".card").dataset.id;
  const libro = state.libros.find((l) => l._id === id);
  if (!libro) return;

  if (btn.dataset.action === "edit") openForm(libro);

  if (btn.dataset.action === "delete") {
    state.deletingId = id;
    $("confirm-name").textContent = libro.titulo;
    confirmModal.hidden = false;
  }

  if (btn.dataset.action === "toggle") {
    btn.disabled = true;
    try {
      const updated = await api.update(id, { disponible: !libro.disponible });
      state.libros = state.libros.map((l) => (l._id === id ? updated : l));
      toast(updated.disponible ? `“${libro.titulo}” fue devuelto 📚` : `“${libro.titulo}” quedó prestado ⏳`, "ok");
      render();
    } catch (error) {
      toast(`No se pudo actualizar: ${error.message}`, "error");
      btn.disabled = false;
    }
  }
});

$("confirm-delete-btn").addEventListener("click", async () => {
  const id = state.deletingId;
  if (!id) return;
  const libro = state.libros.find((l) => l._id === id);
  const btn = $("confirm-delete-btn");
  btn.disabled = true;

  try {
    await api.remove(id);
    state.libros = state.libros.filter((l) => l._id !== id);
    toast(`“${libro ? libro.titulo : "El libro"}” fue eliminado`, "ok");
    closeModals();
    render();
  } catch (error) {
    toast(`No se pudo eliminar: ${error.message}`, "error");
  } finally {
    btn.disabled = false;
  }
});

// ---------- Búsqueda y filtros ----------
$("search-input").addEventListener("input", (e) => {
  state.search = e.target.value;
  render();
});

$("sort-select").addEventListener("change", (e) => {
  state.sort = e.target.value;
  render();
});

document.querySelectorAll(".segmented__btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".segmented__btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.dispFilter = btn.dataset.vac;
    render();
  })
);

chipsEl.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  state.genreFilter = chip.dataset.genre || null;
  render();
});

loadBooks();
