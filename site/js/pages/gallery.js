mountShell("gallery.html").then(async () => {
    try {
        const res = await authFetch("/api/recipes");
        if (!res.ok) throw new Error();
        const list = (await res.json()).recipes || [];
        $("#gal").innerHTML = list.map(r => `<article data-id="${r.id}">${ph(r)}<h3>${esc(r.name)}</h3>
            <small>${esc(r.type)} · ${esc(r.difficulty)} · ${r.servings} servings</small></article>`).join("");
    } catch { $("#gal").innerHTML = '<p class="empty">Unable to load recipes.</p>'; }
});
