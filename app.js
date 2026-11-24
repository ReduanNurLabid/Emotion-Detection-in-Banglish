/* Bangla emotion label-audit app. Static page; answers go to a Google Apps Script endpoint. */
(() => {
  const CFG = window.LABEL_CONFIG;
  // Local testing only: ?endpoint=... is honoured on localhost, never on the public site.
  const qsEndpoint = new URLSearchParams(location.search).get("endpoint");
  if (qsEndpoint && ["localhost", "127.0.0.1"].includes(location.hostname)) CFG.endpoint = qsEndpoint;
  const KEY = `labelstudy:${CFG.study}`;
  const TEST_MODE = !CFG.endpoint;
  const app = document.getElementById("app");

  const CHOICES = [
    ["anger", "Anger", "রাগ"], ["disgust", "Disgust", "ঘৃণা/বিরক্তি"], ["fear", "Fear", "ভয়/দুশ্চিন্তা"],
    ["joy", "Joy", "আনন্দ/ভালোবাসা"], ["sadness", "Sadness", "দুঃখ"], ["surprise", "Surprise", "বিস্ময়"],
    ["neutral", "No clear emotion", "কোনো আবেগ নেই"], ["unclear", "Can't understand", "বুঝতে পারছি না"],
  ];
  const NAME = Object.fromEntries(CHOICES.map(([k, en]) => [k, en]));
  const PRACTICE = [
    { bn: "আজ রেজাল্ট দিয়েছে, আমি পাস করেছি! আলহামদুলিল্লাহ", bl: "aj result diyeche, ami pass korechi! alhamdulillah",
      answer: "joy", why: "The writer is happy and grateful." },
    { bn: "রাস্তায় ময়লার স্তূপ, গন্ধে বমি আসে। ছি!", bl: "rastay moylar stup, gondhe bomi ase. chi!",
      answer: "disgust", why: "Revulsion (“gross”), not hostility toward someone." },
    { bn: "কাল পরীক্ষা, কিছুই পড়া হয়নি, খুব দুশ্চিন্তা হচ্ছে", bl: "kal porikkha, kichui pora hoyni, khub dushchinta hocche",
      answer: "fear", why: "Worry about something that is going to happen." },
    { bn: "বাহ, আবার কারেন্ট নেই! দারুণ সেবা দিচ্ছেন আপনারা", bl: "bah, abar current nei! darun seba dicchen apnara",
      answer: "anger", why: "Sarcasm: “great service” really means the writer is angry." },
  ];

  // ---------- state ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ } };
  if (new URLSearchParams(location.search).get("reset") === "1") {
    try { localStorage.removeItem(KEY); } catch {}
    const u = new URL(location.href); u.searchParams.delete("reset"); history.replaceState(null, "", u); // a refresh must not wipe progress
  }
  let S = load() || { stage: "welcome", sessionId: uid(), answers: {}, pending: [], pos: 0, practicePos: 0 };
  let ITEMS = null, REPEATS = [], itemShownAt = 0;

  function uid() {
    const a = new Uint8Array(8); (crypto || window.msCrypto).getRandomValues(a);
    return "s" + Date.now().toString(36) + Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
  }
  function rng(seedStr) { // mulberry32 seeded from a string hash
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function buildOrder() {
    const r = rng(S.sessionId), ids = ITEMS.map(i => i.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    let order = ids.map(id => ({ id, repeat: false }));
    const firstZone = Math.max(1, ids.length - CFG.repeatGapMin - 40);
    for (const rid of REPEATS) { // keep originals early enough, then insert the repeat later
      let i = order.findIndex(o => o.id === rid);
      if (i >= firstZone) { const [o] = order.splice(i, 1); i = Math.floor(r() * firstZone); order.splice(i, 0, o); }
    }
    for (const rid of REPEATS) {
      const i = order.findIndex(o => o.id === rid && !o.repeat);
      const j = Math.min(order.length, i + CFG.repeatGapMin + Math.floor(r() * 40));
      order.splice(j, 0, { id: rid, repeat: true });
    }
    return order;
  }

  // ---------- network ----------
  // No `keepalive`: browsers cap in-flight keepalive bodies (~64 KB) and silently reject the rest.
  function post(payload) {
    if (TEST_MODE) return Promise.resolve();
    return fetch(CFG.endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload) });
  }
  let inFlight = null; // one batch at a time, so fast tapping can't flood the network
  function flush() {
    if (TEST_MODE || inFlight || !S.pending.length) return inFlight || Promise.resolve();
    const batch = S.pending.slice(0, 25);
    inFlight = post({ type: "answers", study: CFG.study, session: S.sessionId, name: S.profile?.name, answers: batch })
      .then(() => { S.pending = S.pending.slice(batch.length); save(); })
      .catch(() => { /* keep pending; retried on next answer or on the final screen */ })
      .finally(() => { inFlight = null; if (S.pending.length && S.stage === "items") setTimeout(flush, 500); });
    return inFlight;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && S.pending.length && !TEST_MODE && navigator.sendBeacon) {
      navigator.sendBeacon(CFG.endpoint, new Blob([JSON.stringify({ type: "answers", study: CFG.study, session: S.sessionId,
        name: S.profile?.name, answers: S.pending })], { type: "text/plain;charset=utf-8" }));
    }
  });
  function serverCount() { // JSONP so it works cross-origin from GitHub Pages
    return new Promise((resolve, reject) => {
      const cb = "__lc" + Math.random().toString(36).slice(2), s = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 12000);
      function cleanup() { clearTimeout(timer); delete window[cb]; s.remove(); }
      window[cb] = data => { cleanup(); resolve(data); };
      s.onerror = () => { cleanup(); reject(new Error("network")); };
      s.src = `${CFG.endpoint}?action=count&session=${encodeURIComponent(S.sessionId)}&callback=${cb}`;
      document.head.appendChild(s);
    });
  }

  // ---------- rendering ----------
  const tpl = id => document.getElementById(id).content.cloneNode(true);
  const $ = sel => app.querySelector(sel);
  function show(node) { app.replaceChildren(node); window.scrollTo(0, 0); }

  function render() {
    save();
    ({ welcome: renderWelcome, profile: renderProfile, guide: renderGuide, practice: renderPractice,
       items: renderItem, done: renderDone })[S.stage]();
  }
  function renderWelcome() {
    show(tpl("tpl-welcome"));
    $("#consent").onchange = e => { $("#btn-start").disabled = !e.target.checked; };
    $("#btn-start").onclick = () => { S.consentAt = new Date().toISOString(); S.stage = "profile"; render(); };
  }
  function renderProfile() {
    show(tpl("tpl-profile"));
    $("#btn-profile").onclick = () => {
      const p = { name: $("#p-name").value.trim(), role: $("#p-role").value, native: $("#p-native").value,
        banglish: $("#p-banglish").value, alone: $("#p-alone").checked };
      if (!p.name || !p.role || !p.native || !p.banglish || !p.alone) { $("#p-err").hidden = false; return; }
      S.profile = p; S.order = buildOrder(); S.stage = "guide";
      post({ type: "session", study: CFG.study, session: S.sessionId, consent_at: S.consentAt, started_at: new Date().toISOString(),
        ...p, n_items: S.order.length, user_agent: navigator.userAgent }).catch(() => {});
      render();
    };
  }
  function renderGuide() {
    show(tpl("tpl-guide"));
    $("#btn-practice").onclick = () => { S.stage = "practice"; S.practicePos = 0; render(); };
  }
  function choiceButtons(onPick, selected) {
    const box = $("#choices");
    for (const [k, en, bn] of CHOICES) {
      const b = document.createElement("button");
      b.className = `c-${k}` + (selected === k ? " selected" : "");
      b.append(en); const sm = document.createElement("small"); sm.textContent = bn; b.append(sm);
      b.onclick = () => onPick(k);
      box.append(b);
    }
  }
  function renderPractice() {
    const it = PRACTICE[S.practicePos];
    show(tpl("tpl-item"));
    $("#practice-tag").hidden = false;
    $("#t-bn").textContent = it.bn; $("#t-bl").textContent = it.bl;
    $("#counter").textContent = `Practice ${S.practicePos + 1}/${PRACTICE.length}`;
    $("#bar-fill").style.width = `${(S.practicePos / PRACTICE.length) * 100}%`;
    $("#btn-back").onclick = () => { if (S.practicePos > 0) { S.practicePos--; render(); } else { S.stage = "guide"; render(); } };
    $("#btn-help").onclick = openHelp;
    choiceButtons(k => {
      const fb = $("#feedback"); fb.hidden = false; fb.replaceChildren();
      const ok = k === it.answer;
      fb.append(`${ok ? "✅ Good." : "Suggested answer: " + NAME[it.answer] + "."} ${it.why} `);
      const next = document.createElement("button"); next.className = "primary";
      const last = S.practicePos === PRACTICE.length - 1;
      next.textContent = last ? "Start the real comments" : "Next practice";
      next.onclick = () => { if (last) { S.stage = "items"; S.pos = 0; } else S.practicePos++; render(); };
      fb.append(next);
      app.querySelectorAll("#choices button").forEach(b => (b.disabled = true));
    });
  }
  function renderItem() {
    const entry = S.order[S.pos], it = ITEMS.find(i => i.id === entry.id), prev = S.answers[S.pos];
    show(tpl("tpl-item"));
    $("#t-bn").textContent = it.bn; $("#t-bl").textContent = it.bl;
    $("#counter").textContent = `${S.pos + 1} / ${S.order.length}`;
    $("#bar-fill").style.width = `${(S.pos / S.order.length) * 100}%`;
    $("#unsure").checked = !!prev?.unsure;
    $("#btn-back").disabled = S.pos === 0;
    $("#btn-back").onclick = () => { if (S.pos > 0) { S.pos--; render(); } };
    $("#btn-help").onclick = openHelp;
    itemShownAt = performance.now();
    choiceButtons(k => {
      const a = { order_index: S.pos, item_id: entry.id, is_repeat: entry.repeat, label: k, unsure: $("#unsure").checked,
        ms: Math.round(performance.now() - itemShownAt), ts: new Date().toISOString(), edited: !!prev };
      S.answers[S.pos] = a; S.pending.push(a);
      S.pos++;
      if (S.pos >= S.order.length) { S.stage = "done"; S.completedAt = new Date().toISOString(); }
      if (S.pending.length >= 5 || S.stage === "done") flush();
      render();
    }, prev?.label);
  }
  function allAnswers() { return Object.values(S.answers).sort((a, b) => a.order_index - b.order_index); }
  async function renderDone() {
    show(tpl("tpl-done"));
    const status = $("#sync-status"), fallback = $("#fallback");
    const dl = () => JSON.stringify({ study: CFG.study, session: S.sessionId, profile: S.profile, consent_at: S.consentAt,
      completed_at: S.completedAt, answers: allAnswers() });
    $("#btn-download").onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([dl()], { type: "application/json" }));
      a.download = `labels_${(S.profile?.name || "anon").replace(/\W+/g, "_")}_${S.sessionId.slice(-6)}.json`; a.click();
    };
    $("#btn-copy").onclick = () => navigator.clipboard?.writeText(dl()).then(() => alert("Copied. Paste it in a message to the organiser."));
    $("#btn-retry").onclick = () => renderDone();
    if (TEST_MODE) { status.textContent = "TEST MODE: nothing was sent."; fallback.hidden = false; return; }
    if (S.verified) { status.textContent = `✅ All ${S.order.length} answers received. You can close this page.`; return; }
    const expected = S.order.length;
    for (let attempt = 0; attempt < 3; attempt++) {
      status.textContent = attempt ? `Checking again (${attempt + 1}/3)…` : "Sending your answers…";
      try {
        await flush();
        await post({ type: "final", study: CFG.study, session: S.sessionId, name: S.profile?.name, completed_at: S.completedAt,
          answers: allAnswers() });
        await new Promise(r => setTimeout(r, 2500 * (attempt + 1)));
        const res = await serverCount();
        if (res && res.count >= expected) {
          S.verified = true; S.pending = []; save();
          status.textContent = `✅ All ${expected} answers received. You can close this page.`; return;
        }
      } catch { /* retry */ }
    }
    status.textContent = "Your answers are saved on this phone, but we could not confirm they reached us.";
    fallback.hidden = false;
  }
  function openHelp() {
    const d = document.createElement("dialog"); d.className = "card"; d.style.maxWidth = "600px";
    const g = tpl("tpl-guide"); g.querySelector("#btn-practice").remove(); d.append(g);
    const c = document.createElement("button"); c.className = "primary"; c.textContent = "Back to labeling";
    c.onclick = () => { d.close(); d.remove(); }; d.append(c);
    document.body.append(d); d.showModal();
  }

  // ---------- boot ----------
  if (TEST_MODE) document.getElementById("testbanner").hidden = false;
  fetch("items.json", { cache: "no-store" }).then(r => r.json()).then(data => {
    ITEMS = data.items; REPEATS = data.repeats || [];
    if (S.order && S.order.some(o => !ITEMS.find(i => i.id === o.id))) { app.textContent = "This study was updated. Please reload with ?reset=1"; return; }
    render();
  }).catch(() => { app.textContent = "Could not load the comments. Check your internet connection and reload."; });
})();
