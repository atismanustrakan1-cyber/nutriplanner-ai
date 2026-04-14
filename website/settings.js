(function () {
  var STORAGE_KEY = "nutriplanner_settings";
  var DEFAULTS = {
    name: "",
    theme: "dark",
    accent: "default",
    density: "comfortable",
    fontSize: "md",
    dietaryRestrictions: "",
    weeklyBudget: "",
    weeklySpent: "",
    stockNotes: "",
    shoppingLocation: ""
  };

  function radiusForDensity(density) {
    return density === "compact" ? "sharp" : "round";
  }

  function normalizeFontSize(fs) {
    return fs === "lg" ? "lg" : "md";
  }

  /** First letter uppercased for “Hi, {name}” (rest of string unchanged). */
  function greetingDisplayName(raw) {
    var n = (raw || "").trim();
    if (!n) return "";
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  function getSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {}
    return Object.assign({}, DEFAULTS);
  }

  function setSettings(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {}
    if (typeof window.scheduleNutriplannerCloudSave === "function") window.scheduleNutriplannerCloudSave();
  }

  function applySettings() {
    var s = getSettings();
    var root = document.documentElement;
    root.setAttribute("data-theme", s.theme || "dark");
    var acc = s.accent || "default";
    if (acc !== "warm" && acc !== "green" && acc !== "blue" && acc !== "violet") acc = "default";
    root.setAttribute("data-accent", acc);
    var density = s.density === "compact" ? "compact" : "comfortable";
    root.setAttribute("data-density", density);
    root.setAttribute("data-radius", radiusForDensity(density));
    root.setAttribute("data-font-size", normalizeFontSize(s.fontSize));

    var name = (s.name || "").trim();
    var greetName = greetingDisplayName(name);
    var greeting = document.getElementById("userGreeting");
    if (greeting) {
      if (name) {
        greeting.textContent = "Hi, " + greetName;
        greeting.style.display = "block";
      } else {
        greeting.textContent = "";
        greeting.style.display = "none";
      }
    }
    var heroGreeting = document.getElementById("heroGreeting");
    if (heroGreeting) {
      if (name) {
        heroGreeting.textContent = "Hi, " + greetName;
        heroGreeting.style.display = "block";
      } else {
        heroGreeting.textContent = "";
        heroGreeting.style.display = "none";
      }
    }
  }

  if (typeof window.applyNutriplannerSettings === "undefined") {
    window.applyNutriplannerSettings = applySettings;
  }

  function getFormValues() {
    var nameEl = document.getElementById("settingsName");
    var dietaryEl = document.getElementById("settingsDietary");
    var budgetEl = document.getElementById("settingsBudget");
    var spentEl = document.getElementById("settingsSpent");
    var stockEl = document.getElementById("settingsStock");
    var locationEl = document.getElementById("settingsShoppingLocation");
    var theme = "dark";
    var accent = "default";
    var density = "comfortable";
    var fontSize = "md";
    document.querySelectorAll("input[name=\"theme\"]").forEach(function (r) { if (r.checked) theme = r.value; });
    document.querySelectorAll("input[name=\"density\"]").forEach(function (r) { if (r.checked) density = r.value; });
    var accentEl = document.getElementById("settingsAccent");
    if (accentEl && accentEl.value) accent = accentEl.value;
    var largeEl = document.getElementById("settingsLargeText");
    fontSize = largeEl && largeEl.checked ? "lg" : "md";
    var budgetVal = budgetEl && budgetEl.value.trim() !== "" ? budgetEl.value.trim() : "";
    var spentVal = spentEl && spentEl.value.trim() !== "" ? spentEl.value.trim() : "";
    return {
      name: nameEl ? nameEl.value.trim() : "",
      dietaryRestrictions: dietaryEl ? dietaryEl.value.trim() : "",
      weeklyBudget: budgetVal,
      weeklySpent: spentVal,
      stockNotes: stockEl ? stockEl.value.trim() : "",
      shoppingLocation: locationEl ? locationEl.value.trim() : "",
      theme: theme,
      accent: accent,
      density: density,
      fontSize: fontSize
    };
  }

  function applyFromForm() {
    var v = getFormValues();
    document.documentElement.setAttribute("data-theme", v.theme);
    var acc = v.accent;
    if (acc !== "warm" && acc !== "green" && acc !== "blue" && acc !== "violet") acc = "default";
    document.documentElement.setAttribute("data-accent", acc);
    var dens = v.density === "compact" ? "compact" : "comfortable";
    document.documentElement.setAttribute("data-density", dens);
    document.documentElement.setAttribute("data-radius", radiusForDensity(dens));
    document.documentElement.setAttribute("data-font-size", normalizeFontSize(v.fontSize));
    updateBudgetSummary(v.weeklyBudget, v.weeklySpent);
  }

  function updateBudgetSummary(budgetRaw, spentRaw) {
    var summaryEl = document.getElementById("settingsBudgetSummary");
    if (!summaryEl) return;
    var budget = budgetRaw !== "" ? parseFloat(budgetRaw) : NaN;
    var spent = spentRaw !== "" ? parseFloat(spentRaw) : NaN;
    if (isNaN(budget) || budget <= 0) {
      summaryEl.textContent = "Set a weekly budget and optional spend to see how much you have left.";
      summaryEl.classList.remove("over");
      return;
    }
    if (isNaN(spent) || spent < 0) {
      summaryEl.textContent = "Weekly budget: $" + budget.toFixed(0) + ". Add what you spent so far to track remaining.";
      summaryEl.classList.remove("over");
      return;
    }
    var remaining = budget - spent;
    if (remaining >= 0) {
      summaryEl.textContent = "Remaining this week: $" + remaining.toFixed(0) + " out of $" + budget.toFixed(0) + ".";
      summaryEl.classList.remove("over");
    } else {
      summaryEl.textContent = "Over budget this week: -$" + Math.abs(remaining).toFixed(0) + " (spent $" + spent.toFixed(0) + " on a $" + budget.toFixed(0) + " budget).";
      summaryEl.classList.add("over");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    applySettings();

    function runSettingsPage() {
    applySettings();

    var nameEl = document.getElementById("settingsName");
    var saveBtn = document.getElementById("settingsSave");
    var savedEl = document.getElementById("settingsSaved");

    var s = getSettings();
    if (nameEl) nameEl.value = s.name || "";
    var dietaryEl = document.getElementById("settingsDietary");
    var budgetEl = document.getElementById("settingsBudget");
    var spentEl = document.getElementById("settingsSpent");
    var stockEl = document.getElementById("settingsStock");
    if (dietaryEl) dietaryEl.value = s.dietaryRestrictions || "";
    if (budgetEl) budgetEl.value = s.weeklyBudget != null && s.weeklyBudget !== "" ? String(s.weeklyBudget) : "";
    if (spentEl) spentEl.value = s.weeklySpent != null && s.weeklySpent !== "" ? String(s.weeklySpent) : "";
    if (stockEl) stockEl.value = s.stockNotes || "";
    var locationField = document.getElementById("settingsShoppingLocation");
    if (locationField) locationField.value = s.shoppingLocation || "";
    var themeRadios = document.querySelectorAll("input[name=\"theme\"]");
    var densityRadios = document.querySelectorAll("input[name=\"density\"]");
    themeRadios.forEach(function (r) { r.checked = r.value === (s.theme || "dark"); });
    var savedAcc = s.accent || "default";
    if (savedAcc !== "warm" && savedAcc !== "green" && savedAcc !== "blue" && savedAcc !== "violet") savedAcc = "default";
    var accentSelect = document.getElementById("settingsAccent");
    if (accentSelect) accentSelect.value = savedAcc;
    densityRadios.forEach(function (r) { r.checked = r.value === (s.density || "comfortable"); });
    var largeCheck = document.getElementById("settingsLargeText");
    if (largeCheck) largeCheck.checked = normalizeFontSize(s.fontSize) === "lg";

    updateBudgetSummary(s.weeklyBudget != null ? String(s.weeklyBudget) : "", s.weeklySpent != null ? String(s.weeklySpent) : "");

    function bindAppearanceRadios(nodes) {
      nodes.forEach(function (r) {
        r.addEventListener("change", function () { applyFromForm(); });
      });
    }
    bindAppearanceRadios(themeRadios);
    bindAppearanceRadios(densityRadios);
    if (accentSelect) accentSelect.addEventListener("change", function () { applyFromForm(); });
    if (largeCheck) largeCheck.addEventListener("change", function () { applyFromForm(); });

    var nameConfirmBtn = document.getElementById("settingsNameConfirm");
    if (nameConfirmBtn) {
      nameConfirmBtn.addEventListener("click", function () {
        var v = getFormValues();
        setSettings(Object.assign({}, getSettings(), { name: v.name }));
        applySettings();
        if (savedEl) {
          savedEl.textContent = "Name saved.";
          savedEl.setAttribute("aria-live", "polite");
          setTimeout(function () { savedEl.textContent = ""; }, 2500);
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        var v = getFormValues();
        setSettings({
          name: v.name,
          theme: v.theme,
          accent: v.accent,
          density: v.density,
          fontSize: v.fontSize,
          dietaryRestrictions: v.dietaryRestrictions,
          weeklyBudget: v.weeklyBudget,
          weeklySpent: v.weeklySpent,
          stockNotes: v.stockNotes,
          shoppingLocation: v.shoppingLocation
        });
        applySettings();
        updateBudgetSummary(v.weeklyBudget, v.weeklySpent);
        if (savedEl) {
          savedEl.textContent = "Saved.";
          savedEl.setAttribute("aria-live", "polite");
          setTimeout(function () { savedEl.textContent = ""; }, 2500);
        }
      });
    }
    }
    var p = window.nutriplannerDataReady;
    if (p && typeof p.then === "function") {
      p.then(runSettingsPage, runSettingsPage);
    } else {
      runSettingsPage();
    }
  });
})();
