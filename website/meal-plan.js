(function () {
  var DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var SLOT_DEFAULTS = {
    breakfast: { start: "07:30", end: "08:00" },
    lunch: { start: "12:15", end: "13:00" },
    dinner: { start: "18:00", end: "19:00" },
  };

  function esc(s) {
    return String(s != null ? s : "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var CONTEXT_FALLBACK =
    "No targets or settings found. User should set daily calories/macros on Set Targets and diet/budget/stock on Settings. " +
    "Assume a balanced omnivore diet ~2000 kcal/day until they update the app.";

  function getMealPlanContextData() {
    var d = {
      targetCalories: null,
      targetMacros: null,
      dietaryRestrictions: null,
      weeklyBudget: null,
      weeklySpent: null,
      stockNotes: null,
      shoppingLocation: null,
    };
    try {
      var rawT = localStorage.getItem("nutriplanner_targets");
      if (rawT) {
        var t = JSON.parse(rawT);
        if (t.targetCalories != null && t.targetCalories !== "") {
          d.targetCalories = t.targetCalories;
        }
        if (t.targetMacros && typeof t.targetMacros === "object") {
          d.targetMacros = {
            protein_g: t.targetMacros.protein_g,
            carbs_g: t.targetMacros.carbs_g,
            fat_g: t.targetMacros.fat_g,
          };
        }
      }
    } catch (_e) {}
    try {
      var rawS = localStorage.getItem("nutriplanner_settings");
      if (rawS) {
        var s = JSON.parse(rawS);
        if (s.dietaryRestrictions && String(s.dietaryRestrictions).trim()) {
          d.dietaryRestrictions = String(s.dietaryRestrictions).trim();
        }
        if (s.weeklyBudget != null && String(s.weeklyBudget).trim() !== "") {
          d.weeklyBudget = String(s.weeklyBudget).trim();
        }
        if (s.weeklySpent != null && String(s.weeklySpent).trim() !== "") {
          d.weeklySpent = String(s.weeklySpent).trim();
        }
        if (s.stockNotes && String(s.stockNotes).trim()) {
          d.stockNotes = String(s.stockNotes).trim();
        }
        if (s.shoppingLocation && String(s.shoppingLocation).trim()) {
          d.shoppingLocation = String(s.shoppingLocation).trim();
        }
      }
    } catch (_e) {}
    return d;
  }

  function buildContextLines(d) {
    var lines = [];
    if (d.targetCalories != null && d.targetCalories !== "") {
      lines.push("Daily calorie target: " + d.targetCalories + " kcal");
    }
    if (d.targetMacros && typeof d.targetMacros === "object") {
      var m = d.targetMacros;
      lines.push(
        "Daily macro targets (grams): protein " +
          (m.protein_g != null ? m.protein_g : "?") +
          ", carbs " +
          (m.carbs_g != null ? m.carbs_g : "?") +
          ", fat " +
          (m.fat_g != null ? m.fat_g : "?"),
      );
    }
    if (d.dietaryRestrictions) {
      lines.push("Dietary restrictions / preferences: " + d.dietaryRestrictions);
    }
    if (d.weeklyBudget != null) {
      lines.push("Weekly food budget (USD): $" + d.weeklyBudget);
    }
    if (d.weeklySpent != null) {
      lines.push("Already spent this week on food (USD): $" + d.weeklySpent);
    }
    if (d.stockNotes) {
      lines.push("Already have on hand (use when possible): " + d.stockNotes);
    }
    if (d.shoppingLocation) {
      lines.push(
        "User's shopping area (use for realistic nearby store names in where_buy for each ingredient): " +
          d.shoppingLocation,
      );
    }
    return lines;
  }

  function buildContext() {
    var lines = buildContextLines(getMealPlanContextData());
    if (lines.length === 0) return CONTEXT_FALLBACK;
    return lines.join("\n");
  }

  function buildRequestContext(baseContext, customization) {
    var extra = String(customization || "").trim();
    if (!extra) return baseContext;
    return baseContext + "\n\nWeekly customization request:\n" + extra;
  }

  function getStoredSettings() {
    try {
      var raw = localStorage.getItem("nutriplanner_settings");
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_e) {
      return {};
    }
  }

  function saveStoredSettings(nextSettings) {
    try {
      localStorage.setItem("nutriplanner_settings", JSON.stringify(nextSettings || {}));
    } catch (_e) {}
    if (typeof window.scheduleNutriplannerCloudSave === "function") {
      window.scheduleNutriplannerCloudSave();
    }
  }

  function persistMealPlanCustomization(customizationText) {
    var txt = String(customizationText || "").trim().slice(0, 600);
    var settings = getStoredSettings();
    if (txt) settings.mealPlanCustomization = txt;
    else delete settings.mealPlanCustomization;
    saveStoredSettings(settings);
  }

  function renderContextPreview(el) {
    if (!el) return;
    var d = getMealPlanContextData();
    var lines = buildContextLines(d);
    if (lines.length === 0) {
      el.innerHTML =
        "<div class=\"meal-plan-empty\" role=\"status\">" +
        "<p class=\"meal-plan-empty-title\">No saved targets or settings yet</p>" +
        "<p class=\"meal-plan-empty-text muted\">The AI will still run with a generic ~2000 kcal plan. For personalized results, set <a href=\"targets.html\">calories &amp; macros</a> and <a href=\"settings.html\">diet, budget, and pantry</a> first.</p>" +
        "</div>";
      return;
    }

    var chunks = [];
    var hasTargets = d.targetCalories != null || (d.targetMacros && typeof d.targetMacros === "object");
    if (hasTargets) {
      chunks.push("<div class=\"meal-plan-stat-grid\">");
      if (d.targetCalories != null) {
        chunks.push(
          "<div class=\"meal-plan-stat-card\">" +
            "<span class=\"meal-plan-stat-label\">Daily calories</span>" +
            "<span class=\"meal-plan-stat-value\">" +
            esc(d.targetCalories) +
            "<span class=\"meal-plan-stat-unit\"> kcal</span></span>" +
            "</div>",
        );
      }
      if (d.targetMacros && typeof d.targetMacros === "object") {
        var mm = d.targetMacros;
        var pg = mm.protein_g != null ? esc(mm.protein_g) : "—";
        var cg = mm.carbs_g != null ? esc(mm.carbs_g) : "—";
        var fg = mm.fat_g != null ? esc(mm.fat_g) : "—";
        chunks.push(
          "<div class=\"meal-plan-stat-card meal-plan-stat-macros\">" +
            "<span class=\"meal-plan-stat-label\">Macros (g / day)</span>" +
            "<div class=\"meal-plan-macro-chips\">" +
            "<span class=\"meal-plan-macro-chip meal-plan-macro-p\"><span class=\"meal-plan-macro-name\">Protein</span><strong>" +
            pg +
            " g</strong></span>" +
            "<span class=\"meal-plan-macro-chip meal-plan-macro-c\"><span class=\"meal-plan-macro-name\">Carbs</span><strong>" +
            cg +
            " g</strong></span>" +
            "<span class=\"meal-plan-macro-chip meal-plan-macro-f\"><span class=\"meal-plan-macro-name\">Fat</span><strong>" +
            fg +
            " g</strong></span>" +
            "</div></div>",
        );
      }
      chunks.push("</div>");
    }

    var settingRows = [];
    if (d.dietaryRestrictions) {
      settingRows.push(
        "<div class=\"meal-plan-detail-row\"><span class=\"meal-plan-detail-key\">Diet &amp; preferences</span><span class=\"meal-plan-detail-val\">" +
          esc(d.dietaryRestrictions) +
          "</span></div>",
      );
    }
    if (d.weeklyBudget != null) {
      settingRows.push(
        "<div class=\"meal-plan-detail-row\"><span class=\"meal-plan-detail-key\">Weekly budget</span><span class=\"meal-plan-detail-val\">$" +
          esc(d.weeklyBudget) +
          "</span></div>",
      );
    }
    if (d.weeklySpent != null) {
      settingRows.push(
        "<div class=\"meal-plan-detail-row\"><span class=\"meal-plan-detail-key\">Already spent (week)</span><span class=\"meal-plan-detail-val\">$" +
          esc(d.weeklySpent) +
          "</span></div>",
      );
    }
    if (d.stockNotes) {
      settingRows.push(
        "<div class=\"meal-plan-detail-row meal-plan-detail-row-block\"><span class=\"meal-plan-detail-key\">Pantry / on hand</span><span class=\"meal-plan-detail-val\">" +
          esc(d.stockNotes) +
          "</span></div>",
      );
    }
    if (d.shoppingLocation) {
      settingRows.push(
        "<div class=\"meal-plan-detail-row\"><span class=\"meal-plan-detail-key\">Shopping area</span><span class=\"meal-plan-detail-val\">" +
          esc(d.shoppingLocation) +
          "</span></div>",
      );
    }
    if (settingRows.length) {
      chunks.push(
        "<div class=\"meal-plan-settings-block\"><h3 class=\"meal-plan-settings-heading\">From Settings</h3><div class=\"meal-plan-detail-list\">" +
          settingRows.join("") +
          "</div></div>",
      );
    }

    el.innerHTML = chunks.join("");
  }

  function normalizeTime(t) {
    if (t == null || typeof t !== "string") return "";
    var m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return "";
    var h = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return "";
    if (h < 0 || h > 23 || min < 0 || min > 59) return "";
    return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
  }

  function derivePlannerEventsFromMeals(meals) {
    if (!Array.isArray(meals)) return [];
    var out = [];
    for (var i = 0; i < meals.length; i++) {
      var m = meals[i];
      if (!m || typeof m !== "object") continue;
      var day = String(m.day || "").trim();
      if (DAYS.indexOf(day) === -1) continue;
      var slot = String(m.slot || "").toLowerCase();
      var def = SLOT_DEFAULTS[slot] || { start: "12:00", end: "13:00" };
      var st = normalizeTime(m.startTime) || def.start;
      var et = normalizeTime(m.endTime) || def.end;
      var title = String(m.title || "").trim();
      if (!title) continue;
      if (slot === "breakfast" || slot === "lunch" || slot === "dinner") {
        title = slot.charAt(0).toUpperCase() + slot.slice(1) + ": " + title;
      }
      out.push({ day: day, startTime: st, endTime: et, title: title });
    }
    return out;
  }

  function mergePlannerSources(data) {
    var fromApi = Array.isArray(data.planner_events)
      ? data.planner_events
      : Array.isArray(data.plannerEvents)
        ? data.plannerEvents
        : [];
    if (fromApi.length > 0) return fromApi;
    return derivePlannerEventsFromMeals(data.meals);
  }

  function formatShoppingLines(shopping) {
    if (!Array.isArray(shopping) || shopping.length === 0) return "";
    var lines = [];
    for (var i = 0; i < shopping.length; i++) {
      var row = shopping[i];
      if (!row || typeof row !== "object") continue;
      var bits = [];
      if (row.item) bits.push(String(row.item));
      if (row.approx_price_usd != null && Number.isFinite(Number(row.approx_price_usd))) {
        bits.push("~$" + Number(row.approx_price_usd).toFixed(2));
      }
      var w = row.where_buy != null ? row.where_buy : row.where;
      if (w) bits.push(String(w));
      if (bits.length) lines.push(bits.join(" · "));
    }
    return lines.join("\n");
  }

  /** Calendar rows for import, with recipe + shopping as instructions when present. */
  function buildImportEventsWithInstructions(data) {
    if (!data || typeof data !== "object") return [];
    var meals = Array.isArray(data.meals) ? data.meals : [];
    var out = [];
    for (var i = 0; i < meals.length; i++) {
      var m = meals[i];
      if (!m || typeof m !== "object") continue;
      var day = String(m.day || "").trim();
      if (DAYS.indexOf(day) === -1) continue;
      var slot = String(m.slot || "").toLowerCase();
      var def = SLOT_DEFAULTS[slot] || { start: "12:00", end: "13:00" };
      var st = normalizeTime(m.startTime) || def.start;
      var et = normalizeTime(m.endTime) || def.end;
      var title = String(m.title || "").trim();
      if (!title) continue;
      if (slot === "breakfast" || slot === "lunch" || slot === "dinner") {
        title = slot.charAt(0).toUpperCase() + slot.slice(1) + ": " + title;
      }
      var recipe = String(m.recipe || "").trim();
      var shop = formatShoppingLines(m.shopping);
      var instr = "";
      if (recipe) instr = recipe;
      if (shop) {
        instr = instr ? instr + "\n\n— Shopping —\n" + shop : "— Shopping —\n" + shop;
      }
      var ev = { day: day, startTime: st, endTime: et, title: title };
      if (instr) ev.instructions = instr;
      out.push(ev);
    }
    return out;
  }

  function renderShoppingRows(shopping) {
    if (!Array.isArray(shopping) || shopping.length === 0) {
      return "<p class=\"muted\">No separate shopping list for this meal.</p>";
    }
    function renderWhereBuy(whereRaw) {
      var raw = String(whereRaw || "").trim();
      if (!raw) return "";
      var match = raw.match(/https?:\/\/[^\s]+/i);
      if (!match) return esc(raw);
      var url = match[0];
      var left = raw.replace(url, "").replace(/[\s\-|:]+$/, "").trim();
      var label = left ? esc(left) + " " : "";
      return (
        label +
        '<a class="meal-plan-directions-link" href="' +
        esc(url) +
        '" target="_blank" rel="noreferrer noopener">Directions</a>'
      );
    }

    var rows = shopping
      .map(function (row) {
        if (!row || typeof row !== "object") return "";
        var item = esc(row.item);
        var price =
          row.approx_price_usd != null && Number.isFinite(Number(row.approx_price_usd))
            ? "$" + Number(row.approx_price_usd).toFixed(2)
            : "—";
        var where = renderWhereBuy(row.where_buy || row.where || "");
        return (
          "<tr><td>" +
          item +
          "</td><td>" +
          price +
          "</td><td>" +
          where +
          "</td></tr>"
        );
      })
      .join("");
    return (
      "<table class=\"meal-plan-shop-table\"><thead><tr><th>Item</th><th>Est. price</th><th>Where to buy</th></tr></thead><tbody>" +
      rows +
      "</tbody></table>"
    );
  }

  function renderWhereBuyWithDirections(whereRaw) {
    var raw = String(whereRaw || "").trim();
    if (!raw) return "";
    var match = raw.match(/https?:\/\/[^\s]+/i);
    if (!match) return esc(raw);
    var url = match[0];
    var left = raw.replace(url, "").replace(/[\s\-|:]+$/, "").trim();
    var label = left ? esc(left) + " " : "";
    return (
      label +
      '<a class="meal-plan-directions-link" href="' +
      esc(url) +
      '" target="_blank" rel="noreferrer noopener">Directions</a>'
    );
  }

  function renderMealCard(m) {
    var slot = esc(m.slot || "");
    var title = esc(m.title || "Meal");
    var cost =
      m.meal_cost_usd != null && Number.isFinite(Number(m.meal_cost_usd))
        ? "<span class=\"meal-plan-meal-cost\">~$" + Number(m.meal_cost_usd).toFixed(2) + "</span>"
        : "";
    var recipe = esc(m.recipe || "").replace(/\n/g, "<br />");
    return (
      "<article class=\"meal-plan-meal-card\">" +
      "<header class=\"meal-plan-meal-head\"><span class=\"meal-plan-slot\">" +
      slot +
      "</span><h3 class=\"meal-plan-meal-title\">" +
      title +
      "</h3>" +
      cost +
      "</header>" +
      "<div class=\"meal-plan-recipe\"><strong>How to make it</strong><p>" +
      recipe +
      "</p></div>" +
      "<div class=\"meal-plan-shop\"><strong>Shopping</strong>" +
      renderShoppingRows(m.shopping) +
      "</div></article>"
    );
  }

  function buildWeeklyGroceryRows(meals) {
    var map = {};
    if (!Array.isArray(meals)) return [];
    for (var i = 0; i < meals.length; i++) {
      var meal = meals[i];
      var shopping = Array.isArray(meal && meal.shopping) ? meal.shopping : [];
      for (var j = 0; j < shopping.length; j++) {
        var row = shopping[j];
        if (!row || typeof row !== "object") continue;
        var itemName = String(row.item || "").trim();
        if (!itemName) continue;
        var key = itemName.toLowerCase();
        if (!map[key]) {
          map[key] = {
            item: itemName,
            approx_price_usd: 0,
            whereList: {},
            count: 0,
          };
        }
        var priceNum = Number(row.approx_price_usd);
        if (Number.isFinite(priceNum) && priceNum > 0) {
          map[key].approx_price_usd += priceNum;
        }
        var where = String(row.where_buy || row.where || "").trim();
        if (where) map[key].whereList[where] = true;
        map[key].count++;
      }
    }
    return Object.keys(map)
      .map(function (k) {
        var v = map[k];
        return {
          item: v.item,
          approx_price_usd: v.approx_price_usd,
          where_buy: Object.keys(v.whereList).join(" / "),
          count: v.count,
        };
      })
      .sort(function (a, b) {
        return b.approx_price_usd - a.approx_price_usd;
      });
  }

  function renderWeeklyGrocery(meals) {
    var listEl = document.getElementById("mealPlanGroceryList");
    var metaEl = document.getElementById("mealPlanGroceryMeta");
    if (!listEl) return;
    var rows = buildWeeklyGroceryRows(meals);
    if (metaEl) {
      var total = 0;
      for (var i = 0; i < rows.length; i++) total += Number(rows[i].approx_price_usd || 0);
      metaEl.textContent = rows.length
        ? rows.length + " items · Estimated total $" + total.toFixed(2)
        : "";
    }
    if (!rows.length) {
      listEl.innerHTML = "<p class=\"muted\">No grocery items were returned in this plan.</p>";
      return;
    }
    var body = rows
      .map(function (r) {
        var where = r.where_buy
          ? "<span class=\"meal-plan-grocery-where\">" + renderWhereBuyWithDirections(r.where_buy) + "</span>"
          : "—";
        return (
          "<tr><td>" +
          esc(r.item) +
          "</td><td>$" +
          Number(r.approx_price_usd || 0).toFixed(2) +
          "</td><td>" +
          where +
          "</td></tr>"
        );
      })
      .join("");
    listEl.innerHTML =
      "<table class=\"meal-plan-grocery-table\"><thead><tr><th>Item</th><th>Est. total</th><th>Where to buy</th></tr></thead><tbody>" +
      body +
      "</tbody></table>";
  }

  function renderResults(data) {
    var resultsEl = document.getElementById("mealPlanResults");
    var daysEl = document.getElementById("mealPlanDays");
    var totalEl = document.getElementById("mealPlanTotalCost");
    var noteEl = document.getElementById("mealPlanBudgetNote");
    if (!resultsEl || !daysEl) return;

    if (data.total_estimated_usd != null && Number.isFinite(Number(data.total_estimated_usd))) {
      if (totalEl) {
        totalEl.textContent = "Estimated week ingredients: ~$" + Number(data.total_estimated_usd).toFixed(2);
      }
    } else if (totalEl) {
      totalEl.textContent = "";
    }

    if (noteEl) {
      noteEl.textContent = data.budget_note || "";
    }

    var meals = Array.isArray(data.meals) ? data.meals : [];
    renderWeeklyGrocery(meals);
    var byDay = {};
    DAYS.forEach(function (d) {
      byDay[d] = [];
    });
    meals.forEach(function (m) {
      var d = String(m.day || "").trim();
      if (byDay[d]) byDay[d].push(m);
    });

    var orderSlot = { breakfast: 0, lunch: 1, dinner: 2 };
    DAYS.forEach(function (d) {
      byDay[d].sort(function (a, b) {
        var sa = orderSlot[String(a.slot || "").toLowerCase()];
        var sb = orderSlot[String(b.slot || "").toLowerCase()];
        sa = sa != null ? sa : 9;
        sb = sb != null ? sb : 9;
        return sa - sb;
      });
    });

    var html = DAYS.map(function (d) {
      var list = byDay[d];
      if (!list.length) return "";
      var cards = list.map(renderMealCard).join("");
      return (
        "<section class=\"meal-plan-day-block panel\"><h2 class=\"meal-plan-day-title\">" +
        esc(d) +
        "</h2><div class=\"meal-plan-meal-list\">" +
        cards +
        "</div></section>"
      );
    }).join("");

    daysEl.innerHTML = html || "<p class=\"muted\">No meals in response. Try generating again.</p>";
    resultsEl.removeAttribute("hidden");
  }

  var lastPlan = null;

  function init() {
    var preview = document.getElementById("mealPlanContextPreview");
    var genBtn = document.getElementById("mealPlanGenerate");
    var statusEl = document.getElementById("mealPlanStatus");
    var importBtn = document.getElementById("mealPlanImportPlanner");
    var importStatus = document.getElementById("mealPlanImportStatus");
    var customPromptEl = document.getElementById("mealPlanCustomPrompt");

    if (!genBtn) return;

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg || "";
    }

    renderContextPreview(preview);
    if (customPromptEl) {
      var s = getStoredSettings();
      var savedPrompt = s && typeof s === "object" ? String(s.mealPlanCustomization || "") : "";
      customPromptEl.value = savedPrompt.slice(0, 600);
    }

    var apiBase =
      typeof window.NUTRIPLANNER_API_ORIGIN === "string" && window.NUTRIPLANNER_API_ORIGIN.trim() !== ""
        ? window.NUTRIPLANNER_API_ORIGIN.trim().replace(/\/$/, "")
        : window.location.origin;

    genBtn.addEventListener("click", function () {
      var baseCtx = buildContext();
      var customPrompt = customPromptEl ? String(customPromptEl.value || "").trim() : "";
      persistMealPlanCustomization(customPrompt);
      var ctx = buildRequestContext(baseCtx, customPrompt);
      renderContextPreview(preview);
      lastPlan = null;
      setStatus("Generating… this can take a minute.");
      var resultsEl = document.getElementById("mealPlanResults");
      if (resultsEl) resultsEl.setAttribute("hidden", "");
      if (importStatus) importStatus.textContent = "";

      fetch(apiBase + "/api/meal-plan-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: ctx }),
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var trimmed = (text || "").trim();
            var data = null;
            if (trimmed) {
              try {
                data = JSON.parse(trimmed);
              } catch (_e) {
                if (!res.ok) {
                  throw new Error(trimmed.slice(0, 220) || res.statusText);
                }
                throw new Error("Invalid JSON from server.");
              }
            }
            if (!res.ok) {
              var errMsg =
                (data && (data.detail || data.message)) ||
                res.statusText ||
                "Request failed (" + res.status + ")";
              throw new Error(errMsg);
            }
            if (data == null) throw new Error("Empty response from server.");
            return data;
          });
        })
        .then(function (data) {
          lastPlan = data;
          setStatus("");
          renderResults(data);
        })
        .catch(function (err) {
          lastPlan = null;
          setStatus("Failed: " + (err && err.message ? err.message : "Try again."));
        });
    });

    if (importBtn) {
      importBtn.addEventListener("click", function () {
        if (!lastPlan) {
          if (importStatus) importStatus.textContent = "Generate a plan first.";
          return;
        }
        var events = buildImportEventsWithInstructions(lastPlan);
        if (!events.length) {
          events = mergePlannerSources(lastPlan);
        }
        if (!events.length) {
          if (importStatus) importStatus.textContent = "No calendar rows to import.";
          return;
        }
        var fn = window.importNutriplannerWeeklyPlanEvents;
        if (typeof fn !== "function") {
          if (importStatus) importStatus.textContent = "Planner not ready. Reload the page.";
          return;
        }
        var n = fn(events);
        if (importStatus) {
          importStatus.textContent = n ? "Added " + n + " events. Open Weekly Planner to view or edit." : "Nothing imported (check day names).";
        }
      });
    }
  }

  function start() {
    init();
  }

  var p = window.nutriplannerDataReady;
  if (p && typeof p.then === "function") {
    p.then(start, start);
  } else {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  }
})();
