# Recipe data now lives in Supabase (table: recipes). This file only holds validation rules.
NUM = ["carbs", "protein", "sugar", "fiber", "sodium", "calories", "estimated_cost"]
TXT = ["name", "description", "cuisine", "image_url"]
ARR = ["ingredients", "steps", "allergens", "diet_tags"]
DIFFICULTY = {"Easy", "Medium", "Hard"}
STATUS = {"Draft", "Published", "Archived"}


def clean_recipe(d, bad, partial=False):
    """Manual validation (replaces the old pydantic Recipe model). `bad(msg)` raises HTTP 422."""
    out = {}
    if not partial and not str(d.get("name") or "").strip():
        bad("name is required")
    for k in TXT:
        if k in d:
            if d[k] is not None and not isinstance(d[k], str):
                bad(f"{k} must be text")
            out[k] = d[k]
    for k in NUM:
        if d.get(k) is not None:
            try:
                v = float(d[k])
            except (TypeError, ValueError):
                bad(f"{k} must be a number")
            if v < 0:
                bad(f"{k} cannot be negative")
            out[k] = v
    if d.get("servings") is not None:
        if not isinstance(d["servings"], int) or d["servings"] <= 0:
            bad("servings must be an integer greater than 0")
        out["servings"] = d["servings"]
    for k, allowed in (("difficulty", DIFFICULTY), ("status", STATUS)):
        if k in d:
            if d[k] not in allowed:
                bad(f"{k} must be one of {sorted(allowed)}")
            out[k] = d[k]
    for k in ARR:
        if k in d:
            if not isinstance(d[k], list) or not all(isinstance(x, str) for x in d[k]):
                bad(f"{k} must be a list of text")
            out[k] = d[k]
    return out
