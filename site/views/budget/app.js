requireLogin();

const PAGE = 6, STEPS = [200, 300, 500];
let all = [], max = Infinity, query = "", shown = PAGE;
const cost = r => Number(r.estimated_cost || 0);
const per = r => r.servings ? (cost(r) / r.servings).toFixed(2) : "-";

const card = (r, d = 0) => `<article class="card rv" style="--d:${d}ms" data-id="${r.id}">${ph(r)}
    <div class="cb"><span class="st">${stars(r)}</span><h3>${esc(r.name)}</h3>
    <small><span class="price">₱${cost(r)}</span> total · ₱${per(r)} per serving · ${r.servings} servings</small></div></article>`;

async function load() {
    try {
        const res = await authFetch("/api/recipes");
        if (!res.ok) throw new Error();
        all = ((await res.json()).recipes || []).sort((a, b) => cost(a) - cost(b));
    } catch { $("#all").innerHTML = '<p class="empty">Unable to load recipes.</p>'; return; }
    $("#top3").innerHTML = all.slice(0, 3).map((r, i) => card(r, i * 90)).join("");
    $("#nav").innerHTML = [`<button type="button" data-m="all" class="on">All</button>`,
        ...STEPS.map(n => `<button type="button" data-m="${n}">Under ₱${n}</button>`)].join("");
    render();
}

function render() {
    const q = query.toLowerCase();
    const list = all.filter(r => cost(r) <= max &&
        (!q || [r.name, r.type, r.description, ...(r.ingredients || [])].join(" ").toLowerCase().includes(q)));
    $("#count").textContent = `(${list.length})`;
    $("#all").innerHTML = list.length ? list.slice(0, shown).map((r, i) => card(r, (i % 3) * 90)).join("")
        : '<p class="empty">No recipes within that budget. Try a higher amount.</p>';
    $("#more").parentElement.hidden = shown >= list.length;
    document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", (b.dataset.m === "all" ? Infinity : Number(b.dataset.m)) === max));
    reveal();
}
function apply() {
    const v = $("#max").value;
    max = v === "" ? Infinity : Number(v); query = $("#q").value.trim(); shown = PAGE; render();
}

async function openRecipe(id) {
    const res = await authFetch(`/api/recipes/${id}`);
    if (!res.ok) return;
    const r = await res.json();
    $("#mb").innerHTML = `${ph(r)}<h3 id="mt">${esc(r.name)}</h3>
        <div class="chips"><span>${esc(r.type)}</span><span>${esc(r.difficulty)}</span><span>${stars(r)}</span></div>
        <p>${esc(r.description)}</p>
        <h4>Estimated cost</h4><div class="nut"><div><b>₱${cost(r)}</b><small>total</small></div><div><b>₱${per(r)}</b><small>per serving</small></div><div><b>${r.servings}</b><small>servings</small></div></div>
        <h4>Ingredients</h4><ul>${(r.ingredients || []).map(i => `<li>${esc(i)}</li>`).join("")}</ul>
        <h4>Steps</h4><ol>${(r.steps || []).map(s => `<li>${esc(s)}</li>`).join("")}</ol>`;
    showModal();
}

document.addEventListener("click", e => {
    const n = e.target.closest("#nav button");
    if (n) { $("#max").value = n.dataset.m === "all" ? "" : n.dataset.m; apply(); return $("#grid").scrollIntoView(); }
    const r = e.target.closest("[data-id]"); if (r) openRecipe(r.dataset.id);
});
$("#more").onclick = () => { shown += PAGE; render(); };
$("#go").onclick = () => { apply(); $("#grid").scrollIntoView(); };
$("#q").addEventListener("input", apply);
$("#max").addEventListener("input", apply);
introHeader();
load();
