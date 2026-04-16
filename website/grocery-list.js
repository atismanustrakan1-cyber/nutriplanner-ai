(function () {
  var STORAGE_KEY = "nutriplanner_grocery_list";

  function esc(s) {
    return String(s != null ? s : "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderWhere(whereRaw) {
    var raw = String(whereRaw || "").trim();
    if (!raw) return "—";
    var match = raw.match(/https?:\/\/[^\s]+/i);
    if (!match) return esc(raw);
    var url = match[0];
    var left = raw.replace(url, "").trim();
    var label = (left.split(/[·|]/)[0] || "").split(",")[0].trim() || "Store";
    return '<a class="meal-plan-directions-link" href="' + esc(url) + '" target="_blank" rel="noreferrer noopener">' + esc(label) + "</a>";
  }

  function getRows() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
      return [];
    }
  }

  function setRows(rows) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
    } catch (_e) {}
    if (typeof window.scheduleNutriplannerCloudSave === "function") {
      window.scheduleNutriplannerCloudSave();
    }
  }

  function render() {
    var root = document.getElementById("groceryListRoot");
    if (!root) return;
    var rows = getRows();
    if (!rows.length) {
      root.innerHTML = "<p class=\"muted\">No imported grocery list yet. Generate a plan in AI Meal Plan and import it.</p>";
      return;
    }
    var body = rows.map(function (r, idx) {
      return "<tr><td>" + esc(r.item || "") + "</td><td>" + esc(r.quantity || "1") + "</td><td>" + renderWhere(r.where_buy || r.where || "") + "</td><td><button type=\"button\" class=\"btn ghost small grocery-delete-item-btn\" data-grocery-delete=\"" + idx + "\">Delete</button></td></tr>";
    }).join("");
    root.innerHTML = "<table class=\"meal-plan-grocery-table\"><thead><tr><th>Item</th><th>Quantity</th><th>Location</th><th>Action</th></tr></thead><tbody>" + body + "</tbody></table>";
  }

  function init() {
    var clearBtn = document.getElementById("groceryClearBtn");
    var status = document.getElementById("groceryStatus");
    var addBtn = document.getElementById("groceryAddBtn");
    var itemInput = document.getElementById("groceryItemInput");
    var qtyInput = document.getElementById("groceryQtyInput");
    var whereInput = document.getElementById("groceryWhereInput");
    var listRoot = document.getElementById("groceryListRoot");
    if (qtyInput) {
      qtyInput.addEventListener("input", function () {
        qtyInput.value = String(qtyInput.value || "").replace(/\D+/g, "");
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        setRows([]);
        if (status) status.textContent = "Grocery list cleared.";
        render();
      });
    }
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var item = itemInput ? String(itemInput.value || "").trim() : "";
        var quantity = qtyInput ? String(qtyInput.value || "").trim() : "";
        var where = whereInput ? String(whereInput.value || "").trim() : "";
        if (!item) {
          if (status) status.textContent = "Enter an item name.";
          return;
        }
        if (quantity && !/^\d+$/.test(quantity)) {
          if (status) status.textContent = "Quantity must be numbers only.";
          return;
        }
        var rows = getRows();
        rows.push({
          item: item,
          quantity: quantity || "1",
          where_buy: where || "",
          approx_price_usd: 0,
        });
        setRows(rows);
        if (itemInput) itemInput.value = "";
        if (qtyInput) qtyInput.value = "";
        if (whereInput) whereInput.value = "";
        if (status) status.textContent = "Item added.";
        render();
      });
    }
    if (listRoot) {
      listRoot.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof Element)) return;
        var btn = target.closest("[data-grocery-delete]");
        if (!btn) return;
        var idx = Number(btn.getAttribute("data-grocery-delete"));
        if (!Number.isInteger(idx) || idx < 0) return;
        var rows = getRows();
        if (idx >= rows.length) return;
        rows.splice(idx, 1);
        setRows(rows);
        if (status) status.textContent = "Item deleted.";
        render();
      });
    }
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
