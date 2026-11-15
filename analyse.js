/* Fill: tab Analyse. Slimme verkoopanalyses op de echte kassaverkopen (porties: glazen, flesjes, shots).
   Alle cijfers komen uit één databasefunctie: analyses(dagen). Gebruikt de globals uit app.js (sb, S, tab, esc, fmt, seg, barChart, WD). */
let anaPeriod = "week", ana = null, anaSpace = null, anaBusy = false, anaFridge = "alle";
const anaOpen = new Set(); // koelingen waarvan alle dranken getoond worden
const ANA_DAYS = { dag: 1, week: 7, maand: 30 };
const WD_LONG = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

async function loadAna() {
  if (anaBusy) return; anaBusy = true;
  const [r, sp] = await Promise.all([rpc("analyses", { p_days: ANA_DAYS[anaPeriod] }), rpc("analyses_space", { p_days: ANA_DAYS[anaPeriod] })]);
  anaBusy = false;
  ana = r.error ? { error: r.error.message } : r.data; anaSpace = sp.error ? null : sp.data;
  if (tab === "analyse") render();
}
// Elke minuut verversen zolang de tab open is
setInterval(() => { if (tab === "analyse" && !document.hidden) loadAna(); }, 60000);

const pname = id => S.products[id]?.name || id;
const fridgeOf = id => S.fridges.find(f => f.items[id]);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const hh = h => String(h % 24).padStart(2, "0");
function ago(t) {
  const m = (Date.now() - new Date(t)) / 60000;
  return m < 90 ? `${Math.max(1, Math.round(m))} min geleden` : m < 36 * 60 ? `${Math.round(m / 60)} uur geleden` : `${Math.round(m / 1440)} dagen geleden`;
}

function anaInsights(a, prods) {
  const out = [], tot = +a.cur;
  if (!tot) return out;
  const top = prods[0];
  if (top) out.push({ ico: "★", t: `${esc(pname(top.id))} verkoopt het best`, d: `${fmt(top.q)} van de ${fmt(tot)} porties (${pct(top.q, tot)}%).` });
  const hours = (a.hours || []).map(x => ({ h: x.h, q: +x.q })).sort((x, y) => y.q - x.q);
  if (hours[0]) out.push({ ico: "◷", t: `Piek tussen ${hh(hours[0].h)}:00 en ${hh(hours[0].h + 1)}:00`, d: `${pct(hours[0].q, tot)}% van alle verkoop valt in dat uur. Zorg dat alles daarvoor vol staat.` });
  // Stijger en daler: gemiddelde per dag met verkoop, huidige periode tegen de vorige
  if (+a.prev_days > 0 && +a.cur_days > 0) {
    const ch = prods.concat((a.products || []).filter(p => +p.q === 0 && +p.p > 0))
      .map(p => ({ id: p.id, q: +p.q, p: +p.p, d: +p.q / a.cur_days - +p.p / a.prev_days })).filter(p => p.q + p.p >= 4).sort((x, y) => y.d - x.d);
    const up = ch[0], dn = ch[ch.length - 1];
    if (up && up.d > 0) out.push({ ico: "▲", cls: "up", t: `${esc(pname(up.id))} stijgt`, d: `${fmt(up.q)} verkocht, de vorige periode ${fmt(up.p)}. Misschien een krat extra koud zetten.` });
    if (dn && dn.d < 0 && dn !== up) out.push({ ico: "▼", cls: "down", t: `${esc(pname(dn.id))} zakt`, d: `${fmt(dn.q)} verkocht, de vorige periode ${fmt(dn.p)}.` });
  }
  const pair = (a.pairs || [])[0];
  if (pair && pair.n >= 2) out.push({ ico: "⇄", t: "Vaak samen besteld", d: `${esc(pname(pair.a))} en ${esc(pname(pair.b))}, ${pair.n}× in dezelfde bestelling.` });
  const fr = Object.entries(a.fridges || {}).sort((x, y) => y[1].q - x[1].q)[0];
  if (fr) { const f = S.fridges.find(x => x.id === fr[0]); out.push({ ico: "▦", t: `${esc(f?.name || fr[0])} draait het hardst`, d: `${pct(fr[1].q, tot)}% van de verkoop komt uit deze koeling.` }); }
  const wds = (a.weekdays || []).filter(w => w.n > 0).map(w => ({ wd: w.wd, avg: w.q / w.n }));
  if (+a.data_days >= 7 && wds.length >= 4) { const b = wds.sort((x, y) => y.avg - x.avg)[0]; out.push({ ico: "▤", t: `${WD_LONG[b.wd - 1][0].toUpperCase() + WD_LONG[b.wd - 1].slice(1)} is de drukste dag`, d: `Gemiddeld ${fmt(b.avg)} porties.` }); }
  return out.slice(0, 6);
}

function stackBar(parts, total) {
  const cols = ["var(--accent)", "var(--ok)", "var(--warn)", "var(--crit)", "var(--muted)"];
  const segs = parts.map((p, i) => ({ ...p, c: cols[i % cols.length], w: total ? p.q / total * 100 : 0 }));
  return `<div class="ana-stack" role="img" aria-label="Verdeling per koeling">${segs.filter(s => s.w > 0).map(s => `<i style="width:${s.w.toFixed(1)}%;background:${s.c}" data-tip="${esc(s.name)} · ${fmt(s.q)} (${Math.round(s.w)}%)"></i>`).join("")}</div>
    <ul class="ana-legend">${segs.map(s => `<li><span class="sw" style="background:${s.c}"></span>${esc(s.name)}<b class="num">${Math.round(s.w)}%</b></li>`).join("")}</ul>`;
}

// ---------- Koelruimte tegen verkoop ----------
// Advies: genoeg plek voor de drukste bijvulperiode (standaard 2 uur) in de gekozen periode, plus de helft extra als buffer.
// Heeft een drank leeggestaan, dan altijd meer. Onder de 7 dagen data is het advies voorlopig (zonder knop).
function spaceAdvice(it, firm) {
  const p = S.products[it.id], min = p?.serve === "glas" ? 2 : 4;
  let rec = Math.max(min, Math.ceil(+it.peak * 1.5));
  if (+it.empty > 0) rec = Math.max(rec, it.par + Math.max(2, Math.ceil(it.par * 0.25)));
  if (!firm && +it.u <= 0 && +it.empty === 0) return { rec, st: "wacht" };
  const st = rec > it.par ? "meer" : (rec <= it.par * 0.6 && it.par - rec >= 3) ? "minder" : "goed";
  return { rec, st };
}
function spacePanel() {
  const sp = anaSpace; if (!sp) return "";
  const firm = +sp.days >= 7, items = (sp.items || []).filter(it => S.products[it.id] && S.fridges.some(f => f.id === it.f));
  const fr = S.fridges.filter(f => items.some(it => it.f === f.id)), sel = fr.some(f => f.id === anaFridge) ? anaFridge : "alle";
  const ord = { meer: 0, minder: 1, goed: 2, wacht: 3 };
  const all = items.map(it => ({ ...it, ...spaceAdvice(it, firm) }));
  const cnt = k => all.filter(x => x.st === k).length;
  const groups = (sel === "alle" ? fr : fr.filter(f => f.id === sel)).map(f => {
    const rows = all.filter(x => x.f === f.id), parSum = rows.reduce((a, x) => a + x.par, 0) || 1, uSum = rows.reduce((a, x) => a + +x.u, 0);
    // Grootste verschil tussen aandeel plek en aandeel verkoop eerst
    const gap = x => Math.abs(x.par / parSum - (uSum ? x.u / uSum : 0));
    rows.sort((a, b) => ord[a.st] - ord[b.st] || gap(b) - gap(a));
    const cap = sel === "alle" && !anaOpen.has(f.id) ? 5 : rows.length, more = rows.length - cap;
    return `<div class="sp-fridge"><div class="sp-fh"><b>${esc(f.name)}</b><small>${fmt(parSum)} plekken · ${fmt(uSum)} verkocht</small></div>
      <ul class="sp-rows">${rows.slice(0, cap).map(x => { const ps = x.par / parSum * 100, us = uSum ? x.u / uSum * 100 : 0, perDay = +x.u / Math.max(1, sp.days);
        const chip = x.st === "meer" ? `<span class="sp-chip meer">Meer plek: ${x.rec}</span>` : x.st === "minder" ? `<span class="sp-chip minder">Kan minder: ${x.rec}</span>` : x.st === "wacht" ? `<span class="sp-chip wacht">Nog geen verkoop</span>` : `<span class="sp-chip goed">Goed zo</span>`;
        const why = +x.empty > 0 ? `${x.empty}× leeg gestaan` : +x.u > 0 ? `drukste ${sp.window_h} uur: ${fmt(Math.ceil(+x.peak))} weg` : "niet verkocht";
        return `<li class="sp-row ${x.st}"><div class="sp-name"><span>${esc(pname(x.id))}</span><small class="num">${x.par} plekken · ${perDay < 1 && perDay > 0 ? perDay.toFixed(1).replace(".", ",") : fmt(perDay)} per dag · ${why}</small></div>
          <div class="sp-bars" data-tip="${esc(pname(x.id))}: ${Math.round(ps)}% van de plek in ${esc(f.name)}, ${Math.round(us)}% van de verkoop"><div class="sp-b plek"><i style="width:${ps.toFixed(1)}%"></i></div><div class="sp-b verk"><i style="width:${us.toFixed(1)}%"></i></div></div>
          <div class="sp-act">${chip}${firm && x.st !== "goed" ? `<button class="btn sm" data-anapar="${x.f}|${x.id}|${x.rec}">Zet op ${x.rec}</button>` : ""}</div></li>`; }).join("")}</ul>${more > 0 ? `<button class="linkbtn sp-more" data-anaopen="${f.id}">Nog ${more} ${more === 1 ? "drank" : "dranken"} tonen</button>` : ""}</div>`;
  }).join("");
  return `<section class="panel full sp"><div class="p-head"><h3>Koelruimte tegen verkoop</h3><span class="p-sub">${cnt("meer")} kunnen meer plek gebruiken · ${cnt("minder")} kunnen minder · ${cnt("goed")} zitten goed${cnt("wacht") ? ` · ${cnt("wacht")} nog niet verkocht` : ""}</span></div>
    <p class="p-sub">Per drank: hoeveel van de koeling hij inneemt <span class="sp-key plek"></span> tegenover hoeveel van de verkoop uit die koeling hij is <span class="sp-key verk"></span>. Het advies is genoeg voor de drukste ${sp.window_h} uur in deze periode, met de helft extra als buffer.${firm ? "" : ` <b class="sp-vl">Voorlopig:</b> pas na een week verkopen kun je het advies met één tik overnemen (nu ${sp.days} ${+sp.days === 1 ? "dag" : "dagen"}).`}</p>
    ${seg("anafridge", [["alle", "Alle koelingen"], ...fr.map(f => [f.id, f.name])], sel)}
    ${groups}</section>`;
}
document.getElementById("view").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b || tab !== "analyse") return;
  const d = b.dataset;
  if (d.anaperiod) { anaPeriod = d.anaperiod; ana = null; render(); }
  else if (d.anafridge) { anaFridge = d.anafridge; render(); }
  else if (d.anaopen) { anaOpen.add(d.anaopen); render(); }
  else if (d.anapar) {
    const [fid, pid, v] = d.anapar.split("|"), it = S.fridges.find(f => f.id === fid)?.items[pid], par = +v; if (!it) return;
    b.disabled = true; it.par = par; it.cur = Math.min(it.cur, par);
    const { error } = await tbl("fridge_items").update({ par, current: it.cur }).eq("fridge_id", fid).eq("product_id", pid);
    if (error) { showToast("Opslaan mislukt: " + error.message); b.disabled = false; return; }
    const row = (anaSpace?.items || []).find(x => x.f === fid && x.id === pid); if (row) row.par = par;
    showToast(`${pname(pid)}: vol is nu ${par}`); render();
  }
});

function viewAnalyse() {
  const label = { dag: "Vandaag", week: "Afgelopen 7 dagen", maand: "Afgelopen 30 dagen" }[anaPeriod];
  const head = `<div class="dash-head"><div><h2 class="dash-title">Analyse · ${label}</h2><p class="note" style="margin:0">Verkochte porties uit de kassa (glazen, flesjes, shots). Een dag loopt van 06:00 tot 06:00.</p></div>
    ${seg("anaperiod", [["dag", "Vandaag"], ["week", "Week"], ["maand", "30 dagen"]], anaPeriod)}</div>`;
  if (!ana) { loadAna(); return `<div class="dash">${head}<p class="note">Analyses laden…</p></div>`; }
  if (ana.error) return `<div class="dash">${head}<p class="note">Kon de analyses niet laden: ${esc(ana.error)}</p></div>`;
  const a = ana, tot = +a.cur, n = ANA_DAYS[anaPeriod];
  const start = new Date(a.start + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
  const young = +a.data_days < 14 ? `<div class="ana-young"><b>Nog jong:</b> er is ${a.data_days} ${+a.data_days === 1 ? "dag" : "dagen"} kassadata (sinds ${start}). Vergelijkingen en weekpatronen worden elke dag betrouwbaarder.</div>` : "";
  const prods = (a.products || []).filter(p => +p.q > 0 && S.products[p.id]).sort((x, y) => y.q - x.q);
  if (!tot) return `<div class="dash">${head}${young}<p class="note">${anaPeriod === "dag" ? "Vandaag is er nog niets verkocht." : "Nog geen verkopen in deze periode."}</p></div>`;

  // Kerncijfers
  const perDay = d => d ? (+a.prev / d) : 0, curAvg = tot / Math.max(1, +a.cur_days), prevAvg = perDay(+a.prev_days);
  const vsLbl = anaPeriod === "dag" ? "gisteren" : anaPeriod === "week" ? "vorige week" : "vorige 30 dagen";
  const dlt = prevAvg ? (() => { const d = (curAvg - prevAvg) / prevAvg * 100; return `<span class="delta ${Math.abs(d) < 2 ? "" : d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(0)}%</span> <span class="vs">per dag t.o.v. ${vsLbl}</span>`; })() : `<span class="vs">nog geen vergelijking</span>`;
  const hours = (a.hours || []).map(x => ({ h: +x.h, q: +x.q })), peak = hours.reduce((m, x) => x.q > (m?.q ?? -1) ? x : m, null);
  const glasses = prods.filter(p => ["glas", "shot"].includes(S.products[p.id].serve)).reduce((s, p) => s + +p.q, 0);
  const kpis = `<div class="kpis">
    <div class="kpi hero"><div class="k-lbl">Verkocht</div><div class="k-big num">${fmt(tot)}</div><div class="k-sub">${dlt}</div><div class="k-foot num">${n > 1 ? `gemiddeld ${fmt(curAvg)} per verkoopdag` : "porties vandaag"}</div></div>
    <div class="kpi"><div class="k-lbl">Bestellingen</div><div class="k-big num">${fmt(a.orders)}</div><div class="k-foot">gemiddeld ${(tot / Math.max(1, a.orders)).toFixed(1).replace(".", ",")} drankjes per bestelling</div></div>
    <div class="kpi"><div class="k-lbl">Drukste uur</div><div class="k-big num">${peak ? hh(peak.h) + ":00" : "–"}</div><div class="k-foot">${peak ? `${fmt(peak.q)} porties, ${pct(peak.q, tot)}% van het totaal` : ""}</div></div>
    <div class="kpi"><div class="k-lbl">Verschillende dranken</div><div class="k-big num">${prods.length}</div><div class="k-foot">${glasses ? `waarvan ${fmt(glasses)} glazen en shots geschonken` : "flesjes en glazen samen"}</div></div>
  </div>`;

  const ins = anaInsights(a, prods);
  const insights = ins.length ? `<section class="ana-ins" aria-label="Wat valt op">${ins.map(i => `<div class="ana-card ${i.cls || ""}"><span class="ana-ico">${i.ico}</span><div><b>${i.t}</b><p>${i.d}</p></div></div>`).join("")}</section>` : "";

  // Toppers met trend
  const max = Math.max(1, ...prods.map(p => +p.q)), canCmp = +a.prev_days > 0;
  const trend = p => { if (!canCmp) return ""; const was = +p.p / a.prev_days * a.cur_days; if (!was) return `<span class="ana-tr new">nieuw</span>`; const d = (p.q - was) / was * 100; return Math.abs(d) < 10 ? `<span class="ana-tr">=</span>` : `<span class="ana-tr ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"}${Math.abs(d).toFixed(0)}%</span>`; };
  const top = `<section class="panel"><div class="p-head"><h3>Toppers</h3><span class="p-sub">meest verkocht${canCmp ? ", met trend" : ""}</span></div>
    <ol class="ana-top">${prods.slice(0, 10).map((p, i) => `<li data-tip="${esc(pname(p.id))} · ${fmt(p.q)} porties, ${pct(p.q, tot)}% van het totaal"><span class="rk num">${i + 1}</span><div class="ana-tn"><div class="hb-top"><span>${esc(pname(p.id))}</span><span><b class="num">${fmt(p.q)}</b> ${trend(p)}</span></div><div class="hb-track"><i style="width:${(p.q / max * 100).toFixed(1)}%"></i></div></div></li>`).join("")}</ol></section>`;

  // Verkoop per uur
  const HRS = Array.from({ length: 14 }, (_, i) => i + 11);
  const hItems = HRS.map(h => { const v = hours.find(x => (x.h < 6 ? x.h + 24 : x.h) === h)?.q || 0; return { label: hh(h), value: v, tip: `${hh(h)}:00 tot ${hh(h + 1)}:00 · ${fmt(v)} porties` }; });
  const hourPanel = `<section class="panel wide"><div class="p-head"><h3>Verkoop per uur</h3><span class="p-sub">${n > 1 ? "opgeteld over de periode" : "vandaag"}</span></div><div class="chartwrap">${barChart(hItems)}</div></section>`;

  // Mix per koeling
  const fr = S.fridges.map(f => ({ name: f.name, q: +((a.fridges || {})[f.id]?.q || 0) })).sort((x, y) => y.q - x.q);
  const mix = `<section class="panel"><div class="p-head"><h3>Mix per koeling</h3><span class="p-sub">aandeel in de verkoop</span></div>${stackBar(fr, tot)}</section>`;

  // Weekdagen (laatste 8 weken)
  const wd = WD.map((l, i) => { const w = (a.weekdays || []).find(x => x.wd === i + 1); return { label: l, value: w ? w.q / w.n : 0, tip: w ? `${WD_LONG[i]} · gemiddeld ${fmt(w.q / w.n)} porties (${w.n}× gemeten)` : `${WD_LONG[i]} · nog geen data` }; });
  const wdKnown = (a.weekdays || []).length;
  const wdPanel = `<section class="panel wide"><div class="p-head"><h3>Per weekdag</h3><span class="p-sub">gemiddelde per dag, laatste 8 weken</span></div>${wdKnown >= 3 ? `<div class="chartwrap">${barChart(wd)}</div>` : `<p class="note">Na een paar verschillende dagen zie je hier welke dag het drukst is. Nu ${wdKnown} ${wdKnown === 1 ? "dag" : "dagen"} gemeten.</p>`}</section>`;

  // Vaak samen besteld
  const pairs = (a.pairs || []).filter(p => S.products[p.a] && S.products[p.b]);
  const pairPanel = `<section class="panel"><div class="p-head"><h3>Vaak samen besteld</h3><span class="p-sub">in dezelfde bestelling</span></div>
    ${pairs.length ? `<ul class="ana-pairs">${pairs.map(p => `<li><span>${esc(pname(p.a))}</span><span class="plus">+</span><span>${esc(pname(p.b))}</span><b class="num">${p.n}×</b></li>`).join("")}</ul>` : `<p class="note">Nog geen combinaties gevonden.</p>`}</section>`;

  // Stille dranken: op het scherm, maar niet verkocht in deze periode
  const still = (a.products || []).filter(p => +p.q <= 0 && S.products[p.id]).sort((x, y) => (x.last ? new Date(x.last) : 0) - (y.last ? new Date(y.last) : 0));
  const stillPanel = `<section class="panel full"><div class="p-head"><h3>Stille dranken</h3><span class="p-sub">${still.length} op het scherm, niet verkocht in deze periode</span></div>
    ${still.length ? `<ul class="ana-still">${still.map(p => `<li><span>${esc(pname(p.id))}</span><small>${esc(fridgeOf(p.id)?.name || "")} · ${p.last ? "laatst " + ago(p.last) : "nog niet verkocht sinds " + start}</small></li>`).join("")}</ul>
      <p class="p-sub">Blijft een drank lang stil? Zet hem minder vol of haal hem van het scherm onder Instellingen &gt; Dranken. Dat scheelt koelruimte en sjouwen.</p>` : `<p class="note">Alles op het scherm is in deze periode verkocht.</p>`}</section>`;

  return `<div class="dash ana">${head}${young}${kpis}${insights}${spacePanel()}<div class="dgrid">${hourPanel}${top}${wdPanel}${mix}${pairPanel}${stillPanel}</div></div>`;
}
