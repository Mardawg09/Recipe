// Shared by all three pages (loaded after auth.js).
const $ = s => document.querySelector(s);

// image: database image_url -> assets/img/<id>.jpg -> coloured placeholder
const ph = r => `<div class="ph" data-c="${esc(r.type)}" data-i="${esc((r.name || "?")[0])}">
    <img src="${esc(r.image_url || `/assets/img/${r.id}.jpg`)}" alt="${esc(r.name)}" loading="lazy" onerror="this.remove()"></div>`;

const stars = r => typeof r.rating === "number"
    ? "★".repeat(Math.round(r.rating)) + "☆".repeat(5 - Math.round(r.rating)) : "★ New";

// scroll reveal + header shadow
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
    { threshold: .1, rootMargin: "0px 0px -40px 0px" });
const reveal = () => requestAnimationFrame(() => document.querySelectorAll(".rv:not(.in)").forEach(el => io.observe(el)));
addEventListener("scroll", () => { const h = $("#hd"); if (h) h.classList.toggle("sc", scrollY > 10); }, { passive: true });

function introHeader() {
    document.querySelectorAll(".hd-in,.nav").forEach((el, i) => { el.classList.add("intro"); el.style.setProperty("--d", i * 120 + "ms"); });
}

// modal: fill #mb, then showModal(); close with x, backdrop click or Esc
function showModal() { $("#ov").classList.add("open"); document.body.style.overflow = "hidden"; }
function closeModal() {
    if (!$("#ov").classList.contains("open")) return;
    $("#ov").classList.remove("open"); document.body.style.overflow = "";
    if (typeof onModalClose === "function") onModalClose();
}
$("#x").onclick = closeModal;
$("#ov").addEventListener("click", e => { if (e.target.id === "ov") closeModal(); });
addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
