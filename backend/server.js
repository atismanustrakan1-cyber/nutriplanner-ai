const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  try {
    // eslint-disable-next-line global-require
    require("dotenv").config({ path: envPath });
  } catch (_err) {
    // dotenv is optional; ignore if not installed
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Some hosts (e.g. Vercel → single serverless entry) invoke the app with paths
// like /scan-food instead of /api/scan-food. Normalize so POST routes match.
app.use(function vercelApiPathFix(req, res, next) {
  var u = req.url || "";
  var q = u.indexOf("?");
  var pathOnly = q === -1 ? u : u.slice(0, q);
  var qs = q === -1 ? "" : u.slice(q);
  if (pathOnly.indexOf("/api/") === 0) {
    return next();
  }
  var fix =
    (pathOnly === "/scan-food" && req.method === "POST") ||
    (pathOnly === "/chat" && req.method === "POST") ||
    (pathOnly === "/food-search" && req.method === "GET");
  if (fix) {
    req.url = "/api" + pathOnly + qs;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const FDC_ENERGY = 1008;
const FDC_PROTEIN = 1003;
const FDC_CARBS = 1005;
const FDC_FAT = 1004;

function httpError(res, status, detail) {
  return res.status(status).json({ detail });
}

async function foodSearchHandler(req, res) {
  const apiKey = (process.env.FOOD_API_KEY || process.env.USDA_API_KEY || "").trim();
  if (!apiKey) {
    return httpError(
      res,
      500,
      "FOOD_API_KEY or USDA_API_KEY not set. Add backend/.env or Vercel → Environment Variables.",
    );
  }

  const query = (req.query.q || "").toString().trim();
  if (!query) {
    return res.json({ foods: [] });
  }

  try {
    const response = await fetch("https://api.nal.usda.gov/fdc/v1/foods/search?api_key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, pageSize: 15 }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return httpError(res, 502, "Food API endpoint not found. Check FOOD_API_KEY or USDA_API_KEY.");
      }
      return httpError(res, 502, `Food search failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    const foodsIn = Array.isArray(data.foods) ? data.foods : [];
    const results = foodsIn.map((food) => {
      const nutrients = {};
      const foodNutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
      for (const nutrient of foodNutrients) {
        const value = nutrient?.value ?? nutrient?.amount ?? 0;
        nutrients[nutrient?.nutrientId] = value;
      }

      const cal100 = Number(nutrients[FDC_ENERGY] || 0);
      const p100 = Number(nutrients[FDC_PROTEIN] || 0);
      const c100 = Number(nutrients[FDC_CARBS] || 0);
      const fat100 = Number(nutrients[FDC_FAT] || 0);
      const serving = Number(food.servingSize || 100);
      const unit = String(food.servingSizeUnit || "g").trim() || "g";
      const factor = serving / 100;

      return {
        description: String(food.description || "").trim() || "Unknown",
        caloriesPerServing: Math.round(cal100 * factor),
        proteinPerServing: Math.round(p100 * factor * 10) / 10,
        carbsPerServing: Math.round(c100 * factor * 10) / 10,
        fatPerServing: Math.round(fat100 * factor * 10) / 10,
        servingSize: serving,
        servingSizeUnit: unit,
      };
    });

    return res.json({ foods: results });
  } catch (err) {
    return httpError(res, 502, "Food search failed: " + err.message);
  }
}
app.get("/api/food-search", foodSearchHandler);
app.get("/food-search", foodSearchHandler);

const UNSAFE_DIET_PATTERNS = [
  /\b\d{2,3}\s*cal(ories)?\s*(per\s*day|a\s*day)?\b/i,
  /\bunder\s*800\s*cal(ories)?\b/i,
  /\b(500|600|700)\s*cal(ories)?\s*(per\s*day|a\s*day)?\b/i,
  /\bstarvation\b/i,
  /\bstarvation[-\s]*diet\b/i,
  /\bwater\s+fast(ing)?\b/i,
  /\b(dry|absolute)\s+fast(ing)?\b/i,
  /\bno\s+food\s+for\s+\d+\s*(days|weeks)\b/i,
];

function looksLikeUnsafeDiet(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  if (UNSAFE_DIET_PATTERNS.some((pattern) => pattern.test(t))) return true;
  return t.includes("eat nothing") || t.includes("stop eating");
}

async function chatHandler(req, res) {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    return httpError(
      res,
      500,
      "OPENROUTER_API_KEY not set. Add it to a .env file in the backend folder.",
    );
  }

  const body = req.body || {};
  const inputMessages = Array.isArray(body.messages) ? body.messages : [];
  let messages = inputMessages.map((m) => ({
    role: m?.role,
    content: m?.content,
  }));
  const context = String(body.nutrition_context || "").trim();
  const userName = String(body.user_name || "").trim();
  const nameNote = userName
    ? ` The user's name is ${userName}. Address them by name when appropriate (e.g. 'Hi ${userName}' or '${userName}, ...').`
    : "";

  const safetyNote =
    " Always prioritize safety: never recommend starvation-level intake or extreme fasting. " +
    "For generally healthy adults, do not suggest daily calories below about 1200 kcal unless a doctor is explicitly supervising; " +
    "avoid telling people to eat nothing, only drink water, or fast for multiple days. " +
    "If a user asks for unsafe or extreme plans, gently refuse and suggest safer alternatives and talking to a healthcare professional.";

  if (!context && nameNote) {
    messages = [{ role: "system", content: "You are the NutriPlanner AI assistant." + nameNote + safetyNote }, ...messages];
  } else if (context) {
    if (context.startsWith("No Day Log data")) {
      const systemMsg =
        "You are the NutriPlanner AI assistant." +
        nameNote +
        safetyNote +
        " " +
        context +
        " Never say you 'don't have access' or 'can't see' their data-you are in the same app; they just need to add data on other pages first.";
      messages = [{ role: "system", content: systemMsg }, ...messages];
    } else {
      const systemMsg =
        "You are the NutriPlanner AI assistant." +
        nameNote +
        safetyNote +
        " The user's Day Log data is pasted inside EACH of their messages below. " +
        "Use that data to answer. Compare meals to targets, say over/under, give brief advice. Never say you don't have access.";
      messages = [{ role: "system", content: systemMsg }, ...messages];
      messages = messages.map((msg) => {
        if (msg.role !== "user") return msg;
        return {
          ...msg,
          content: "[My Day Log - use this data]\n" + context + "\n\n[My question]\n" + msg.content,
        };
      });
    }
  }

  const payload = {
    model: "openai/gpt-3.5-turbo",
    messages,
    max_tokens: 1024,
  };

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nutriplanner-ai.local",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      return httpError(res, 502, `OpenRouter request failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = String(data?.choices?.[0]?.message?.content || "");

    if (looksLikeUnsafeDiet(content)) {
      const safeMsg =
        "I'm not able to support starvation-level dieting or extreme fasting. " +
        "For most adults, eating only a few hundred calories per day or going multiple days with no food can be dangerous. " +
        "Instead, aim for a gradual, sustainable calorie deficit and balanced macros, and check in with a doctor or registered dietitian " +
        "before making big changes to your intake.";
      return res.json({ message: safeMsg, role: "assistant" });
    }

    return res.json({ message: content, role: "assistant" });
  } catch (err) {
    return httpError(res, 502, err.message || "Invalid response from AI");
  }
}
app.post("/api/chat", chatHandler);
app.post("/chat", chatHandler);

const SCAN_FOOD_PROMPT = `You are helping a meal-logging app. Look at this image carefully.

First decide whether the image clearly shows REAL edible food that a person would log as a meal or snack. Set "is_real_food" to true ONLY if you can see actual food (prepared dish, whole ingredients clearly intended as food, etc.). Set it to false for: toys or models of food, drawings or photos of food on a screen, pets, people without food, empty plates, packaging with no visible food, drinks alone only if ambiguous, random objects, or anything where you cannot identify real food.

Reply with ONLY one JSON object, no markdown or other text, with these exact keys:
"is_real_food" (boolean),
"rejection_reason" (string: if is_real_food is false, one short sentence for the user explaining why; if true, use ""),
"name" (string: short meal name when is_real_food is true; otherwise "Not food" or similar),
"calories" (number: estimated kcal when is_real_food is true, else 0),
"protein" (number: grams),
"carbs" (number: grams),
"fat" (number: grams).
Use 0 for macros you cannot estimate. Do not invent nutrition for non-food images.

Example when food is visible: {"is_real_food":true,"rejection_reason":"","name":"Grilled chicken salad","calories":420,"protein":38,"carbs":12,"fat":22}
Example when not food: {"is_real_food":false,"rejection_reason":"This looks like a toy or model, not real food.","name":"Not food","calories":0,"protein":0,"carbs":0,"fat":0}`;

async function scanFoodHandler(req, res) {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    return httpError(
      res,
      500,
      "OPENROUTER_API_KEY not set. Add it to a .env file in the backend folder.",
    );
  }

  let raw = String(req.body?.image_base64 || "").trim();
  if (!raw) return httpError(res, 400, "image_base64 is required");
  if (raw.startsWith("data:")) {
    raw = raw.includes(",") ? raw.split(",", 2)[1] : "";
  }
  if (!raw) return httpError(res, 400, "Invalid image_base64");

  const imageUrl = "data:image/jpeg;base64," + raw;
  const payload = {
    model: "openai/gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: SCAN_FOOD_PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 256,
  };

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nutriplanner-ai.local",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      return httpError(res, 502, `Scan failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = String(data?.choices?.[0]?.message?.content || "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
      return httpError(res, 502, "Could not parse nutrition from image");
    }

    let out;
    try {
      out = JSON.parse(text.slice(start, end + 1));
    } catch {
      return httpError(res, 502, "Could not parse nutrition from image");
    }

    const isRealFood = out.is_real_food !== false;
    const rejectionReason =
      String(out.rejection_reason || "").trim() ||
      "This photo does not look like food you can log. Try a clear picture of your meal.";

    const name = String(out.name || "").trim() || (isRealFood ? "Scanned meal" : "Not food");
    const calories = Math.max(0, parseInt(out.calories || 0, 10));
    const protein = Math.max(0, Math.round(Number(out.protein || 0) * 10) / 10);
    const carbs = Math.max(0, Math.round(Number(out.carbs || 0) * 10) / 10);
    const fat = Math.max(0, Math.round(Number(out.fat || 0) * 10) / 10);

    return res.json({
      is_real_food: isRealFood,
      rejection_reason: isRealFood ? "" : rejectionReason,
      name,
      calories: Number.isFinite(calories) ? calories : 0,
      protein: Number.isFinite(protein) ? protein : 0,
      carbs: Number.isFinite(carbs) ? carbs : 0,
      fat: Number.isFinite(fat) ? fat : 0,
    });
  } catch (err) {
    return httpError(res, 502, "Invalid nutrition format: " + err.message);
  }
}
app.post("/api/scan-food", scanFoodHandler);
app.post("/scan-food", scanFoodHandler);

const websiteDir = path.join(__dirname, "..", "website");
if (fs.existsSync(websiteDir)) {
  app.use(express.static(websiteDir));
  app.get(/^(?!\/api\/|\/health$).*/, (_req, res) => {
    return res.sendFile(path.join(websiteDir, "index.html"));
  });
}

const port = Number(process.env.PORT || 8000);
if (require.main === module) {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`NutriPlanner backend running on http://localhost:${port}`);
  });
}

module.exports = app;
