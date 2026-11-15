// Multi-tenant ondersteuning voor Fill (Roboshift-platform).
// - Bepaalt bij inloggen voor welke organisatie de gebruiker Fill gebruikt (core.my_entitlements).
// - Gebruikers met één organisatie merken niets: de database vult org_id zelf in.
// - Gebruikers met meerdere organisaties kiezen er één; alle queries, RPC's en live-updates
//   worden dan expliciet op die org gefilterd.
// - Werkt ook vóór de platformmigraties: dan valt de app terug op de oude teamlijst (is_team).
// Laadt vóór app.js; gebruikt `sb` pas tijdens aanroepen.
const TENANT = { org: null, explicit: false, orgs: [] };
const ORGLESS = new Set(["team_members"]);

// Retourneert { ok: true } of { ok: false, msg }
async function resolveOrg() {
  const ent = await sb.schema("core").rpc("my_entitlements");
  if (ent.error) {
    // Platform nog niet uitgerold: oude toegangscontrole
    const { data: ok, error } = await sb.rpc("is_team");
    return error || !ok ? { ok: false } : { ok: true };
  }
  const orgs = (ent.data || []).filter(e => e.product_key === "fill" && e.has_access)
    .map(e => ({ id: e.org_id, name: e.org_name }));
  if (!orgs.length) {
    // Bestaand team van de eerste klant (nog niet als lid in core.memberships)
    const { data: legacy } = await sb.rpc("fill_current_org");
    if (legacy) { TENANT.org = legacy; return { ok: true }; }
    return { ok: false };
  }
  TENANT.orgs = orgs;
  if (orgs.length === 1) { TENANT.org = orgs[0].id; return { ok: true }; }
  let saved = null; try { saved = localStorage.getItem("bv-org"); } catch (e) {}
  const pick = orgs.find(o => o.id === saved) || (await chooseOrg(orgs));
  TENANT.org = pick.id; TENANT.explicit = true;
  try { localStorage.setItem("bv-org", pick.id); } catch (e) {}
  return { ok: true };
}

// Eenvoudige keuzelijst (alleen bij meerdere organisaties)
function chooseOrg(orgs) {
  return new Promise(resolve => {
    const d = document.createElement("dialog");
    d.className = "orgpick";
    d.innerHTML = "<h3>Kies een bedrijf</h3>";
    for (const o of orgs) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = o.name; // textContent: geen HTML-injectie via bedrijfsnaam
      b.onclick = () => { d.close(); d.remove(); resolve(o); };
      d.appendChild(b);
    }
    document.body.appendChild(d); d.showModal();
  });
}
function switchOrg() { try { localStorage.removeItem("bv-org"); } catch (e) {} location.reload(); }

const withOrg = r => Array.isArray(r) ? r.map(withOrg) : { org_id: TENANT.org, ...r };

// Vervanger voor sb.from(tabel): tbl("x")
function tbl(table) {
  const b = sb.from(table);
  if (!TENANT.explicit || ORGLESS.has(table)) return b;
  const o = TENANT.org;
  return {
    select: (...a) => b.select(...a).eq("org_id", o),
    insert: (r, opt) => b.insert(withOrg(r), opt),
    upsert: (r, opt) => b.upsert(withOrg(r), opt),
    update: v => b.update(v).eq("org_id", o),
    delete: opt => b.delete(opt).eq("org_id", o),
  };
}
// Vervanger voor sb.rpc(naam, args): geeft p_org mee bij expliciete org-keuze
function rpc(name, args = {}) { return sb.rpc(name, TENANT.explicit ? { ...args, p_org: TENANT.org } : args); }
// Extra filter voor live-updates
function orgFilter() { return TENANT.explicit ? { filter: `org_id=eq.${TENANT.org}` } : {}; }
