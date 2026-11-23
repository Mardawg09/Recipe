// Shared login helper. No API key and no API URL in the browser:
// requests go to /api/... on this site (Vercel forwards them to the API),
// and every request carries the signed-in user's session token instead.
const TOKEN_KEY = "rp_token", USER_KEY = "rp_user";

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
function isAdmin() { const u = getUser(); return !!u && u.role === "admin"; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    (window.top || window).location.href = "/login.html";
}

function requireLogin() {
    if (!getToken()) { (window.top || window).location.replace("/login.html"); throw new Error("login required"); }
}

async function authFetch(path, options = {}) {
    const res = await fetch(path, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}), Authorization: "Bearer " + getToken() }
    });
    if (res.status === 401) logout();
    return res;
}

document.addEventListener("DOMContentLoaded", () => {
    if (window.self !== window.top) return; // inside the switcher: the top bar shows the user
    const u = getUser(), list = document.querySelector(".nav-links");
    if (!u || !list) return;
    const li = document.createElement("li");
    li.innerHTML = `<span style="font-size:.85rem">${esc(u.name || u.email)}
        <b style="padding:2px 8px;border-radius:12px;background:${u.role === "admin" ? "#c1452a" : "#6c7f55"};color:#fff;font-size:.72rem">${esc(u.role)}</b></span>
        <a href="#" onclick="logout();return false" style="margin-left:10px">Log out</a>`;
    list.appendChild(li);
});
