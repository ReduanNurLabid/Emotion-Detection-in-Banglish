/* Natural-rewrite study: people type Bengali comments in their own Banglish. */
(() => {
  const CFG = Object.assign({}, window.LABEL_CONFIG, { study: "rewrite-v1" });
  const qs = new URLSearchParams(location.search);
  const qsEndpoint = qs.get("endpoint"); // local testing only
  if (qsEndpoint && ["localhost", "127.0.0.1"].includes(location.hostname)) CFG.endpoint = qsEndpoint;
  const TEST_MODE = !CFG.endpoint;
  const BLOCK = parseInt(qs.get("block") || "", 10);
  const KEY = `rewrite:${CFG.study}:block${BLOCK}`;
  const app = document.getElementById("app");
  const BENGALI = /[ঀ-৿]/;

  const PRACTICE = [
    { bn: "ভাই আপনার ভিডিওটা অসাধারণ হয়েছে, অনেক শুভকামনা রইলো",
      example: "bhai apnar video ta osadharon hoise, onek shubhokamona roilo" },
    { bn: "আজকে বৃষ্টিতে ভিজে বাসায় ফিরলাম, ঠান্ডা লেগে গেছে",
      example: "ajke brishti te bhije basay firlam, thanda lege gese" },
  ];

  // ---------- state ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
  if (qs.get("reset") === "1") {
    try { localStorage.removeItem(KEY); } catch {}
    const u = new URL(location.href); u.searchParams.delete("reset"); history.replaceState(null, "", u);
  }
  let S = load() || { stage: "welcome", sessionId: uid(), answers: {}, pending: [], pos: 0, practicePos: 0 };
  let ITEMS = null, shownAt = 0;

  function uid() {
    const a = new Uint8Array(8); crypto.getRandomValues(a);
    return "r" + Date.now().toString(36) + Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
  }
  function rng(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function buildOrder() {
    const r = rng(S.sessionId), ids = ITEMS.map(i => i.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    return ids;
  }

  // ---------- network (same pattern as the labeling app) ----------
  function post(payload) {
    if (TEST_MODE) return Promise.resolve();
    return fetch(CFG.endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload) });
  }
  const base = () => ({ study: CFG.study, session: S.sessionId, name: S.profile?.name, block: BLOCK });
  let inFlight = null;
  function flush() {
    if (TEST_MODE || inFlight || !S.pending.length) return inFlight || Promise.resolve();
    const batch = S.pending.slice(0, 20);
    inFlight = post({ type: "rw_answers", ...base(), answers: batch })
      .then(() => { S.pending = S.pending.slice(batch.length); save(); })
      .catch(() => {})
      .finally(() => { inFlight = null; if (S.pending.length && S.stage === "items") setTimeout(flush, 500); });
    return inFlight;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && S.pending.length && !TEST_MODE && navigator.sendBeacon) {
      navigator.sendBeacon(CFG.endpoint, new Blob([JSON.stringify({ type: "rw_answers", ...base(), answers: S.pending })],
        { type: "text/plain;charset=utf-8" }));
    }
  });
  function serverCount() {
    return new Promise((resolve, reject) => {
      const cb = "__rc" + Math.random().toString(36).slice(2), s = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 12000);
      function cleanup() { clearTimeout(timer); delete window[cb]; s.remove(); }
      window[cb] = d => { cleanup(); resolve(d); };
      s.onerror = () => { cleanup(); reject(new Error("network")); };
      s.src = `${CFG.endpoint}?action=count&kind=rw&session=${encodeURIComponent(S.sessionId)}&callback=${cb}`;
      document.head.appendChild(s);
    });
  }

  // ---------- rendering ----------
  const tpl = id => document.getElementById(id).content.cloneNode(true);
  const $ = sel => app.querySelector(sel);
  const show = node => { app.replaceChildren(node); window.scrollTo(0, 0); };
  function render() {
    save();
    ({ welcome: renderWelcome, profile: renderProfile, guide: renderGuide, practice: renderPractice,
       items: renderItem, done: renderDone })[S.stage]();
  }
  function renderPick(nBlocks) {
    show(tpl("tpl-pick"));
    const box = $("#block-links");
    for (let b = 1; b <= nBlocks; b++) {
      const a = document.createElement("a");
      const u = new URL(location.href); u.searchParams.set("block", b); a.href = u.toString();
      a.textContent = `Part ${b}`; box.append(a);
    }
  }
  function renderWelcome() {
    show(tpl("tpl-welcome"));
    $("#w-block").textContent = `(part ${BLOCK})`; $("#w-n").textContent = ITEMS.length;
    $("#consent").onchange = e => { $("#btn-start").disabled = !e.target.checked; };
    $("#btn-start").onclick = () => { S.consentAt = new Date().toISOString(); S.stage = "profile"; render(); };
  }
  function renderProfile() {
    show(tpl("tpl-profile"));
    $("#btn-profile").onclick = () => {
      const p = { name: $("#p-name").value.trim(), role: $("#p-role").value, native: $("#p-native").value,
        freq: $("#p-freq").value, keyboard: $("#p-kbd").value, alone: $("#p-alone").checked };
      if (!p.name || !p.role || !p.native || !p.freq || !p.keyboard || !p.alone) { $("#p-err").hidden = false; return; }
      S.profile = p; S.order = buildOrder(); S.stage = "guide";
      post({ type: "rw_session", ...base(), consent_at: S.consentAt, started_at: new Date().toISOString(), ...p,
        n_items: S.order.length, user_agent: navigator.userAgent }).catch(() => {});
      render();
    };
  }
  function renderGuide() {
    show(tpl("tpl-guide"));
    $("#btn-practice").onclick = () => { S.stage = "practice"; S.practicePos = 0; render(); };
  }
  function check(text, bn) {
    if (!text.trim()) return "Please type the comment, or tap “Can't write this one”.";
    if (BENGALI.test(text)) return "Please use English letters only (no Bangla script).";
    const want = bn.trim().split(/\s+/).length, got = text.trim().split(/\s+/).length;
    if (got < Math.max(1, Math.round(want * 0.4))) return `This looks much shorter than the original (${got} vs ${want} words). Did you skip part of it? Tap Next again to keep it.`;
    return null;
  }
  function itemScreen({ bn, counter, fill, practice, prevText, onBack, onSubmit, onSkip }) {
    show(tpl("tpl-item"));
    $("#practice-tag").hidden = !practice;
    $("#t-bn").textContent = bn; $("#counter").textContent = counter; $("#bar-fill").style.width = fill;
    const ta = $("#answer"); ta.value = prevText || "";
    $("#btn-back").onclick = onBack; $("#btn-help").onclick = openHelp;
    let warned = null;
    $("#btn-next").onclick = () => {
      const msg = check(ta.value, bn);
      if (msg && !(msg.startsWith("This looks") && warned === ta.value)) {
        $("#warn").textContent = msg; $("#warn").hidden = false; warned = ta.value; return;
      }
      onSubmit(ta.value.trim());
    };
    $("#btn-skip").onclick = onSkip;
    shownAt = performance.now();
  }
  function renderPractice() {
    const it = PRACTICE[S.practicePos];
    itemScreen({
      bn: it.bn, practice: true, counter: `Practice ${S.practicePos + 1}/${PRACTICE.length}`,
      fill: `${(S.practicePos / PRACTICE.length) * 100}%`,
      onBack: () => { if (S.practicePos > 0) S.practicePos--; else S.stage = "guide"; render(); },
      onSubmit: () => {
        const fb = $("#feedback"); fb.hidden = false; fb.replaceChildren();
        fb.append("👍 Thanks. One person might write it as: ");
        const m = document.createElement("span"); m.className = "mono"; m.textContent = it.example; fb.append(m);
        fb.append(". Yours can be different; that's what we want.");
        const next = document.createElement("button"); next.className = "primary";
        const last = S.practicePos === PRACTICE.length - 1;
        next.textContent = last ? "Start the real comments" : "Next practice";
        next.onclick = () => { if (last) { S.stage = "items"; S.pos = 0; } else S.practicePos++; render(); };
        fb.append(next);
        $("#btn-next").disabled = true; $("#btn-skip").disabled = true;
      },
      onSkip: () => { if (S.practicePos < PRACTICE.length - 1) S.practicePos++; else { S.stage = "items"; S.pos = 0; } render(); },
    });
  }
  function record(text, skipped) {
    const prev = S.answers[S.pos];
    const a = { order_index: S.pos, item_id: S.order[S.pos], text: skipped ? "" : text, skipped,
      ms: Math.round(performance.now() - shownAt), ts: new Date().toISOString(), edited: !!prev };
    S.answers[S.pos] = a; S.pending.push(a); S.pos++;
    if (S.pos >= S.order.length) { S.stage = "done"; S.completedAt = new Date().toISOString(); }
    if (S.pending.length >= 5 || S.stage === "done") flush();
    render();
  }
  function renderItem() {
    const it = ITEMS.find(i => i.id === S.order[S.pos]), prev = S.answers[S.pos];
    itemScreen({
      bn: it.bn, practice: false, counter: `${S.pos + 1} / ${S.order.length}`,
      fill: `${(S.pos / S.order.length) * 100}%`, prevText: prev?.text,
      onBack: () => { if (S.pos > 0) { S.pos--; render(); } },
      onSubmit: text => record(text, false), onSkip: () => record("", true),
    });
    $("#btn-back").disabled = S.pos === 0;
    $("#answer").focus({ preventScroll: true });
  }
  const allAnswers = () => Object.values(S.answers).sort((a, b) => a.order_index - b.order_index);
  async function renderDone() {
    show(tpl("tpl-done"));
    const status = $("#sync-status"), fallback = $("#fallback");
    const dump = () => JSON.stringify({ ...base(), profile: S.profile, consent_at: S.consentAt, completed_at: S.completedAt, answers: allAnswers() });
    $("#btn-download").onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([dump()], { type: "application/json" }));
      a.download = `rewrite_part${BLOCK}_${(S.profile?.name || "anon").replace(/\W+/g, "_")}.json`; a.click();
    };
    $("#btn-copy").onclick = () => navigator.clipboard?.writeText(dump()).then(() => alert("Copied. Paste it in a message to the organiser."));
    $("#btn-retry").onclick = () => renderDone();
    if (TEST_MODE) { status.textContent = "TEST MODE: nothing was sent."; fallback.hidden = false; return; }
    if (S.verified) { status.textContent = `✅ All ${S.order.length} answers received. You can close this page.`; return; }
    for (let attempt = 0; attempt < 3; attempt++) {
      status.textContent = attempt ? `Checking again (${attempt + 1}/3)…` : "Sending your answers…";
      try {
        await flush();
        await post({ type: "rw_final", ...base(), completed_at: S.completedAt, answers: allAnswers() });
        await new Promise(r => setTimeout(r, 2500 * (attempt + 1)));
        const res = await serverCount();
        if (res && res.count >= S.order.length) {
          S.verified = true; S.pending = []; save();
          status.textContent = `✅ All ${S.order.length} answers received. You can close this page.`; return;
        }
      } catch {}
    }
    status.textContent = "Your answers are saved on this phone, but we could not confirm they reached us.";
    fallback.hidden = false;
  }
  function openHelp() {
    const d = document.createElement("dialog"); d.className = "card"; d.style.maxWidth = "600px";
    const g = tpl("tpl-guide"); g.querySelector("#btn-practice").remove(); d.append(g);
    const c = document.createElement("button"); c.className = "primary"; c.textContent = "Back";
    c.onclick = () => { d.close(); d.remove(); }; d.append(c);
    document.body.append(d); d.showModal();
  }

  // ---------- boot ----------
  if (TEST_MODE) document.getElementById("testbanner").hidden = false;
  fetch("rewrite_items.json", { cache: "no-store" }).then(r => r.json()).then(data => {
    const nBlocks = Math.max(...data.items.map(i => i.block));
    if (!(BLOCK >= 1 && BLOCK <= nBlocks)) { renderPick(nBlocks); return; }
    ITEMS = data.items.filter(i => i.block === BLOCK);
    render();
  }).catch(() => { app.textContent = "Could not load the comments. Check your internet connection and reload."; });
})();
