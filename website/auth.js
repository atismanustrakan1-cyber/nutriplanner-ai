import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

var LS_TARGETS = "nutriplanner_targets";
var LS_MEALS = "nutriplanner_meals";
var LS_SETTINGS = "nutriplanner_settings";
var LS_WEEKLY = "nutriplanner_weekly_events";
var LS_GROCERY = "nutriplanner_grocery_list";

function getRedirectUrl() {
  try {
    var u = new URL(window.location.href);
    u.hash = "";
    u.search = "";
    return u.href;
  } catch (e) {
    return window.location.origin + "/login.html";
  }
}

function getClient() {
  var url = window.NUTRIPLANNER_SUPABASE_URL;
  var key = window.NUTRIPLANNER_SUPABASE_ANON_KEY;
  if (!url || !key || String(key).trim() === "") return null;
  /* Static SPA: use implicit flow (Supabase JS default). PKCE needs a server exchange route for some redirects. */
  return createClient(url, key, {
    auth: {
      flowType: "implicit",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

/** Map Supabase Auth errors to clearer copy (see https://supabase.com/docs/guides/auth/passwords). */
function friendlyAuthError(err) {
  if (!err) return "Something went wrong. Try again.";
  var msg = String(err.message || "");
  var code = err.code || err.name || "";
  if (code === "email_not_confirmed" || /email.*confirm/i.test(msg)) {
    return "Confirm your email first — open the link Supabase sent you, then sign in.";
  }
  if (
    code === "invalid_credentials" ||
    /invalid login credentials/i.test(msg) ||
    /invalid.*password/i.test(msg)
  ) {
    return "Wrong email or password. Check your details or use “Forgot password?”.";
  }
  if (/user already registered|already been registered/i.test(msg)) {
    return "That email already has an account. Sign in instead.";
  }
  if (/rate limit|too many requests/i.test(msg)) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (/network|fetch/i.test(msg)) {
    return "Network error. Check your connection and try again.";
  }
  return msg || "Request failed.";
}

function clearLocalNutriData() {
  [LS_TARGETS, LS_MEALS, LS_SETTINGS, LS_WEEKLY, LS_GROCERY].forEach(function (k) {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  });
}

function setLocalFromCloudValue(lsKey, val) {
  if (val === null || typeof val === "undefined") {
    try {
      localStorage.removeItem(lsKey);
    } catch (e) {}
    return;
  }
  try {
    localStorage.setItem(lsKey, typeof val === "string" ? val : JSON.stringify(val));
  } catch (e) {}
}

async function loadUserAppData(client, userId) {
  var r = await client
    .from("user_app_data")
    .select("targets, meals, settings, weekly_events, grocery_list")
    .eq("user_id", userId)
    .maybeSingle();
  if (r.error) throw r.error;
  if (!r.data) {
    await saveUserAppData(client);
    return;
  }
  var d = r.data;
  setLocalFromCloudValue(LS_TARGETS, d.targets);
  setLocalFromCloudValue(LS_MEALS, d.meals);
  setLocalFromCloudValue(LS_SETTINGS, d.settings);
  setLocalFromCloudValue(LS_WEEKLY, d.weekly_events);
  setLocalFromCloudValue(LS_GROCERY, d.grocery_list);
}

function parseLocalKey(key) {
  try {
    var raw = localStorage.getItem(key);
    if (raw == null || raw === "") return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function saveUserAppData(client) {
  var res = await client.auth.getSession();
  var session = res.data && res.data.session ? res.data.session : null;
  if (!session) return;
  var payload = {
    user_id: session.user.id,
    targets: parseLocalKey(LS_TARGETS),
    meals: parseLocalKey(LS_MEALS),
    settings: parseLocalKey(LS_SETTINGS),
    weekly_events: parseLocalKey(LS_WEEKLY),
    grocery_list: parseLocalKey(LS_GROCERY),
    updated_at: new Date().toISOString(),
  };
  var up = await client.from("user_app_data").upsert(payload, { onConflict: "user_id" });
  if (up.error) throw up.error;
}

var cloudSaveTimer = null;

function scheduleNutriplannerCloudSave() {
  var c = getClient();
  if (!c) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(function () {
    saveUserAppData(c).catch(function () {});
  }, 700);
}

window.scheduleNutriplannerCloudSave = scheduleNutriplannerCloudSave;

window.nutriplannerDataReady = (async function () {
  var client = getClient();
  if (!client) return;
  try {
    var res = await client.auth.getSession();
    var session = res.data && res.data.session ? res.data.session : null;
    if (!session) return;
    await loadUserAppData(client, session.user.id);
  } catch (e) {
    console.warn("NutriPlanner cloud load failed:", e);
  }
})();

function signOutEverywhere(client) {
  if (!client) return;
  clearLocalNutriData();
  client.auth.signOut().then(function () {
    window.location.reload();
  });
}

function show(el, on) {
  if (!el) return;
  if (on) el.removeAttribute("hidden");
  else el.setAttribute("hidden", "");
}

function setNavAuth(client, session) {
  var link = document.getElementById("navAuthLink");
  var userEl = document.getElementById("navAuthUser");
  var outBtn = document.getElementById("navAuthSignOut");
  var heroSignInRow = document.getElementById("heroSignInRow");
  var homeSignInCard = document.getElementById("homeSignInCard");
  if (!link && !userEl && !outBtn && !heroSignInRow && !homeSignInCard) return;

  if (!client || !session || !session.user) {
    if (link) show(link, true);
    if (userEl) {
      userEl.textContent = "";
      show(userEl, false);
    }
    if (outBtn) show(outBtn, false);
    if (heroSignInRow) show(heroSignInRow, true);
    if (homeSignInCard) show(homeSignInCard, true);
    return;
  }

  var meta = session.user.user_metadata || {};
  var email = session.user.email || meta.full_name || "Signed in";
  if (link) show(link, false);
  if (userEl) {
    userEl.textContent = email;
    show(userEl, true);
  }
  if (outBtn) show(outBtn, true);
  if (heroSignInRow) show(heroSignInRow, false);
  if (homeSignInCard) show(homeSignInCard, false);
}

async function initNav(client) {
  if (!client) return;
  var link = document.getElementById("navAuthLink");
  if (!link) return;

  var outBtn = document.getElementById("navAuthSignOut");
  var session = null;
  try {
    var res = await client.auth.getSession();
    session = res.data && res.data.session ? res.data.session : null;
  } catch (e) {
    return;
  }
  setNavAuth(client, session);

  if (outBtn) {
    outBtn.addEventListener("click", function () {
      signOutEverywhere(client);
    });
  }

  client.auth.onAuthStateChange(function (_event, sess) {
    setNavAuth(client, sess);
  });
}

async function initLoginPage(client) {
  var warn = document.getElementById("authConfigWarn");
  var signedIn = document.getElementById("authSignedIn");
  var signedOut = document.getElementById("authSignedOut");
  var userLabel = document.getElementById("authUserEmail");
  var emailForm = document.getElementById("emailMagicForm");
  var emailInput = document.getElementById("emailMagicInput");
  var msgEl = document.getElementById("authMessage");

  if (!client) {
    show(warn, true);
    show(signedIn, false);
    show(signedOut, false);
    return;
  }

  show(warn, false);

  function setMsg(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.classList.toggle("auth-alert-error", !!isError && !!text);
    msgEl.hidden = !text;
  }

  var res = await client.auth.getSession();
  var session = res.data && res.data.session ? res.data.session : null;
  if (session && session.user) {
    show(signedIn, true);
    show(signedOut, false);
    if (userLabel) userLabel.textContent = session.user.email || "";
  } else {
    show(signedIn, false);
    show(signedOut, true);
    setMsg("", false);
  }

  var signOutMain = document.getElementById("signOutMain");
  if (signOutMain) {
    signOutMain.addEventListener("click", function () {
      signOutEverywhere(client);
    });
  }

  if (emailForm && emailInput) {
    emailForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = (emailInput.value || "").trim();
      if (!email) {
        setMsg("Enter your email address.", true);
        return;
      }
      setMsg("Sending link…");
      client.auth
        .signInWithOtp({
          email: email,
          options: { emailRedirectTo: getRedirectUrl() },
        })
        .then(function (res) {
          if (res.error) {
            setMsg(friendlyAuthError(res.error), true);
            return;
          }
          setMsg("Check your email — we sent you a sign-in link. You can close this tab.", false);
        })
        .catch(function (err) {
          setMsg(friendlyAuthError(err), true);
        });
    });
  }

  var pwForm = document.getElementById("passwordSignInForm");
  var pwEmail = document.getElementById("passwordEmail");
  var pwPass = document.getElementById("passwordSignIn");
  var signUpForm = document.getElementById("passwordSignUpForm");
  var signUpEmail = document.getElementById("signUpEmail");
  var signUpPass = document.getElementById("signUpPassword");
  var signUpPass2 = document.getElementById("signUpPasswordConfirm");
  var modeSignIn = document.getElementById("authModeSignIn");
  var modeSignUp = document.getElementById("authModeSignUp");
  var panelSignIn = document.getElementById("authPanelSignIn");
  var panelSignUp = document.getElementById("authPanelSignUp");
  var forgotBtn = document.getElementById("passwordForgotBtn");

  function showAuthMode(signUp) {
    setMsg("");
    if (panelSignIn && panelSignUp) {
      show(panelSignIn, !signUp);
      show(panelSignUp, !!signUp);
    }
    if (modeSignIn && modeSignUp) {
      modeSignIn.classList.toggle("auth-tab-active", !signUp);
      modeSignUp.classList.toggle("auth-tab-active", !!signUp);
      modeSignIn.setAttribute("aria-selected", !signUp ? "true" : "false");
      modeSignUp.setAttribute("aria-selected", signUp ? "true" : "false");
      modeSignIn.setAttribute("tabindex", !signUp ? "0" : "-1");
      modeSignUp.setAttribute("tabindex", signUp ? "0" : "-1");
    }
    if (signUp && signUpEmail && pwEmail) {
      signUpEmail.value = (pwEmail.value || "").trim();
    }
    if (!signUp && pwEmail && signUpEmail) {
      pwEmail.value = (signUpEmail.value || "").trim();
    }
  }

  if (modeSignIn) {
    modeSignIn.addEventListener("click", function () {
      showAuthMode(false);
    });
  }
  if (modeSignUp) {
    modeSignUp.addEventListener("click", function () {
      showAuthMode(true);
    });
  }

  var tablistEl = modeSignIn && modeSignIn.parentElement;
  if (tablistEl && modeSignIn && modeSignUp) {
    tablistEl.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        showAuthMode(true);
        modeSignUp.focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        showAuthMode(false);
        modeSignIn.focus();
      }
    });
  }

  if (pwForm && pwEmail && pwPass) {
    pwForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = (pwEmail.value || "").trim();
      var password = pwPass.value || "";
      if (!email || !password) {
        setMsg("Enter email and password.", true);
        return;
      }
      setMsg("Signing in…");
      client.auth
        .signInWithPassword({ email: email, password: password })
        .then(function (res) {
          if (res.error) {
            setMsg(friendlyAuthError(res.error), true);
            return;
          }
          window.location.reload();
        })
        .catch(function (err) {
          setMsg(friendlyAuthError(err), true);
        });
    });
  }

  if (signUpForm && signUpEmail && signUpPass && signUpPass2) {
    signUpForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = (signUpEmail.value || "").trim();
      var p1 = signUpPass.value || "";
      var p2 = signUpPass2.value || "";
      if (!email || !p1) {
        setMsg("Enter email and password.", true);
        return;
      }
      if (p1 !== p2) {
        setMsg("Passwords do not match.", true);
        return;
      }
      if (p1.length < 6) {
        setMsg("Use at least 6 characters for your password.", true);
        return;
      }
      setMsg("Creating account…");
      client.auth
        .signUp({
          email: email,
          password: p1,
          options: { emailRedirectTo: getRedirectUrl() },
        })
        .then(function (res) {
          if (res.error) {
            setMsg(friendlyAuthError(res.error), true);
            return;
          }
          if (res.data && res.data.session) {
            window.location.reload();
            return;
          }
          setMsg(
            "Check your email to confirm your account (if confirmations are on in Supabase), then sign in.",
            false
          );
        })
        .catch(function (err) {
          setMsg(friendlyAuthError(err), true);
        });
    });
  }

  if (forgotBtn && pwEmail) {
    forgotBtn.addEventListener("click", function () {
      var email = (pwEmail.value || "").trim();
      if (!email) {
        setMsg("Enter your email above, then click Forgot password again.", true);
        return;
      }
      setMsg("Sending reset email…");
      client.auth
        .resetPasswordForEmail(email, { redirectTo: getRedirectUrl() })
        .then(function (res) {
          if (res.error) {
            setMsg(friendlyAuthError(res.error), true);
            return;
          }
          setMsg("If that email is registered, you’ll get a link to set a new password.", false);
        })
        .catch(function (err) {
          setMsg(friendlyAuthError(err), true);
        });
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var client = getClient();
  initNav(client);
  if (document.getElementById("authSignedOut")) {
    initLoginPage(client).catch(function () {});
  }
});
