import json
import os
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import requests

# Load .env from backend directory
from pathlib import Path
_env = Path(__file__).resolve().parent / ".env"
if _env.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env)
    except ImportError:
        pass

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    nutrition_context: str | None = None
    user_name: str | None = None


class ScanFoodRequest(BaseModel):
    image_base64: str  # raw base64 (no data URL prefix)


@app.get("/health")
def health():
    return {"status": "ok"}


# USDA FoodData Central: nutrient IDs for search response (per 100g)
_FDC_ENERGY = 1008
_FDC_PROTEIN = 1003
_FDC_CARBS = 1005
_FDC_FAT = 1004


@app.get("/api/food-search")
def food_search(q: str = ""):
    """Search foods via USDA FoodData Central. Requires FOOD_API_KEY in .env."""
    api_key = os.environ.get("FOOD_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="FOOD_API_KEY not set. Add it to a .env file in the backend folder.",
        )
    query = (q or "").strip()
    if not query:
        return {"foods": []}
    url = "https://api.nal.usda.gov/fdc/v1/foods/search"
    try:
        # USDA FDC accepts POST with JSON body (GET with params may 404)
        r = requests.post(
            url,
            params={"api_key": api_key},
            json={"query": query, "pageSize": 15},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            raise HTTPException(status_code=502, detail="Food API endpoint not found. Check FOOD_API_KEY.")
        raise HTTPException(status_code=502, detail="Food search failed: " + str(e))
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail="Food search failed: " + str(e))
    except (ValueError, KeyError):
        raise HTTPException(status_code=502, detail="Invalid response from food API")

    foods_in = data.get("foods") or []
    results = []
    for f in foods_in:
        def _amt(n): return n.get("value") or n.get("amount") or 0
        nutrients = {n.get("nutrientId"): _amt(n) for n in f.get("foodNutrients") or []}
        # Values in API are per 100g
        cal_100 = nutrients.get(_FDC_ENERGY) or 0
        p_100 = nutrients.get(_FDC_PROTEIN) or 0
        c_100 = nutrients.get(_FDC_CARBS) or 0
        fat_100 = nutrients.get(_FDC_FAT) or 0
        serving = f.get("servingSize") or 100
        unit = (f.get("servingSizeUnit") or "g").strip() or "g"
        factor = serving / 100.0
        results.append({
            "description": (f.get("description") or "").strip() or "Unknown",
            "caloriesPerServing": round(cal_100 * factor, 0),
            "proteinPerServing": round(p_100 * factor, 1),
            "carbsPerServing": round(c_100 * factor, 1),
            "fatPerServing": round(fat_100 * factor, 1),
            "servingSize": serving,
            "servingSizeUnit": unit,
        })
    return {"foods": results}


_UNSAFE_DIET_PATTERNS = [
    r"\b\d{2,3}\s*cal(ories)?\s*(per\s*day|a\s*day)?\b",  # "300 calories a day"
    r"\bunder\s*800\s*cal(ories)?\b",
    r"\b(500|600|700)\s*cal(ories)?\s*(per\s*day|a\s*day)?\b",
    r"\bstarvation\b",
    r"\bstarvation[-\s]*diet\b",
    r"\bwater\s+fast(ing)?\b",
    r"\b(dry|absolute)\s+fast(ing)?\b",
    r"\bno\s+food\s+for\s+\d+\s*(days|weeks)\b",
]


def _looks_like_unsafe_diet(text: str) -> bool:
    """Heuristic filter for obviously unsafe diet advice (very low calories / extreme fasting)."""
    if not text:
        return False
    t = text.lower()
    # Very low explicit calorie targets
    for pat in _UNSAFE_DIET_PATTERNS:
        if re.search(pat, t, re.IGNORECASE):
            return True
    # Generic "eat nothing" style advice
    if "eat nothing" in t or "stop eating" in t:
        return True
    return False


@app.post("/api/chat")
def chat_completion(req: ChatRequest):
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY not set. Add it to a .env file in the backend folder.",
        )
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    context = (req.nutrition_context or "").strip()
    user_name = (req.user_name or "").strip()
    name_note = f" The user's name is {user_name}. Address them by name when appropriate (e.g. 'Hi {user_name}' or '{user_name}, ...')." if user_name else ""

    safety_note = (
        " Always prioritize safety: never recommend starvation-level intake or extreme fasting. "
        "For generally healthy adults, do not suggest daily calories below about 1200 kcal unless a doctor is explicitly supervising; "
        "avoid telling people to eat nothing, only drink water, or fast for multiple days. "
        "If a user asks for unsafe or extreme plans, gently refuse and suggest safer alternatives and talking to a healthcare professional."
    )

    if not context and name_note:
        messages = [{"role": "system", "content": "You are the NutriPlanner AI assistant." + name_note + safety_note}] + messages
    elif context:
        if context.startswith("No Day Log data"):
            system_msg = (
                "You are the NutriPlanner AI assistant." + name_note + safety_note + " " + context
                + " Never say you 'don't have access' or 'can't see' their data—you are in the same app; they just need to add data on other pages first."
            )
            messages = [{"role": "system", "content": system_msg}] + messages
        else:
            system_msg = (
                "You are the NutriPlanner AI assistant." + name_note + safety_note + " "
                "The user's Day Log data is pasted inside EACH of their messages below. "
                "Use that data to answer. Compare meals to targets, say over/under, give brief advice. Never say you don't have access."
            )
            messages = [{"role": "system", "content": system_msg}] + messages
            # Inject Day Log into EVERY user message so the model cannot miss it
            for i in range(len(messages)):
                if messages[i].get("role") == "user":
                    messages[i]["content"] = (
                        "[My Day Log — use this data]\n" + context + "\n\n[My question]\n" + messages[i]["content"]
                    )
    payload = {
        "model": "openai/gpt-3.5-turbo",
        "messages": messages,
        "max_tokens": 1024,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nutriplanner-ai.local",
    }
    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            json=payload,
            headers=headers,
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        content = message.get("content", "") or ""
        # Final safety filter: if the model returns clearly unsafe diet advice, replace with a safer message.
        if _looks_like_unsafe_diet(content):
            safe_msg = (
                "I’m not able to support starvation-level dieting or extreme fasting. "
                "For most adults, eating only a few hundred calories per day or going multiple days with no food can be dangerous. "
                "Instead, aim for a gradual, sustainable calorie deficit and balanced macros, and check in with a doctor or registered dietitian "
                "before making big changes to your intake."
            )
            return {"message": safe_msg, "role": "assistant"}
        return {"message": content, "role": "assistant"}
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=str(e))
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=502, detail="Invalid response from AI")


_SCAN_FOOD_PROMPT = """Look at this image of food. Reply with ONLY a single JSON object, no other text, with these exact keys:
"name" (string: short meal name, e.g. "Grilled chicken salad"),
"calories" (number: estimated kcal),
"protein" (number: grams),
"carbs" (number: grams),
"fat" (number: grams).
Use 0 for any value you cannot estimate. Example: {"name":"Oatmeal with banana","calories":320,"protein":12,"carbs":58,"fat":6}"""


@app.post("/api/scan-food")
def scan_food(req: ScanFoodRequest):
    """Analyze a food image via vision AI and return estimated name + nutrition (JSON)."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY not set. Add it to a .env file in the backend folder.",
        )
    raw = (req.image_base64 or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="image_base64 is required")
    # Support both raw base64 and optional data URL prefix
    if raw.startswith("data:"):
        raw = raw.split(",", 1)[-1] if "," in raw else ""
    if not raw:
        raise HTTPException(status_code=400, detail="Invalid image_base64")
    url = "data:image/jpeg;base64," + raw
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": _SCAN_FOOD_PROMPT},
                {"type": "image_url", "image_url": {"url": url}},
            ],
        }
    ]
    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": messages,
        "max_tokens": 256,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nutriplanner-ai.local",
    }
    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            json=payload,
            headers=headers,
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        choice = data.get("choices", [{}])[0]
        text = (choice.get("message", {}).get("content") or "").strip()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail="Scan failed: " + str(e))
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Invalid response from vision API")
    # Parse JSON from response (model might wrap in markdown code block)
    json_match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if not json_match:
        raise HTTPException(status_code=502, detail="Could not parse nutrition from image")
    try:
        out = json.loads(json_match.group())
        name = (out.get("name") or "").strip() or "Scanned meal"
        cal = int(out.get("calories") or 0)
        p = float(out.get("protein") or 0)
        c = float(out.get("carbs") or 0)
        f = float(out.get("fat") or 0)
        return {
            "name": name,
            "calories": max(0, cal),
            "protein": max(0, round(p, 1)),
            "carbs": max(0, round(c, 1)),
            "fat": max(0, round(f, 1)),
        }
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=502, detail="Invalid nutrition format: " + str(e))


# Serve static website from parent/website when running from backend dir
_website = Path(__file__).resolve().parent.parent / "website"
if _website.exists():
    app.mount("/", StaticFiles(directory=str(_website), html=True), name="static")
