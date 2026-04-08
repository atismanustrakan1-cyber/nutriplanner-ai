(function () {
  var STORAGE_KEY = "nutriplanner_settings";
  var DEFAULTS = {
    name: "",
    theme: "dark",
    accent: "default",
    dietaryRestrictions: "",
    weeklyBudget: "",
    weeklySpent: "",
    stockNotes: ""
  };

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
    root.setAttribute("data-accent", s.accent || "default");

    var name = (s.name || "").trim();
    var greeting = document.getElementById("userGreeting");
    if (greeting) {
      if (name) {
        greeting.textContent = "Hi, " + name;
        greeting.style.display = "block";
      } else {
        greeting.textContent = "";
        greeting.style.display = "none";
      }
    }
    var heroGreeting = document.getElementById("heroGreeting");
    if (heroGreeting) {
      if (name) {
        heroGreeting.textContent = "Hi, " + name;
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
    var theme = "dark";
    var accent = "default";
    document.querySelectorAll("input[name=\"theme\"]").forEach(function (r) { if (r.checked) theme = r.value; });
    document.querySelectorAll("input[name=\"accent\"]").forEach(function (r) { if (r.checked) accent = r.value; });
    var budgetVal = budgetEl && budgetEl.value.trim() !== "" ? budgetEl.value.trim() : "";
    var spentVal = spentEl && spentEl.value.trim() !== "" ? spentEl.value.trim() : "";
    return {
      name: nameEl ? nameEl.value.trim() : "",
      dietaryRestrictions: dietaryEl ? dietaryEl.value.trim() : "",
      weeklyBudget: budgetVal,
      weeklySpent: spentVal,
      stockNotes: stockEl ? stockEl.value.trim() : "",
      theme: theme,
      accent: accent
    };
  }

  function applyFromForm() {
    var v = getFormValues();
    document.documentElement.setAttribute("data-theme", v.theme);
    document.documentElement.setAttribute("data-accent", v.accent);
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
    var themeRadios = document.querySelectorAll("input[name=\"theme\"]");
    var accentRadios = document.querySelectorAll("input[name=\"accent\"]");
    themeRadios.forEach(function (r) { r.checked = r.value === (s.theme || "dark"); });
    accentRadios.forEach(function (r) { r.checked = r.value === (s.accent || "default"); });

    updateBudgetSummary(s.weeklyBudget != null ? String(s.weeklyBudget) : "", s.weeklySpent != null ? String(s.weeklySpent) : "");

    themeRadios.forEach(function (r) {
      r.addEventListener("change", function () { applyFromForm(); });
    });
    accentRadios.forEach(function (r) {
      r.addEventListener("change", function () { applyFromForm(); });
    });

    var nameConfirmBtn = document.getElementById("settingsNameConfirm");
    if (nameConfirmBtn) {
      nameConfirmBtn.addEventListener("click", function () {
        var v = getFormValues();
        var s = getSettings();
        setSettings({
          name: v.name,
          theme: s.theme,
          accent: s.accent,
          dietaryRestrictions: s.dietaryRestrictions,
          weeklyBudget: s.weeklyBudget,
          weeklySpent: s.weeklySpent,
          stockNotes: s.stockNotes
        });
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
          dietaryRestrictions: v.dietaryRestrictions,
          weeklyBudget: v.weeklyBudget,
          weeklySpent: v.weeklySpent,
          stockNotes: v.stockNotes
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
