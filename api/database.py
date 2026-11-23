import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

URL = os.environ["SUPABASE_URL"]

# Server-only client (secret key bypasses RLS). Never send this key to the browser.
db = create_client(URL, os.environ["SUPABASE_SECRET_KEY"])


def auth_client():
    """Fresh client per sign-in so a user's session never leaks into `db`."""
    return create_client(URL, os.environ["SUPABASE_PUBLISHABLE_KEY"])
