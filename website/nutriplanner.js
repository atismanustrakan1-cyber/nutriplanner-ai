// ---------- Helpers ----------
function nearest50(calories) {
  return Math.round(calories / 50) * 50;
}

// ---------- Core functions ----------
function np_daily_calorie_target(user, goal) {
  // Basic validation (matches intent of your C)
  if (!user || user.weight_kg <= 0 || user.height_cm <= 0 || user.age_years <= 0) return -1;

  // Your C code currently returns early and never applies goal adjustments.
  // This JS version keeps the "intended" logic: compute base, round to nearest 50, then apply goal.
  let base;
  if (user.sex === 1) {
    base = 10 * user.weight_kg + 6.25 * user.height_cm - 5 * user.age_years + 5;
  } else {
    base = 10 * user.weight_kg + 6.25 * user.height_cm - 5 * user.age_years - 161;
  }

  let target = nearest50(base);

  if (goal === "loss") target -= 500;
  else if (goal === "gain") target += 300;

  if (target < 1200) target = 1200;
  if (target > 4500) target = 4500;

  return target;
}

function np_macro_targets(calories, weight_kg) {
  const result = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  if (calories <= 0 || weight_kg <= 0) return result;

  const protein = Math.round(1.6 * weight_kg);
  const fat = Math.round(0.8 * weight_kg);

  const remaining = calories - (protein * 4 + fat * 9);
  const carbs = remaining > 0 ? Math.floor(remaining / 4) : 0;

  result.calories = calories;
  result.protein_g = protein;
  result.fat_g = fat;
  result.carbs_g = carbs;

  return result;
}

// ---------- Daylog (replaces pointers + realloc with JS arrays) ----------
function np_daylog_init() {
  return { meals: [] };
}

function np_daylog_free(log) {
  if (!log) return;
  log.meals = [];
}

function np_daylog_add_meal(log, meal) {
  if (!log || !Array.isArray(log.meals)) return 0;
  log.meals.push({
    calories: meal.calories ?? 0,
    protein_g: meal.protein_g ?? 0,
    carbs_g: meal.carbs_g ?? 0,
    fat_g: meal.fat_g ?? 0,
  });
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

// ---------- Example usage ----------
/*
const user = { weight_kg: 70, height_cm: 175, age_years: 20, sex: 1 };
const calories = np_daily_calorie_target(user, "loss");
const macros = np_macro_targets(calories, user.weight_kg);

const log = np_daylog_init();
np_daylog_add_meal(log, { calories: 600, protein_g: 40, carbs_g: 60, fat_g: 20 });
np_daylog_add_meal(log, { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15 });
console.log(np_daylog_totals(log));
*/


// Expose functions to global scope so HTML can call them
window.np_daily_calorie_target = np_daily_calorie_target;
window.np_macro_targets = np_macro_targets;
window.np_daylog_init = np_daylog_init;
window.np_daylog_add_meal = np_daylog_add_meal;
window.np_daylog_totals = np_daylog_totals;