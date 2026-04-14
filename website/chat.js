(function () {
  var messages = [];
  var messagesEl = document.getElementById("chatMessages");
  var inputEl = document.getElementById("chatInput");
  var sendBtn = document.getElementById("chatSend");
  var errorEl = document.getElementById("chatError");

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg || "";
      errorEl.style.display = msg ? "block" : "none";
    }
  }

  function appendMessage(role, content) {
    if (!messagesEl) return;
    var wrap = document.createElement("div");
    wrap.className = "chat-msg " + role;
    var roleLabel = role === "user" ? "You" : "AI";
    wrap.innerHTML = "<span class=\"chat-role\">" + roleLabel + "</span><p></p>";
    var p = wrap.querySelector("p");
    p.textContent = content;
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setLoading(on) {
    if (sendBtn) sendBtn.disabled = on;
    if (inputEl) inputEl.disabled = on;
  }

  function getApiBase() {
    if (typeof window.NUTRIPLANNER_API_ORIGIN === "string" && window.NUTRIPLANNER_API_ORIGIN.trim() !== "") {
      return window.NUTRIPLANNER_API_ORIGIN.trim().replace(/\/$/, "");
    }
    return window.location.origin;
  }

  function getSettingsExtras() {
    try {
      var raw = localStorage.getItem("nutriplanner_settings");
      if (!raw) return [];
      var s = JSON.parse(raw);
      var lines = [];
      if (s.dietaryRestrictions && s.dietaryRestrictions.trim()) {
        lines.push("User's dietary restrictions: " + s.dietaryRestrictions.trim());
      }
      if (s.weeklyBudget != null && s.weeklyBudget !== "") {
        var budgetNum = parseFloat(String(s.weeklyBudget).trim());
        var spentNum = s.weeklySpent != null && s.weeklySpent !== "" ? parseFloat(String(s.weeklySpent).trim()) : NaN;
        if (!isNaN(budgetNum) && budgetNum > 0) {
          if (!isNaN(spentNum) && spentNum >= 0) {
            var remaining = budgetNum - spentNum;
            var status = remaining >= 0
              ? "Remaining budget this week: $" + remaining.toFixed(0) + " out of $" + budgetNum.toFixed(0) + "."
              : "User is over budget by $" + Math.abs(remaining).toFixed(0) + " this week (spent $" + spentNum.toFixed(0) + " on a $" + budgetNum.toFixed(0) + " budget).";
            lines.push("User's weekly food budget: $" + budgetNum.toFixed(0) + ". " + status);
          } else {
            lines.push("User's weekly food budget: $" + budgetNum.toFixed(0) + ".");
          }
        } else {
          lines.push("User's weekly food budget (text): " + String(s.weeklyBudget).trim());
        }
      }
      if (s.stockNotes && s.stockNotes.trim()) {
        lines.push("What user has on hand (stock): " + s.stockNotes.trim());
      }
      if (s.shoppingLocation && String(s.shoppingLocation).trim()) {
        lines.push("User's shopping area (for nearby store suggestions): " + String(s.shoppingLocation).trim());
      }
      return lines;
    } catch (e) {
      return [];
    }
  }

  function getNutritionContext() {
    try {
      var targetsRaw = localStorage.getItem("nutriplanner_targets");
      var mealsRaw = localStorage.getItem("nutriplanner_meals");
      var targets = targetsRaw ? JSON.parse(targetsRaw) : null;
      var meals = mealsRaw ? JSON.parse(mealsRaw) : [];
      if (!targets && (!meals || meals.length === 0)) return null;

      var cal = targets ? targets.targetCalories : 0;
      var mac = targets ? targets.targetMacros : { protein_g: 0, carbs_g: 0, fat_g: 0 };
      var totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
      for (var i = 0; i < meals.length; i++) {
        var m = meals[i];
        totalCal += m.calories || 0;
        totalP += m.protein_g || 0;
        totalC += m.carbs_g || 0;
        totalF += m.fat_g || 0;
      }
      var remCal = cal - totalCal, remP = mac.protein_g - totalP, remC = mac.carbs_g - totalC, remF = mac.fat_g - totalF;
      var fmt = function (v) { return v >= 0 ? v + " remaining" : "+" + Math.abs(v) + " over"; };

      var lines = [];
      if (targets) {
        lines.push("Daily targets: " + cal + " cal, " + mac.protein_g + "g protein, " + mac.carbs_g + "g carbs, " + mac.fat_g + "g fat.");
      }
      if (meals.length > 0) {
        lines.push("Meals logged today (" + meals.length + "):");
        meals.forEach(function (m, i) {
          var namePart = (m.name && m.name.trim()) ? m.name.trim() + " — " : "";
          lines.push("  Meal " + (i + 1) + ": " + namePart + (m.calories || 0) + " cal, " + (m.protein_g || 0) + "g P, " + (m.carbs_g || 0) + "g C, " + (m.fat_g || 0) + "g F");
        });
        lines.push("Totals consumed: " + totalCal + " cal, " + totalP + "g protein, " + totalC + "g carbs, " + totalF + "g fat.");
        if (targets) {
          lines.push("Vs target: " + fmt(remCal) + "; protein " + fmt(remP) + "; carbs " + fmt(remC) + "; fat " + fmt(remF) + ".");
        }
      } else if (targets) {
        lines.push("Meals logged today: none yet. (User has set targets but has not logged any meals.)");
      }
      var extras = getSettingsExtras();
      if (extras.length) {
        lines.push("");
        lines.push("User preferences (use when suggesting meals):");
        extras.forEach(function (line) { lines.push(line); });
      }
      return lines.length ? lines.join("\n") : null;
    } catch (e) {
      return null;
    }
  }

  function getNutritionContextForApi() {
    var ctx = getNutritionContext();
    if (ctx) return ctx;
    var fallback = "No Day Log data in this session yet. The user has not set targets or logged any meals (or they used Set Targets / Day Log in a different tab—data is shared only in the same browser). When they ask about 'my meals' or 'my day log', tell them: to get analysis they should (1) open Set Targets, enter weight and goal, click Calculate; (2) open Day Log, add their meals; then return to Chat. Do not say you 'don't have access' or 'can't see'—explain they need to add data in the app first, then you can compare.";
    var extras = getSettingsExtras();
    if (extras.length) {
      fallback += "\n\nUser preferences (use when suggesting meals):\n" + extras.join("\n");
    }
    return fallback;
  }

  function getUserName() {
    try {
      var raw = localStorage.getItem("nutriplanner_settings");
      if (raw) {
        var s = JSON.parse(raw);
        return (s.name || "").trim();
      }
    } catch (e) {}
    return "";
  }

  function sendMessage() {
    var text = inputEl && inputEl.value ? inputEl.value.trim() : "";
    if (!text) return;

    messages.push({ role: "user", content: text });
    appendMessage("user", text);
    if (inputEl) inputEl.value = "";
    showError("");
    setLoading(true);

    var apiErrorMsg = "Chat needs the backend server. Stop any simple file server, then run: cd backend && npm install && npm start — then open this site at http://localhost:8000";

    var body = {
      messages: messages,
      nutrition_context: getNutritionContextForApi(),
      user_name: getUserName() || undefined
    };

    fetch(getApiBase() + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        var ct = (res.headers.get("content-type") || "").toLowerCase();
        if (ct.indexOf("application/json") === -1) {
          throw new Error(apiErrorMsg);
        }
        if (!res.ok) return res.json().then(function (d) { throw new Error(d.detail || res.statusText); });
        return res.json();
      })
      .then(function (data) {
        var reply = data.message || "";
        messages.push({ role: "assistant", content: reply });
        appendMessage("assistant", reply);
      })
      .catch(function (err) {
        var msg = err.message || "";
        if (msg.indexOf("JSON") !== -1 || msg.indexOf("<!DOCTYPE") !== -1) {
          msg = apiErrorMsg;
        }
        showError("Error: " + msg);
      })
      .finally(function () {
        setLoading(false);
      });
  }

  function updateDayLogStatus() {
    var statusEl = document.getElementById("chatDayLogStatus");
    if (!statusEl) return;
    var ctx = getNutritionContext();
    if (ctx) {
      statusEl.textContent = "Using your Day Log (targets + meals) so the AI can compare.";
      statusEl.style.color = "";
    } else {
      statusEl.textContent = "Set targets and log meals on the Day Log page so the AI can analyze your intake.";
      statusEl.style.color = "var(--muted)";
    }
  }

  function startChatUi() {
    updateDayLogStatus();
    setInterval(updateDayLogStatus, 2000);
    if (sendBtn) sendBtn.addEventListener("click", sendMessage);
    if (inputEl) {
      inputEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var p = window.nutriplannerDataReady;
    if (p && typeof p.then === "function") {
      p.then(startChatUi, startChatUi);
    } else {
      startChatUi();
    }
  });
})();
