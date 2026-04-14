/**
 * Apply saved theme/appearance before first paint (avoids flash when auth/cloud loads later).
 * Must load in <head> before style.css. Keep in sync with settings.js STORAGE_KEY / keys.
 */
(function () {
  var KEY = "nutriplanner_settings";
  var ACCENTS = { warm: 1, green: 1, blue: 1, violet: 1 };
  function apply(root, s) {
    if (!s || typeof s !== "object") s = {};
    root.setAttribute("data-theme", s.theme === "light" ? "light" : "dark");
    root.setAttribute("data-accent", ACCENTS[s.accent] ? s.accent : "default");
    var density = s.density === "compact" ? "compact" : "comfortable";
    root.setAttribute("data-density", density);
    root.setAttribute("data-radius", density === "compact" ? "sharp" : "round");
    root.setAttribute("data-font-size", s.fontSize === "lg" ? "lg" : "md");
  }
  try {
    var root = document.documentElement;
    var raw = localStorage.getItem(KEY);
    if (!raw) {
      apply(root, {});
      return;
    }
    var s = JSON.parse(raw);
    apply(root, s && typeof s === "object" ? s : {});
  } catch (e) {
    try {
      apply(document.documentElement, {});
    } catch (e2) {}
  }
})();
