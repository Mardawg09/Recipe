import os
import sys
import random
from datetime import datetime, timezone
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import FastAPI, HTTPException, Header, Depends, Request, Query
from fastapi.middleware.cors import CORSMiddleware

try:
    from database import db, auth_client
    from recipes import clean_recipe
except ImportError:  # when run as a package
    from api.database import db, auth_client
    from api.recipes import clean_recipe

app = FastAPI(title="Recipe API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])

STAFF = ("admin", "editor")


_jwks = PyJWKClient(os.environ["SUPABASE_JWKS_URL"])


# ---------- helpers (no pydantic models) ----------
def bad(msg, code=422):
    raise HTTPException(status_code=code, detail=msg)


async def body(request: Request) -> dict:
    try:
        data = await request.json()
    except Exception:
        bad("Request body must be JSON", 400)
    if not isinstance(data, dict):
        bad("Request body must be a JSON object", 400)
    return data


def to_int(v, name):
    try:
        return int(v)
    except (TypeError, ValueError):
        bad(f"{name} must be an integer")


# ---------- authentication ----------
def current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        bad("Login required", 401)
    token = authorization[7:]
    try:
        key = _jwks.get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["ES256", "RS256"], audience="authenticated")
    except Exception:
        bad("Invalid or expired session", 401)
    rows = (db.table("users").select("id,email,name,roles(name)")
            .eq("id", claims["sub"]).limit(1).execute().data)
    if not rows:
        bad("Account profile not found", 401)
    u = rows[0]
    role = (u.get("roles") or {}).get("name") or "user"
    return {"id": u["id"], "email": u["email"], "name": u["name"], "role": role}


def require_role(*roles):
    def check(user=Depends(current_user)):
        if user["role"] not in roles:
            bad("You do not have permission to do that", 403)
        return user
    return check


@app.post("/auth/register", status_code=201)
async def register(request: Request):
    d = await body(request)
    email, password = str(d.get("email", "")).strip(), str(d.get("password", ""))
    name = str(d.get("name", "")).strip()
    if "@" not in email or len(password) < 6:
        bad("Valid email and a password of at least 6 characters are required")
    try:
        res = auth_client().auth.sign_up(
            {"email": email, "password": password, "options": {"data": {"name": name}}})
    except Exception as e:
        bad(str(e), 400)
    if not res.session:  # Supabase "Confirm email" is ON
        return {"message": "Account created. Check your email to confirm, then log in."}
    return {"message": "Account created. You can log in now."}


@app.post("/auth/login")
async def login(request: Request):
    d = await body(request)
    try:
        res = auth_client().auth.sign_in_with_password(
            {"email": str(d.get("email", "")).strip(), "password": str(d.get("password", ""))})
    except Exception:
        bad("Incorrect email or password", 401)
    token = res.session.access_token
    row = (db.table("users").select("email,name,roles(name)").eq("id", res.user.id)
           .limit(1).execute().data)[0]
    return {"access_token": token,
            "user": {"email": row["email"], "name": row["name"],
                     "role": (row.get("roles") or {}).get("name") or "user"}}


@app.get("/me")
def me(user=Depends(current_user)):
    return user


# ---------- public ----------
@app.get("/")
def home():
    return {"message": "Recipe API", "login": "/auth/login"}


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ---------- recipes ----------
def rating_map():
    acc = {}
    for r in db.table("recipe_ratings").select("recipe_id,rating").execute().data:
        acc.setdefault(r["recipe_id"], []).append(r["rating"])
    return {k: round(sum(v) / len(v), 1) for k, v in acc.items()}


def shape(r, ratings):
    """Keep the field names the websites already use (type, allergen, rating)."""
    r = dict(r)
    r["type"] = r.get("cuisine")
    r["allergen"] = r.get("allergens") or []
    r["rating"] = ratings.get(r["id"], "New")
    return r


def visible_recipes(user):
    q = db.table("recipes").select("*").order("id")
    if user["role"] not in STAFF:
        q = q.eq("status", "Published")
    return q.execute().data


@app.get("/recipes")
def list_recipes(user=Depends(current_user)):
    rt = rating_map()
    rows = [shape(r, rt) for r in visible_recipes(user)]
    return {"count": len(rows), "recipes": rows}


@app.get("/recipes/search")
def search_recipes(q: str = Query(..., min_length=1), user=Depends(current_user)):
    needle, rt = q.lower(), rating_map()
    hits = [shape(r, rt) for r in visible_recipes(user)
            if needle in " ".join([r["name"], r.get("description") or "", r.get("cuisine") or "",
                                   *(r.get("ingredients") or [])]).lower()]
    return {"query": q, "count": len(hits), "results": hits}


@app.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: int, user=Depends(current_user)):
    rows = db.table("recipes").select("*").eq("id", recipe_id).limit(1).execute().data
    if not rows or (rows[0]["status"] != "Published" and user["role"] not in STAFF):
        bad("Recipe not found", 404)
    return shape(rows[0], rating_map())


@app.post("/recipes", status_code=201)
async def create_recipe(request: Request, user=Depends(require_role(*STAFF))):
    data = clean_recipe(await body(request), bad)
    data["created_by"] = user["id"]
    return db.table("recipes").insert(data).execute().data[0]


@app.put("/recipes/{recipe_id}")
async def update_recipe(recipe_id: int, request: Request, user=Depends(require_role(*STAFF))):
    data = clean_recipe(await body(request), bad, partial=True)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    rows = db.table("recipes").update(data).eq("id", recipe_id).execute().data
    if not rows:
        bad("Recipe not found", 404)
    return rows[0]


@app.delete("/recipes/{recipe_id}")
def delete_recipe(recipe_id: int, user=Depends(require_role("admin"))):
    db.table("recipes").delete().eq("id", recipe_id).execute()
    return {"deleted": recipe_id}


@app.post("/recipes/{recipe_id}/rate")
async def rate_recipe(recipe_id: int, request: Request, user=Depends(current_user)):
    d = await body(request)
    rating = to_int(d.get("rating"), "rating")
    if not 1 <= rating <= 5:
        bad("rating must be 1-5")
    db.table("recipe_ratings").upsert(
        {"recipe_id": recipe_id, "user_id": user["id"], "rating": rating, "review": d.get("review")},
        on_conflict="recipe_id,user_id").execute()
    return {"ok": True}


# ---------- ingredient game ----------
def levels_overview(uid):
    levels = (db.table("game_levels").select("*").eq("is_active", True)
              .order("level_order").execute().data)
    lr = db.table("game_level_recipes").select("level_id,recipe_id").execute().data
    found_ids = {r["recipe_id"] for r in db.table("user_recipe_discoveries")
                 .select("recipe_id").eq("user_id", uid).execute().data}
    prog = {r["level_id"]: r for r in db.table("user_game_progress")
            .select("*").eq("user_id", uid).execute().data}
    out, prev_done = [], True
    for lv in levels:
        ids = [x["recipe_id"] for x in lr if x["level_id"] == lv["id"]]
        found = sum(1 for i in ids if i in found_ids)
        done = bool(ids) and found == len(ids)
        p = prog.get(lv["id"], {})
        out.append({"id": lv["id"], "title": lv["title"], "description": lv["description"],
                    "difficulty": lv["difficulty"], "total": len(ids), "found": found,
                    "score": p.get("score", 0), "attempts": p.get("attempts", 0),
                    "status": "Completed" if done else ("Unlocked" if prev_done else "Locked")})
        prev_done = done
    return out


@app.get("/game/levels")
def game_levels(user=Depends(current_user)):
    return {"levels": levels_overview(user["id"])}


def recipe_ingredient_ids(recipe_id):
    rows = (db.table("recipe_ingredients").select("ingredient_id")
            .eq("recipe_id", recipe_id).execute().data)
    return {r["ingredient_id"] for r in rows}


@app.post("/game/round")
async def game_round(request: Request, user=Depends(current_user)):
    level_id = to_int((await body(request)).get("level_id"), "level_id")
    lv = next((l for l in levels_overview(user["id"]) if l["id"] == level_id), None)
    if not lv:
        bad("Level not found", 404)
    if lv["status"] == "Locked":
        bad("Finish the previous level first", 403)

    ids = [x["recipe_id"] for x in db.table("game_level_recipes").select("recipe_id")
           .eq("level_id", level_id).execute().data]
    found = {r["recipe_id"] for r in db.table("user_recipe_discoveries").select("recipe_id")
             .eq("user_id", user["id"]).execute().data}
    target_id = random.choice([i for i in ids if i not in found] or ids)  # random order each round

    recipe = (db.table("recipes").select("name,cuisine,difficulty,description")
              .eq("id", target_id).single().execute().data)
    need = recipe_ingredient_ids(target_id)
    pool = [r["ingredients"] for r in db.table("game_level_ingredients")
            .select("ingredients(id,name,category)").eq("level_id", level_id).execute().data]
    needed = [i for i in pool if i["id"] in need]
    decoys = [i for i in pool if i["id"] not in need]
    pantry = needed + random.sample(decoys, min(len(decoys), max(4, 10 - len(needed))))
    random.shuffle(pantry)
    return {"recipe_id": target_id, "level_id": level_id, "order": recipe,
            "needs": len(need), "pantry": pantry}


@app.post("/game/cook")
async def game_cook(request: Request, user=Depends(current_user)):
    d = await body(request)
    level_id, recipe_id = to_int(d.get("level_id"), "level_id"), to_int(d.get("recipe_id"), "recipe_id")
    raw = d.get("ingredient_ids")
    if not isinstance(raw, list):
        bad("ingredient_ids must be a list")
    picked = {to_int(x, "ingredient id") for x in raw}

    lr = db.table("game_level_recipes").select("recipe_id,points_reward").eq("level_id", level_id).execute().data
    entry = next((x for x in lr if x["recipe_id"] == recipe_id), None)
    if not entry:
        bad("That recipe is not part of this level", 400)

    need = recipe_ingredient_ids(recipe_id)
    correct = picked == need
    found = {r["recipe_id"] for r in db.table("user_recipe_discoveries").select("recipe_id")
             .eq("user_id", user["id"]).execute().data}
    points = entry["points_reward"] if correct and recipe_id not in found else 0
    if points:
        db.table("user_recipe_discoveries").upsert(
            {"user_id": user["id"], "recipe_id": recipe_id}, on_conflict="user_id,recipe_id").execute()
        found.add(recipe_id)

    prev = (db.table("user_game_progress").select("*").eq("user_id", user["id"])
            .eq("level_id", level_id).limit(1).execute().data or [{}])[0]
    done = all(x["recipe_id"] in found for x in lr)
    score = prev.get("score", 0) + points
    db.table("user_game_progress").upsert({
        "user_id": user["id"], "level_id": level_id, "score": score,
        "attempts": prev.get("attempts", 0) + 1,
        "status": "Completed" if done else "Unlocked",
        "completed_at": prev.get("completed_at") or (datetime.now(timezone.utc).isoformat() if done else None),
    }, on_conflict="user_id,level_id").execute()

    result = {"correct": correct, "points": points, "level_score": score, "level_completed": done}
    if correct:
        result["recipe"] = (db.table("recipes").select("name,cuisine,difficulty,description,ingredients,steps")
                            .eq("id", recipe_id).single().execute().data)
    else:
        result["hint"] = {"missing": len(need - picked), "extra": len(picked - need)}
    return result


# ---------- favourites (the "mini cart" / cookbook) and profile stats ----------
@app.get("/favorites")
def list_favorites(user=Depends(current_user)):
    ids = [r["recipe_id"] for r in db.table("favorites").select("recipe_id").eq("user_id", user["id"]).execute().data]
    if not ids:
        return {"recipes": []}
    rows = db.table("recipes").select("*").in_("id", ids).execute().data
    rt = rating_map()
    return {"recipes": [shape(r, rt) for r in rows]}


@app.put("/favorites/{recipe_id}")
def add_favorite(recipe_id: int, user=Depends(current_user)):
    db.table("favorites").upsert({"user_id": user["id"], "recipe_id": recipe_id},
                                 on_conflict="user_id,recipe_id").execute()
    return {"ok": True}


@app.delete("/favorites/{recipe_id}")
def remove_favorite(recipe_id: int, user=Depends(current_user)):
    db.table("favorites").delete().eq("user_id", user["id"]).eq("recipe_id", recipe_id).execute()
    return {"ok": True}


@app.get("/me/stats")
def my_stats(user=Depends(current_user)):
    uid = user["id"]
    count = lambda t, col="user_id": len(db.table(t).select(col).eq("user_id", uid).execute().data)
    score = sum(r["score"] or 0 for r in db.table("user_game_progress").select("score").eq("user_id", uid).execute().data)
    return {"saved": count("favorites"), "rated": count("recipe_ratings"),
            "discovered": count("user_recipe_discoveries"), "score": score}