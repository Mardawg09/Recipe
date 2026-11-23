requireLogin();

let levelId = null, round = null;
const picked = new Set();
const $ = id => document.getElementById(id);

async function loadLevels() {
    const res = await authFetch("/api/game/levels");
    const { levels } = await res.json();
    $("levels").innerHTML = levels.map(l => `
        <button class="level ${l.id === levelId ? "active" : ""}" data-id="${l.id}" ${l.status === "Locked" ? "disabled" : ""}>
            <strong>${esc(l.title)}</strong>
            <small>${esc(l.difficulty)} · ${l.found}/${l.total} cooked · ${l.score} pts</small>
            <small>${l.status === "Locked" ? "🔒 Finish the previous level" : l.status === "Completed" ? "✅ Completed" : esc(l.description)}</small>
        </button>`).join("");
    document.querySelectorAll(".level").forEach(b => b.onclick = () => { levelId = Number(b.dataset.id); newRound(); });
}

async function newRound() {
    $("feedback").textContent = "";
    const res = await authFetch("/api/game/round", { method: "POST", body: JSON.stringify({ level_id: levelId }) });
    const data = await res.json();
    if (!res.ok) { $("feedback").textContent = data.detail; return; }
    round = data; picked.clear();

    $("board").hidden = false;
    $("tName").textContent = data.order.name;
    $("tCuisine").textContent = `${data.order.cuisine} · ${data.order.difficulty}`;
    $("tDesc").textContent = data.order.description;
    $("tNeeds").textContent = data.needs;
    $("pantry").innerHTML = data.pantry.map((p, i) =>
        `<button type="button" class="chip pop" style="animation-delay:${i * 40}ms" data-id="${p.id}">${esc(p.name)}</button>`).join("");
    document.querySelectorAll(".chip").forEach(c => c.onclick = () => {
        const id = Number(c.dataset.id);
        picked.has(id) ? picked.delete(id) : picked.add(id);
        c.classList.toggle("on", picked.has(id));
        $("picked").textContent = `${picked.size} selected`;
    });
    $("picked").textContent = "0 selected";
    loadLevels();
}

async function cook() {
    if (!round || picked.size === 0) { $("feedback").textContent = "Pick some ingredients first."; return; }
    const res = await authFetch("/api/game/cook", {
        method: "POST",
        body: JSON.stringify({ level_id: levelId, recipe_id: round.recipe_id, ingredient_ids: [...picked] })
    });
    const r = await res.json();
    if (!res.ok) { $("feedback").textContent = r.detail; return; }

    if (!r.correct) {
        const { missing, extra } = r.hint;
        $("feedback").textContent = `Not quite - ${missing} missing, ${extra} that don't belong. Try again!`;
        return;
    }
    const rec = r.recipe;
    $("modalBody").innerHTML = `
        <div class="recipe-type">${r.points ? `+${r.points} points!` : "Already discovered"}</div>
        <h3 id="modalTitle">${esc(rec.name)}</h3>
        <p class="desc">${esc(rec.description)}</p>
        <h4>Ingredients</h4><ul class="ingredients">${rec.ingredients.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
        <h4>Steps</h4><ol class="steps">${rec.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
        <p><strong>Level score: ${r.level_score}</strong>${r.level_completed ? " 🎉 Level completed!" : ""}</p>`;
    $("modalOverlay").classList.add("open");
}

function closeModal() {
    if (!$("modalOverlay").classList.contains("open")) return;
    $("modalOverlay").classList.remove("open");
    if (round) newRound();
}

$("cookBtn").onclick = cook;
$("newBtn").onclick = newRound;
$("modalOverlay").addEventListener("click", e => { if (e.target.id === "modalOverlay") closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
loadLevels();
