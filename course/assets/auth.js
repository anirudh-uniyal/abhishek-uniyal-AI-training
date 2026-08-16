/* ===========================================================================
   Sign-in gate.

   Firebase sends a one-time link rather than a typed code — email links are
   the only passwordless email method it offers, and clicking one proves the
   same thing a code would. Listed addresses skip the email entirely.

   The course markup is public either way: anyone can read this repository or
   request the page directly. This gate records who started the course and
   keeps the casual visitor out; it is not a lock on the content.
   =========================================================================== */
(function () {
  "use strict";

  var CFG      = window.GT_AUTH || {};
  var SDK      = "https://www.gstatic.com/firebasejs/10.12.2/";
  var K_EMAIL  = "gt-ai:auth:email";
  var K_OK     = "gt-ai:auth:ok";
  var K_PEND   = "gt-ai:auth:pending";

  function get(k)    { try { return localStorage.getItem(k); }   catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(k, v); }        catch (e) {} }
  function drop(k)   { try { localStorage.removeItem(k); }        catch (e) {} }

  var gate, form, input, submit, msg, sent, sentTo;

  /* ---------------- the listed addresses ---------------------------------- */

  function sha256(text) {
    if (!window.crypto || !crypto.subtle) return Promise.resolve(null);
    var bytes = new TextEncoder().encode(String(text).trim().toLowerCase());
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
    });
  }

  function isListed(email) {
    var list = CFG.skipVerification || [];
    if (!list.length) return Promise.resolve(false);
    return sha256(email).then(function (h) {
      if (!h) return false;
      for (var i = 0; i < list.length; i++) if (list[i].hash === h) return true;
      return false;
    });
  }

  /* ---------------- firebase, loaded only when it can actually be used ---- */

  var fbLoad = null;

  function firebase() {
    if (fbLoad) return fbLoad;
    var c = CFG.firebase || {};
    var usable = c.apiKey && c.authDomain && c.projectId &&
                 location.protocol !== "file:";
    if (!usable) { fbLoad = Promise.resolve(null); return fbLoad; }

    fbLoad = Promise.all([
      import(SDK + "firebase-app.js"),
      import(SDK + "firebase-auth.js")
    ]).then(function (m) {
      var app  = m[0].initializeApp(c);
      var auth = m[1].getAuth(app);
      return { auth: auth, api: m[1] };
    }).catch(function () {
      return null;   // offline, blocked, or a bad config: fall back to open mode
    });
    return fbLoad;
  }

  /* ---------------- gate UI ----------------------------------------------- */

  function build() {
    gate = document.createElement("div");
    gate.className = "signin";
    gate.innerHTML =
      '<div class="signin-card" role="dialog" aria-modal="true" aria-labelledby="signin-h">' +
        '<img class="signin-logo" src="../course/brand/logo-full.png" alt="Gold Technology">' +
        '<p class="signin-kicker">AI Training Program</p>' +
        '<h1 id="signin-h">Sign in to start</h1>' +
        '<p class="signin-sub">Module 1 — AI Fundamentals &amp; Generative AI</p>' +
        '<form class="signin-form" novalidate>' +
          '<label for="signin-email">Your email address</label>' +
          '<input id="signin-email" type="email" autocomplete="email" ' +
                 'inputmode="email" placeholder="you@company.com" required>' +
          '<button class="signin-go" type="submit">Continue</button>' +
        '</form>' +
        '<p class="signin-msg" role="status" aria-live="polite"></p>' +
        '<div class="signin-sent" hidden>' +
          '<div class="signin-tick">&#10003;</div>' +
          '<h2>Check your inbox</h2>' +
          '<p>We sent a sign-in link to <b class="signin-to"></b>. ' +
             'Open it on this device and the course starts.</p>' +
          '<button class="signin-back" type="button">Use a different address</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(gate);

    form   = gate.querySelector(".signin-form");
    input  = gate.querySelector("#signin-email");
    submit = gate.querySelector(".signin-go");
    msg    = gate.querySelector(".signin-msg");
    sent   = gate.querySelector(".signin-sent");
    sentTo = gate.querySelector(".signin-to");

    form.addEventListener("submit", onSubmit);
    gate.querySelector(".signin-back").addEventListener("click", function () {
      sent.hidden = true; form.hidden = false; say(""); input.focus();
    });

    var remembered = get(K_EMAIL);
    if (remembered) input.value = remembered;
  }

  function say(text, kind) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.className = "signin-msg" + (kind ? " is-" + kind : "");
  }

  function busy(on, label) {
    if (!submit) return;
    submit.disabled = !!on;
    submit.textContent = on ? (label || "Working…") : "Continue";
  }

  function valid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function onSubmit(e) {
    e.preventDefault();
    var email = (input.value || "").trim().toLowerCase();
    if (!valid(email)) { say("That does not look like an email address.", "bad"); input.focus(); return; }

    busy(true, "Checking…");
    say("");

    isListed(email).then(function (listed) {
      if (listed) { unlock(email); return; }

      return firebase().then(function (fb) {
        // no project configured yet: record the address and let them through,
        // so the course stays usable while the setup is still pending
        if (!fb) { unlock(email); return; }

        busy(true, "Sending…");
        var url = CFG.returnUrl || (location.origin + location.pathname);
        return fb.api.sendSignInLinkToEmail(fb.auth, email, {
          url: url, handleCodeInApp: true
        }).then(function () {
          put(K_PEND, email);
          put(K_EMAIL, email);
          sentTo.textContent = email;
          form.hidden = true;
          sent.hidden = false;
          busy(false);
        });
      });
    }).catch(function (err) {
      busy(false);
      say(readable(err), "bad");
    });
  }

  function readable(err) {
    var code = (err && err.code) || "";
    if (code === "auth/invalid-email")         return "That address was rejected. Check it and try again.";
    if (code === "auth/too-many-requests")     return "Too many attempts. Wait a minute, then try again.";
    if (code === "auth/unauthorized-domain")   return "This site is not on the project's authorised-domain list yet.";
    if (code === "auth/network-request-failed") return "No connection. Check your network and try again.";
    return "Could not send the link. Try again in a moment.";
  }

  /* ---------------- locking and unlocking --------------------------------- */

  function unlock(email) {
    if (email) put(K_EMAIL, email);
    put(K_OK, "1");
    drop(K_PEND);
    document.documentElement.classList.add("authed");
    if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
    gate = null;
    mountSignOut();
    // the lesson measures its scroll gate against a full-height page
    window.dispatchEvent(new Event("resize"));
  }

  function signOut() {
    drop(K_OK); drop(K_PEND);
    firebase().then(function (fb) {
      if (fb) { try { fb.api.signOut(fb.auth); } catch (e) {} }
      location.reload();
    });
  }

  function mountSignOut() {
    var bar = document.querySelector(".topbar .audio");
    if (!bar || document.getElementById("a-out")) return;
    var b = document.createElement("button");
    b.className = "abtn";
    b.id = "a-out";
    b.type = "button";
    b.title = "Sign out";
    b.setAttribute("aria-label", "Sign out");
    b.innerHTML = "&#9099;";
    b.addEventListener("click", function () { signOut(); });
    bar.appendChild(b);
  }

  /* ---------------- boot --------------------------------------------------- */

  function start() {
    // returning from the emailed link
    firebase().then(function (fb) {
      if (fb && fb.api.isSignInWithEmailLink(fb.auth, location.href)) {
        var email = get(K_PEND) || get(K_EMAIL);
        if (!email) email = window.prompt("Confirm the email address you used:") || "";
        return fb.api.signInWithEmailLink(fb.auth, email.trim().toLowerCase(), location.href)
          .then(function (res) {
            // drop the one-time code so a refresh cannot replay it
            history.replaceState(null, "", location.pathname + location.hash);
            unlock((res.user && res.user.email) || email);
            return true;
          })
          .catch(function () {
            build();
            say("That link has expired or was already used. Send yourself a new one.", "bad");
            return true;
          });
      }
      return false;
    }).then(function (handled) {
      if (handled) return;
      if (get(K_OK) === "1") { unlock(get(K_EMAIL)); return; }
      build();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
