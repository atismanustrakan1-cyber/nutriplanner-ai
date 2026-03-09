// ---------- MVP formulas (match docs/requirements.txt and C core) ----------
// Daily calorie: base = round(30 * weight_kg); loss: -500, gain: +300; clamp [1200, 4500]
// Macros: protein_g = round(1.6*weight_kg), fat_g = round(0.8*weight_kg), carbs from remainder

/**
 * Daily calorie target. goal: -1 = loss, 0 = maintain, 1 = gain.
 * Returns -1 if weight_kg <= 0.
 */
function np_daily_calorie_target(weight_kg, goal) {
  if (weight_kg <= 0) return -1;
  let base = Math.round(30 * weight_kg);
  if (goal === -1) base -= 500;
  else if (goal === 1) base += 300;
  if (base < 1200) base = 1200;
  if (base > 4500) base = 4500;
  return base;
}

/**
 * Macro targets in grams. Returns { protein_g, carbs_g, fat_g }.
 * If calories <= 0 or weight_kg <= 0, returns all zeros.
 */
function np_macro_targets(calories, weight_kg) {
  const result = { protein_g: 0, carbs_g: 0, fat_g: 0 };
  if (calories <= 0 || weight_kg <= 0) return result;

  const protein_g = Math.round(1.6 * weight_kg);
  const fat_g = Math.round(0.8 * weight_kg);
  const remainder = calories - (protein_g * 4 + fat_g * 9);
  const carbs_g = Math.max(0, Math.floor(remainder / 4));

  result.protein_g = protein_g;
  result.fat_g = fat_g;
  result.carbs_g = carbs_g;
  return result;
}

// ---------- Day log (matches np_daylog_t: list of meals, totals) ----------
function np_daylog_init() {
  return { meals: [] };
}

function np_daylog_add_meal(log, meal) {
  if (!log || !Array.isArray(log.meals)) return 0;
  const cal = Math.max(0, Math.floor(Number(meal.calories) || 0));
  const p = Math.max(0, Math.floor(Number(meal.protein_g) || 0));
  const c = Math.max(0, Math.floor(Number(meal.carbs_g) || 0));
  const f = Math.max(0, Math.floor(Number(meal.fat_g) || 0));
  const name = typeof meal.name === "string" ? meal.name.trim() : "";
  log.meals.push({ calories: cal, protein_g: p, carbs_g: c, fat_g: f, name: name });
  return 1;
}

function np_daylog_totals(log) {
  const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  if (!log || !Array.isArray(log.meals)) return totals;
  for (const m of log.meals) {
    totals.calories += m.calories || 0;
    totals.protein_g += m.protein_g || 0;
    totals.carbs_g += m.carbs_g || 0;
    totals.fat_g += m.fat_g || 0;
  }
  return totals;
}

// Expose for use from HTML/script.js
window.np_daily_calorie_target = np_daily_calorie_target;
window.np_macro_targets = np_macro_targets;
window.np_daylog_init = np_daylog_init;
window.np_daylog_add_meal = np_daylog_add_meal;
window.np_daylog_totals = np_daylog_totals;
