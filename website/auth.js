import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

var LS_TARGETS = "nutriplanner_targets";
var LS_MEALS = "nutriplanner_meals";
var LS_SETTINGS = "nutriplanner_settings";
var LS_WEEKLY = "nutriplanner_weekly_events";

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
  return createClient(url, key, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
    },
  });
}

function clearLocalNutriData() {
  [LS_TARGETS, LS_MEALS, LS_SETTINGS, LS_WEEKLY].forEach(function (k) {
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
    .select("targets, meals, settings, weekly_events")
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
  if (!link && !userEl && !outBtn) return;

  if (!client || !session || !session.user) {
    if (link) show(link, true);
    if (userEl) {
      userEl.textContent = "";
      show(userEl, false);
    }
    if (outBtn) show(outBtn, false);
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
  var googleBtn = document.getElementById("googleSignIn");
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
    msgEl.style.color = isError ? "var(--error)" : "var(--muted)";
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
  }

  var signOutMain = document.getElementById("signOutMain");
  if (signOutMain) {
    signOutMain.addEventListener("click", function () {
      signOutEverywhere(client);
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener("click", function () {
      setMsg("");
      client.auth
        .signInWithOAuth({
          provider: "google",
          options: { redirectTo: getRedirectUrl() },
        })
        .catch(function (err) {
          setMsg(err.message || "Google sign-in failed", true);
        });
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
            setMsg(res.error.message || "Could not send email", true);
            return;
          }
          setMsg("Check your email — we sent you a sign-in link. You can close this tab.", false);
        })
        .catch(function (err) {
          setMsg(err.message || "Request failed", true);
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
  var signUpBtn = document.getElementById("passwordSignUpBtn");
  var backBtn = document.getElementById("passwordBackToSignIn");
  var forgotBtn = document.getElementById("passwordForgotBtn");

  if (signUpBtn && pwForm && signUpForm) {
    signUpBtn.addEventListener("click", function () {
      setMsg("");
      show(pwForm, false);
      show(signUpForm, true);
      if (signUpEmail && pwEmail) signUpEmail.value = (pwEmail.value || "").trim();
    });
  }
  if (backBtn && pwForm && signUpForm) {
    backBtn.addEventListener("click", function () {
      setMsg("");
      show(signUpForm, false);
      show(pwForm, true);
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
            setMsg(res.error.message || "Sign-in failed", true);
            return;
          }
          window.location.reload();
        })
        .catch(function (err) {
          setMsg(err.message || "Sign-in failed", true);
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
            setMsg(res.error.message || "Sign up failed", true);
            return;
          }
          if (res.data && res.data.session) {
            window.location.reload();
            return;
          }
          setMsg(
            "Account created. If email confirmation is required in Supabase, check your inbox — otherwise try Sign in.",
            false
          );
        })
        .catch(function (err) {
          setMsg(err.message || "Sign up failed", true);
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
            setMsg(res.error.message || "Could not send reset email", true);
            return;
          }
          setMsg("If that email is registered, you’ll get a link to set a new password.", false);
        })
        .catch(function (err) {
          setMsg(err.message || "Request failed", true);
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
