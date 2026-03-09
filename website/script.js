(function () {
  var STORAGE_TARGETS = "nutriplanner_targets";
  var STORAGE_MEALS = "nutriplanner_meals";
  var DEFAULT_TARGETS = { targetCalories: 2100, targetMacros: { protein_g: 112, carbs_g: 230, fat_g: 56 } };

  function setYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  function copyText(text, msgEl) {
    navigator.clipboard.writeText(text).then(function () {
      if (msgEl) msgEl.textContent = "Copied.";
      setTimeout(function () { if (msgEl) msgEl.textContent = ""; }, 1500);
    }).catch(function () {
      if (msgEl) msgEl.textContent = "Copy failed. Select and copy manually.";
    });
  }

  function getStoredTargets() {
    try {
      var raw = localStorage.getItem(STORAGE_TARGETS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function setStoredTargets(cal, macros) {
    try {
      localStorage.setItem(STORAGE_TARGETS, JSON.stringify({ targetCalories: cal, targetMacros: macros }));
    } catch (e) {}
  }

  function getStoredMeals() {
    try {
      var raw = localStorage.getItem(STORAGE_MEALS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  function setStoredMeals(meals) {
    try {
      localStorage.setItem(STORAGE_MEALS, JSON.stringify(meals));
    } catch (e) {}
  }

  // ----- Targets page -----
  function goalLabel(goal) {
    var g = parseInt(goal, 10);
    if (g === -1) return "loss (-1)";
    if (g === 1) return "gain (1)";
    return "maintain (0)";
  }

  function macrosFromPercentages(cal, pctP, pctF) {
    var calP = cal * pctP / 100;
    var calF = cal * pctF / 100;
    var calC = Math.max(0, cal - calP - calF);
    return {
      protein_g: Math.round(calP / 4),
      carbs_g: Math.round(calC / 4),
      fat_g: Math.round(calF / 9)
    };
  }

  function getDietTypeAndMessage(pctP, pctC, pctF) {
    var dietType = "Balanced";
    var note = "";
    if (pctF >= 50 && pctC <= 25) {
      dietType = "Keto-style";
      note = "—low carbs and high fat to support ketosis. Plan meals around fats, moderate protein, and minimal carbs.";
    } else if (pctP >= 30) {
      dietType = "High protein";
      note = "—prioritize protein at each meal to support muscle and satiety while keeping carbs and fat moderate.";
    } else if (pctC < 25) {
      dietType = "Low carb";
      note = "—fewer carbs and more fat/protein. Good for steady energy and appetite control across meals.";
    } else if (pctF < 22) {
      dietType = "Low fat";
      note = "—carbs and protein carry most calories. Suits higher meal volume and lower fat intake.";
    } else if (pctC >= 55) {
      dietType = "Carb-focused";
      note = "—plenty of carbs for energy and recovery; pair with protein at meals for balance.";
    } else {
      note = "—steady energy from carbs, solid protein for muscle, and enough fat for hormones. Works well for most meals.";
    }
    return { dietType: dietType, note: note };
  }

  function updateTargetRightPanel(cal, macros, weightKg) {
    var calP = macros.protein_g * 4;
    var calC = macros.carbs_g * 4;
    var calF = macros.fat_g * 9;
    var totalCal = calP + calC + calF;
    var pctP = totalCal > 0 ? (calP / totalCal) * 100 : 0;
    var pctC = totalCal > 0 ? (calC / totalCal) * 100 : 0;
    var pctF = totalCal > 0 ? (calF / totalCal) * 100 : 0;

    var aiEl = document.getElementById("targetAiSuggestion");
    if (aiEl) {
      if (totalCal <= 0) {
        aiEl.textContent = "";
      } else {
        var r = getDietTypeAndMessage(pctP, pctC, pctF);
        var split = Math.round(pctP) + "% P / " + Math.round(pctC) + "% C / " + Math.round(pctF) + "% F";
        aiEl.innerHTML = "AI suggestion: Your customized macro split (" + split + ") fits a <strong>" + r.dietType + "</strong> diet " + r.note;
      }
    }

    var mathEl = document.getElementById("targetMathBreakdown");
    if (mathEl) {
      mathEl.innerHTML = totalCal > 0
        ? "<li><strong>Protein:</strong> " + calP + " kcal (" + macros.protein_g + "g × 4 kcal)</li>" +
          "<li><strong>Carbs:</strong> " + calC + " kcal (" + macros.carbs_g + "g × 4 kcal)</li>" +
          "<li><strong>Fat:</strong> " + calF + " kcal (" + macros.fat_g + "g × 9 kcal)</li>"
        : "<li class=\"muted\">Calculate targets to see breakdown.</li>";
    }

    var gkgEl = document.getElementById("targetGperKg");
    if (gkgEl && weightKg > 0) {
      var pKg = (macros.protein_g / weightKg).toFixed(1);
      var cKg = (macros.carbs_g / weightKg).toFixed(1);
      var fKg = (macros.fat_g / weightKg).toFixed(1);
      gkgEl.innerHTML = "<li>Protein: " + pKg + " g/kg</li><li>Carbs: " + cKg + " g/kg</li><li>Fat: " + fKg + " g/kg</li>";
    } else if (gkgEl) {
      gkgEl.innerHTML = "<li class=\"muted\">Enter weight to see g/kg.</li>";
    }

    var spP = document.getElementById("targetSliderPctP");
    var spC = document.getElementById("targetSliderPctC");
    var spF = document.getElementById("targetSliderPctF");
    var slP = document.getElementById("sliderProtein");
    var slF = document.getElementById("sliderFat");
    if (spP) spP.textContent = Math.round(pctP);
    if (spC) spC.textContent = Math.round(pctC);
    if (spF) spF.textContent = Math.round(pctF);
    if (slP) slP.value = Math.round(pctP);
    if (slF) slF.value = Math.round(pctF);
  }

  function renderTargetOutput(cal, macros, isError) {
    var resultsEl = document.getElementById("targetResults");
    var errorEl = document.getElementById("targetError");
    if (!resultsEl || !errorEl) return;

    if (isError) {
      resultsEl.style.display = "none";
      errorEl.style.display = "block";
      errorEl.textContent = cal;
      return;
    }
    resultsEl.style.display = "";
    errorEl.style.display = "none";

    function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
    set("outCal", cal);
    set("outProtein", macros.protein_g);
    set("outCarbs", macros.carbs_g);
    set("outFat", macros.fat_g);

    var calP = macros.protein_g * 4;
    var calC = macros.carbs_g * 4;
    var calF = macros.fat_g * 9;
    var totalCal = calP + calC + calF;
    var pieEl = document.getElementById("targetPie");
    var legendEl = document.getElementById("targetLegend");
    if (pieEl && legendEl) {
      if (totalCal <= 0) {
        pieEl.style.background = "var(--border)";
        legendEl.innerHTML = "<span class=\"target-legend-item\"><i style=\"background:var(--muted)\"></i>No data</span>";
      } else {
        var pctP = (calP / totalCal) * 100;
        var pctC = (calC / totalCal) * 100;
        var pctF = (calF / totalCal) * 100;
        pieEl.style.background = "conic-gradient(#7c9cf8 0% " + pctP + "%, #a78bfa " + pctP + "% " + (pctP + pctC) + "%, #e4b363 " + (pctP + pctC) + "% 100%)";
        legendEl.innerHTML =
          "<span class=\"target-legend-item\"><i style=\"background:#7c9cf8\"></i>Protein " + Math.round(pctP) + "%</span>" +
          "<span class=\"target-legend-item\"><i style=\"background:#a78bfa\"></i>Carbs " + Math.round(pctC) + "%</span>" +
          "<span class=\"target-legend-item\"><i style=\"background:#e4b363\"></i>Fat " + Math.round(pctF) + "%</span>";
      }
    }

    var weightEl = document.getElementById("weightInput");
    var weightKg = weightEl ? parseFloat(weightEl.value) || 0 : 0;
    updateTargetRightPanel(cal, macros, weightKg);
  }

  function calculateTargets() {
    var weightEl = document.getElementById("weightInput");
    var goalEl = document.getElementById("goalInput");
    var overrideEl = document.getElementById("calOverride");
    var overrideToastEl = document.getElementById("calOverrideToast");
    if (!weightEl || !goalEl) return;

    var weight = parseFloat(weightEl.value);
    var goal = parseInt(goalEl.value, 10);
    var override = overrideEl && overrideEl.value.trim() !== "" ? parseInt(overrideEl.value, 10) : null;

    if (!weight || weight <= 0) {
      renderTargetOutput("Enter a valid weight (kg).", null, true);
      return;
    }

    var cal = override;
    var forcedMin = false;
    if (cal == null || cal <= 0) {
      cal = window.np_daily_calorie_target(weight, goal);
      if (cal === -1) {
        renderTargetOutput("Invalid weight.", null, true);
        if (overrideToastEl) {
          overrideToastEl.textContent = "";
          overrideToastEl.classList.remove("show");
        }
        return;
      }
    } else {
      if (cal < 1200) forcedMin = true;
      cal = Math.max(1200, Math.min(4500, cal));
    }

    var macros = window.np_macro_targets(cal, weight);
    setStoredTargets(cal, macros);
    renderTargetOutput(cal, macros, false);

    if (overrideToastEl) {
      if (forcedMin) {
        overrideToastEl.textContent = "That calorie goal is very low. We automatically set it to 1200 kcal as a minimum.";
        overrideToastEl.classList.add("show");
        clearTimeout(calculateTargets._toastTimer);
        calculateTargets._toastTimer = setTimeout(function () {
          overrideToastEl.classList.remove("show");
        }, 3500);
      } else {
        overrideToastEl.classList.remove("show");
      }
    }
    if (!weightEl || !goalEl) return;
  }

  function applySliderMacros() {
    var sliderP = document.getElementById("sliderProtein");
    var sliderF = document.getElementById("sliderFat");
    var stored = getStoredTargets();
    if (!sliderP || !sliderF || !stored) return;
    var cal = stored.targetCalories;
    var pctP = parseInt(sliderP.value, 10);
    var pctF = parseInt(sliderF.value, 10);
    var pctC = 100 - pctP - pctF;
    if (pctC < 0) {
      pctC = 0;
      pctF = 100 - pctP;
      sliderF.value = pctF;
    }
    var macros = macrosFromPercentages(cal, pctP, pctF);
    setStoredTargets(cal, macros);
    renderTargetOutput(cal, macros, false);
  }

  function initTargetsPage() {
    var calcBtn = document.getElementById("calculate");
    if (calcBtn) calcBtn.addEventListener("click", calculateTargets);

    var sliderP = document.getElementById("sliderProtein");
    var sliderF = document.getElementById("sliderFat");
    if (sliderP) sliderP.addEventListener("input", applySliderMacros);
    if (sliderF) sliderF.addEventListener("input", applySliderMacros);

    var saved = getStoredTargets();
    if (saved) {
      renderTargetOutput(saved.targetCalories, saved.targetMacros, false);
    } else {
      setStoredTargets(DEFAULT_TARGETS.targetCalories, DEFAULT_TARGETS.targetMacros);
      renderTargetOutput(DEFAULT_TARGETS.targetCalories, DEFAULT_TARGETS.targetMacros, false);
    }
  }

  // ----- Day log page -----
  function renderMealsList(daylog, listEl, emptyEl) {
    if (!listEl || !emptyEl) return;
    var meals = daylog && daylog.meals ? daylog.meals : [];
    listEl.innerHTML = "";
    if (meals.length === 0) {
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";
    meals.forEach(function (m, i) {
      var li = document.createElement("li");
      li.className = "meal-item";
      var title = (m.name && m.name.trim()) ? "Meal " + (i + 1) + ": " + m.name.trim() : "Meal " + (i + 1);
      var macros = "P: " + m.protein_g + "g • C: " + m.carbs_g + "g • F: " + m.fat_g + "g";
      li.innerHTML =
        "<div class=\"meal-item-left\">" +
          "<span class=\"meal-item-name\">" + title.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</span>" +
          "<span class=\"meal-item-macros\">" + macros + "</span>" +
        "</div>" +
        "<div class=\"meal-item-actions\">" +
          "<span class=\"meal-item-cal\">" + m.calories + " kcal</span>" +
          "<button type=\"button\" class=\"btn link small meal-edit-btn\" data-idx=\"" + i + "\">Edit</button>" +
          "<button type=\"button\" class=\"btn ghost small meal-delete-btn\" data-idx=\"" + i + "\">Remove</button>" +
        "</div>";
      listEl.appendChild(li);
    });
  }

  function progressBar(target, current, barColor) {
    var over = current > target;
    var pct = target <= 0 ? 0 : Math.min(100, (current / target) * 100);
    if (over) pct = 100;
    var color = over ? "var(--error)" : barColor;
    return "<div class=\"progress-bar-track\"><div class=\"progress-bar-fill" + (over ? " over" : "") + "\" style=\"width:" + pct + "%;background:" + color + "\"></div></div>";
  }
  function renderProgress(targetCal, targetMacros, totals, progressEl) {
    if (!progressEl) return;
    var remCal = targetCal - totals.calories;
    var remP = targetMacros.protein_g - totals.protein_g;
    var remC = targetMacros.carbs_g - totals.carbs_g;
    var remF = targetMacros.fat_g - totals.fat_g;

    function cell(v) {
      var over = v < 0;
      var text = v >= 0 ? String(v) : "+" + Math.abs(v) + " over";
      return "<td class=\"rem" + (over ? " over" : "") + "\">" + text + "</td>";
    }
    var barCal = progressBar(targetCal, totals.calories, "var(--accent)");
    var barP = progressBar(targetMacros.protein_g, totals.protein_g, "#7c9cf8");
    var barC = progressBar(targetMacros.carbs_g, totals.carbs_g, "#a78bfa");
    var barF = progressBar(targetMacros.fat_g, totals.fat_g, "#e4b363");
    var html = "<table class=\"progress-table\"><thead><tr><th></th><th>Target</th><th>Total</th><th>Remaining</th></tr></thead><tbody>" +
      "<tr><td>Calories</td><td>" + targetCal + "</td><td>" + totals.calories + "</td>" + cell(remCal) + "</tr><tr class=\"progress-bar-row\"><td colspan=\"4\">" + barCal + "</td></tr>" +
      "<tr><td>Protein (g)</td><td>" + targetMacros.protein_g + "</td><td>" + totals.protein_g + "</td>" + cell(remP) + "</tr><tr class=\"progress-bar-row\"><td colspan=\"4\">" + barP + "</td></tr>" +
      "<tr><td>Carbs (g)</td><td>" + targetMacros.carbs_g + "</td><td>" + totals.carbs_g + "</td>" + cell(remC) + "</tr><tr class=\"progress-bar-row\"><td colspan=\"4\">" + barC + "</td></tr>" +
      "<tr><td>Fat (g)</td><td>" + targetMacros.fat_g + "</td><td>" + totals.fat_g + "</td>" + cell(remF) + "</tr><tr class=\"progress-bar-row\"><td colspan=\"4\">" + barF + "</td></tr>" +
      "</tbody></table>";
    progressEl.innerHTML = html;
  }

  function initDaylogPage() {
    var addBtn = document.getElementById("addMeal");
    var listEl = document.getElementById("mealsList");
    var emptyEl = document.getElementById("mealsEmpty");
    var progressEl = document.getElementById("progressOutput");
    if (!addBtn) return;

    var nameEl = document.getElementById("mealName");
    var calEl = document.getElementById("mealCal");
    var pEl = document.getElementById("mealP");
    var cEl = document.getElementById("mealC");
    var fEl = document.getElementById("mealF");
    var addBtnDefaultText = addBtn.textContent || "Add meal";
    var editingIndex = null;

    var targets = getStoredTargets() || DEFAULT_TARGETS;
    var targetCal = targets.targetCalories;
    var targetMacros = targets.targetMacros;

    var daylog = window.np_daylog_init();
    var storedMeals = getStoredMeals();
    storedMeals.forEach(function (m) {
      window.np_daylog_add_meal(daylog, m);
    });

    function saveAndRender() {
      setStoredMeals(daylog.meals);
      renderMealsList(daylog, listEl, emptyEl);
      var totals = window.np_daylog_totals(daylog);
      renderProgress(targetCal, targetMacros, totals, progressEl);
    }

    addBtn.addEventListener("click", function () {
      var name = nameEl && nameEl.value ? nameEl.value.trim() : "";
      var cal = parseInt(calEl.value, 10) || 0;
      var p = parseInt(pEl.value, 10) || 0;
      var c = parseInt(cEl.value, 10) || 0;
      var f = parseInt(fEl.value, 10) || 0;
      if (cal < 0 || p < 0 || c < 0 || f < 0) return;

      var mealData = { name: name, calories: cal, protein_g: p, carbs_g: c, fat_g: f };

      if (editingIndex !== null && editingIndex >= 0 && editingIndex < daylog.meals.length) {
        daylog.meals[editingIndex] = mealData;
        editingIndex = null;
        addBtn.textContent = addBtnDefaultText;
      } else {
        if (!window.np_daylog_add_meal(daylog, mealData)) {
          return;
        }
      }

      if (nameEl) nameEl.value = "";
      if (calEl) calEl.value = "";
      if (pEl) pEl.value = "";
      if (cEl) cEl.value = "";
      if (fEl) fEl.value = "";
      if (nameEl) nameEl.focus();
      saveAndRender();
    });

    ["mealName", "mealCal", "mealP", "mealC", "mealF"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("keydown", function (e) { if (e.key === "Enter") addBtn.click(); });
    });

    if (listEl) {
      listEl.addEventListener("click", function (e) {
        var editBtn = e.target.closest && e.target.closest(".meal-edit-btn");
        var deleteBtn = e.target.closest && e.target.closest(".meal-delete-btn");

        if (editBtn) {
          var idx = parseInt(editBtn.getAttribute("data-idx"), 10);
          if (isNaN(idx) || idx < 0 || idx >= daylog.meals.length) return;
          var m = daylog.meals[idx];
          if (!m) return;
          if (nameEl) nameEl.value = m.name || "";
          if (calEl) calEl.value = m.calories != null ? String(m.calories) : "";
          if (pEl) pEl.value = m.protein_g != null ? String(m.protein_g) : "";
          if (cEl) cEl.value = m.carbs_g != null ? String(m.carbs_g) : "";
          if (fEl) fEl.value = m.fat_g != null ? String(m.fat_g) : "";
          editingIndex = idx;
          addBtn.textContent = "Update meal";
          if (nameEl) nameEl.focus();
          return;
        }

        if (deleteBtn) {
          var dIdx = parseInt(deleteBtn.getAttribute("data-idx"), 10);
          if (isNaN(dIdx) || dIdx < 0 || dIdx >= daylog.meals.length) return;
          daylog.meals.splice(dIdx, 1);
          if (editingIndex === dIdx) {
            editingIndex = null;
            addBtn.textContent = addBtnDefaultText;
            if (nameEl) nameEl.value = "";
            if (calEl) calEl.value = "";
            if (pEl) pEl.value = "";
            if (cEl) cEl.value = "";
            if (fEl) fEl.value = "";
          }
          saveAndRender();
        }
      });
    }

    var foodSearchInput = document.getElementById("foodSearchInput");
    var foodSearchBtn = document.getElementById("foodSearchBtn");
    var foodSearchResults = document.getElementById("foodSearchResults");
    var foodSearchAutocomplete = document.getElementById("foodSearchAutocomplete");
    var apiBase = window.location.origin;
    function searchFailMessage(err, is404) {
      if (is404 || (err && (err.message === "Not Found" || err.message.indexOf("404") !== -1)))
        return "Search unavailable. Run the app from the backend server: in terminal run \u201ccd backend && python -m uvicorn server:app --port 8000\u201d then open http://localhost:8000";
      return "Search failed: " + (err && err.message ? err.message : "Check FOOD_API_KEY in backend/.env");
    }
    if (foodSearchBtn && foodSearchResults) {
      function hideAutocomplete() { if (foodSearchAutocomplete) { foodSearchAutocomplete.setAttribute("hidden", ""); foodSearchAutocomplete.innerHTML = ""; } }
      var foodSearchEmptyState = document.getElementById("foodSearchEmptyState");
      function runFoodSearch() {
        hideAutocomplete();
        var q = foodSearchInput ? foodSearchInput.value.trim() : "";
        if (!q) return;
        if (foodSearchEmptyState) foodSearchEmptyState.setAttribute("hidden", "");
        foodSearchResults.setAttribute("hidden", "");
        foodSearchResults.innerHTML = "<p class=\"muted\">Searching…</p>";
        foodSearchResults.removeAttribute("hidden");
        fetch(apiBase + "/api/food-search?q=" + encodeURIComponent(q))
          .then(function (res) {
            var is404 = res.status === 404;
            if (!res.ok) return res.json().then(function (d) { throw new Error(d.detail || res.statusText); }).catch(function (e) { throw new Error(is404 ? "Not Found" : (e.message || res.statusText)); });
            return res.json();
          })
          .then(function (data) {
            var foods = data.foods || [];
            if (foods.length === 0) {
              foodSearchResults.innerHTML = "<p class=\"muted\">No foods found. Try another search.</p>";
              return;
            }
            var html = "";
            foods.forEach(function (item, idx) {
              var sid = "foodServings_" + idx;
              var per = item.servingSize + (item.servingSizeUnit || "g");
              var name = (item.description || "Unknown").replace(/</g, "&lt;").replace(/>/g, "&gt;");
              var macros = item.caloriesPerServing + " cal, P " + item.proteinPerServing + "g / C " + item.carbsPerServing + "g / F " + item.fatPerServing + "g per serving (" + per + ")";
              html += "<div class=\"food-search-result-item\" data-idx=\"" + idx + "\">" +
                "<span class=\"food-search-result-name\">" + name + "</span>" +
                "<span class=\"food-search-result-macros\">" + macros + "</span>" +
                "<span class=\"food-search-result-servings\"><label>Servings <input type=\"number\" id=\"" + sid + "\" min=\"0.25\" step=\"0.25\" value=\"1\" /></label></span>" +
                "<button type=\"button\" class=\"btn primary small food-add-btn\">Add meal</button>" +
                "</div>";
            });
            foodSearchResults.innerHTML = html;
            foodSearchResults.querySelectorAll(".food-add-btn").forEach(function (btn) {
              btn.addEventListener("click", function () {
                var row = btn.closest(".food-search-result-item");
                var idx = parseInt(row.getAttribute("data-idx"), 10);
                var item = foods[idx];
                if (!item) return;
                var servEl = document.getElementById("foodServings_" + idx);
                var servings = (servEl ? parseFloat(servEl.value) : 1) || 1;
                if (servings <= 0) return;
                var cal = Math.round(item.caloriesPerServing * servings);
                var p = Math.round(item.proteinPerServing * servings * 10) / 10;
                var c = Math.round(item.carbsPerServing * servings * 10) / 10;
                var f = Math.round(item.fatPerServing * servings * 10) / 10;
                window.np_daylog_add_meal(daylog, { name: item.description || "", calories: cal, protein_g: p, carbs_g: c, fat_g: f });
                saveAndRender();
              });
            });
          })
          .catch(function (err) {
            var is404 = err && (err.message === "Not Found" || String(err.message).indexOf("404") !== -1);
            foodSearchResults.innerHTML = "<p class=\"muted\">" + searchFailMessage(err, is404) + "</p>";
          });
      }
      foodSearchBtn.addEventListener("click", runFoodSearch);
      if (foodSearchInput) {
        foodSearchInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { hideAutocomplete(); runFoodSearch(); }
        });
        var acTimer;
        foodSearchInput.addEventListener("input", function () {
          clearTimeout(acTimer);
          var q = foodSearchInput.value.trim();
          if (!foodSearchAutocomplete) return;
          if (q.length < 2) { hideAutocomplete(); return; }
          foodSearchAutocomplete.innerHTML = "<div class=\"food-search-autocomplete-loading\">Searching…</div>";
          foodSearchAutocomplete.removeAttribute("hidden");
          acTimer = setTimeout(function () {
            fetch(apiBase + "/api/food-search?q=" + encodeURIComponent(q))
              .then(function (res) {
                var is404 = res.status === 404;
                if (!res.ok) return res.json().then(function (d) { throw new Error(d.detail || res.statusText); }).catch(function (e) { throw new Error(is404 ? "Not Found" : (e.message || res.statusText)); });
                return res.json();
              })
              .then(function (data) {
                var foods = (data.foods || []).slice(0, 10);
                if (foods.length === 0) {
                  foodSearchAutocomplete.innerHTML = "<div class=\"food-search-autocomplete-loading muted\">No suggestions. Press Search or Enter.</div>";
                  foodSearchAutocomplete.removeAttribute("hidden");
                  return;
                }
                foodSearchAutocomplete.innerHTML = foods.map(function (item) {
                  var raw = (item.description || "Unknown");
                  var safe = raw.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
                  return "<button type=\"button\" class=\"food-search-autocomplete-item\" role=\"option\" data-desc=\"" + safe + "\">" + raw.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</button>";
                }).join("");
                foodSearchAutocomplete.removeAttribute("hidden");
                foodSearchAutocomplete.querySelectorAll(".food-search-autocomplete-item").forEach(function (btn) {
                  btn.addEventListener("click", function () {
                    var desc = btn.getAttribute("data-desc") || "";
                    if (foodSearchInput) foodSearchInput.value = desc;
                    hideAutocomplete();
                    runFoodSearch();
                  });
                });
              })
              .catch(function (err) {
                var is404 = err && (err.message === "Not Found" || String(err.message).indexOf("404") !== -1);
                foodSearchAutocomplete.innerHTML = "<div class=\"food-search-autocomplete-loading muted\">" + searchFailMessage(err, is404) + "</div>";
                foodSearchAutocomplete.removeAttribute("hidden");
              });
          }, 200);
        });
        foodSearchInput.addEventListener("blur", function () { setTimeout(hideAutocomplete, 180); });
      }
    }

    var scanFoodBtn = document.getElementById("scanFoodBtn");
    var scanFoodOverlay = document.getElementById("scanFoodOverlay");
    var scanFoodVideo = document.getElementById("scanFoodVideo");
    var scanFoodCanvas = document.getElementById("scanFoodCanvas");
    var scanFoodCapture = document.getElementById("scanFoodCapture");
    var scanFoodCancel = document.getElementById("scanFoodCancel");
    var scanFoodStatus = document.getElementById("scanFoodStatus");
    if (scanFoodBtn && scanFoodOverlay && scanFoodVideo && scanFoodCanvas && scanFoodCapture && scanFoodCancel) {
      var scanStream = null;
      function stopScanStream() {
        if (scanStream && scanStream.getTracks) {
          scanStream.getTracks().forEach(function (t) { t.stop(); });
          scanStream = null;
        }
        if (scanFoodVideo) scanFoodVideo.srcObject = null;
      }
      function closeScanModal() {
        stopScanStream();
        scanFoodOverlay.setAttribute("hidden", "");
        if (scanFoodStatus) scanFoodStatus.textContent = "";
      }
      scanFoodBtn.addEventListener("click", function () {
        if (scanFoodStatus) scanFoodStatus.textContent = "";
        scanFoodOverlay.removeAttribute("hidden");
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (stream) {
          scanStream = stream;
          scanFoodVideo.srcObject = stream;
        }).catch(function (err) {
          if (scanFoodStatus) scanFoodStatus.textContent = "Camera access denied or unavailable.";
        });
      });
      scanFoodCancel.addEventListener("click", closeScanModal);
      scanFoodOverlay.addEventListener("click", function (e) { if (e.target === scanFoodOverlay) closeScanModal(); });
      scanFoodCapture.addEventListener("click", function () {
        if (!scanFoodVideo.srcObject || scanFoodVideo.readyState < 2) return;
        var w = scanFoodVideo.videoWidth;
        var h = scanFoodVideo.videoHeight;
        if (!w || !h) return;
        scanFoodCanvas.width = w;
        scanFoodCanvas.height = h;
        var ctx = scanFoodCanvas.getContext("2d");
        ctx.drawImage(scanFoodVideo, 0, 0);
        var dataUrl = scanFoodCanvas.toDataURL("image/jpeg", 0.85);
        var base64 = dataUrl.indexOf(",") >= 0 ? dataUrl.split(",")[1] : dataUrl;
        closeScanModal();
        if (scanFoodStatus) scanFoodStatus.textContent = "Analyzing…";
        scanFoodOverlay.removeAttribute("hidden");
        fetch(apiBase + "/api/scan-food", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: base64 }),
        })
          .then(function (res) {
            if (!res.ok) return res.json().then(function (d) { throw new Error(d.detail || res.statusText); });
            return res.json();
          })
          .then(function (data) {
            closeScanModal();
            var nameEl = document.getElementById("mealName");
            var calEl = document.getElementById("mealCal");
            var pEl = document.getElementById("mealP");
            var cEl = document.getElementById("mealC");
            var fEl = document.getElementById("mealF");
            if (nameEl) nameEl.value = data.name || "";
            if (calEl) calEl.value = String(data.calories != null ? data.calories : 0);
            if (pEl) pEl.value = String(data.protein != null ? data.protein : 0);
            if (cEl) cEl.value = String(data.carbs != null ? data.carbs : 0);
            if (fEl) fEl.value = String(data.fat != null ? data.fat : 0);
            if (nameEl) nameEl.focus();
          })
          .catch(function (err) {
            closeScanModal();
            if (scanFoodStatus) scanFoodStatus.textContent = "Scan failed: " + (err && err.message ? err.message : "Try again.");
            scanFoodOverlay.removeAttribute("hidden");
          });
      });
    }

    saveAndRender();
  }

  function resetStorage() {
    try {
      localStorage.removeItem("nutriplanner_targets");
      localStorage.removeItem("nutriplanner_meals");
      if (typeof location !== "undefined" && location.reload) location.reload();
    } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    setYear();
    initTargetsPage();
    initDaylogPage();
    var resetBtn = document.getElementById("resetStorage");
    var overlay = document.getElementById("resetConfirmOverlay");
    var confirmOk = document.getElementById("resetConfirmOk");
    var confirmCancel = document.getElementById("resetConfirmCancel");
    if (resetBtn && overlay) {
      resetBtn.addEventListener("click", function () { overlay.removeAttribute("hidden"); });
      if (confirmCancel) confirmCancel.addEventListener("click", function () { overlay.setAttribute("hidden", ""); });
      if (confirmOk) confirmOk.addEventListener("click", function () { overlay.setAttribute("hidden", ""); resetStorage(); });
      overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.setAttribute("hidden", ""); });
    }
  });
})();
