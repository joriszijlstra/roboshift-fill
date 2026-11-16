/* RoboShift Handleiding: infoknop + handleiding in de app. Gedeeld door Fill, Loop en Pass.
   Inhoud per app staat in handleiding-inhoud.js (window.RS_HANDLEIDING), dit bestand is overal gelijk.
   Stijl volgt Fill. Openen: de ?-knop, de toets ?, of #handleiding achter de link. */
(function () {
  "use strict";
  var VERSIE = "1.0.0";
  var C = window.RS_HANDLEIDING;
  if (!C || !C.secties) return;

  var CSS = `
.rsh-root{--rsh-bg:#eef2f4;--rsh-surface:#fff;--rsh-surface-2:#f5f8f9;--rsh-line:#d8e0e4;--rsh-fg:#14222a;--rsh-muted:#5b6b74;--rsh-accent:#0b6e8a;--rsh-accent-ink:#fff;--rsh-accent-soft:#dcedf2;--rsh-warn:#a56300;--rsh-warn-soft:#fbeccf;
  font-family:"Barlow",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.45;color:var(--rsh-fg);}
.rsh-root.rsh-dark{--rsh-bg:#0d1519;--rsh-surface:#152127;--rsh-surface-2:#1a2930;--rsh-line:#26363e;--rsh-fg:#e4edf1;--rsh-muted:#8fa2ab;--rsh-accent:#4fb6d3;--rsh-accent-ink:#062029;--rsh-accent-soft:#163640;--rsh-warn:#f0b04f;--rsh-warn-soft:#3a2a10;color-scheme:dark;}
.rsh-root *{box-sizing:border-box;}
.rsh-btn{font:inherit;cursor:pointer;}
.rsh-float{position:fixed;z-index:2147483000;right:max(16px,env(safe-area-inset-right,0px));top:calc(12px + env(safe-area-inset-top,0px));width:40px;height:40px;border-radius:50%;border:1px solid var(--rsh-line);background:var(--rsh-surface);color:var(--rsh-accent);font-family:"Barlow Semi Condensed","Arial Narrow",system-ui,sans-serif;font-weight:700;font-size:1.25rem;display:grid;place-items:center;box-shadow:0 4px 16px rgba(20,34,42,.18);}
.rsh-float:hover,.rsh-float:focus-visible{border-color:var(--rsh-accent);}
.rsh-float[hidden]{display:none!important;}
.rsh-scrim{position:fixed;inset:0;z-index:2147483001;background:rgba(10,18,22,.45);opacity:0;transition:opacity .18s;}
.rsh-open .rsh-scrim{opacity:1;}
.rsh-panel{position:fixed;z-index:2147483002;top:0;right:0;bottom:0;width:min(460px,100vw);background:var(--rsh-bg);border-left:1px solid var(--rsh-line);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .2s ease;box-shadow:-12px 0 32px rgba(10,18,22,.18);padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);}
.rsh-open .rsh-panel{transform:none;}
@media (prefers-reduced-motion:reduce){.rsh-panel,.rsh-scrim{transition:none;}}
.rsh-head{background:var(--rsh-surface);border-bottom:1px solid var(--rsh-line);padding:14px 16px 12px;display:grid;gap:10px;}
.rsh-titlerow{display:flex;align-items:center;gap:10px;}
.rsh-title{margin:0;font-family:"Barlow Semi Condensed","Arial Narrow",system-ui,sans-serif;font-weight:700;font-size:1.45rem;letter-spacing:.01em;flex:1;min-width:0;}
.rsh-title small{display:block;font-family:"Barlow",system-ui,sans-serif;font-weight:500;font-size:.85rem;color:var(--rsh-muted);letter-spacing:0;}
.rsh-x{width:38px;height:38px;border-radius:50%;border:1px solid var(--rsh-line);background:var(--rsh-surface-2);color:var(--rsh-fg);font-size:1.1rem;display:grid;place-items:center;flex:none;}
.rsh-x:hover{border-color:var(--rsh-accent);}
.rsh-search{width:100%;padding:10px 12px;border:1px solid var(--rsh-line);border-radius:8px;background:var(--rsh-surface-2);color:var(--rsh-fg);font:inherit;}
.rsh-search:focus{outline:3px solid var(--rsh-accent);outline-offset:1px;}
.rsh-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:14px 16px 24px;display:flex;flex-direction:column;gap:10px;}
.rsh-body>*{flex:none;}
.rsh-root :focus-visible{outline:3px solid var(--rsh-accent);outline-offset:2px;}
.rsh-intro{margin:0;color:var(--rsh-muted);font-size:.95rem;}
.rsh-label{margin:8px 0 0;font-family:"Barlow Semi Condensed","Arial Narrow",system-ui,sans-serif;font-weight:700;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--rsh-muted);}
.rsh-sec{background:var(--rsh-surface);border:1px solid var(--rsh-line);border-radius:10px;overflow:hidden;}
.rsh-sec.rsh-here{border-color:var(--rsh-accent);box-shadow:0 0 0 1px var(--rsh-accent) inset;}
.rsh-sec summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;align-items:center;gap:10px;font-weight:600;font-size:1.02rem;}
.rsh-sec summary::-webkit-details-marker{display:none;}
.rsh-ico{width:30px;height:30px;border-radius:8px;background:var(--rsh-accent-soft);display:grid;place-items:center;flex:none;font-size:1rem;}
.rsh-st{flex:1;min-width:0;}
.rsh-tag{font-size:.72rem;font-weight:600;color:var(--rsh-accent-ink);background:var(--rsh-accent);border-radius:999px;padding:2px 8px;flex:none;}
.rsh-chev{width:18px;height:18px;flex:none;fill:none;stroke:var(--rsh-muted);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .15s;}
.rsh-sec[open] .rsh-chev{transform:rotate(180deg);}
.rsh-txt{padding:0 14px 14px;border-top:1px solid var(--rsh-line);}
.rsh-txt p{margin:12px 0 0;}
.rsh-txt ol,.rsh-txt ul{margin:10px 0 0;padding-left:1.3em;}
.rsh-txt li{margin:5px 0;}
.rsh-txt b{font-weight:600;}
.rsh-txt kbd,.rsh-k{display:inline-block;font-family:inherit;font-size:.88em;font-weight:600;padding:0 6px;border:1px solid var(--rsh-line);border-bottom-width:2px;border-radius:6px;background:var(--rsh-surface-2);white-space:nowrap;}
.rsh-tip{margin:12px 0 0;padding:10px 12px;border-radius:8px;background:var(--rsh-accent-soft);font-size:.95rem;}
.rsh-let{margin:12px 0 0;padding:10px 12px;border-radius:8px;background:var(--rsh-warn-soft);font-size:.95rem;}
.rsh-tip::before{content:"Tip · ";font-weight:600;color:var(--rsh-accent);}
.rsh-let::before{content:"Let op · ";font-weight:600;color:var(--rsh-warn);}
.rsh-empty{padding:18px 14px;text-align:center;color:var(--rsh-muted);background:var(--rsh-surface);border:1px dashed var(--rsh-line);border-radius:10px;}
.rsh-foot{margin:10px 0 0;color:var(--rsh-muted);font-size:.85rem;text-align:center;}
.rsh-foot b{font-family:"Archivo Black","Barlow Semi Condensed",sans-serif;font-weight:400;letter-spacing:.04em;}
mark.rsh-m{background:var(--rsh-warn-soft);color:inherit;border-radius:3px;padding:0 1px;}
@media (max-width:520px){.rsh-panel{width:100vw;border-left:0;}}
@media print{.rsh-root{display:none!important;}}
`;

  var CHEV = '<svg class="rsh-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var root, panel, body, search, floatBtn, mountBtn, lastFocus = null, isOpen = false;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function plain(html) { var d = document.createElement("div"); d.innerHTML = html; return (d.textContent || "").toLowerCase(); }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    if (C.volgSysteemThema === false) return false;
    return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function paintTheme() { if (root) root.classList.toggle("rsh-dark", isDark()); }

  function contextId() { try { return C.context ? C.context() : null; } catch (e) { return null; } }

  function build() {
    var st = el("style"); st.id = "rsh-style"; st.textContent = CSS; document.head.appendChild(st);
    root = el("div", "rsh-root"); root.setAttribute("data-rsh", VERSIE);

    floatBtn = el("button", "rsh-btn rsh-float", "?");
    floatBtn.type = "button"; floatBtn.title = "Handleiding"; floatBtn.setAttribute("aria-label", "Handleiding openen");
    floatBtn.hidden = true;
    floatBtn.addEventListener("click", function () { open(); });
    root.appendChild(floatBtn);

    var scrim = el("div", "rsh-scrim"); scrim.hidden = true; scrim.addEventListener("click", close);
    panel = el("aside", "rsh-panel"); panel.hidden = true;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-labelledby", "rsh-title");
    var head = el("div", "rsh-head");
    head.innerHTML = '<div class="rsh-titlerow"><h2 class="rsh-title" id="rsh-title">Handleiding<small>RoboShift ' + C.app + "</small></h2>" +
      '<button type="button" class="rsh-btn rsh-x" aria-label="Handleiding sluiten">✕</button></div>' +
      '<input class="rsh-search" type="search" placeholder="Zoek, bijv. ' + (C.zoekVoorbeeld || "afvinken") + '" aria-label="Zoek in de handleiding" autocomplete="off">';
    head.querySelector(".rsh-x").addEventListener("click", close);
    search = head.querySelector(".rsh-search");
    search.addEventListener("input", function () { renderBody(); body.scrollTop = 0; });
    body = el("div", "rsh-body");
    panel.appendChild(head); panel.appendChild(body);
    root.appendChild(scrim); root.appendChild(panel);
    document.body.appendChild(root);
    root._scrim = scrim;

    // Knop in de kopbalk van de app (valt terug op de zwevende knop als die er niet is of niet zichtbaar)
    if (C.knop && C.knop.voor) {
      var ref = document.querySelector(C.knop.voor);
      if (ref && ref.parentNode) {
        mountBtn = el("button", C.knop.klasse || "", C.knop.inhoud || "?");
        mountBtn.type = "button"; mountBtn.id = "rsh-knop"; mountBtn.title = "Handleiding: hoe werkt het?";
        mountBtn.setAttribute("aria-label", "Handleiding openen");
        if (C.knop.stijl) mountBtn.setAttribute("style", C.knop.stijl);
        mountBtn.addEventListener("click", function () { open(); });
        ref.parentNode.insertBefore(mountBtn, ref);
      }
    }
    syncFloat();
    setInterval(syncFloat, 1000);
    paintTheme();
    new MutationObserver(paintTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    if (window.matchMedia) { var mq = matchMedia("(prefers-color-scheme: dark)"); if (mq.addEventListener) mq.addEventListener("change", paintTheme); }

    document.addEventListener("keydown", function (e) {
      if (isOpen && e.key === "Escape") { e.preventDefault(); close(); return; }
      if (isOpen && e.key === "Tab") trapFocus(e);
      if (!isOpen && e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var t = e.target, tag = t && t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
        e.preventDefault(); open();
      }
    });
    window.addEventListener("hashchange", function () { if (location.hash === "#handleiding") open(); });
    if (location.hash === "#handleiding") open();
  }

  // Zwevende knop alleen tonen als de knop in de kopbalk niet zichtbaar is (bijv. op het inlogscherm)
  function syncFloat() {
    var visible = mountBtn && mountBtn.offsetParent !== null && mountBtn.getClientRects().length > 0;
    if (visible) { var r = mountBtn.getBoundingClientRect(); visible = r.width > 0 && r.bottom > 0; }
    var force = false; try { force = !!(C.toonZwevend && C.toonZwevend()); } catch (e) {}
    floatBtn.hidden = isOpen || (visible && !force);
  }

  function trapFocus(e) {
    var f = panel.querySelectorAll('button,input,summary,a[href],[tabindex]:not([tabindex="-1"])');
    var list = Array.prototype.filter.call(f, function (x) { return x.offsetParent !== null; });
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function highlight(html, q) {
    if (!q) return html;
    var d = document.createElement("div"); d.innerHTML = html;
    var words = q.split(/\s+/).filter(function (w) { return w.length > 1; });
    if (!words.length) return html;
    var walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var txt = node.nodeValue, low = norm(txt), hits = [];
      words.forEach(function (w) { var i = 0; while ((i = low.indexOf(w, i)) > -1) { hits.push([i, i + w.length]); i += w.length; } });
      if (!hits.length) return;
      hits.sort(function (a, b) { return a[0] - b[0]; });
      var frag = document.createDocumentFragment(), pos = 0;
      hits.forEach(function (h) {
        if (h[0] < pos) return;
        frag.appendChild(document.createTextNode(txt.slice(pos, h[0])));
        var m = document.createElement("mark"); m.className = "rsh-m"; m.textContent = txt.slice(h[0], h[1]); frag.appendChild(m);
        pos = h[1];
      });
      frag.appendChild(document.createTextNode(txt.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    });
    return d.innerHTML;
  }

  function secHtml(s, opts) {
    var here = opts.here, q = opts.q;
    var d = el("details", "rsh-sec" + (here ? " rsh-here" : ""));
    if (opts.open) d.open = true;
    d.id = "rsh-" + s.id;
    d.innerHTML = '<summary><span class="rsh-ico" aria-hidden="true">' + (s.icoon || "•") + '</span><span class="rsh-st">' + highlight(s.titel, q) + "</span>" +
      (here ? '<span class="rsh-tag">Dit scherm</span>' : "") + CHEV + "</summary>" +
      '<div class="rsh-txt">' + highlight(s.tekst, q) + "</div>";
    return d;
  }

  function score(s, words) {
    var title = norm(s.titel), all = norm(s.titel + " " + (s.zoek || "") + " " + plain(s.tekst)), sc = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (all.indexOf(w) < 0) return 0;
      sc += title.indexOf(w) > -1 ? 5 : 1;
    }
    return sc;
  }

  function renderBody() {
    var q = norm(search.value.trim());
    body.innerHTML = "";
    var here = contextId();
    var groepen = [{ naam: null, items: C.secties }];
    if (C.vragen && C.vragen.length) groepen.push({ naam: "Veelgestelde vragen", items: C.vragen });

    if (q) {
      var words = q.split(/\s+/).filter(Boolean), hits = [];
      groepen.forEach(function (g) { g.items.forEach(function (s) { var sc = score(s, words); if (sc) hits.push({ s: s, sc: sc }); }); });
      hits.sort(function (a, b) { return b.sc - a.sc; });
      if (!hits.length) {
        body.appendChild(el("div", "rsh-empty", "Niets gevonden voor “" + search.value.trim().replace(/[<>&]/g, "") + "”. Probeer een ander woord, of vraag het je leidinggevende."));
      } else {
        hits.forEach(function (h, i) { body.appendChild(secHtml(h.s, { q: q, open: i < 2, here: h.s.id === here })); });
      }
    } else {
      if (C.intro) body.appendChild(el("p", "rsh-intro", C.intro));
      groepen.forEach(function (g) {
        if (g.naam) body.appendChild(el("h3", "rsh-label", g.naam));
        g.items.forEach(function (s) { body.appendChild(secHtml(s, { open: s.id === here, here: s.id === here })); });
      });
    }
    body.appendChild(el("p", "rsh-foot", "<b>ROBOSHIFT</b> " + C.app + " · handleiding bijgewerkt " + (C.bijgewerkt || "") + "<br>Shift happens. RoboShift regelt het."));
  }

  function open(sectieId) {
    if (isOpen) return;
    lastFocus = document.activeElement;
    paintTheme();
    search.value = "";
    renderBody();
    panel.hidden = false; root._scrim.hidden = false;
    // forceer reflow voor de animatie
    void panel.offsetWidth;
    root.classList.add("rsh-open"); isOpen = true; syncFloat();
    document.documentElement.style.overflow = "hidden";
    var target = sectieId ? document.getElementById("rsh-" + sectieId) : body.querySelector(".rsh-here");
    if (target) { target.open = true; setTimeout(function () { target.scrollIntoView({ block: "start" }); }, 30); }
    setTimeout(function () { (body.querySelector(".rsh-here summary") || panel.querySelector(".rsh-x")).focus({ preventScroll: true }); }, 60);
  }
  function close() {
    if (!isOpen) return;
    root.classList.remove("rsh-open"); isOpen = false;
    document.documentElement.style.overflow = "";
    setTimeout(function () { if (!isOpen) { panel.hidden = true; root._scrim.hidden = true; } syncFloat(); }, 220);
    if (location.hash === "#handleiding") history.replaceState(null, "", location.pathname + location.search);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  window.RSHandleiding = { open: open, sluit: close, versie: VERSIE };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
