mountShell("profile.html").then(async () => {
    const u = getUser() || {};
    let s = { rated: 0, discovered: 0, score: 0 };
    try { s = await (await authFetch("/api/me/stats")).json(); } catch {}
    const stats = [["Saved", favs.length], ["Rated", s.rated], ["Cooked", s.discovered], ["Points", s.score]];
    const tabs = {
        saved: favs.map(r => [`cook.html?id=${r.id}`, r.name, r.type]),
        play: [["game.html", "Pantry Game", "Earn points"], ["budget.html", "Budget recipes", "Spend less"]],
    };
    const draw = tab => {
        $("#p").innerHTML = `<div class="pav">${esc((u.name || u.email || "?")[0].toUpperCase())}</div>
            <h1 style="font-size:1.7rem;margin:0">${esc(u.name || u.email)}</h1>
            <p style="color:var(--mut);margin:4px 0 0">${esc(u.email)} · ${esc(u.role)}</p>
            <div class="pst">${stats.map(([l, v]) => `<div><b>${v}</b><small>${l}</small></div>`).join("")}</div>
            <div class="ptabs"><button data-t="saved" class="${tab === "saved" ? "on" : ""}">Saved recipes</button><button data-t="play" class="${tab === "play" ? "on" : ""}">Play</button></div>
            <ul class="plist">${tabs[tab].length ? tabs[tab].map(([h, t, m]) => `<li><a href="${h}">${esc(t)}<span>${esc(m)}</span></a></li>`).join("")
                : '<li style="text-align:center;color:var(--mut);padding:12px">Nothing here yet.</li>'}</ul>`;
        document.querySelectorAll(".ptabs button").forEach(b => b.onclick = () => draw(b.dataset.t));
    };
    draw("saved");
});
