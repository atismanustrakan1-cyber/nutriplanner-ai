// ---------- MVP formulas ----------
// Daily calorie: compute BMR, multiply by activity factor, apply goal adjustment, clamp [1200, 4500]
// Macros: protein_g = round(1.6*weight_kg), fat_g = round(0.8*weight_kg), carbs from remainder

/**
 * Daily calorie target using the Harris-Benedict equation.
 * goal: -1 = loss, 0 = maintain, 1 = gain.
 * Returns -1 if any inputs are invalid.
 */
function np_daily_calorie_target(weight_kg, goal, height_cm, age_years, sex, activity_level) {
  const w = Number(weight_kg);
  const h = Number(height_cm);
  const age = Number(age_years);
  const g = Number(goal);
  const s = typeof sex === "string" ? sex.trim().toUpperCase() : "";

  if (!(w > 0) || !(h > 0) || !(age > 0) || (s !== "M" && s !== "F")) {
    return -1;
  }

  let bmr;
  if (s === "M") {
    // Revised Harris-Benedict for men
    bmr = 88.362 + 13.397 * w + 4.799 * h - 5.677 * age;
  } else {
    // Revised Harris-Benedict for women
    bmr = 447.593 + 9.247 * w + 3.098 * h - 4.330 * age;
  }

  // Activity factor mapping
  // - sedentary: 1.2
  // - lightly active: 1.375
  // - moderately active: 1.55
  // - very active: 1.725
  // - extra active: 1.9
  const activityMap = {
    "sedentary": 1.2,
    "lightly active": 1.375,
    "moderately active": 1.55,
    "very active": 1.725,
    "extra active": 1.9
  };

  let activityMult = 1.375; // default: lightly active
  if (activity_level != null) {
    if (typeof activity_level === "number") {
      activityMult = activity_level;
    } else if (typeof activity_level === "string") {
      const trimmed = activity_level.trim();
      const lower = trimmed.toLowerCase();
      const asNumber = parseFloat(lower);
      if (Number.isFinite(asNumber) && asNumber > 0) {
        activityMult = asNumber;
      } else if (lower in activityMap) {
        activityMult = activityMap[lower];
      } else if (lower.replace(/_/g, " ") in activityMap) {
        activityMult = activityMap[lower.replace(/_/g, " ")];
      }
    }
  }

  let base = bmr * activityMult;

  if (g === -1) base -= 500;
  else if (g === 1) base += 300;

  base = Math.round(base);
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

  const protein_g = Math.round(1.7 * weight_kg);
  const fat_g = Math.round(calories * 0.25 / 9);
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
