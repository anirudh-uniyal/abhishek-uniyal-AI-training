/* =====================================================================
   Gold Technology — AI Training Program
   Shared lesson runtime: progress, screen navigation, paged quiz,
   copy buttons and the prompt builder.

   A page opts in by defining window.LESSON before loading this file:
     window.LESSON = { id: "m2", quiz: [ { q, o:[...], a, e }, ... ] }
   Everything else is driven by markup, so a new module needs no new JS.
   ===================================================================== */
(function () {
  "use strict";

  var LESSON = window.LESSON || {};
  var MODULE_ID = LESSON.id || "m0";
  var NS = "gt-ai:";

  /* ---------------- storage (a blocked cookie jar must not break a lesson) --- */
  function read(key, fallback) {
    try {
      var v = localStorage.getItem(NS + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  var bar     = document.getElementById("bar");
  var pctFill = document.querySelector(".topbar-pct .fill");
  var pctText = document.querySelector(".topbar-pct .val");

  function setProgress(pct) {
    if (bar)     bar.style.width = pct.toFixed(1) + "%";
    if (pctFill) pctFill.style.width = pct.toFixed(1) + "%";
    if (pctText) pctText.textContent = Math.round(pct) + "%";
  }

  /* ---------------- scroll progress (long-form pages only) ------------------- */
  var hasScreens = !!document.querySelector(".screen");
  if (!hasScreens) {
    var furthest = read(MODULE_ID + ":read", 0);
    var saveTimer = null;
    var scrollProgress = function () {
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
    };
    if (pctFill) pctFill.style.width = furthest.toFixed(1) + "%";
    if (pctText) pctText.textContent = Math.round(furthest) + "%";
    window.addEventListener("scroll", scrollProgress, { passive: true });
    scrollProgress();
  }

  /* ---------------- table-of-contents scroll spy ----------------------------- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll("#toc a"));
  if (tocLinks.length) {
    var tocSecs = tocLinks.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    var spy = function () {
      var mark = window.scrollY + 140, idx = 0;
      for (var i = 0; i < tocSecs.length; i++) {
        if (tocSecs[i] && tocSecs[i].offsetTop <= mark) idx = i;
      }
      tocLinks.forEach(function (a, i) { a.classList.toggle("active", i === idx); });
    };
    window.addEventListener("scroll", spy, { passive: true });
    window.addEventListener("resize", spy);
    spy();
  }

  /* ---------------- completed modules in the journey strip ------------------- */
  document.querySelectorAll("[data-mod]").forEach(function (card) {
    var id = card.getAttribute("data-mod");
    if (read(id + ":score", null) !== null && read(id + ":read", 0) >= 85) {
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

  /* ---------------- copy to clipboard ---------------------------------------- */
  function copyText(text, btn) {
    function done() {
      var old = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("ok");
      setTimeout(function () { btn.textContent = old; btn.classList.remove("ok"); }, 1600);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:absolute;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else { fallback(); }
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
    var out   = builder.querySelector("#built");
    var areas = Array.prototype.slice.call(builder.querySelectorAll("textarea[data-part]"));
    var saved = read(MODULE_ID + ":builder", {});

    var persist = function () {
      var data = {};
      areas.forEach(function (t) { if (t.value.trim()) data[t.dataset.part] = t.value; });
      write(MODULE_ID + ":builder", data);
    };

    var renderBuilder = function () {
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
    };

    areas.forEach(function (t) {
      if (saved[t.dataset.part]) t.value = saved[t.dataset.part];
      t.addEventListener("input", function () { renderBuilder(); persist(); });
    });

    var loadBtn = builder.querySelector("#builder-example");
    if (loadBtn) {
      loadBtn.addEventListener("click", function () {
        var ex = JSON.parse(loadBtn.getAttribute("data-example"));
        areas.forEach(function (t) { t.value = ex[t.dataset.part] || ""; });
        renderBuilder(); persist();
      });
    }
    var clearBtn = builder.querySelector("#builder-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        areas.forEach(function (t) { t.value = ""; });
        renderBuilder(); persist();
      });
    }
    renderBuilder();
  }

  /* ---------------- knowledge check: one question at a time ------------------ */
  var Quiz = null;
  var QUESTIONS = LESSON.quiz || [];
  var quizHost = document.getElementById("quiz");

  if (quizHost && QUESTIONS.length) {
    var LETTERS    = ["A", "B", "C", "D"];
    var scoreBox   = document.getElementById("score");
    var scoreN     = document.getElementById("score-n");
    var scoreT     = document.getElementById("score-t");
    var SCORE_PAGE = QUESTIONS.length;     // the page just past the last question
    var cards      = [];
    var picked     = [];
    var qi         = 0;
    var onChange   = null;                 // the router hooks in here

    function buildQuiz() {
      cards = []; picked = []; qi = 0;
      quizHost.innerHTML = "";
      if (scoreBox) scoreBox.hidden = true;

      QUESTIONS.forEach(function (item, index) {
        var card = document.createElement("div");
        card.className = "q";

        var n = document.createElement("div");
        n.className = "q-n";
        n.textContent = "Question " + (index + 1) + " of " + QUESTIONS.length;
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

          b.addEventListener("click", function () { choose(index, oi); });
          opts.appendChild(b);
        });

        card.appendChild(opts);
        quizHost.appendChild(card);
        cards.push(card);
      });

      showQuestion(0);
    }

    function choose(index, chosen) {
      if (picked[index] !== undefined) return;
      picked[index] = chosen;

      var item    = QUESTIONS[index];
      var card    = cards[index];
      var buttons = Array.prototype.slice.call(card.querySelectorAll(".opt"));
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

      if (onChange) onChange();
    }

    function correctCount() {
      var c = 0;
      picked.forEach(function (p, i) { if (p === QUESTIONS[i].a) c++; });
      return c;
    }

    function showScore() {
      var correct = correctCount();
      write(MODULE_ID + ":score", correct);
      if (!scoreBox) return;
      scoreN.textContent = correct + "/" + QUESTIONS.length;
      var pct = correct / QUESTIONS.length;
      scoreT.textContent =
        pct === 1   ? "Full marks. You have this module cold — carry on to the next one." :
        pct >= 0.75 ? "Solid understanding. Re-read the topics behind the ones you missed, then continue." :
        pct >= 0.5  ? "The basics are there, but the detail is not yet secure. Another pass is worth your time." :
                      "Read the module once more before continuing — the next module builds directly on this one.";
      scoreBox.hidden = false;
    }

    function showQuestion(i) {
      qi = Math.max(0, Math.min(SCORE_PAGE, i));
      cards.forEach(function (c, k) { c.classList.toggle("on", k === qi); });
      if (scoreBox) {
        if (qi === SCORE_PAGE) showScore();
        else scoreBox.hidden = true;
      }
      if (onChange) onChange();
    }

    var retry = document.getElementById("retry");
    if (retry) retry.addEventListener("click", function () { buildQuiz(); });

    Quiz = {
      atStart:     function () { return qi === 0; },
      atEnd:       function () { return qi === SCORE_PAGE; },
      answered:    function () { return qi === SCORE_PAGE || picked[qi] !== undefined; },
      next:        function () { showQuestion(qi + 1); },
      prev:        function () { showQuestion(qi - 1); },
      reset:       function () { buildQuiz(); },
      label:       function () {
        return qi === SCORE_PAGE ? "Your score" : "Question " + (qi + 1) + " of " + QUESTIONS.length;
      },
      nextLabel:   function () { return qi === SCORE_PAGE - 1 ? "See score" : "Next"; },
      setOnChange: function (fn) { onChange = fn; }
    };

    buildQuiz();
  }

  /* ---------------- screen router -------------------------------------------- */
  var screens = Array.prototype.slice.call(document.querySelectorAll(".screen"));
  if (screens.length) {
    var railSteps = Array.prototype.slice.call(document.querySelectorAll(".railstep"));
    var prevBtn   = document.getElementById("nav-prev");
    var nextBtn   = document.getElementById("nav-next");
    var midLabel  = document.getElementById("nav-mid");
    var total     = screens.length;
    var seen      = read(MODULE_ID + ":seen", []);
    var current   = -1;

    var quizIdx = -1;
    screens.forEach(function (s, i) { if (s.querySelector("#quiz")) quizIdx = i; });
    var onQuiz = function () { return Quiz && current === quizIdx; };

    function setBtn(btn, text, arrow) {
      btn.textContent = "";
      if (arrow === "left") {
        btn.appendChild(document.createTextNode("←"));
        var wl = document.createElement("span");
        wl.className = "word";
        wl.textContent = " " + text;
        btn.appendChild(wl);
      } else {
        btn.appendChild(document.createTextNode(text));
        var wr = document.createElement("span");
        wr.className = "word";
        wr.textContent = arrow === "tick" ? " ✓" : " →";
        btn.appendChild(wr);
      }
    }

    function syncNav() {
      if (onQuiz()) {
        prevBtn.disabled = false;                 // question 1 steps back to topic 9
        setBtn(prevBtn, "Previous", "left");
        if (Quiz.atEnd()) {
          nextBtn.disabled = true;
          setBtn(nextBtn, "Finish", "tick");
        } else {
          nextBtn.disabled = !Quiz.answered();
          setBtn(nextBtn, Quiz.nextLabel(), "right");
        }
        midLabel.innerHTML = "";
        var qb = document.createElement("b");
        qb.textContent = Quiz.label();
        midLabel.appendChild(qb);
        if (!Quiz.atEnd() && !Quiz.answered()) {
          midLabel.appendChild(document.createTextNode(" · choose an answer"));
        }
        return;
      }

      var lastScreen = current === total - 1;
      prevBtn.disabled = current === 0;
      nextBtn.disabled = lastScreen;
      setBtn(prevBtn, "Previous", "left");
      setBtn(nextBtn, lastScreen ? "Finish" : "Next", lastScreen ? "tick" : "right");

      midLabel.innerHTML = "";
      var b = document.createElement("b");
      b.textContent = (current + 1) + " / " + total;
      midLabel.appendChild(b);
      midLabel.appendChild(document.createTextNode(" · " + (screens[current].dataset.title || "")));
    }

    function markSeen(i) {
      if (seen.indexOf(i) === -1) { seen.push(i); write(MODULE_ID + ":seen", seen); }
      railSteps.forEach(function (s, k) { s.classList.toggle("seen", seen.indexOf(k) !== -1); });
    }

    function show(i, push) {
      i = Math.max(0, Math.min(total - 1, i));
      var changed = i !== current;
      current = i;

      screens.forEach(function (s, k) { s.classList.toggle("on", k === i); });
      railSteps.forEach(function (s, k) { s.classList.toggle("on", k === i); });

      markSeen(i);
      write(MODULE_ID + ":screen", i);
      setProgress(((i + 1) / total) * 100);
      syncNav();

      var chip = railSteps[i];
      if (chip && chip.scrollIntoView) chip.scrollIntoView({ block: "nearest", inline: "center" });
      if (push) history.replaceState(null, "", "#s" + (i + 1));
      if (changed) window.scrollTo({ top: 0, behavior: "auto" });
    }

    if (Quiz) Quiz.setOnChange(function () { if (onQuiz()) syncNav(); });

    nextBtn.addEventListener("click", function () {
      if (onQuiz() && !Quiz.atEnd()) {
        if (Quiz.answered()) { Quiz.next(); window.scrollTo({ top: 0, behavior: "auto" }); }
        return;
      }
      show(current + 1, true);
    });

    prevBtn.addEventListener("click", function () {
      if (onQuiz() && !Quiz.atStart()) {
        Quiz.prev();
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }
      show(current - 1, true);
    });

    railSteps.forEach(function (s, k) {
      s.addEventListener("click", function () {
        if (Quiz && k === quizIdx && current !== quizIdx) Quiz.reset();
        show(k, true);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.target.matches("input, textarea")) return;
      if (e.key === "ArrowLeft")  prevBtn.click();
      if (e.key === "ArrowRight") nextBtn.click();
    });

    function screenFromHash() {
      var m = location.hash.match(/^#s(\d+)$/);
      if (!m) return null;
      var n = parseInt(m[1], 10);
      return isNaN(n) ? null : n - 1;
    }

    window.addEventListener("hashchange", function () {
      var target = screenFromHash();
      if (target !== null) show(target, false);
    });

    var linked = screenFromHash();
    show(linked !== null ? linked : (read(MODULE_ID + ":screen", 0) || 0), false);
  }
})();
