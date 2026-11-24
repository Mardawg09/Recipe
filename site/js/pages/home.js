const PAGE = 6;
let all = [], cuisine = "all", query = "", shown = PAGE;

const card = (r, d = 0) => `<article class="card rv" style="--d:${d}ms" data-id="${r.id}">${ph(r)}
    <div class="cb"><span class="st">${stars(r)}</span><h3>${esc(r.name)}</h3><small>${esc(r.type)} · ${esc(r.difficulty)} · ${r.servings} servings</small></div></article>`;

async function load() {
    try {
        const res = await authFetch("/api/recipes");
        if (!res.ok) throw new Error();
        all = (await res.json()).recipes || [];
    } catch { $("#latest").innerHTML = '<p class="empty">Unable to load recipes.</p>'; return; }

    const latest = [...all].sort((a, b) => b.id - a.id);
    $("#wall").innerHTML = latest.slice(0, 6).map(r => `<button data-id="${r.id}" title="${esc(r.name)}">${ph(r)}</button>`).join("");
    $("#top3").innerHTML = latest.slice(0, 3).map((r, i) => card(r, i * 90)).join("");
    const f = latest[3];
    $("#latest").innerHTML = (f ? `<article class="feat rv" data-id="${f.id}">${ph(f)}<div class="cb"><span class="st">${stars(f)}</span>
        <h3>${esc(f.name)}</h3><p>${esc(f.description)}</p></div></article>` : "") +
        latest.slice(4, 8).map(r => `<article class="li rv" data-id="${r.id}">${ph(r)}<div><span class="st">${stars(r)}</span>
        <h3>${esc(r.name)}</h3><small>${esc(r.type)} · ${esc(r.difficulty)}</small></div></article>`).join("");
    $("#fresh").innerHTML = latest.slice(8, 14).map(r => `<div class="fr rv" data-id="${r.id}">${ph(r)}${esc(r.name)}</div>`).join("");

    const types = [...new Set(all.map(r => r.type).filter(Boolean))];
    $("#nav").innerHTML = ["all", ...types].map(t => `<button type="button" data-c="${esc(t)}" class="${t === "all" ? "on" : ""}">${t === "all" ? "All" : esc(t)}</button>`).join("");
    $("#collections").innerHTML = types.map((t, i) => {
        const list = all.filter(r => r.type === t);
        return `<div class="col rv" style="--d:${(i % 3) * 90}ms" data-cuisine="${esc(t)}">${ph(list[0])}<h3>${esc(t)} Kitchen</h3><span>${list.length} Recipes</span></div>`;
    }).join("");
    renderGrid();
}

function renderGrid() {
    const q = query.toLowerCase();
    const list = all.filter(r => (cuisine === "all" || r.type === cuisine) &&
        (!q || [r.name, r.type, r.description, ...(r.ingredients || [])].join(" ").toLowerCase().includes(q)));
    $("#count").textContent = `(${list.length})`;
    $("#all").innerHTML = list.length ? list.slice(0, shown).map((r, i) => card(r, (i % 3) * 90)).join("")
        : '<p class="empty">No recipes found. Try another search or cuisine.</p>';
    $("#more").parentElement.hidden = shown >= list.length;
    document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.c === cuisine));
    reveal();
}
const setFilter = (c, q) => { cuisine = c; query = q; shown = PAGE; renderGrid(); };
const toGrid = () => $("#grid").scrollIntoView({ behavior: "smooth" });

mountShell("home.html").then(() => {
    document.addEventListener("click", e => {
        const c = e.target.closest("[data-cuisine]"); if (c) { setFilter(c.dataset.cuisine, ""); $("#q").value = ""; return toGrid(); }
        const n = e.target.closest("#nav button"); if (n) { setFilter(n.dataset.c, query); toGrid(); }
    });
    $("#more").onclick = () => { shown += PAGE; renderGrid(); };
    $("#go").onclick = () => { setFilter(cuisine, $("#q").value.trim()); toGrid(); };
    $("#q").addEventListener("input", () => setFilter(cuisine, $("#q").value.trim()));
    $("#q").addEventListener("keydown", e => { if (e.key === "Enter") toGrid(); });
    $("#browse").onclick = () => $("#search").scrollIntoView({ behavior: "smooth" });
    load();
});
