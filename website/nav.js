(function () {
  function setCurrentNav() {
    var nav = document.getElementById("nav");
    if (!nav) return;
    var path = window.location.pathname || "/";
    var segments = path.split("/").filter(Boolean);
    var page = segments.length ? segments[segments.length - 1] : "index.html";
    if (page === "" || path === "/") page = "index.html";
    var links = nav.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = (a.getAttribute("href") || "").replace(/^\.\//, "");
      var isHome = href === "" || href === "index.html";
      var match = (page === "index.html" && isHome) || href === page;
      if (match) a.classList.add("current");
      else a.classList.remove("current");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setCurrentNav);
  } else {
    setCurrentNav();
  }
})();
