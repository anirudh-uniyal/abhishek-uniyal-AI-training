/* =====================================================================
   Gold Technology — AI Training Program
   Shared lesson runtime: progress, navigation, quiz, prompt builder.

   A page opts in by defining window.LESSON before loading this file:
     window.LESSON = { id: "m2", quiz: [ { q, o:[...], a, e }, ... ] }
   Everything else is driven by markup, so a new module needs no new JS.
   ===================================================================== */
(function () {
  "use strict";

  var LESSON = window.LESSON || {};
  var MODULE_ID = LESSON.id || "m0";
  var NS = "gt-ai:";

  /* ---------------- storage (never let a blocked cookie jar break a lesson) ---- */
  function read(key, fallback) {
    try {
      var v = localStorage.getItem(NS + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  /* ---------------- reading progress + furthest-read persistence -------------- */
  var bar = document.getElementById("bar");
  var pctFill = document.querySelector(".topbar-pct .fill");
  var pctText = document.querySelector(".topbar-pct .val");
  var furthest = read(MODULE_ID + ":read", 0);
  var saveTimer = null;

  function progress() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;

    if (bar) bar.style.width = pct.toFixed(2) + "%";

    if (pct > furthest) {
      furthest = pct;
      if (pctFill) pctFill.style.width = furthest.toFixed(1) + "%";
      if (pctText) pctText.textContent = Math.round(furthest) + "%";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { write(MODULE_ID + ":read", furthest); }, 400);
    }
  }
  if (pctFill) pctFill.style.width = furthest.toFixed(1) + "%";
  if (pctText) pctText.textContent = Math.round(furthest) + "%";

  /* ---------------- table-of-contents scroll spy ------------------------------ */
  var links = Array.prototype.slice.call(document.querySelectorAll("#toc a"));
  var secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });

  function spy() {
    var mark = window.scrollY + 140, idx = 0;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i] && secs[i].offsetTop <= mark) idx = i;
    }
    links.forEach(function (a, i) { a.classList.toggle("active", i === idx); });
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { progress(); spy(); ticking = false; });
  }, { passive: true });
  window.addEventListener("resize", function () { progress(); spy(); });
  progress(); spy();

  /* ---------------- completed modules in the journey strip -------------------- */
  document.querySelectorAll("[data-mod]").forEach(function (card) {
    var id = card.getAttribute("data-mod");
    var scored = read(id + ":score", null);
    var seen = read(id + ":read", 0);
    if (scored !== null && seen >= 85) {
      card.classList.add("done");
      var b = card.querySelector("b");
      if (b && !b.querySelector(".tick")) {
        var t = document.createElement("span");
        t.className = "tick";
        t.textContent = " ✓";
        b.appendChild(t);
      }
    }
  });

  /* ---------------- copy-to-clipboard ---------------------------------------- */
  function copyText(text, btn) {
    function done() {
      var old = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("ok");
      setTimeout(function () { btn.textContent = old; btn.classList.remove("ok"); }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
    } else {
      fallback(text, done);
    }
  }
  function fallback(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:absolute;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  document.querySelectorAll(".copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var box = btn.closest(".prompt");
      var pre = box && box.querySelector("pre");
      if (pre) copyText(pre.textContent.trim(), btn);
    });
  });

  /* ---------------- prompt builder ------------------------------------------- */
  var builder = document.getElementById("builder");
  if (builder) {
    var out = builder.querySelector("#built");
    var areas = Array.prototype.slice.call(builder.querySelectorAll("textarea[data-part]"));
    var saved = read(MODULE_ID + ":builder", {});

    areas.forEach(function (t) {
      if (saved[t.dataset.part]) t.value = saved[t.dataset.part];
      t.addEventListener("input", function () { render(); persist(); });
    });

    function persist() {
      var data = {};
      areas.forEach(function (t) { if (t.value.trim()) data[t.dataset.part] = t.value; });
      write(MODULE_ID + ":builder", data);
    }

    function render() {
      var parts = [];
      areas.forEach(function (t) {
        var v = t.value.trim();
        if (v) parts.push(t.dataset.label.toUpperCase() + "\n" + v);
      });
      if (parts.length) {
        out.textContent = parts.join("\n\n");
        out.classList.remove("builder-empty");
      } else {
        out.textContent = "Fill the fields above and your prompt assembles here, ready to copy.";
        out.classList.add("builder-empty");
      }
    }

    var loadBtn = builder.querySelector("#builder-example");
    if (loadBtn) {
      loadBtn.addEventListener("click", function () {
        var ex = JSON.parse(loadBtn.getAttribute("data-example"));
        areas.forEach(function (t) { t.value = ex[t.dataset.part] || ""; });
        render(); persist();
      });
    }

    var clearBtn = builder.querySelector("#builder-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        areas.forEach(function (t) { t.value = ""; });
        render(); persist();
      });
    }

    render();
  }

  /* ---------------- knowledge check ------------------------------------------ */
  var QUESTIONS = LESSON.quiz || [];
  var host = document.getElementById("quiz");

  if (host && QUESTIONS.length) {
    var LETTERS = ["A", "B", "C", "D"];
    var scoreBox = document.getElementById("score");
    var scoreN = document.getElementById("score-n");
    var scoreT = document.getElementById("score-t");
    var answered, correct;

    function build() {
      answered = 0; correct = 0;
      if (scoreBox) scoreBox.hidden = true;
      host.innerHTML = "";

      QUESTIONS.forEach(function (item, qi) {
        var card = document.createElement("div");
        card.className = "q";

        var n = document.createElement("div");
        n.className = "q-n";
        n.textContent = "Question " + (qi + 1) + " of " + QUESTIONS.length;
        card.appendChild(n);

        var t = document.createElement("p");
        t.className = "q-t";
        t.textContent = item.q;
        card.appendChild(t);

        var opts = document.createElement("div");
        opts.className = "opts";

        item.o.forEach(function (text, oi) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "opt";

          var k = document.createElement("span");
          k.className = "k";
          k.textContent = LETTERS[oi];
          b.appendChild(k);

          var s = document.createElement("span");
          s.textContent = text;
          b.appendChild(s);

          b.addEventListener("click", function () { pick(card, opts, item, oi); });
          opts.appendChild(b);
        });

        card.appendChild(opts);
        host.appendChild(card);
      });
    }

    function pick(card, opts, item, chosen) {
      var buttons = Array.prototype.slice.call(opts.querySelectorAll(".opt"));
      if (buttons[0].disabled) return;

      buttons.forEach(function (b, i) {
        b.disabled = true;
        if (i === item.a) b.classList.add("right");
        else if (i === chosen) b.classList.add("wrong");
      });

      var exp = document.createElement("div");
      exp.className = "exp";
      var lead = document.createElement("b");
      lead.textContent = chosen === item.a ? "Correct. " : "Not quite. ";
      exp.appendChild(lead);
      exp.appendChild(document.createTextNode(item.e));
      card.appendChild(exp);

      answered++;
      if (chosen === item.a) correct++;
      if (answered === QUESTIONS.length) finish();
    }

    function finish() {
      write(MODULE_ID + ":score", correct);
      if (!scoreBox) return;
      scoreN.textContent = correct + "/" + QUESTIONS.length;

      var pct = correct / QUESTIONS.length;
      var msg;
      if (pct === 1)        msg = "Full marks. You have this module cold — carry on to the next one.";
      else if (pct >= 0.75) msg = "Solid understanding. Re-read the sections behind the ones you missed, then continue.";
      else if (pct >= 0.5)  msg = "The basics are there, but the detail is not yet secure. Another pass through the module is worth your time.";
      else                  msg = "Read the module once more before continuing — the next module builds directly on this one.";
      scoreT.textContent = msg;
      scoreBox.hidden = false;
    }

    var retry = document.getElementById("retry");
    if (retry) {
      retry.addEventListener("click", function () {
        build();
        var sec = host.closest(".sec");
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    build();
  }
})();
