mountShell("home.html").then(async () => {
    const id = new URLSearchParams(location.search).get("id");
    try {
        const res = await authFetch(`/api/recipes/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error();
        const r = await res.json();
        const save = () => (isFav(r.id) ? "♥ Saved to my cookbook" : "Save to my cookbook");
        $("#cook").innerHTML = `<a href="home.html" style="color:var(--mut);text-decoration:none;font-size:.9rem">← Back to recipes</a>
            <h1 style="font-size:2.4rem;margin:10px 0 2px">${esc(r.name)}</h1>
            <p style="color:var(--mut);margin:0">${esc(r.type)} · ${esc(r.difficulty)} · ${r.servings} servings</p>
            <div class="ing"><h2 style="font-size:1.3rem;margin:0">Ingredients</h2><ul>${(r.ingredients || []).map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>
            <h2 style="font-size:1.8rem;margin:30px 0 0">How to cook it</h2>
            <ol class="hiw">${(r.steps || []).map((s, i) => `<li><b>${i + 1}</b><div><strong>Step ${i + 1}</strong><p>${esc(s)}</p></div></li>`).join("")}</ol>
            <button class="cta-g" id="cta">${save()}</button>`;
        $("#cta").onclick = async () => { await toggleFav(r.id); $("#cta").textContent = save(); };
    } catch { $("#cook").innerHTML = '<p class="empty">Recipe not found.</p>'; }
});
