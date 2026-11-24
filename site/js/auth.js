// Login helper shared by every page. No API key and no API URL in the browser:
// requests go to /api/... on this site (vercel.json forwards them to the API) and carry the user's login token.
const TOKEN_KEY = "rp_token", USER_KEY = "rp_user";

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    location.href = "../index.html";
}
function requireLogin() {
    if (!getToken()) { location.replace("login.html"); throw new Error("login required"); }
}
async function authFetch(path, options = {}) {
    const res = await fetch(path, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}), Authorization: "Bearer " + getToken() }
    });
    if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); location.href = "login.html"; }
    return res;
}
