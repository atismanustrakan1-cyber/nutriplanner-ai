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

  function initSidebar() {
    var menuBtn = document.getElementById("sidebarMenuBtn");
    var backdrop = document.getElementById("sidebarBackdrop");
    if (!menuBtn || !backdrop) return;

    function setOpen(open) {
      document.body.classList.toggle("sidebar-open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        backdrop.removeAttribute("hidden");
        backdrop.setAttribute("aria-hidden", "false");
      } else {
        backdrop.setAttribute("hidden", "");
        backdrop.setAttribute("aria-hidden", "true");
      }
    }

    menuBtn.addEventListener("click", function () {
      setOpen(!document.body.classList.contains("sidebar-open"));
    });

    backdrop.addEventListener("click", function () {
      setOpen(false);
    });

    var nav = document.getElementById("nav");
    if (nav) {
      nav.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest("a[href]");
        if (!a || !nav.contains(a)) return;
        if (window.matchMedia("(max-width: 899px)").matches) {
          setOpen(false);
        }
      });
    }

    window.addEventListener("resize", function () {
      if (window.matchMedia("(min-width: 900px)").matches) {
        setOpen(false);
      }
    });
  }

  function onReady() {
    setCurrentNav();
    initSidebar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();
