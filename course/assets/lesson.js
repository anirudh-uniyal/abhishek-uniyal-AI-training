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
  // screen pages do all their scrolling programmatically; CSS smooth scrolling
  // turns those resets into animations and makes position reads unreliable
  if (hasScreens) document.documentElement.style.scrollBehavior = "auto";

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


  /* ---------------- video slots: probed lazily, mounted only if present ----- */
  var VideoSlots = (function () {
    var handled = [];

    function mountPlayer(box, paths, after) {
      var v = document.createElement("video");
      v.controls = true;
      v.playsInline = true;
      v.preload = "metadata";

      // hand the browser every candidate and let it pick the first that decodes;
      // probing with fetch() would fail outright when the page is opened from disk
      var last = null;
      paths.forEach(function (p) {
        var src = document.createElement("source");
        src.src = p;
        src.type = /\.webm$/i.test(p) ? "video/webm" : "video/mp4";
        v.appendChild(src);
        last = src;
      });

      // the final source erroring means every candidate was exhausted
      last.addEventListener("error", function () {
        if (v.readyState === 0) mountMissing(box, v, paths[0], after);
      });
      v.addEventListener("loadedmetadata", function () { if (after) after(); });

      box.replaceChild(v, box.firstElementChild);

      // only one thing should be speaking at a time
      v.addEventListener("play", function () {
        if (!window.__gtNarration) return;
        window.__gtNarration.stop();
        var script = box.getAttribute("data-script");
        if (script && window.__gtNarration.isOn()) window.__gtNarration.speakText(script);
      });
      ["pause", "ended", "emptied"].forEach(function (ev) {
        v.addEventListener(ev, function () {
          if (window.__gtNarration) window.__gtNarration.stop();
        });
      });
    }

    function mountMissing(box, current, path, after) {
      var ph = document.createElement("div");
      ph.className = "vidmissing";
      var t = document.createElement("b");
      var name = box.getAttribute("data-name");
      t.textContent = name ? "Summary video for \u201C" + name + "\u201D" : "Summary video";
      var code = document.createElement("code");
      // show the repository path, not the page-relative one
      code.textContent = path.replace(/^(\.\.\/)+/, "");
      var note = document.createElement("span");
      note.textContent = "Not uploaded yet. Add the file at this path and it plays here automatically.";
      ph.appendChild(t); ph.appendChild(code); ph.appendChild(note);
      box.replaceChild(ph, current);
      if (after) after();
    }

    function ensure(root, after) {
      var boxes = root.querySelectorAll(".videobox[data-src]");
      Array.prototype.forEach.call(boxes, function (box) {
        if (handled.indexOf(box) !== -1) return;
        handled.push(box);
        var path = box.getAttribute("data-src");
        // a real .mp4 wins if it is ever added; otherwise the generated .webm plays
        var candidates = [path];
        var webm = path.replace(/\.mp4$/i, ".webm");
        if (webm !== path) candidates.push(webm);

        mountPlayer(box, candidates, after);
        if (after) after();
      });
    }

    return { ensure: ensure };
  })();

  /* ---------------- narration -------------------------------------------- */
  var Narration = (function () {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return null;

    var synth   = window.speechSynthesis;
    var playBtn = document.getElementById("a-play");
    var muteBtn = document.getElementById("a-mute");
    if (!playBtn || !muteBtn) return null;

    var enabled = read("audio:on", false);   // narration is opt-in, never a surprise
    var voice   = null;
    var chunks  = [];

    // prefer a natural-sounding male English voice; names differ per platform,
    // so try the known good ones in order before falling back to any English one
    var MALE_VOICES = [
      /Google UK English Male/i,
      /Google US English/i,
      /Microsoft (Guy|Ryan|Christopher|Eric|Davis|David|Mark)/i,
      /\bDaniel\b/i,        // Apple en-GB male
      /\bAlex\b/i,          // Apple en-US male
      /\bRishi\b/i,         // Apple en-IN male
      /\bOliver\b/i,
      /\bTom\b/i
    ];

    function pickVoice() {
      var all = synth.getVoices();
      if (!all.length) return null;
      for (var i = 0; i < MALE_VOICES.length; i++) {
        for (var j = 0; j < all.length; j++) {
          if (MALE_VOICES[i].test(all[j].name)) return all[j];
        }
      }
      for (var k = 0; k < all.length; k++) {
        if (/^en[-_]?(IN|GB|US)?/i.test(all[k].lang)) return all[k];
      }
      return all[0];
    }

    // the voice list is populated asynchronously in most browsers
    voice = pickVoice();
    if (synth.addEventListener) {
      synth.addEventListener("voiceschanged", function () { voice = pickVoice(); });
    } else {
      synth.onvoiceschanged = function () { voice = pickVoice(); };
    }
    var at      = 0;
    var playing = false;
    var screenEl = null;

    // pull the readable prose out of a screen, skipping tables, diagrams and captions
    function textOf(el) {
      var picked = el.querySelectorAll("h2, p.sub, h3, h4, p, li, .flow .step b, .flow .step span, .vs .col h5");
      var lines = [];
      Array.prototype.forEach.call(picked, function (node) {
        if (node.closest("table") || node.closest("svg") || node.closest("figcaption")) return;
        if (node.classList.contains("cap")) return;
        var t = (node.textContent || "").replace(/\s+/g, " ").trim();
        if (t) lines.push(t);
      });
      return lines.join(". ");
    }

    // long strings get truncated by some engines, so speak sentence-sized pieces
    function split(text) {
      var out = [], buf = "";
      text.split(/(?<=[.?!])\s+/).forEach(function (sentence) {
        if ((buf + " " + sentence).length > 220) { if (buf) out.push(buf.trim()); buf = sentence; }
        else { buf += " " + sentence; }
      });
      if (buf.trim()) out.push(buf.trim());
      return out;
    }

    function speakFrom(i) {
      if (i >= chunks.length) { stop(); return; }
      at = i;
      var u = new SpeechSynthesisUtterance(chunks[i]);
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 0.94;    // a touch slower reads as calmer and more deliberate
      u.pitch = 0.92;   // slightly lower, which warms up the default timbre
      u.volume = 1;
      u.onend = function () { if (playing) speakFrom(at + 1); };
      u.onerror = function () { stop(); };
      synth.speak(u);
    }

    function start() {
      if (!screenEl) return;
      synth.cancel();
      chunks = split(textOf(screenEl));
      if (!chunks.length) return;
      playing = true;
      speakFrom(0);
      sync();
    }

    function stop() {
      playing = false;
      try { synth.cancel(); } catch (e) { /* ignore */ }
      sync();
    }

    function sync() {
      playBtn.textContent = playing ? "⏸" : "▶";
      playBtn.setAttribute("aria-label", playing ? "Pause narration" : "Play narration");
      playBtn.classList.toggle("on", playing);
      playBtn.disabled = !enabled;
      playBtn.classList.toggle("off", !enabled);
      muteBtn.textContent = enabled ? "🔊" : "🔇";
      muteBtn.setAttribute("aria-label", enabled ? "Turn narration off" : "Turn narration on");
      muteBtn.classList.toggle("on", enabled);
    }

    playBtn.addEventListener("click", function () {
      if (!enabled) return;
      if (playing) stop(); else start();
    });

    muteBtn.addEventListener("click", function () {
      enabled = !enabled;
      write("audio:on", enabled);
      if (!enabled) stop(); else start();   // the tap itself is the gesture browsers require
      sync();
    });

    window.addEventListener("beforeunload", function () { try { synth.cancel(); } catch (e) {} });

    sync();

    function speakText(text) {
      if (!enabled || !text) return;
      synth.cancel();
      chunks = split(text);
      if (!chunks.length) return;
      playing = true;
      speakFrom(0);
      sync();
    }

    return {
      isOn:      function () { return enabled; },
      stop:      stop,
      speakText: speakText,
      setScreen: function (el) {
        screenEl = el;
        stop();
        if (enabled) start();
      }
    };
  })();

  window.__gtNarration = Narration;

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

    /* the learner must reach the bottom of a screen before Next unlocks.
       once cleared a screen stays cleared, so going back is never punished. */
    var cleared = read(MODULE_ID + ":cleared", []);
    var hint = document.getElementById("gatehint");

    var settled = false;       // layout for this screen has stopped moving
    var userScrolled = false;  // the learner has actually scrolled on it

    // a screen that fits entirely on the display has nothing to scroll through
    function screenFits() {
      var el = screens[current];
      if (!el) return false;
      return el.getBoundingClientRect().height <= window.innerHeight - 90;
    }

    // measured against the screen's own bottom, not the document height, so a
    // video slot mounting later cannot flip the answer
    function scrolledOut() {
      var el = screens[current];
      if (!el) return false;
      return el.getBoundingClientRect().bottom <= window.innerHeight + 48;
    }

    function gateOpen() { return cleared.indexOf(current) !== -1; }

    function checkGate() {
      if (current < 0 || !settled || gateOpen()) return;
      // never unlock from a stale scroll position: either the screen genuinely
      // fits, or the learner has scrolled it themselves and reached the end
      if (screenFits() || (userScrolled && scrolledOut())) {
        cleared.push(current);
        write(MODULE_ID + ":cleared", cleared);
        syncNav();
      }
    }

    function showHint(on) {
      if (!hint) return;
      hint.classList.toggle("show", on);
    }

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
        showHint(false);
        prevBtn.disabled = false;                 // question 1 steps back to topic 9
        setBtn(prevBtn, "Previous", "left");
        if (Quiz.atEnd()) {
          // the score page must still lead on to whatever screen follows
          var quizIsLast = current === total - 1;
          nextBtn.disabled = quizIsLast;
          setBtn(nextBtn, quizIsLast ? "Finish" : "Next", quizIsLast ? "tick" : "right");
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
      var locked = !gateOpen();
      prevBtn.disabled = current === 0;
      nextBtn.disabled = lastScreen || locked;
      setBtn(prevBtn, "Previous", "left");
      setBtn(nextBtn, lastScreen ? "Finish" : "Next", lastScreen ? "tick" : "right");
      showHint(locked && !lastScreen);

      midLabel.innerHTML = "";
      var b = document.createElement("b");
      b.textContent = (current + 1) + " / " + total;
      midLabel.appendChild(b);
      if (locked && !lastScreen) {
        var g = document.createElement("span");
        g.className = "gate";
        g.textContent = " · scroll to continue";
        midLabel.appendChild(g);
      } else {
        midLabel.appendChild(document.createTextNode(" · " + (screens[current].dataset.title || "")));
      }
    }

    function markSeen(i) {
      if (seen.indexOf(i) === -1) { seen.push(i); write(MODULE_ID + ":seen", seen); }
      railSteps.forEach(function (s, k) {
        var reached = seen.indexOf(k) !== -1;
        s.classList.toggle("seen", reached);
        s.classList.toggle("locked", !reached);
        s.disabled = !reached;
        s.title = reached ? "" : "Finish the earlier topics first";
      });
    }

    function show(i, push) {
      i = Math.max(0, Math.min(total - 1, i));
      var changed = i !== current;
      // close the gate first: toggling screens and resetting scroll both fire
      // scroll events, and measuring those against a stale position would
      // clear the incoming screen before the learner has seen any of it
      if (changed) { settled = false; userScrolled = false; }
      current = i;

      screens.forEach(function (s, k) { s.classList.toggle("on", k === i); });
      railSteps.forEach(function (s, k) { s.classList.toggle("on", k === i); });

      markSeen(i);
      write(MODULE_ID + ":screen", i);
      setProgress(((i + 1) / total) * 100);
      syncNav();

      if (changed) window.scrollTo({ top: 0, behavior: "instant" });
      var chip = railSteps[i];
      if (chip && chip.scrollIntoView) chip.scrollIntoView({ block: "nearest", inline: "center" });
      if (push) history.replaceState(null, "", "#s" + (i + 1));

      if (Narration && changed) Narration.setScreen(screens[i]);

      // the video slot changes this screen's height, so the gate stays closed
      // until the slot has resolved and layout has run at least once
      var settle = function () {
        settled = true;
        checkGate();
        syncNav();
      };
      VideoSlots.ensure(screens[i], function () {
        requestAnimationFrame(function () { requestAnimationFrame(settle); });
      });
      setTimeout(settle, 600);   // fallback when there is no slot to resolve
    }

    window.addEventListener("scroll", function () {
      if (settled) userScrolled = true;
      checkGate();
    }, { passive: true });
    window.addEventListener("resize", checkGate);

    if (Quiz) Quiz.setOnChange(function () { if (onQuiz()) syncNav(); });

    nextBtn.addEventListener("click", function () {
      if (onQuiz() && !Quiz.atEnd()) {
        if (Quiz.answered()) { Quiz.next(); window.scrollTo({ top: 0, behavior: "instant" }); }
        return;
      }
      show(current + 1, true);
    });

    prevBtn.addEventListener("click", function () {
      if (onQuiz() && !Quiz.atStart()) {
        Quiz.prev();
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
      }
      show(current - 1, true);
    });

    railSteps.forEach(function (s, k) {
      s.addEventListener("click", function () {
        if (seen.indexOf(k) === -1) return;      // not unlocked yet
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

    // a pasted #s7 link cannot jump a learner past screens they have not cleared
    function allowed(i) {
      if (seen.indexOf(i) !== -1) return i;
      return seen.length ? Math.max.apply(null, seen) : 0;
    }

    window.addEventListener("hashchange", function () {
      var target = screenFromHash();
      if (target !== null) show(allowed(target), false);
    });

    var linked = screenFromHash();
    show(allowed(linked !== null ? linked : (read(MODULE_ID + ":screen", 0) || 0)), false);
    if (Narration) Narration.setScreen(screens[current]);
  }
})();

/* ---------------------------------------------------------------------------
   The page reserves room at its foot for the fixed prev/next bar. Hardcoding
   that reserve meant it drifted every time the bar changed height, leaving a
   band of empty page between the footer and the bar. Measure the bar instead.
   --------------------------------------------------------------------------- */
(function () {
  var nav = document.querySelector(".stepnav");
  if (!nav || !document.body.classList.contains("screens")) return;

  function fit() {
    document.body.style.paddingBottom = nav.offsetHeight + "px";
  }

  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(nav);
})();
