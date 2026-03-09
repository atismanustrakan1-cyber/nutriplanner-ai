(function () {
  var STORAGE_KEY = "nutriplanner_settings";
  var DEFAULTS = { name: "", theme: "dark", accent: "default", dietaryRestrictions: "", weeklyBudget: "", stockNotes: "" };

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
        greeting.style.display = "";
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
    var stockEl = document.getElementById("settingsStock");
    var theme = "dark";
    var accent = "default";
    document.querySelectorAll("input[name=\"theme\"]").forEach(function (r) { if (r.checked) theme = r.value; });
    document.querySelectorAll("input[name=\"accent\"]").forEach(function (r) { if (r.checked) accent = r.value; });
    var budgetVal = budgetEl && budgetEl.value.trim() !== "" ? budgetEl.value.trim() : "";
    return {
      name: nameEl ? nameEl.value.trim() : "",
      dietaryRestrictions: dietaryEl ? dietaryEl.value.trim() : "",
      weeklyBudget: budgetVal,
      stockNotes: stockEl ? stockEl.value.trim() : "",
      theme: theme,
      accent: accent
    };
  }

  function applyFromForm() {
    var v = getFormValues();
    document.documentElement.setAttribute("data-theme", v.theme);
    document.documentElement.setAttribute("data-accent", v.accent);
  }

  document.addEventListener("DOMContentLoaded", function () {
    applySettings();

    var nameEl = document.getElementById("settingsName");
    var saveBtn = document.getElementById("settingsSave");
    var savedEl = document.getElementById("settingsSaved");

    var s = getSettings();
    if (nameEl) nameEl.value = s.name || "";
    var dietaryEl = document.getElementById("settingsDietary");
    var budgetEl = document.getElementById("settingsBudget");
    var stockEl = document.getElementById("settingsStock");
    if (dietaryEl) dietaryEl.value = s.dietaryRestrictions || "";
    if (budgetEl) budgetEl.value = s.weeklyBudget != null && s.weeklyBudget !== "" ? String(s.weeklyBudget) : "";
    if (stockEl) stockEl.value = s.stockNotes || "";
    var themeRadios = document.querySelectorAll("input[name=\"theme\"]");
    var accentRadios = document.querySelectorAll("input[name=\"accent\"]");
    themeRadios.forEach(function (r) { r.checked = r.value === (s.theme || "dark"); });
    accentRadios.forEach(function (r) { r.checked = r.value === (s.accent || "default"); });

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
          stockNotes: v.stockNotes
        });
        applySettings();
        if (savedEl) {
          savedEl.textContent = "Saved.";
          savedEl.setAttribute("aria-live", "polite");
          setTimeout(function () { savedEl.textContent = ""; }, 2500);
        }
      });
    }
  });
})();
