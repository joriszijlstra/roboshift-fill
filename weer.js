/* Fill: weerbericht. Haalt weather_outlook() op (Open-Meteo via de Edge Function weather-sync, elk uur ververst).
   Toont een weerstrook op Bijvullen (met advies bij mooi weer) en een weerkaart op het Dashboard.
   Gebruikt de globals uit app.js (sb, S, tab, esc, fmt, render). */
let WX = null, wxBusy = false;
async function loadWeer() {
  if (wxBusy) return; wxBusy = true;
  const { data, error } = await sb.rpc("weather_outlook");
  wxBusy = false;
  if (!error && data) { WX = data; if (tab === "koelingen" || tab === "dashboard") render(); }
}
setInterval(() => { if (!document.hidden) loadWeer(); }, 15 * 60e3);

const wxPct = f => { const p = Math.round((f - 1) * 100); return p > 0 ? `+${p}%` : `${p}%`; };
// Verwachte drukte voor bier en fris (de koelingen die het meest op het weer reageren)
function wxBusyF(d) { const f = d?.factor || {}; const v = ["bier", "fris"].map(k => f[k]?.f).filter(x => x != null); return v.length ? v.reduce((a, b) => a + +b, 0) / v.length : 1; }

// Advies voor vandaag (en na 15:00 ook voor morgen): alleen als het merkbaar drukker of rustiger wordt
function wxAdvice() {
  if (!WX?.days?.length) return null;
  const h = new Date().getHours(), list = h >= 15 ? WX.days.slice(0, 2) : WX.days.slice(0, 1);
  const d = list.map(x => ({ x, f: wxBusyF(x) })).sort((a, b) => b.f - a.f)[0]; if (!d) return null;
  const x = d.x, dag = x.dag === "vandaag" ? "Vandaag" : x.dag === "morgen" ? "Morgen" : x.dag[0].toUpperCase() + x.dag.slice(1);
  if (d.f >= 1.1) {
    const extra = (x.extra || []).map(e => `${esc(e.name)} ${esc(e.txt)}`).join(" · ");
    return { lvl: "good", t: `${x.icon} ${dag} ${x.label.toLowerCase()}: reken op ${wxPct(d.f)} bier en fris`, d: extra ? `Zet extra koud: ${extra}` : `${fmt(x.tmax)}°, ${String(x.sun_h).replace(".", ",")} uur zon. Zet wat extra bier en fris koud.` };
  }
  if (d.f <= 0.9 && x.dag === "vandaag") return { lvl: "calm", t: `${x.icon} ${dag} ${x.label.toLowerCase()}: waarschijnlijk rustiger (${wxPct(d.f)} bier en fris)`, d: "Geen extra voorraad koud nodig." };
  return null;
}

function weerStrip() {
  if (!WX) { loadWeer(); return ""; }
  const n = WX.now, days = (WX.days || []).slice(0, 2), adv = wxAdvice();
  return `<section class="wx" aria-label="Weerbericht ${esc(WX.location || "")}">
    <div class="wx-row">${n ? `<span class="wx-now"><span class="wx-ico" aria-hidden="true">${n.icon}</span><b class="num">${fmt(n.temp)}°</b><small>nu</small></span>` : ""}
    ${days.map(d => `<span class="wx-day" title="${esc(d.label)} · ${d.sun_h} uur zon · ${d.rain_mm} mm regen"><small>${esc(d.dag)}</small><span class="wx-ico" aria-hidden="true">${d.icon}</span><b class="num">${fmt(d.tmax)}°</b><span class="wx-lbl">${esc(d.label)}</span></span>`).join("")}</div>
    ${adv ? `<div class="wx-adv ${adv.lvl}"><b>${adv.t}</b><small>${adv.d}</small></div>` : ""}
  </section>`;
}

function weerDash() {
  if (!WX) { loadWeer(); return ""; }
  const names = Object.fromEntries(S.fridges.map(f => [f.id, f.name]));
  const sens = WX.sensitivity || {}, learned = Object.values(sens).some(s => s.basis === "geleerd");
  const minDays = Math.min(...Object.values(sens).map(s => +s.days || 0));
  return `<section class="card wx-card" aria-label="Weer en verwachte drukte"><h3>Weer en verwachte drukte · ${esc(WX.location || "")}</h3>
    <div class="wx-days">${(WX.days || []).map(d => `<div class="wx-dcol"><div class="wx-dhead"><span class="wx-ico big" aria-hidden="true">${d.icon}</span><div><b>${esc(d.dag[0].toUpperCase() + d.dag.slice(1))}</b><small>${esc(d.label)} · ${fmt(d.tmax)}° · ${String(d.sun_h).replace(".", ",")} u zon · ${String(d.rain_mm).replace(".", ",")} mm</small></div></div>
      <ul class="wx-f">${S.fridges.filter(f => d.factor?.[f.id]).map(f => { const v = +d.factor[f.id].f; return `<li><span>${esc(names[f.id])}</span><b class="num ${v >= 1.1 ? "up" : v <= 0.9 ? "down" : ""}">${Math.abs(v - 1) < 0.03 ? "normaal" : wxPct(v)}</b></li>`; }).join("")}</ul></div>`).join("")}</div>
    <p class="note" style="margin:6px 0 0">${learned ? "Geleerd uit jullie eigen verkoop bij verschillend weer." : `Nu nog een aanname (mooi weer: meer bier, fris en witte wijn). Na ±8 open dagen met wisselend weer leert Fill het uit jullie eigen kassa (nu ${minDays} ${minDays === 1 ? "dag" : "dagen"}).`} Weer: Open-Meteo, openingsuren 11 tot 22 uur.</p>
  </section>`;
}
