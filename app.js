/* Fill (De Kwikkel): live bijvullen per koeling, data uit Supabase (verkopen komen via unTill) */
const sb = supabase.createClient(window.BIJVUL_CONFIG.url, window.BIJVUL_CONFIG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const TICK_OK = TICK.replace("<svg", '<svg width="22" height="22" style="stroke:var(--ok)"');

const S = { products: {}, order: [], fridges: [], warehouse: {}, sort: "pak", view: "koeling", untill: {}, feed: [], team: [] };
let tab = "koelingen", period = "dag", dash = null, dash30 = null;
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
let lastUndo = null, toastTimer = null, renderQueued = false;

// ---------- Inloggen ----------
// "Ingelogd blijven": sessie staat in localStorage; als reserve bewaren we het verversingstoken een jaar in een cookie,
// zodat de app op het beginscherm (iOS) ook na afsluiten of opgeschoonde opslag ingelogd blijft.
const RT_COOKIE = "bv_rt";
const readRt = () => (document.cookie.match(/(?:^|; )bv_rt=([^;]*)/) || [])[1];
const writeRt = t => { document.cookie = `${RT_COOKIE}=${t ? encodeURIComponent(t) : ""}; Max-Age=${t ? 31536000 : 0}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; };
const remember = () => store.get("bv-remember", "1") === "1";
async function boot() {
  let { data: { session } } = await sb.auth.getSession();
  // Niet onthouden en de app is opnieuw opgestart: uitloggen
  if (session && !remember() && !(() => { try { return sessionStorage.getItem("bv-alive"); } catch (e) { return null; } })()) { writeRt(null); await sb.auth.signOut({ scope: "local" }); session = null; }
  if (!session && remember() && readRt()) {
    const r = await sb.auth.refreshSession({ refresh_token: decodeURIComponent(readRt()) });
    session = r.data?.session || null; if (!session) writeRt(null);
  }
  if (!session) return showLogin();
  const access = await resolveOrg();
  if (!access.ok) return showLogin(`Je account (${session.user.email}) heeft nog geen toegang. Vraag Joris om je toe te voegen onder Instellingen.`, true);
  $("#login").hidden = true; $("#app").hidden = false;
  await loadAll(); subscribe(); render();
  loadSignals(); setInterval(loadSignals, 60e3);
  if (pushSupported()) navigator.serviceWorker.register("sw.js").catch(() => {});
}
function showLogin(msg, signedIn) {
  $("#app").hidden = true; $("#login").hidden = false;
  $("#loginerr").hidden = !msg; $("#loginerr").textContent = msg || "";
  if (signedIn) { $("#loginbtn").textContent = "Uitloggen"; $("#loginbtn").dataset.out = "1"; }
}
$("#loginform").addEventListener("submit", async e => {
  e.preventDefault();
  if ($("#loginbtn").dataset.out) { await sb.auth.signOut(); location.reload(); return; }
  $("#loginerr").hidden = true;
  const keep = $("#remember").checked;
  store.set("bv-remember", keep ? "1" : "0"); store.set("bv-email", $("#email").value.trim());
  try { sessionStorage.setItem("bv-alive", "1"); } catch (e) {}
  const { error } = await sb.auth.signInWithPassword({ email: $("#email").value.trim(), password: $("#password").value });
  if (error) { $("#loginerr").textContent = "Inloggen lukt niet: controleer je e-mail en wachtwoord."; $("#loginerr").hidden = false; return; }
  if (keep) navigator.storage?.persist?.().catch(() => {});
  boot();
});
$("#signupbtn").onclick = async () => {
  const email = $("#email").value.trim(), password = $("#password").value;
  if (!email || password.length < 6) { $("#loginerr").textContent = "Vul je e-mail en een wachtwoord van minstens 6 tekens in."; $("#loginerr").hidden = false; return; }
  const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) { $("#loginerr").textContent = "Account aanmaken lukt niet: " + error.message; $("#loginerr").hidden = false; return; }
  $("#loginok").textContent = "Check je mail en klik op de bevestigingslink. Daarna kun je inloggen."; $("#loginok").hidden = false;
};
$("#logout").onclick = async () => { writeRt(null); await sb.auth.signOut(); location.reload(); };
$("#email").value = store.get("bv-email", ""); $("#remember").checked = remember();

// Licht, donker of automatisch (volgt het apparaat)
const ICO = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const THEMES = {
  auto: [ICO('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" class="fillc"/>'), "Automatisch (volgt apparaat)"],
  light: [ICO('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'), "Licht"],
  dark: [ICO('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'), "Donker"],
};
function themeNow() { return document.documentElement.dataset.theme || "auto"; }
function setTheme(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  store.set("bv-theme", t); paintTheme(); if (tab === "instellingen") render();
}
function paintTheme() { const [ico, lbl] = THEMES[themeNow()]; $("#themebtn").innerHTML = ico; $("#themebtn").title = "Thema: " + lbl; }
$("#themebtn").onclick = () => { const order = ["auto", "light", "dark"]; setTheme(order[(order.indexOf(themeNow()) + 1) % 3]); };

// ---------- Data ----------
async function loadAll() {
  const [p, f, fi, w, st, sl] = await Promise.all([
    tbl("products").select("*").order("pick_order"),
    tbl("fridges").select("*").order("sort_order"),
    tbl("fridge_items").select("*"),
    tbl("warehouse").select("*"),
    tbl("settings").select("*"),
    tbl("sales").select("product_id, fridge_id, qty, sold_at").order("sold_at", { ascending: false }).limit(12),
  ]);
  S.products = Object.fromEntries(p.data.map(x => [x.id, x]));
  S.order = p.data.map(x => x.id);
  S.fridges = f.data.map(x => ({ id: x.id, name: x.name, sub: x.sub, items: {} }));
  for (const it of fi.data) setItem(it);
  S.warehouse = Object.fromEntries(w.data.map(x => [x.product_id, +x.qty]));
  for (const r of st.data) applySetting(r);
  S.feed = sl.data.map(feedEntry);
}
function setItem(it) {
  const f = S.fridges.find(x => x.id === it.fridge_id); if (!f) return;
  f.items[it.product_id] = { par: it.par, cur: +it.current, show: it.visible, low: it.low_since };
}
function applySetting(r) {
  if (r.key === "sort") S.sort = r.value; else if (r.key === "view") S.view = r.value; else if (r.key === "untill") S.untill = r.value;
}
function feedEntry(s) {
  const p = S.products[s.product_id], ratio = p?.ratio || 1;
  const serve = ratio > 1 ? (p.serve || "glas") + " " : "";
  return { t: s.sold_at, txt: `${+s.qty}× ${serve}${p?.name || s.product_id}`, where: S.fridges.find(f => f.id === s.fridge_id)?.name || "" };
}
let dashTimer = null, frTimer = null;
function subscribe() {
  sb.channel("live")
    .on("postgres_changes", { event: "*", schema: "public", table: "fridge_items", ...orgFilter() }, e => { const o = e.old; if (o?.fridge_id && (o.fridge_id !== e.new?.fridge_id || e.eventType === "DELETE")) delete S.fridges.find(f => f.id === o.fridge_id)?.items[o.product_id]; if (e.new?.fridge_id) setItem(e.new); queueRender(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "warehouse", ...orgFilter() }, e => { if (e.new?.product_id) S.warehouse[e.new.product_id] = +e.new.qty; queueRender(); })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales", ...orgFilter() }, e => { S.feed.unshift(feedEntry(e.new)); S.feed = S.feed.slice(0, 12); renderFeed(); renderTabs(); queueSignals(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "settings", ...orgFilter() }, e => { if (e.new?.key) applySetting(e.new); renderTabs(); if (e.new?.key !== "untill") queueRender(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "products", ...orgFilter() }, e => { if (e.new?.id) { S.products[e.new.id] = e.new; S.order = Object.values(S.products).sort((a, b) => a.pick_order - b.pick_order).map(x => x.id); } queueRender(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "fridges", ...orgFilter() }, () => { clearTimeout(frTimer); frTimer = setTimeout(() => loadAll().then(queueRender), 800); })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "refills", ...orgFilter() }, () => { if (tab === "dashboard") { clearTimeout(dashTimer); dashTimer = setTimeout(loadDash, 1500); } })
    .subscribe(status => { $("#syncdot").classList.toggle("paused", status !== "SUBSCRIBED"); });
}
function queueRender() {
  if (renderQueued) return; renderQueued = true;
  setTimeout(() => { renderQueued = false; if (document.activeElement?.matches?.("input, select") && (tab === "instellingen" || tab === "magazijn")) { renderTabs(); return; } render(); }, 250);
}

// ---------- Rekenwerk ----------
function ratioOf(pid) { return S.products[pid]?.ratio || 1; }
function needOf(it) { return it.show === false ? 0 : Math.max(0, Math.floor(it.par - it.cur + 1e-9)); }
function soldSince(pid, it) { return Math.round((it.par - it.cur) * ratioOf(pid)); }
function level(cur, par) { const r = cur / par; return r <= 0.3 ? "crit" : r <= 0.6 ? "warn" : "ok"; }
function bySort(a, b) {
  const oa = S.order.indexOf(a.pid), ob = S.order.indexOf(b.pid);
  if (S.sort === "nood") return (a.cur / a.par) - (b.cur / b.par) || oa - ob;
  return oa - ob;
}
function fridgePct(f) { let c = 0, p = 0; for (const it of Object.values(f.items)) { if (it.show === false) continue; c += it.cur; p += it.par; } return p ? Math.round(c / p * 100) : 100; }
function totals() { let units = 0, lines = 0; for (const f of S.fridges) for (const it of Object.values(f.items)) { const n = needOf(it); if (n) { units += n; lines++; } } return { units, lines }; }
function plural(p, n) { return n === 1 ? p.pack : p.pack === "doos" ? "dozen" : p.pack === "tray" ? "trays" : "kratten"; }
function packText(n, pid) {
  const p = S.products[pid], full = Math.floor(n / p.pack_size), rest = n % p.pack_size;
  const loose = p.ratio > 1 ? `${rest} ${rest === 1 ? "fles" : "flessen"}` : `${rest} los`;
  if (!full) return loose;
  return rest ? `${full} ${plural(p, full)} + ${rest}` : `${full} ${plural(p, full)}`;
}
const timeStr = t => new Date(t).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
const fmt = n => Math.round(n).toLocaleString("nl-NL");

// ---------- Acties ----------
async function refill(pairs, label) {
  const ids = []; let total = 0;
  for (const [fid, pid] of pairs) {
    const { data: n, error } = await rpc("do_refill", { p_fridge: fid, p_product: pid });
    if (error) { showToast("Opslaan mislukt: " + error.message); return; }
    if (n > 0) {
      total += n;
      // Meteen lokaal bijwerken, niet wachten op realtime
      const it = S.fridges.find(f => f.id === fid)?.items[pid]; if (it) { it.cur = Math.max(it.cur, it.par); it.low = null; }
      const { data } = await tbl("refills").select("id").eq("fridge_id", fid).eq("product_id", pid).order("id", { ascending: false }).limit(1);
      if (data?.[0]) ids.push(data[0].id);
    }
  }
  if (!total) { showToast("Staat al vol"); loadAll().then(render); return; }
  render(); showToast(label.replace("{n}", total), ids);
}
function showToast(text, ids) {
  lastUndo = ids || null;
  $("#toasttext").textContent = text; $("#undo").hidden = !ids; $("#toast").hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast").hidden = true; lastUndo = null; }, 6000);
}
$("#undo").onclick = async () => {
  if (!lastUndo) return; const ids = lastUndo; lastUndo = null; $("#toast").hidden = true;
  for (const id of ids) await rpc("undo_refill", { p_id: id });
};
async function saveSetting(key, value) { S[key] = value; render(); await tbl("settings").upsert({ key, value }); }

// ---------- Weergaven ----------
function renderTabs() {
  $("#c-koel").textContent = totals().lines;
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
  const u = S.untill || {}, last = S.feed[0];
  const txt = u.mode === "live" ? `unTill live${u.env === "test" ? " (testomgeving)" : ""}${u.last_sync ? " · bijgewerkt " + timeStr(u.last_sync) : ""}`
    : u.mode === "error" ? `unTill-koppeling geeft een fout${u.message ? ": " + u.message : ""}`
    : `Demoverkoop, unTill nog niet gekoppeld${last ? " · laatste " + timeStr(last.t) : ""}`;
  $("#synctext").textContent = txt;
  $("#feeddot").classList.toggle("paused", u.mode === "error");
}
function seg(name, options, current) {
  return `<div class="seg" role="group">${options.map(([v, l]) => `<button class="btn" data-${name}="${v}" aria-pressed="${current === v}">${l}</button>`).join("")}</div>`;
}
const viewSwitch = () => seg("view", [["koeling", "Per koeling"], ["samen", "Alles samen"]], S.view);
const sortSwitch = () => seg("sort", [["pak", "Volgorde van pakken"], ["nood", "Hardst nodig eerst"]], S.sort);

// Blokjesbalk: elk blokje is één plek in de koeling (bij grote vulstanden geschaald naar max 12)
function blocks(cur, par, lvl) {
  const n = Math.max(1, Math.min(par, 12)), on = Math.max(0, Math.min(n, Math.round(cur / par * n)));
  return `<div class="blocks ${lvl}" aria-hidden="true">${"<i class=on></i>".repeat(on)}${"<i></i>".repeat(n - on)}</div>`;
}
function itemRow(f, pid, it, withFridge) {
  const n = needOf(it), lvl = level(it.cur, it.par), ratio = ratioOf(pid), p = S.products[pid];
  const info = ratio > 1 ? `${soldSince(pid, it)} ${p.serve === "shot" ? "shots" : "glazen"} verkocht · ${ratio} = 1 fles` : `${Math.floor(it.cur)}/${it.par}`;
  const pack = n >= p.pack_size ? packText(n, pid) : "";
  return `<li class="item ${lvl}">
    <div class="i-main"><div class="name">${esc(p.name)}</div>
    <div class="i-bar">${blocks(it.cur, it.par, lvl)}<span class="meta num">${withFridge ? `<span class="where-tag">${esc(f.name)}</span> · ` : ""}${info}</span></div></div>
    <div class="need num"><b>${n}</b><small>erbij${pack ? ` · ${pack}` : ""}</small></div>
    <button class="tick" data-fill="${f.id}|${pid}" aria-label="${esc(p.name)} bijgevuld">${TICK}</button>
  </li>`;
}
// Ring met vulstand voor bovenaan
function ring(pct) {
  const r = 42, c = 2 * Math.PI * r, lv = level(pct, 100);
  return `<svg class="ring" viewBox="0 0 100 100" role="img" aria-label="${pct}% vol"><circle cx="50" cy="50" r="${r}" class="r-track"/><circle cx="50" cy="50" r="${r}" class="r-val ${lv}" stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/><text x="50" y="47" class="r-pct">${pct}%</text><text x="50" y="68" class="r-lbl">VOL</text></svg>`;
}
// ---------- Slimme signalen ----------
// Signaal alleen als een drank op max 30% van vol staat én bij het huidige tempo binnen 45 minuten op is.
// "Loopt hard" (laatste uur ruim boven normaal voor deze weekdag/tijd) komt erbij als extra info.
const SIG = { rows: [], at: 0 };
let sigTimer = null;
async function loadSignals() {
  const { data, error } = await rpc("signals");
  if (!error) { SIG.rows = data || []; SIG.at = Date.now(); if (tab === "koelingen") queueRender(); }
}
function queueSignals() { clearTimeout(sigTimer); sigTimer = setTimeout(loadSignals, 4000); }
const SNOOZE_KEY = "bv-snooze";
function snoozed(key) { try { const m = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}"); return (m[key] || 0) > Date.now(); } catch (e) { return false; } }
function snooze(key) { try { const m = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}"); for (const k in m) if (m[k] < Date.now()) delete m[k]; m[key] = Date.now() + 3600e3; localStorage.setItem(SNOOZE_KEY, JSON.stringify(m)); } catch (e) {} }
function signals() {
  const out = [], day = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"][new Date().getDay()];
  for (const r of SIG.rows) {
    const p = S.products[r.product_id]; if (!p) continue;
    const f = S.fridges.find(x => x.items[r.product_id]?.show !== false && x.items[r.product_id]); if (!f) continue;
    const it = f.items[r.product_id], rate = +r.rate_now, base = +r.baseline, unit = p.ratio > 1 ? "flessen" : "stuks";
    const cur = Math.floor(it.cur), mins = rate > 0 ? it.cur / (rate / 60) : Infinity;
    // Alleen melden als de koeling bijna leeg is (max 30% van vol) en hij bij dit tempo binnen 45 min op is
    if (rate < 2 || it.cur > 0.3 * it.par || mins > 45 || snoozed("leeg:" + p.id)) continue;
    const hard = r.basis === "geen" ? rate >= 6 : rate >= 4 && rate >= 2 * Math.max(base, 1);
    const x = hard && base > 0 ? (rate / base).toFixed(1).replace(".0", "").replace(".", ",") : null;
    const when = cur < 1 ? "is op" : `is over ±${Math.max(5, Math.round(mins / 5) * 5)} min op`;
    out.push({ key: "leeg:" + p.id, lvl: hard ? "warn" : "crit", ico: hard ? "🔥" : "⏱", score: 100 - mins,
      t: `${esc(p.name)} ${when}`, d: `Nog ${cur} van ${it.par} in ${esc(f.name)} · ${fmt(rate)} ${unit}/uur${hard ? ` · loopt hard${x ? ` (${x}× ${r.basis === "weekdag" ? `gewone ${day}` : "normaal"})` : ""}` : ""}`, fill: `${f.id}|${p.id}` });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 4);
}
function signalBlock() {
  const list = signals(); if (!list.length) return "";
  return `<section class="signals" aria-label="Signalen">${list.map(x => `<div class="signal ${x.lvl}"><span class="s-ico" aria-hidden="true">${x.ico}</span>
    <div class="s-txt"><b>${x.t}</b><small>${x.d}</small></div>
    ${x.fill ? `<button class="btn sm" data-fill="${x.fill}">Bijgevuld</button>` : ""}<button class="s-x" data-snooze="${x.key}" aria-label="Verbergen" title="Een uur verbergen">✕</button></div>`).join("")}</section>`;
}

function viewKoelingen() {
  const t = totals();
  let c = 0, pr = 0; for (const f of S.fridges) for (const it of Object.values(f.items)) if (it.show !== false) { c += Math.min(it.cur, it.par); pr += it.par; }
  const nf = S.fridges.filter(f => Object.values(f.items).some(it => needOf(it) > 0)).length;
  let h = `${signalBlock()}${typeof weerStrip === "function" ? weerStrip() : ""}<div class="summary">
    <div class="hero">${ring(pr ? Math.round(c / pr * 100) : 100)}<div><div class="big num">${t.units}</div><div class="lbl">${t.units === 1 ? "stuk" : "stuks en flessen"} bijvullen${nf ? ` in ${nf === 1 ? "1 koeling" : nf + " koelingen"}` : ""} · ${t.lines} ${t.lines === 1 ? "drank" : "dranken"}</div></div></div>
    <div class="actions">${viewSwitch()}${sortSwitch()}</div></div><div class="grid">`;
  if (S.view === "samen") {
    const all = [];
    S.fridges.forEach((f, fi) => { for (const [pid, it] of Object.entries(f.items)) if (needOf(it) > 0) all.push({ f, fi, pid, it }); });
    all.sort((a, b) => bySort({ pid: a.pid, ...a.it }, { pid: b.pid, ...b.it }) || a.fi - b.fi);
    h += `<section class="fridge samen">` + (all.length ? `<ul class="items">${all.map(x => itemRow(x.f, x.pid, x.it, true)).join("")}</ul>` : `<div class="fdone">${TICK_OK} Alles op vulstand</div>`) + `</section>`;
    return h + `</div>`;
  }
  const info = S.fridges.map((f, i) => {
    const rows = Object.entries(f.items).filter(([, it]) => needOf(it) > 0).sort((a, b) => bySort({ pid: a[0], ...a[1] }, { pid: b[0], ...b[1] }));
    return { f, i, rows, pct: fridgePct(f), full: Object.values(f.items).filter(it => it.show !== false).length - rows.length };
  });
  const MAX = 6;
  for (const { f, i, rows, pct, full } of info) {
    const lv = level(pct, 100);
    if (!rows.length) {
      h += `<section class="fridge alldone compact" id="fr-${f.id}"><div class="fhead"><div class="route num" title="Looproute">${i + 1}</div><h2>${esc(f.name)}</h2><div class="fdone-tag">${TICK_OK} Alles vol</div></div></section>`;
      continue;
    }
    const open = EXP.has(f.id), shown = open ? rows : rows.slice(0, MAX), more = rows.length - shown.length;
    h += `<section class="fridge" id="fr-${f.id}"><div class="fhead">
        <div class="route num" title="Looproute">${i + 1}</div><h2>${esc(f.name)} <span class="fcount num">${rows.length}</span></h2>
        <div class="fill"><div class="pct num ${lv}">${pct}%</div><div class="bar" style="color:var(--${lv})"><i style="width:${pct}%"></i></div></div>
        <div class="sub">${esc(f.sub)}</div></div>
      <ul class="items">${shown.map(([pid, it]) => itemRow(f, pid, it, false)).join("")}</ul>
      ${more > 0 ? `<button class="morebtn" data-expand="${f.id}">Nog ${more} tonen</button>` : rows.length > MAX ? `<button class="morebtn" data-expand="${f.id}">Minder tonen</button>` : ""}
      <div class="ffoot"><span>${full} artikel${full === 1 ? "" : "en"} vol</span><button class="btn" data-fillall="${f.id}">Hele koeling bijgevuld</button></div></section>`;
  }
  return h + `</div>`;
}
const EXP = new Set();
function viewPakken() {
  const m = {};
  S.fridges.forEach(f => { for (const [pid, it] of Object.entries(f.items)) { const n = needOf(it); if (!n) continue; (m[pid] ||= { n: 0, cur: 0, par: 0, where: [] }).n += n; m[pid].cur += it.cur; m[pid].par += it.par; m[pid].where.push(`${f.name} ${n}`); } });
  const rows = Object.entries(m).sort((a, b) => bySort({ pid: a[0], ...a[1] }, { pid: b[0], ...b[1] }));
  let h = `<div class="summary"><div class="actions" style="margin-left:0">${sortSwitch()}</div></div><p class="note">Pak alles in één keer uit het magazijn en loop daarna langs de koelingen. De koelingen vink je af op het tabblad Bijvullen.</p>`;
  if (!rows.length) return h + `<div class="picklist"><div class="fdone">${TICK_OK} Niets te pakken, alles staat vol</div></div>`;
  h += `<div class="picklist">`;
  for (const [pid, r] of rows) {
    const stock = Math.floor(S.warehouse[pid] || 0);
    h += `<div class="prow"><div><div class="pname">${esc(S.products[pid].name)}</div><div class="where num">${esc(r.where.join(" · "))}</div></div>
      <div class="crate num">${packText(r.n, pid)}<div class="stock">${r.n} stuks</div></div>
      <div class="stockcol"><div class="stock num">${stock} op voorraad</div></div><div></div></div>`;
  }
  return h + `</div>`;
}
// Beheer: keuzes per apparaat onthouden (filter, gekozen onderdeel)
const M = { q: "", filter: "alle" };
const SET = { sec: store.get("bv-sec", "dranken"), fridge: store.get("bv-fridge", ""), q: "", hidden: false, adding: false };
const shownAnywhere = pid => S.fridges.some(f => f.items[pid]?.show);
const matches = (q, ...txt) => !q || txt.join(" ").toLowerCase().includes(q.trim().toLowerCase());
const searchBox = (id, value, ph) => `<input class="search" type="search" id="${id}" placeholder="${ph}" value="${esc(value)}" autocomplete="off">`;
const chips = (name, options, current) => `<div class="chips" role="group">${options.map(([v, l, n]) => `<button class="chip" data-${name}="${v}" aria-pressed="${current === v}">${l}${n != null ? ` <span class="num">${n}</span>` : ""}</button>`).join("")}</div>`;

function stockStatus(pid) {
  const p = S.products[pid], st = Math.floor(S.warehouse[pid] || 0), packs = st / p.pack_size;
  const order = packs < 2 ? Math.ceil(6 - packs) : 0;
  return { st, order, lvl: packs < 2 ? "crit" : packs < 3 ? "warn" : "ok" };
}
function viewMagazijn() {
  // Alleen dranken die in minstens één koeling zichtbaar zijn (verborgen dranken staan in Instellingen)
  const ids = S.order.filter(shownAnywhere).sort((a, b) => (S.warehouse[a] || 0) / S.products[a].pack_size - (S.warehouse[b] || 0) / S.products[b].pack_size);
  const all = ids.map(pid => ({ pid, ...stockStatus(pid) })), cnt = l => all.filter(x => x.lvl === l).length;
  const rows = all.filter(x => (M.filter === "alle" || x.lvl === M.filter) && matches(M.q, S.products[x.pid].name));
  let h = `<div class="toolbar">${searchBox("magsearch", M.q, "Zoek drank")}
    ${chips("magfilter", [["alle", "Alles", all.length], ["crit", "Bestellen", cnt("crit")], ["warn", "Bijna op", cnt("warn")]], M.filter)}</div>
    <p class="hint">Loopt op de achtergrond mee en gaat omlaag als je bijvult. Bijvullen kan altijd, ook als hier 0 staat. Levering binnen? Tik op <b>+1</b> of typ de nieuwe stand.</p>
    <div class="rows stockrows">`;
  for (const x of rows) {
    const p = S.products[x.pid];
    h += `<div class="row ${x.lvl}" data-name="${esc(p.name.toLowerCase())}"><div class="r-name">${esc(p.name)}</div>
      <div class="r-stock num">${packText(x.st, x.pid)}</div>
      <div class="r-status">${x.order ? `<span class="pill crit">Bestel ${x.order} ${plural(p, x.order)}</span>` : x.lvl === "warn" ? `<span class="pill warn">Bijna op</span>` : `<span class="pill ok">Op voorraad</span>`}</div>
      <div class="r-edit"><button class="btn sm" data-addpack="${x.pid}" title="Een ${p.pack} van ${p.pack_size} erbij">+1 ${p.pack}</button><input class="par num" type="number" min="0" inputmode="numeric" id="stock-${x.pid}" data-stock="${x.pid}" value="${x.st}" aria-label="Voorraad ${esc(p.name)} in stuks"></div></div>`;
  }
  if (!rows.length) h += `<div class="empty">Niets gevonden.</div>`;
  return h + `</div>`;
}

function viewInstellingen() {
  const secs = [["dranken", 'Dranken<span class="lg"> op scherm</span>'], ["koelingen", "Koelingen"], ["volgorde", "Pakvolgorde"], ["koppeling", 'unTill<span class="lg">-koppeling</span>'], ["uitsluiten", 'Niet meetellen'], ["algemeen", 'Weergave<span class="lg"> en team</span>']];
  if (!secs.some(s => s[0] === SET.sec)) SET.sec = "dranken";
  const body = SET.sec === "dranken" ? setDranken() : SET.sec === "koelingen" ? setKoelingen() : SET.sec === "volgorde" ? setVolgorde() : SET.sec === "koppeling" ? viewKoppeling() : SET.sec === "uitsluiten" ? viewUitsluiten() : setAlgemeen();
  return `<nav class="subnav" aria-label="Instellingen">${secs.map(([v, l]) => `<button data-sec="${v}" aria-current="${SET.sec === v}">${l}</button>`).join("")}</nav><div class="setbody">${body}</div>`;
}
function setDranken() {
  if (!S.fridges.some(f => f.id === SET.fridge)) SET.fridge = S.fridges[0]?.id || "";
  const f = S.fridges.find(x => x.id === SET.fridge); if (!f) return "";
  const opts = S.fridges.map(x => { const its = Object.values(x.items); return [x.id, esc(x.name), `${its.filter(i => i.show !== false).length}/${its.length}`]; });
  const pids = Object.keys(f.items).sort((a, b) => S.order.indexOf(a) - S.order.indexOf(b));
  let h = `${chips("fridge", opts, SET.fridge)}
    <div class="toolbar">${searchBox("setsearch", SET.q, "Zoek drank")}<button class="btn primary" data-newdrink="1" aria-expanded="${SET.adding}">+ Nieuwe drank</button></div>
    ${SET.adding ? newDrinkForm(f) : ""}
    <p class="hint"><b>Koeling</b>: waar de drank staat. <b>Verpakking</b>: krat, doos of tray en hoeveel erin zit. <b>Per fles</b>: hoeveel verkopen samen één fles zijn (5 glazen wijn = 1 fles, fris en bier 1). <b>Nu</b>: wat er nu in de koeling staat; klopt het niet, typ dan de echte stand. <b>Vol</b>: hoeveel erin hoort.</p>
    <div class="rows setrows"><div class="row rhead"><span>Op scherm</span><span>Koeling</span><span>Verpakking</span><span class="r">Per fles</span><span class="r">Nu</span><span class="r">Vol</span></div>`;
  const packs = sel => ["krat", "doos", "tray"].map(v => `<option${v === sel ? " selected" : ""}>${v}</option>`).join("");
  const fopts = sel => S.fridges.map(x => `<option value="${x.id}"${x.id === sel ? " selected" : ""}>${esc(x.name)}</option>`).join("");
  for (const pid of pids) {
    const it = f.items[pid], p = S.products[pid], on = it.show !== false;
    h += `<div class="row${on ? "" : " off"}" data-name="${esc(p.name.toLowerCase())}"${matches(SET.q, p.name) ? "" : " hidden"}>
      <label class="r-name"><input type="checkbox" class="chk" data-show="${f.id}|${pid}" ${on ? "checked" : ""}> ${esc(p.name)}</label>
      <select class="par r-fridge" data-movefridge="${f.id}|${pid}" aria-label="Koeling van ${esc(p.name)}">${fopts(f.id)}</select>
      <div class="r-pack"><select class="par" data-pack="${pid}" aria-label="Verpakking ${esc(p.name)}">${packs(p.pack)}</select><span>van</span><input class="par num" type="number" min="1" max="200" inputmode="numeric" data-packsize="${pid}" value="${p.pack_size}" aria-label="Aantal per ${p.pack} ${esc(p.name)}"></div>
      <input class="par num" type="number" min="1" max="50" inputmode="numeric" data-ratio="${pid}" value="${p.ratio}" aria-label="Verkopen per fles ${esc(p.name)}">
      <input class="par num cur" type="number" min="0" inputmode="numeric" data-cur="${f.id}|${pid}" value="${Math.floor(it.cur)}" aria-label="Nu in koeling ${esc(p.name)}" title="Klopt de stand niet? Typ hoeveel er nu echt in staat">
      <input class="par num" type="number" min="1" max="500" inputmode="numeric" data-par="${f.id}|${pid}" value="${it.par}" aria-label="Vulstand ${esc(p.name)}"></div>`;
  }
  return h + `</div>`;
}
// Nieuwe drank: naam, koeling, verpakking, vulstand en (optioneel) het kassa-artikel
function newDrinkForm(f) {
  const mapped = new Set(U.map.map(m => String(m.article_id)));
  const arts = Object.values(U.arts).filter(a => !mapped.has(String(a.id))).sort((a, b) => a.name.localeCompare(b.name, "nl"));
  return `<form class="card newdrink" id="newdrink">
    <h3>Nieuwe drank toevoegen</h3>
    <div class="nd-grid">
      <label>Naam<input class="search" id="nd-name" required placeholder="bijv. Ranja Fruitmix"></label>
      <label>Koeling<select class="par" id="nd-fridge">${S.fridges.map(x => `<option value="${x.id}"${x.id === f.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
      <label>Verpakking<span class="r-pack"><select class="par" id="nd-pack"><option>krat</option><option>doos</option><option>tray</option></select><span>van</span><input class="par num" type="number" id="nd-size" min="1" max="200" value="24"></span></label>
      <label>Vol<input class="par num" type="number" id="nd-par" min="1" max="500" value="12"></label>
      <label>Per fles<input class="par num" type="number" id="nd-ratio" min="1" max="50" value="1"></label>
      <label class="nd-art">Kassa-artikel (unTill)<input class="search" id="nd-art" list="nd-arts" placeholder="Typ om te zoeken, mag leeg"><datalist id="nd-arts">${arts.map(a => `<option value="${esc(a.name)} · ${esc(a.department || "")}${a.number ? " · nr " + a.number : ""}" data-id="${a.id}"></option>`).join("")}</datalist></label>
    </div>
    <div class="toolbar" style="margin:10px 0 0"><button class="btn primary">Toevoegen</button><button class="btn" type="button" data-newdrink="0">Annuleren</button></div>
  </form>`;
}
async function addDrink() {
  const name = $("#nd-name").value.trim(); if (!name) return;
  const fid = $("#nd-fridge").value, size = Math.max(1, parseInt($("#nd-size").value, 10) || 24), par = Math.max(1, parseInt($("#nd-par").value, 10) || 12), ratio = Math.max(1, parseInt($("#nd-ratio").value, 10) || 1);
  const artTxt = $("#nd-art").value.trim(), opt = [...$("#nd-arts").options].find(o => o.value === artTxt), art = opt ? Number(opt.dataset.id) : null;
  if (artTxt && !art) { showToast("Kies het kassa-artikel uit de lijst, of laat het leeg"); return; }
  let id = "k-" + name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (let i = 2; S.products[id]; i++) id = id.replace(/-\d+$/, "") + "-" + i;
  const pick = Math.max(0, ...Object.values(S.products).map(p => p.pick_order).filter(po => po < 900)) + 1;
  const product = { id, name, pack: $("#nd-pack").value, pack_size: size, ratio, pick_order: pick };
  let r = await tbl("products").insert(product);
  if (!r.error) r = await tbl("fridge_items").insert({ fridge_id: fid, product_id: id, par, current: par, visible: true });
  if (!r.error) r = await tbl("warehouse").insert({ product_id: id, qty: 0 });
  if (!r.error && art) { r = await tbl("untill_map").insert({ article_id: art, product_id: id, factor: 1 }); if (!r.error) U.map.push({ article_id: art, product_id: id, factor: 1 }); }
  if (r.error) { showToast("Toevoegen mislukt: " + r.error.message); return; }
  S.products[id] = { ...product, serve: null }; S.order.push(id);
  const f = S.fridges.find(x => x.id === fid); f.items[id] = { par, cur: par, show: true, low: null }; S.warehouse[id] = 0;
  SET.adding = false; SET.fridge = fid; render();
  showToast(`${name} toegevoegd aan ${f.name}${art ? " en gekoppeld aan de kassa" : ""}`);
}
// Koelingen beheren: naam, omschrijving, looproute-volgorde, toevoegen en (lege) koelingen verwijderen
function setKoelingen() {
  let h = `<p class="hint">De volgorde is je looproute: koeling 1 vul je als eerste. Een koeling kan pas weg als er geen dranken meer in staan; verplaats ze eerst bij Dranken op scherm.</p><div class="rows fridgerows">`;
  S.fridges.forEach((f, i) => {
    const n = Object.keys(f.items).length, ask = SET.delFridge === f.id;
    h += `<div class="row${n ? "" : " empty"}"><div class="route num">${i + 1}</div>
      <input class="fr-in" data-fname="${f.id}" value="${esc(f.name)}" aria-label="Naam" maxlength="40">
      <input class="fr-in sub" data-fsub="${f.id}" value="${esc(f.sub || "")}" placeholder="Omschrijving" aria-label="Omschrijving" maxlength="60">
      <span class="fr-n">${n} ${n === 1 ? "drank" : "dranken"}</span>
      <span class="fr-act"><button class="btn mv" data-fmv="${f.id}|-1" ${i === 0 ? "disabled" : ""} aria-label="Eerder in de route">↑</button><button class="btn mv" data-fmv="${f.id}|1" ${i === S.fridges.length - 1 ? "disabled" : ""} aria-label="Later in de route">↓</button>
      ${ask ? `<button class="btn danger" data-fdel="${f.id}|ja">Ja, weg</button><button class="btn" data-fdel="">Nee</button>` : `<button class="btn" data-fdel="${f.id}" ${n ? `disabled title="Verplaats eerst de ${n} dranken"` : ""}>Verwijderen</button>`}</span></div>`;
  });
  return h + `</div><form class="newfridge" id="nf-form"><h3>Nieuwe koeling</h3><div class="nd-grid">
    <label>Naam<input id="nf-name" required maxlength="40" placeholder="Bijv. Terraskoeling"></label>
    <label>Omschrijving<input id="nf-sub" maxlength="60" placeholder="Bijv. Bier en fris voor het terras"></label></div>
    <button class="btn primary" type="submit">Koeling toevoegen</button></form>`;
}
async function addFridge() {
  const name = $("#nf-name").value.trim(); if (!name) return;
  let id = "f-" + name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (let i = 2; S.fridges.some(f => f.id === id); i++) id = id.replace(/-\d+$/, "") + "-" + i;
  const sub = $("#nf-sub").value.trim(), sort_order = S.fridges.length + 1;
  const { error } = await tbl("fridges").insert({ id, name, sub, sort_order });
  if (error) { showToast("Toevoegen mislukt: " + error.message); return; }
  S.fridges.push({ id, name, sub, items: {} }); render();
  showToast(`${name} toegevoegd. Zet er dranken in via Dranken op scherm.`);
}
async function moveFridge(id, dir) {
  const i = S.fridges.findIndex(f => f.id === id), j = i + dir; if (i < 0 || j < 0 || j >= S.fridges.length) return;
  [S.fridges[i], S.fridges[j]] = [S.fridges[j], S.fridges[i]]; render();
  await Promise.all(S.fridges.map((f, k) => tbl("fridges").update({ sort_order: k + 1 }).eq("id", f.id)));
}
async function deleteFridge(id) {
  const f = S.fridges.find(x => x.id === id); SET.delFridge = null;
  if (!f || Object.keys(f.items).length) { showToast("Verplaats eerst de dranken uit deze koeling"); render(); return; }
  const { error } = await tbl("fridges").delete().eq("id", id);
  if (error) { showToast("Verwijderen mislukt: " + error.message); render(); return; }
  S.fridges = S.fridges.filter(x => x.id !== id); render(); showToast(`${f.name} verwijderd`);
  await Promise.all(S.fridges.map((x, k) => tbl("fridges").update({ sort_order: k + 1 }).eq("id", x.id)));
}
function setVolgorde() {
  const list = S.order.filter(pid => SET.hidden || shownAnywhere(pid));
  const where = pid => S.fridges.find(f => f.items[pid])?.name || "";
  let h = `<div class="toolbar">${searchBox("setsearch", SET.q, "Zoek drank")}
    <label class="toggle"><input type="checkbox" id="showhidden" ${SET.hidden ? "checked" : ""}> Ook verborgen dranken</label></div>
    <p class="hint">Zet de dranken in de volgorde waarin ze in het magazijn staan. Typ een nummer om een drank direct naar die plek te zetten.</p><div class="rows orderrows">`;
  list.forEach((pid, i) => {
    const p = S.products[pid];
    h += `<div class="row${shownAnywhere(pid) ? "" : " off"}" data-name="${esc(p.name.toLowerCase())}"${matches(SET.q, p.name) ? "" : " hidden"}>
      <input class="par num pos" type="number" min="1" max="${list.length}" inputmode="numeric" data-pos="${pid}" value="${i + 1}" aria-label="Plek van ${esc(p.name)}">
      <div class="r-name">${esc(p.name)}<small>${esc(where(pid))}</small></div>
      <button class="btn mv" data-mv="${pid}|${list[i - 1] || ""}" ${i === 0 ? "disabled" : ""} aria-label="omhoog">↑</button>
      <button class="btn mv" data-mv="${pid}|${list[i + 1] || ""}" ${i === list.length - 1 ? "disabled" : ""} aria-label="omlaag">↓</button></div>`;
  });
  return h + `</div>`;
}
// ---------- Pushmeldingen ----------
const PUSH = { state: "?" };
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
async function pushState() {
  if (!pushSupported()) return isIOS && !standalone ? "homescreen" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}
async function refreshPush() { PUSH.state = await pushState(); if (tab === "instellingen") render(); }
const b64u = s => { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function pushOn() {
  try {
    if (await Notification.requestPermission() !== "granted") { await refreshPush(); return; }
    const reg = await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(window.BIJVUL_CONFIG.vapid) });
    const j = sub.toJSON(), { data: { session } } = await sb.auth.getSession();
    const { error } = await tbl("push_subscriptions").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, email: session?.user?.email || null });
    if (error) throw error;
    await sb.functions.invoke("push-signals", { body: { test: true, endpoint: j.endpoint, org_id: TENANT.org } });
    showToast("Pushmeldingen staan aan op dit apparaat");
  } catch (e) { showToast("Aanzetten lukt niet: " + (e.message || e)); }
  refreshPush();
}
async function pushOff() {
  const reg = await navigator.serviceWorker.getRegistration(), sub = await reg?.pushManager.getSubscription();
  if (sub) { await tbl("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
  showToast("Pushmeldingen staan uit op dit apparaat"); refreshPush();
}
function pushCard() {
  const st = PUSH.state, body =
    st === "on" ? `<p class="hint"><span class="pill ok">Aan</span> Je krijgt een melding als een drank onder 30% zit en snel op gaat, hooguit één keer per uur per drank.</p><div class="toolbar"><button class="btn" data-push="test">Testmelding</button><button class="btn" data-push="off">Uitzetten</button></div>`
    : st === "off" ? `<p class="hint">Krijg een melding op dit apparaat als een drank hard loopt of bijna op is, ook als de app dicht is.</p><button class="btn primary" data-push="on">Meldingen aanzetten</button>`
    : st === "homescreen" ? `<p class="hint">Op de iPhone werkt dit alleen vanuit de app op je beginscherm. Open Safari, tik op Delen en kies "Zet op beginscherm". Open de app daarna vanaf het beginscherm en zet hier de meldingen aan.</p>`
    : st === "denied" ? `<p class="hint"><span class="pill crit">Geblokkeerd</span> Meldingen zijn geweigerd. Zet ze aan via Instellingen > Meldingen > Bijvullen op je telefoon.</p>`
    : st === "unsupported" ? `<p class="hint">Deze browser ondersteunt geen pushmeldingen.</p>` : `<p class="hint">Even kijken…</p>`;
  return `<section class="card"><h3>Pushmeldingen</h3>${body}</section>`;
}

function setAlgemeen() {
  if (PUSH.state === "?") refreshPush();
  return `<div class="cards">${pushCard()}
  <section class="card"><h3>Volgorde op het bijvulscherm</h3><p class="hint">Volgorde van pakken: je loopt het magazijn in één keer af. Hardst nodig eerst: leegste dranken bovenaan.</p>${sortSwitch()}</section>
  <section class="card"><h3>Weergave</h3><p class="hint">Elke koeling apart, of één lijst voor alles.</p>${viewSwitch()}</section>
  <section class="card"><h3>Team</h3><p class="hint">Wie mag inloggen. Laat iemand eerst zelf een account aanmaken en zet het e-mailadres hier.</p>
    <div class="rows">${S.team.map(e => `<div class="row teamrow"><span class="r-name">${esc(e)}</span><button class="btn sm" data-delteam="${esc(e)}">Verwijderen</button></div>`).join("")}</div>
    <form id="teamform" class="toolbar" style="margin-top:10px"><input class="search" type="email" id="teamemail" placeholder="naam@voorbeeld.nl" required><button class="btn primary">Toevoegen</button></form></section>
  <section class="card"><h3>Licht of donker</h3><p class="hint">Automatisch volgt de instelling van dit apparaat. Geldt alleen voor dit apparaat.</p>${seg("theme", [["auto", "Automatisch"], ["light", "Licht"], ["dark", "Donker"]], themeNow())}</section>
  <section class="card"><h3>Account</h3><button class="btn" data-logout="1">Uitloggen</button></section></div>`;
}

// unTill-artikelen koppelen aan dranken. Factor = hoeveel glazen/shots/stuks één verkocht artikel is (fles wijn = 5, 250 ml = 1,4).
const U = { map: [], arts: {}, search: "", loaded: false };
async function loadKoppeling() {
  const [m, a] = await Promise.all([
    tbl("untill_map").select("article_id, product_id, factor"),
    tbl("untill_articles").select("id, name, number, department, sold_qty, last_sold").order("sold_qty", { ascending: false }).limit(2000),
  ]);
  U.map = m.data || []; U.arts = Object.fromEntries((a.data || []).map(x => [x.id, x])); U.loaded = true;
  await loadUitsluiten();
}

// Niet meetellen: een drank die op bepaalde tafels wordt aangeslagen telt niet mee in Fill
// (bijv. cola op een personeelstafel, geschonken uit de grote fles). Geldt alleen voor nieuwe aanslagen.
const X = { rows: [], loaded: false };
async function loadUitsluiten() {
  const { data } = await tbl("fill_uitsluitingen").select("id, product_id, tafel_van, tafel_tot, actief, notitie").order("tafel_van").order("product_id");
  X.rows = data || []; X.loaded = true;
}
function viewUitsluiten() {
  if (!X.loaded) return `<p class="hint">Laden…</p>`;
  const name = pid => S.products[pid]?.name || pid;
  const rows = [...X.rows].sort((a, b) => a.tafel_van - b.tafel_van || a.tafel_tot - b.tafel_tot || name(a.product_id).localeCompare(name(b.product_id)));
  const opts = `<option value="">Kies drank…</option>` + S.order.filter(shownAnywhere).map(pid => `<option value="${pid}">${esc(S.products[pid].name)}</option>`).join("");
  let h = `<p class="hint">Aanslagen van deze dranken op deze tafels tellen niet mee in Fill: de koeling gaat er niet van omlaag. Handig voor personeelstafels waar fris uit een grote fles komt. Geldt voor nieuwe aanslagen, niet met terugwerkende kracht.</p>
    <form class="card newdrink" id="ux-form"><h3>Regel toevoegen</h3><div class="nd-grid">
      <label>Drank<select class="par" id="ux-pid" required>${opts}</select></label>
      <label>Van tafel<input class="par num" type="number" id="ux-van" min="0" max="99999" step="1" required placeholder="400"></label>
      <label>Tot en met tafel<input class="par num" type="number" id="ux-tot" min="0" max="99999" step="1" required placeholder="499"></label>
      <label>Notitie<input class="search" id="ux-note" maxlength="80" placeholder="Bijv. personeel, grote fles"></label></div>
      <div class="toolbar" style="margin:10px 0 0"><button class="btn primary">Toevoegen</button></div></form>
    <h3 class="sechead">Regels <span class="num">${rows.length}</span></h3><div class="rows uxrows">`;
  for (const r of rows) h += `<div class="row"><label class="r-name"><input type="checkbox" class="chk" data-uxactief="${r.id}" ${r.actief ? "checked" : ""} aria-label="Actief"> <span>${esc(name(r.product_id))}${r.notitie ? `<small>${esc(r.notitie)}</small>` : ""}</span></label>
    <span class="ux-tafels">tafel <input class="par num" type="number" min="0" max="99999" step="1" data-uxvan="${r.id}" value="${r.tafel_van}" aria-label="Van tafel"> t/m <input class="par num" type="number" min="0" max="99999" step="1" data-uxtot="${r.id}" value="${r.tafel_tot}" aria-label="Tot en met tafel"></span>
    <button class="btn sm" data-uxdel="${r.id}" aria-label="Verwijderen">✕</button></div>`;
  if (!rows.length) h += `<div class="empty">Nog geen regels: alles telt mee.</div>`;
  return h + `</div>`;
}
async function addUitsluiting() {
  const pid = $("#ux-pid").value, van = parseInt($("#ux-van").value, 10), tot = parseInt($("#ux-tot").value, 10), notitie = $("#ux-note").value.trim() || null;
  if (!pid) { showToast("Kies eerst een drank"); return; }
  if (!Number.isFinite(van) || !Number.isFinite(tot) || van > tot) { showToast("Vul een geldig tafelbereik in"); return; }
  const { data, error } = await tbl("fill_uitsluitingen").insert({ product_id: pid, tafel_van: van, tafel_tot: tot, notitie }).select().single();
  if (error) { showToast(error.code === "23505" ? "Die regel bestaat al" : "Opslaan mislukt: " + error.message); return; }
  X.rows.push(data); render(); showToast(`${S.products[pid]?.name || pid} telt niet mee op tafel ${van}–${tot}`);
}
function viewKoppeling() {
  const u = S.untill || {};
  const st = u.mode === "live" ? `<span class="pill ok">Verbonden${u.env === "test" ? " met testomgeving" : ""}</span> laatst opgehaald ${u.last_sync ? timeStr(u.last_sync) : "–"}`
    : u.mode === "error" ? `<span class="pill crit">Fout</span> ${esc(u.message || "")}` : `<span class="pill warn">Demo</span> nog geen unTill-gegevens ingesteld`;
  let h = `<p class="hint status">${st}</p>`;
  if (!U.loaded) return h + `<p class="hint">Laden…</p>`;
  const q = U.search;
  const artTxt = a => a ? a.name + " " + (a.department || "") + " " + (a.number ?? "") : "";
  const artName = id => { const a = U.arts[id]; return a ? `${esc(a.name)}<small>${esc(a.department || "")}${a.number ? " · nr " + a.number : ""}</small>` : `Artikel ${id}`; };
  const mapped = new Set(U.map.map(m => String(m.article_id)));
  const cands = Object.values(U.arts).filter(a => !mapped.has(String(a.id)) && (q ? matches(q, artTxt(a)) : a.sold_qty > 0)).slice(0, 40);
  const rows = [...U.map].filter(m => matches(q, S.products[m.product_id]?.name || "", artTxt(U.arts[m.article_id])))
    .sort((a, b) => S.order.indexOf(a.product_id) - S.order.indexOf(b.product_id));
  const opts = `<option value="">Kies drank…</option>` + S.order.filter(shownAnywhere).map(pid => `<option value="${pid}">${esc(S.products[pid].name)}</option>`).join("");
  h += `<div class="toolbar">${searchBox("artsearch", U.search, "Zoek artikel of drank")}</div>
    <p class="hint">Factor = hoeveel glazen, shots of stuks één verkoop is: glas wijn 1, groot glas 1,4, hele fles 5. Ongekoppelde artikelen tellen niet mee.</p>
    <h3 class="sechead">Nog te koppelen <span class="num">${cands.length}</span></h3>
    <p class="hint">${q ? "Zoekresultaten" : "Verkocht maar nog niet gekoppeld, meest verkocht bovenaan"}</p><div class="rows maprows">`;
  for (const a of cands) h += `<div class="row"><div class="r-name">${artName(a.id)}</div>
    <select class="par" id="mp-${a.id}" aria-label="Drank">${opts}</select>
    <input class="par num" type="number" min="0.1" max="100" step="0.1" id="mf-${a.id}" value="1" aria-label="Factor">
    <button class="btn primary sm" data-domap="${a.id}">Koppel</button></div>`;
  if (!cands.length) h += `<div class="empty">${q ? "Niets gevonden." : "Alle verkochte artikelen zijn gekoppeld."}</div>`;
  h += `</div><h3 class="sechead">Gekoppeld <span class="num">${rows.length}</span></h3><div class="rows maprows">`;
  for (const m of rows) h += `<div class="row"><div class="r-name">${artName(m.article_id)}</div>
    <div class="r-drink">→ ${esc(S.products[m.product_id]?.name || m.product_id)}</div>
    <input class="par num" type="number" min="0.1" max="100" step="0.1" data-mapfactor="${m.article_id}" value="${m.factor}" aria-label="Factor">
    <button class="btn sm" data-unmap="${m.article_id}" aria-label="Ontkoppelen">✕</button></div>`;
  if (!rows.length) h += `<div class="empty">${q ? "Niets gevonden." : "Nog niets gekoppeld."}</div>`;
  return h + `</div>`;
}

// ---------- Dashboard ----------
const WD = ["ma", "di", "wo", "do", "vr", "za", "zo"], HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
async function loadDash() {
  const n = period === "dag" ? 1 : period === "week" ? 7 : 30;
  const [a, b] = await Promise.all([rpc("dashboard", { p_days: n }), n === 30 ? null : rpc("dashboard", { p_days: 30 })]);
  dash = a.data; dash30 = b ? b.data : a.data;
  if (tab === "dashboard") render();
}
function delta(cur, prev, lowerIsBetter) {
  if (!prev) return `<span class="vs">nog geen vergelijking</span>`;
  const d = (cur - prev) / prev * 100, good = lowerIsBetter ? d < 0 : d > 0;
  const lbl = period === "dag" ? "gisteren" : period === "week" ? "vorige week" : "vorige 30 dagen";
  return `<span class="delta ${Math.abs(d) < 2 ? "" : good ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(0)}%</span> <span class="vs">t.o.v. ${lbl}</span>`;
}
function funWeight(kg) {
  const cmp = [[30, "Labrador", "Labradors"], [70, "volwassen man", "volwassen mannen"], [900, "Smart fortwo", "Smarts"], [1300, "Volkswagen Golf", "Volkswagen Golfs"], [5000, "olifant", "olifanten"]];
  let best = cmp[0]; for (const c of cmp) if (kg / c[0] >= 1) best = c;
  const n = kg / best[0];
  return n < 1.15 ? `Zo zwaar als een ${best[1]}` : `Net zoveel als ${n.toFixed(n < 10 ? 1 : 0).replace(".", ",")} ${best[2]}`;
}
function sparkline(vals) {
  const w = 120, h = 34, max = Math.max(...vals), min = Math.min(...vals);
  const pts = vals.map((v, i) => [i / Math.max(1, vals.length - 1) * w, h - 3 - (v - min) / (max - min || 1) * (h - 8)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" "), last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d} L${w} ${h} L0 ${h}Z" class="spark-area"/><path d="${d}" class="spark-line"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5" class="spark-dot"/></svg>`;
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v || 1))); return [1, 2, 2.5, 5, 10].map(m => m * p).find(m => m >= v); }
function barChart(items) {
  const W = 720, H = 250, L = 40, B = 28, T = 22, max = niceMax(Math.max(1, ...items.map(i => i.value)) * 1.08);
  const bw = (W - L) / items.length, gap = Math.max(2, bw * 0.28), y = v => T + (H - T - B) * (1 - v / max);
  const avg = items.reduce((a, i) => a + i.value, 0) / items.length, top = items.reduce((a, i) => i.value > a.value ? i : a, items[0]);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bijgevuld per ${period === "dag" ? "uur" : "dag"}">`;
  for (let k = 0; k <= 4; k++) { const v = max * k / 4; s += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 8}" y="${y(v) + 4}" class="tick" text-anchor="end">${fmt(v)}</text>`; }
  const every = items.length > 16 ? 5 : 1;
  items.forEach((it, i) => {
    const x = L + i * bw + gap / 2, w = bw - gap, yy = y(it.value), h = H - B - yy, r = Math.min(4, w / 2, h);
    if (h > 0) s += `<path class="bar${it === top ? " top" : ""}" d="M${x} ${H - B} V${yy + r} Q${x} ${yy} ${x + r} ${yy} H${x + w - r} Q${x + w} ${yy} ${x + w} ${yy + r} V${H - B} Z"/>`;
    s += `<rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" data-tip="${esc(it.tip)}"/>`;
    if (i % every === 0 || i === items.length - 1) s += `<text x="${x + w / 2}" y="${H - 8}" class="tick" text-anchor="middle">${it.label}</text>`;
  });
  s += `<line x1="${L}" x2="${W}" y1="${y(avg)}" y2="${y(avg)}" class="avg"/><text x="${L + 6}" y="${y(avg) - 6}" class="tick avg-l" text-anchor="start">gemiddeld ${fmt(avg)}</text>`;
  if (top.value > 0) { const tx = L + items.indexOf(top) * bw + bw / 2; s += `<text x="${Math.min(W - 30, Math.max(L + 30, tx))}" y="${y(top.value) - 7}" class="peak" text-anchor="middle">${fmt(top.value)}</text>`; }
  return s + `</svg>`;
}
function heatmap(heat) {
  const grid = WD.map(() => HOURS.map(() => 0));
  for (const c of heat || []) { const hi = HOURS.indexOf(c.h < 6 ? c.h + 24 : c.h); if (hi >= 0) grid[c.wd - 1][hi] += +c.u; }
  const max = Math.max(1, ...grid.flat()); let peak = [0, 0];
  grid.forEach((row, r) => row.forEach((v, c) => { if (v === max) peak = [r, c]; }));
  const cw = 44, ch = 30, L = 34, T = 22, W = L + cw * HOURS.length, H = T + ch * 7;
  let s = `<svg class="chart heat" viewBox="0 0 ${W} ${H + 4}" role="img" aria-label="Drukte per uur en weekdag">`;
  HOURS.forEach((h, c) => { if (c % 2 === 0) s += `<text x="${L + c * cw + cw / 2}" y="14" class="tick" text-anchor="middle">${String(h % 24).padStart(2, "0")}u</text>`; });
  grid.forEach((row, r) => {
    s += `<text x="${L - 8}" y="${T + r * ch + ch / 2 + 4}" class="tick" text-anchor="end">${WD[r]}</text>`;
    row.forEach((v, c) => { s += `<rect x="${L + c * cw + 1}" y="${T + r * ch + 1}" width="${cw - 2}" height="${ch - 2}" rx="4" class="cell${r === peak[0] && c === peak[1] ? " peak-cell" : ""}" style="fill-opacity:${(0.06 + 0.94 * Math.pow(v / max, 1.3)).toFixed(2)}" data-tip="${WD[r]} ${String(HOURS[c] % 24).padStart(2, "0")}:00 · gem. ${fmt(v)} stuks bijgevuld"/>`; });
  });
  return { svg: s + `</svg>`, peak: `${["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"][peak[0]]} rond ${String(HOURS[peak[1]] % 24).padStart(2, "0")}:00` };
}
function gauge(score) {
  const r = 70, cx = 90, cy = 86, a = Math.PI * (1 - score / 100), x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  return `<svg class="gauge" viewBox="0 0 180 100" role="img" aria-label="Bijvulscore ${score} van 100"><path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" class="g-track"/><path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" class="g-val"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" class="g-knob"/><text x="${cx}" y="${cy - 8}" text-anchor="middle" class="g-num">${score}</text></svg>`;
}
const BOTTLE = '<svg viewBox="0 0 12 30" class="btl" aria-hidden="true"><path d="M4.5 0h3v7c0 1.5 3.5 3 3.5 6v15.5c0 .8-.7 1.5-1.5 1.5h-7C1.7 30 1 29.3 1 28.5V13c0-3 3.5-4.5 3.5-6z"/></svg>';

function viewDashboard() {
  const label = { dag: "Vandaag", week: "Afgelopen 7 dagen", maand: "Afgelopen 30 dagen" }[period];
  const head = `<div class="dash-head"><div><h2 class="dash-title">${label}</h2><p class="note" style="margin:0">Loopt live mee. Een dag loopt van 06:00 tot 06:00, zodat een late avond bij één dag hoort.</p></div>
    ${seg("period", [["dag", "Vandaag"], ["week", "Week"], ["maand", "30 dagen"]], period)}</div>`;
  const fill = `<section class="fillrow" aria-label="Vulstand per koeling">${S.fridges.map(f => { const pct = fridgePct(f), lv = level(pct, 100), n = Object.values(f.items).filter(it => needOf(it) > 0).length;
    return `<div class="fillline ${lv}" title="${n ? `${n} ${n === 1 ? "drank" : "dranken"} bijvullen` : "Alles vol"}"><span class="fc-name">${esc(f.name)}</span><div class="hb-track"><i style="width:${pct}%"></i></div><b class="num">${pct}%</b><small class="num">${n ? `${n} bij` : "vol"}</small></div>`; }).join("")}</section>`;
  const wx = typeof weerDash === "function" ? weerDash() : "";
  if (!dash) { loadDash(); return `<div class="dash">${fill}${wx}${head}<p class="note">Cijfers laden…</p></div>`; }
  const n = period === "dag" ? 1 : period === "week" ? 7 : 30, days = dash.days || [];
  const cur = days.slice(-n), prev = days.slice(0, days.length - n);
  const sum = (ds, k) => ds.reduce((a, d) => a + (+d[k] || 0), 0);
  const units = sum(cur, "units"), unitsP = sum(prev, "units"), kg = sum(cur, "kg"), kgP = sum(prev, "kg");
  const empt = sum(cur, "empties"), emptP = sum(prev, "empties"), rounds = sum(cur, "rounds");
  const avgReact = ds => { const v = ds.filter(d => d.react != null); return v.length ? v.reduce((a, d) => a + +d.react, 0) / v.length : null; };
  const react = avgReact(cur), reactP = avgReact(prev), streak = +dash30.streak || 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - empt / n * 14 - ((react ?? 6) - 6) * 1.6)));
  const scoreLbl = score >= 85 ? "Topavond, de bar staat er strak bij" : score >= 70 ? "Goed bezig, nog wat winst te halen" : "Er stond te vaak iets leeg";
  const items = n === 1
    ? HOURS.map(h => { const v = +((dash.hours || []).find(x => (x.h < 6 ? x.h + 24 : x.h) === h)?.units || 0); const hh = String(h % 24).padStart(2, "0"); return { label: hh, value: v, tip: `${hh}:00 tot ${String((h + 1) % 24).padStart(2, "0")}:00 · ${fmt(v)} stuks` }; })
    : cur.map(d => { const dt = new Date(d.d + "T12:00:00"); return { label: n === 7 ? WD[(dt.getDay() + 6) % 7] : String(dt.getDate()), value: +d.units, tip: `${dt.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })} · ${fmt(d.units)} stuks` }; });
  const per = dash.products || {}, ranked = Object.entries(per).filter(([p]) => S.products[p]).sort((a, b) => b[1] - a[1]), pod = ranked.slice(0, 3);
  const fr = S.fridges.map(f => ({ name: f.name, v: +((dash.fridges || {})[f.id] || 0) })).sort((a, b) => b.v - a.v), frMax = Math.max(1, fr[0]?.v || 0);
  const wineIds = Object.values(S.products).filter(p => p.serve === "glas").map(p => p.id);
  const wineB = wineIds.reduce((a, p) => a + +(per[p] || 0), 0), glasses = wineIds.reduce((a, p) => a + +(per[p] || 0) * ratioOf(p), 0);
  const scale = Math.max(1, Math.ceil(wineB / 40)), shown = Math.round(wineB / scale);
  const hm = heatmap(dash30.heat), km = rounds * 2 * 35 / 1000, prosIds = Object.values(S.products).filter(p => /prosecco/i.test(p.name)).map(p => p.id), pros = prosIds.reduce((a, p) => a + +(per[p] || 0), 0), prosGl = prosIds.reduce((a, p) => a + +(per[p] || 0) * ratioOf(p), 0);
  const all30 = (dash30.days || []).map(d => +d.units), best = Math.max(0, ...all30), todayV = all30[all30.length - 1] || 0;
  const badges = [
    { on: streak >= 3, t: "Nooit leeg", d: "3 dagen op rij geen lege koeling" },
    { on: react != null && react < 12, t: "Bliksemsnel", d: "Gemiddeld binnen 12 minuten weer vol" },
    { on: kg >= 1000, t: "Krachtpatser", d: "Meer dan een ton gesjouwd" },
    { on: cur.some(d => new Date(d.d + "T12:00:00").getDay() === 6 && +d.units > 600), t: "Zaterdagheld", d: "Een zaterdag met 600+ stuks overleefd" },
    { on: km >= 10, t: "Marathonloper", d: "10 km tussen magazijn en bar" },
    { on: todayV > 0 && todayV >= best * 0.98, t: "Recordavond", d: "Drukste dag van de afgelopen 30 dagen" },
  ];
  return `<div class="dash">${fill}${wx}${head}
  <div class="kpis">
    <div class="kpi hero"><div class="k-lbl">Bijgevuld</div><div class="k-row"><div class="k-big num">${fmt(units)}</div>${sparkline(all30.slice(-14))}</div><div class="k-sub">${delta(units, unitsP)}</div><div class="k-foot num">${fmt(rounds)} bijvulrondes gelopen</div></div>
    <div class="kpi"><div class="k-lbl">Gesjouwd</div><div class="k-big num">${fmt(kg)}<span class="unit"> kg</span></div><div class="k-sub">${delta(kg, kgP)}</div><div class="k-foot">${funWeight(kg)}</div></div>
    <div class="kpi"><div class="k-lbl">Reactietijd</div><div class="k-big num">${react == null ? "–" : react.toFixed(0)}<span class="unit"> min</span></div><div class="k-sub">${react == null ? "" : delta(react, reactP, true)}</div><div class="k-foot">Van "bijna leeg" tot weer vol</div></div>
    <div class="kpi"><div class="k-lbl">Keer leeg gestaan</div><div class="k-big num">${empt}</div><div class="k-sub">${delta(empt || 0.0001, emptP, true)}</div><div class="k-foot"><span class="streak">${streak} ${streak === 1 ? "dag" : "dagen"} op rij</span> nergens leeg</div></div>
  </div>
  <div class="badges">${badges.map(b => `<div class="badge${b.on ? " on" : ""}" data-tip="${esc(b.d)}"><span class="b-ico">${b.on ? "★" : "☆"}</span><div><b>${b.t}</b><small>${b.on ? "Behaald" : esc(b.d)}</small></div></div>`).join("")}</div>
  <div class="funrow">
    <div class="fun"><span class="f-num num">${km.toFixed(1).replace(".", ",")} km</span><span class="f-txt">gelopen tussen magazijn en bar, dat is ${(km / 0.4).toFixed(0)} rondjes atletiekbaan</span></div>
    <div class="fun"><span class="f-num num">${fmt(prosGl)}</span><span class="f-txt">glazen prosecco geschonken, ${fmt(pros)} kurken geknald</span></div>
    <div class="fun"><span class="f-num num">${fmt(units / Math.max(1, rounds))}</span><span class="f-txt">stuks per ronde, zo efficiënt loop je</span></div>
  </div>
  <div class="dgrid">
    <section class="panel wide"><div class="p-head"><h3>Bijgevuld per ${n === 1 ? "uur" : "dag"}</h3><span class="p-sub">stuks en flessen</span></div><div class="chartwrap">${barChart(items)}</div></section>
    <section class="panel score"><div class="p-head"><h3>Bijvulscore</h3><span class="p-sub">van 100</span></div>${gauge(score)}<p class="g-lbl">${scoreLbl}</p><p class="p-sub" style="text-align:center;margin:0">Hoe vaker niets leeg staat en hoe sneller je bijvult, hoe hoger de score.</p></section>
    <section class="panel"><div class="p-head"><h3>Toppers</h3><span class="p-sub">meest bijgevuld</span></div>
      <div class="podium">${[1, 0, 2].map(i => pod[i] ? `<div class="pod p${i + 1}"><div class="pod-name">${esc(S.products[pod[i][0]].name)}</div><div class="pod-n num">${fmt(pod[i][1])}</div><div class="pod-block"><span>${i + 1}</span></div></div>` : "<div></div>").join("")}</div>
      <ol class="rest" start="4">${ranked.slice(3, 8).map(([p, v]) => `<li><span>${esc(S.products[p].name)}</span><b class="num">${fmt(v)}</b></li>`).join("")}</ol></section>
    <section class="panel"><div class="p-head"><h3>Per koeling</h3><span class="p-sub">stuks bijgevuld</span></div>
      <ul class="hbars">${fr.map(f => `<li data-tip="${esc(f.name)} · ${fmt(f.v)} stuks"><div class="hb-top"><span>${esc(f.name)}</span><b class="num">${fmt(f.v)}</b></div><div class="hb-track"><i style="width:${(f.v / frMax * 100).toFixed(1)}%"></i></div></li>`).join("")}</ul></section>
    <section class="panel"><div class="p-head"><h3>Wijn geschonken</h3><span class="p-sub">per fles ingesteld</span></div>
      <div class="wine-big"><span class="num">${fmt(glasses)}</span> glazen</div><div class="bottles">${BOTTLE.repeat(shown)}</div>
      <p class="p-sub">${fmt(wineB)} flessen bijgevuld${scale > 1 ? `, elk flesje hierboven is er ${scale}` : ""}</p></section>
    <section class="panel full"><div class="p-head"><h3>Wanneer is het druk?</h3><span class="p-sub">gemiddelde over de laatste 4 weken</span></div><div class="chartwrap">${hm.svg}</div>
      <p class="p-sub">Piekmoment: <b style="color:var(--fg)">${hm.peak}</b>. Zorg dat alles daarvoor vol staat.</p></section>
  </div></div>`;
}

function renderFeed() {
  const last = S.feed[0];
  $("#feedlast").textContent = last ? `${timeStr(last.t)} ${last.txt}` : "";
  $("#feedlist").innerHTML = S.feed.slice(0, 12).map((e, i) => `<li class="${i === 0 ? "fresh" : ""}"><time>${timeStr(e.t)}</time><span>${esc(e.txt)} <span style="color:var(--muted)">· ${esc(e.where)}</span></span></li>`).join("") || `<li><span style="color:var(--muted)">Nog geen verkopen</span></li>`;
}
function render() {
  renderTabs(); renderFeed();
  const y = window.scrollY;
  $("#view").innerHTML = tab === "koelingen" ? viewKoelingen() : tab === "pakken" ? viewPakken() : tab === "magazijn" ? viewMagazijn() : tab === "dashboard" ? viewDashboard() : tab === "analyse" ? viewAnalyse() : viewInstellingen();
  window.scrollTo(0, y);
}

// ---------- Interactie ----------
$("#tabs").onclick = async e => {
  const b = e.target.closest("button"); if (!b) return;
  tab = b.dataset.tab; window.scrollTo(0, 0);
  if (tab === "instellingen") { const { data } = await tbl("team_members").select("email").order("email"); S.team = (data || []).map(x => x.email); await loadKoppeling(); }
  if (tab === "dashboard") dash = null;
  if (tab === "analyse") ana = null;
  placeFeed(); render();
};
$("#view").addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) return;
  const d = t.dataset;
  if (d.fill) { const [fid, pid] = d.fill.split("|"); t.disabled = true; await refill([[fid, pid]], `${S.products[pid].name}: {n} bijgevuld`); }
  else if (d.fillall) { const f = S.fridges.find(x => x.id === d.fillall); t.disabled = true; await refill(Object.keys(f.items).filter(p => needOf(f.items[p]) > 0).map(p => [f.id, p]), `${f.name}: {n} stuks bijgevuld`); }
  else if (d.view) saveSetting("view", d.view);
  else if (d.sort) saveSetting("sort", d.sort);
  else if (d.sec) { SET.sec = d.sec; SET.q = ""; store.set("bv-sec", d.sec); window.scrollTo(0, 0); render(); }
  else if (d.fridge) { SET.fridge = d.fridge; store.set("bv-fridge", d.fridge); render(); }
  else if (d.push) { if (d.push === "on") pushOn(); else if (d.push === "off") pushOff(); else { const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription(); await sb.functions.invoke("push-signals", { body: { test: true, endpoint: sub?.endpoint, org_id: TENANT.org } }); showToast("Testmelding verstuurd"); } }
  else if (d.snooze) { snooze(d.snooze); render(); }
  else if (d.fmv) { const [id, dir] = d.fmv.split("|"); moveFridge(id, +dir); }
  else if ("fdel" in d) { const [id, yes] = d.fdel.split("|"); if (yes) deleteFridge(id); else { SET.delFridge = id || null; render(); } }
  else if (d.expand) { EXP.has(d.expand) ? EXP.delete(d.expand) : EXP.add(d.expand); render(); }
  else if (d.newdrink) { SET.adding = d.newdrink === "1" && !SET.adding; render(); if (SET.adding) $("#nd-name").focus(); }
  else if (d.magfilter) { M.filter = d.magfilter; render(); }
  else if (d.theme) setTheme(d.theme);
  else if (d.logout) { writeRt(null); await sb.auth.signOut(); location.reload(); }
  else if (d.period) { period = d.period; dash = null; render(); }
  else if (d.mv) {
    const [pid, other] = d.mv.split("|"); if (!other) return;
    const i = S.order.indexOf(pid), j = S.order.indexOf(other);
    [S.order[i], S.order[j]] = [S.order[j], S.order[i]]; render();
    const a = S.products[pid].pick_order, b = S.products[other].pick_order;
    S.products[pid].pick_order = b; S.products[other].pick_order = a;
    await tbl("products").update({ pick_order: b }).eq("id", pid); await tbl("products").update({ pick_order: a }).eq("id", other);
  }
  else if (d.addpack) { const p = S.products[d.addpack]; await tbl("warehouse").update({ qty: (S.warehouse[p.id] || 0) + p.pack_size }).eq("product_id", p.id); }
  else if (d.delteam) { await tbl("team_members").delete().eq("email", d.delteam); S.team = S.team.filter(x => x !== d.delteam); render(); }
  else if (d.uxdel) { const { error } = await tbl("fill_uitsluitingen").delete().eq("id", d.uxdel); if (error) { showToast("Verwijderen mislukt: " + error.message); return; } X.rows = X.rows.filter(r => String(r.id) !== d.uxdel); render(); }
  else if (d.unmap) { await tbl("untill_map").delete().eq("article_id", d.unmap); U.map = U.map.filter(m => String(m.article_id) !== d.unmap); render(); }
  else if (d.domap) {
    const pid = $("#mp-" + d.domap).value, factor = Math.max(0.1, parseFloat($("#mf-" + d.domap).value) || 1);
    if (!pid) { showToast("Kies eerst een drank"); return; }
    const { error } = await tbl("untill_map").insert({ article_id: d.domap, product_id: pid, factor });
    if (error) { showToast("Koppelen mislukt: " + error.message); return; }
    U.map.push({ article_id: Number(d.domap), product_id: pid, factor }); render();
  }
});
// Zoekvelden: filter direct en houd de cursor in het veld
const SEARCH = { artsearch: v => U.search = v, setsearch: v => SET.q = v, magsearch: v => M.q = v };
$("#view").addEventListener("input", e => {
  const id = e.target.id; if (!SEARCH[id]) return;
  SEARCH[id](e.target.value); render();
  const el = $("#" + id), n = el.value.length; el.focus(); el.setSelectionRange(n, n);
});
$("#view").addEventListener("change", async e => {
  const el = e.target, d = el.dataset;
  if (d.fname || d.fsub) {
    const id = d.fname || d.fsub, f = S.fridges.find(x => x.id === id), v = el.value.trim();
    if (d.fname && !v) { el.value = f.name; return; }
    const col = d.fname ? "name" : "sub"; f[col] = v;
    const { error } = await tbl("fridges").update({ [col]: v }).eq("id", id);
    showToast(error ? "Opslaan mislukt: " + error.message : "Opgeslagen"); return;
  }
  if (d.show) { const [fid, pid] = d.show.split("|"); await tbl("fridge_items").update({ visible: el.checked }).eq("fridge_id", fid).eq("product_id", pid); }
  else if (d.ratio) { const v = Math.max(1, Math.min(50, parseInt(el.value, 10) || 1)); S.products[d.ratio].ratio = v; await tbl("products").update({ ratio: v }).eq("id", d.ratio); }
  else if (d.par) {
    const [fid, pid] = d.par.split("|"), v = Math.max(1, Math.min(500, parseInt(el.value, 10) || 1)), it = S.fridges.find(x => x.id === fid).items[pid];
    it.par = v; it.cur = Math.min(it.cur, v);
    await tbl("fridge_items").update({ par: v, current: it.cur }).eq("fridge_id", fid).eq("product_id", pid);
  }
  else if (d.uxactief) { const r = X.rows.find(x => String(x.id) === d.uxactief); const { error } = await tbl("fill_uitsluitingen").update({ actief: el.checked }).eq("id", d.uxactief); if (error) { el.checked = !el.checked; showToast("Opslaan mislukt: " + error.message); } else if (r) r.actief = el.checked; }
  else if (d.uxvan || d.uxtot) {
    const id = d.uxvan || d.uxtot, r = X.rows.find(x => String(x.id) === id), col = d.uxvan ? "tafel_van" : "tafel_tot", v = parseInt(el.value, 10);
    const next = { ...r, [col]: v };
    if (!r || !Number.isFinite(v) || next.tafel_van > next.tafel_tot) { if (r) el.value = r[col]; showToast("Van-tafel moet lager zijn dan tot-tafel"); return; }
    const { error } = await tbl("fill_uitsluitingen").update({ [col]: v }).eq("id", id);
    if (error) { el.value = r[col]; showToast("Opslaan mislukt: " + error.message); return; }
    r[col] = v; showToast("Opgeslagen");
  }
  else if (d.mapfactor) { const v = Math.max(0.1, parseFloat(el.value) || 1); await tbl("untill_map").update({ factor: v }).eq("article_id", d.mapfactor); const m = U.map.find(x => String(x.article_id) === d.mapfactor); if (m) m.factor = v; }
  else if (d.movefridge) {
    const [from, pid] = d.movefridge.split("|"), to = el.value, src = S.fridges.find(x => x.id === from), dst = S.fridges.find(x => x.id === to);
    if (!dst || to === from || dst.items[pid]) { if (dst?.items[pid]) showToast("Die drank staat daar al"); render(); return; }
    dst.items[pid] = src.items[pid]; delete src.items[pid]; render();
    const { error } = await tbl("fridge_items").update({ fridge_id: to }).eq("fridge_id", from).eq("product_id", pid);
    if (error) { showToast("Verplaatsen mislukt: " + error.message); src.items[pid] = dst.items[pid]; delete dst.items[pid]; render(); return; }
    showToast(`${S.products[pid].name} staat nu in ${dst.name}`);
  }
  else if (d.pack) { S.products[d.pack].pack = el.value; await tbl("products").update({ pack: el.value }).eq("id", d.pack); render(); }
  else if (d.packsize) { const v = Math.max(1, Math.min(200, parseInt(el.value, 10) || 1)); S.products[d.packsize].pack_size = v; await tbl("products").update({ pack_size: v }).eq("id", d.packsize); }
  else if (d.cur) {
    // Vol uit hetzelfde rijtje lezen: dat kan net gewijzigd zijn en nog niet terug zijn van de database
    const [fid, pid] = d.cur.split("|"), it = S.fridges.find(x => x.id === fid).items[pid];
    const parEl = el.closest(".row")?.querySelector("[data-par]"), par = Math.max(1, parseInt(parEl?.value, 10) || it.par);
    let v = Math.max(0, parseInt(el.value, 10) || 0); const capped = v > par;
    if (capped) { v = par; el.value = v; }
    it.par = par; it.cur = v; const low = v <= par * 0.3 ? (it.low || new Date().toISOString()) : null;
    const { error } = await tbl("fridge_items").update({ current: v, low_since: low }).eq("fridge_id", fid).eq("product_id", pid);
    showToast(error ? "Opslaan mislukt: " + error.message : capped ? `Meer dan vol (${par}) kan niet, op ${par} gezet. Verhoog Vol als er meer in past.` : `${S.products[pid].name}: stand op ${v} gezet`);
  }
  else if (el.id === "showhidden") { SET.hidden = el.checked; render(); }
  else if (d.pos) { await moveTo(d.pos, parseInt(el.value, 10)); }
  else if (d.stock) { await tbl("warehouse").update({ qty: Math.max(0, parseInt(el.value, 10) || 0) }).eq("product_id", d.stock); }
});
// Drank direct naar plek n in de (getoonde) pakvolgorde; alleen gewijzigde pick_order's opslaan
async function moveTo(pid, n) {
  const list = S.order.filter(x => SET.hidden || shownAnywhere(x)), from = list.indexOf(pid);
  if (!(n >= 1) || from < 0) { render(); return; }
  const to = Math.min(list.length, n) - 1; if (to === from) { render(); return; }
  const slots = list.map(x => S.products[x].pick_order).sort((a, b) => a - b);
  list.splice(from, 1); list.splice(to, 0, pid);
  const changed = list.map((x, i) => [x, slots[i]]).filter(([x, po]) => S.products[x].pick_order !== po);
  for (const [x, po] of changed) S.products[x].pick_order = po;
  S.order = Object.values(S.products).sort((a, b) => a.pick_order - b.pick_order).map(x => x.id); render();
  await Promise.all(changed.map(([x, po]) => tbl("products").update({ pick_order: po }).eq("id", x)));
}
$("#view").addEventListener("submit", async e => {
  if (e.target.id === "newdrink") { e.preventDefault(); addDrink(); return; }
  if (e.target.id === "nf-form") { e.preventDefault(); addFridge(); return; }
  if (e.target.id === "ux-form") { e.preventDefault(); addUitsluiting(); return; }
  if (e.target.id !== "teamform") return; e.preventDefault();
  const email = $("#teamemail").value.trim().toLowerCase(); if (!email) return;
  const { error } = await tbl("team_members").insert({ email });
  if (error) { showToast("Toevoegen mislukt: " + error.message); return; }
  S.team.push(email); render();
});

// Tooltip voor grafieken
const tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.hidden = true; document.body.appendChild(tipEl);
document.addEventListener("pointermove", e => {
  const t = e.target.closest?.("[data-tip]");
  if (!t || tab !== "dashboard" && tab !== "analyse") { tipEl.hidden = true; return; }
  tipEl.textContent = t.dataset.tip; tipEl.hidden = false;
  tipEl.style.left = Math.min(window.innerWidth - tipEl.offsetWidth - 8, e.clientX + 14) + "px"; tipEl.style.top = (e.clientY - tipEl.offsetHeight - 12) + "px";
});
// Verkoopfeed: op telefoon en liggend scherm standaard ingeklapt, keuze per apparaat onthouden
const small = matchMedia("(max-width: 760px), (max-height: 560px)");
const feedPref = () => store.get(small.matches ? "bv-feed-small" : "bv-feed", small.matches ? "0" : "1") === "1";
// Op de beheerschermen klapt hij vanzelf in, zodat hij niet over de invoervelden valt
let feedAuto = false;
function placeFeed() {
  const want = tab === "magazijn" || tab === "instellingen" || tab === "analyse" ? false : feedPref();
  if ($("#feed").open !== want) { feedAuto = true; $("#feed").open = want; }
}
placeFeed();
small.addEventListener("change", placeFeed);
$("#feed").addEventListener("toggle", () => { if (feedAuto) { feedAuto = false; return; } store.set(small.matches ? "bv-feed-small" : "bv-feed", $("#feed").open ? "1" : "0"); });
// Scherm wakker houden op de tablet
async function wake() { try { await navigator.wakeLock?.request("screen"); } catch (e) {} }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wake(); if (!$("#app").hidden) loadAll().then(render); } });
paintTheme(); wake();
sb.auth.onAuthStateChange((ev, session) => {
  if (session?.refresh_token && remember()) writeRt(session.refresh_token);
  if (ev === "SIGNED_OUT") { writeRt(null); location.reload(); }
});
boot();
