// Shared by every logged-in page: navbar, footer, cookbook (favorites), recipe modal, helpers.
const $ = s => document.querySelector(s);
const LINKS = [["home.html", "🌍 Home"], ["budget.html", "₱ Budget"], ["game.html", "🎲 Pantry Game"], ["gallery.html", "🖼 Gallery"], ["profile.html", "👤 Profile"]];
let favs = [];

// image: database image_url -> assets/img/<id>.jpg -> coloured placeholder
const ph = r => `<div class="ph" data-c="${esc(r.type)}" data-i="${esc((r.name || "?")[0])}">
    <img src="${esc(r.image_url || `/assets/img/${r.id}.jpg`)}" alt="${esc(r.name)}" loading="lazy" onerror="this.remove()"></div>`;
const stars = r => typeof r.rating === "number"
    ? "★".repeat(Math.round(r.rating)) + "☆".repeat(5 - Math.round(r.rating)) : "★ New";

// ---- scroll reveal ----
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
    { threshold: .1, rootMargin: "0px 0px -40px 0px" });
const reveal = () => requestAnimationFrame(() => document.querySelectorAll(".rv:not(.in)").forEach(el => io.observe(el)));

// ---- modal ----
function showModal() { $("#ov").classList.add("open"); document.body.style.overflow = "hidden"; }
function closeModal() {
    if (!$("#ov").classList.contains("open")) return;
    $("#ov").classList.remove("open"); document.body.style.overflow = "";
    if (typeof onModalClose === "function") onModalClose();
}

// ---- cookbook (favorites) ----
const isFav = id => favs.some(r => r.id === Number(id));
async function loadFavs() {
    try { favs = (await (await authFetch("/api/favorites")).json()).recipes || []; } catch { favs = []; }
    renderCookbook();
}
async function toggleFav(id) {
    await authFetch(`/api/favorites/${id}`, { method: isFav(id) ? "DELETE" : "PUT" });
    await loadFavs();
}
function renderCookbook() {
    const n = $("#ckN"); if (!n) return;
    n.hidden = !favs.length; n.textContent = favs.length;
    $("#ckPop").innerHTML = favs.length ? favs.map(r =>
        `<div class="ckrow"><a href="cook.html?id=${r.id}">${esc(r.name)}</a><button data-rm="${r.id}" aria-label="Remove">×</button></div>`).join("")
        : "<p>No saved recipes yet.</p>";
}

// ---- recipe detail modal (budget = show cost instead of nutrition) ----
async function openRecipeModal(id, budget = false) {
    const res = await authFetch(`/api/recipes/${id}`);
    if (!res.ok) return;
    const r = await res.json();
    const cost = Number(r.estimated_cost || 0), per = r.servings ? (cost / r.servings).toFixed(2) : "-";
    const nut = [["protein", "g"], ["carbs", "g"], ["sugar", "g"], ["fiber", "g"], ["sodium", "mg"]]
        .map(([k, u]) => `<div><b>${r[k] ?? "-"}${u}</b><small>${k}</small></div>`).join("");
    $("#mb").innerHTML = `${ph(r)}<h3 id="mt">${esc(r.name)}</h3>
        <div class="chips"><span>${esc(r.type)}</span><span>${esc(r.difficulty)}</span><span>${stars(r)}</span><span>${r.servings} servings</span></div>
        <p>${esc(r.description)}</p>
        <div class="actions" style="margin:14px 0"><button class="btn" data-fav="${r.id}">${isFav(r.id) ? "♥ Saved" : "♡ Save to cookbook"}</button>
        <a class="btn ghost" href="cook.html?id=${r.id}">Step-by-step</a></div>
        ${budget ? `<h4>Estimated cost</h4><div class="nut"><div><b>₱${cost}</b><small>total</small></div><div><b>₱${per}</b><small>per serving</small></div></div>` : ""}
        <h4>Ingredients</h4><ul>${(r.ingredients || []).map(i => `<li>${esc(i)}</li>`).join("")}</ul>
        <h4>Steps</h4><ol>${(r.steps || []).map(s => `<li>${esc(s)}</li>`).join("")}</ol>
        ${budget ? "" : `<h4>Nutrition</h4><div class="nut">${nut}</div>
        <h4>Allergens</h4><div class="chips">${(r.allergen && r.allergen.length ? r.allergen : ["None"]).map(a => `<span>${esc(a)}</span>`).join("")}</div>`}`;
    showModal();
}

// ---- page shell ----
function mountShell(active) {
    requireLogin();
    const u = getUser() || {};
    document.body.insertAdjacentHTML("afterbegin", `
    <header class="hd sc" id="hd"><div class="wrap hd-in intro">
      <a class="logo" href="home.html">Recipe <em>Hub</em></a>
      <nav class="tabs">${LINKS.map(([h, t]) => `<a href="${h}" class="${h === active ? "on" : ""}">${t}</a>`).join("")}</nav>
      <div class="who">
        <button class="ckbtn" id="ckBtn" type="button">🍽 Cookbook <span class="ckn" id="ckN" hidden>0</span></button>
        <div class="ckpop" id="ckPop"></div>
        <span class="nm">${esc(u.name || u.email || "")}</span><span class="role ${esc(u.role || "user")}">${esc(u.role || "user")}</span>
        <button class="out" type="button" onclick="logout()">Log out</button>
      </div></div></header>`);
    document.body.insertAdjacentHTML("beforeend", `
    <footer class="ft"><div class="wrap"><div class="logo">Recipe <em>Hub</em></div>
      <form id="news"><input type="email" required placeholder="Email for cooking tips"><button>Join</button></form>
      <p>Recipes served by your own Supabase-backed API.</p></div></footer>
    <div class="ov" id="ov"><div class="md" role="dialog" aria-modal="true"><button class="x" id="x" aria-label="Close">×</button><div id="mb"></div></div></div>`);

    $("#x").onclick = closeModal;
    $("#ov").addEventListener("click", e => { if (e.target.id === "ov") closeModal(); });
    addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); $("#ckPop").classList.remove("open"); } });
    $("#ckBtn").onclick = e => { e.stopPropagation(); $("#ckPop").classList.toggle("open"); };
    $("#news").onsubmit = e => { e.preventDefault(); e.target.outerHTML = '<p style="color:#2e7d32">Thanks! You are on the list.</p>'; };
    document.addEventListener("click", async e => {
        if (!e.target.closest(".who")) $("#ckPop").classList.remove("open");
        const rm = e.target.closest("[data-rm]"); if (rm) return toggleFav(rm.dataset.rm);
        const fv = e.target.closest("[data-fav]");
        if (fv) { await toggleFav(fv.dataset.fav); fv.textContent = isFav(fv.dataset.fav) ? "♥ Saved" : "♡ Save to cookbook"; return; }
        const card = e.target.closest("[data-id]"); if (card) openRecipeModal(card.dataset.id, !!window.BUDGET_MODE);
    });
    addEventListener("scroll", () => $("#hd").classList.toggle("sc", scrollY > 10), { passive: true });
    return loadFavs();
}
