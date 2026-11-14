// Unit test voor tenant.js met een nep-Supabase-client. Draaien: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function load({ ent, isTeam = false, legacy = null, saved = null }) {
  const calls = [];
  const builder = (table) => {
    const rec = { table, ops: [] };
    calls.push(rec);
    const b = new Proxy({}, { get: (_, op) => (...a) => { rec.ops.push([op, ...a]); return b; } });
    return b;
  };
  const sb = {
    from: builder,
    rpc: async (name, args) => { calls.push({ rpc: name, args }); return name === "is_team" ? { data: isTeam } : name === "fill_current_org" ? { data: legacy } : { data: null }; },
    schema: () => ({ rpc: async () => ent }),
  };
  const store = new Map(saved ? [["bv-org", saved]] : []);
  const ctx = { sb, localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL("../tenant.js", import.meta.url), "utf8") + "\n;this.api = { TENANT, resolveOrg, tbl, rpc, orgFilter };", ctx);
  return { api: ctx.api, calls };
}
const j = x => JSON.parse(JSON.stringify(x));
const A = "00000000-0000-0000-0000-0000000000aa", B = "00000000-0000-0000-0000-0000000000bb";

test("platform nog niet uitgerold: terugval op teamlijst", async () => {
  const { api } = load({ ent: { error: { message: "schema core bestaat niet" } }, isTeam: true });
  assert.deepEqual(j(await api.resolveOrg()), { ok: true });
  assert.equal(api.TENANT.explicit, false);
});
test("geen toegang zonder licentie en zonder teamlidmaatschap", async () => {
  const { api } = load({ ent: { data: [] } });
  assert.equal((await api.resolveOrg()).ok, false);
});
test("bestaand team zonder lidmaatschap krijgt eerste klant", async () => {
  const { api } = load({ ent: { data: [] }, legacy: A });
  assert.equal((await api.resolveOrg()).ok, true);
  assert.equal(api.TENANT.org, A);
});
test("één organisatie: niets expliciet, database vult org_id", async () => {
  const { api, calls } = load({ ent: { data: [{ product_key: "fill", has_access: true, org_id: A, org_name: "A" }, { product_key: "loop", has_access: true, org_id: B, org_name: "B" }] } });
  await api.resolveOrg();
  assert.equal(api.TENANT.org, A); assert.equal(api.TENANT.explicit, false);
  api.tbl("products").select("*");
  assert.deepEqual(j(calls.at(-1).ops), [["select", "*"]]);
  await api.rpc("dashboard", { p_days: 7 });
  assert.deepEqual(j(calls.at(-1).args), { p_days: 7 });
});
test("meerdere organisaties: alles expliciet gefilterd", async () => {
  const { api, calls } = load({ saved: B, ent: { data: [
    { product_key: "fill", has_access: true, org_id: A, org_name: "A" }, { product_key: "fill", has_access: true, org_id: B, org_name: "B" }] } });
  await api.resolveOrg();
  assert.equal(api.TENANT.org, B); assert.equal(api.TENANT.explicit, true);
  api.tbl("products").select("*").order("x");
  assert.deepEqual(j(calls.at(-1).ops), [["select", "*"], ["eq", "org_id", B], ["order", "x"]]);
  api.tbl("fridges").insert({ id: "bar" });
  assert.deepEqual(j(calls.at(-1).ops)[0][1], { org_id: B, id: "bar" });
  api.tbl("settings").update({ value: 1 }).eq("key", "x");
  assert.deepEqual(j(calls.at(-1).ops), [["update", { value: 1 }], ["eq", "org_id", B], ["eq", "key", "x"]]);
  api.tbl("team_members").select("email");
  assert.deepEqual(j(calls.at(-1).ops), [["select", "email"]], "teamlijst heeft geen org_id");
  await api.rpc("do_refill", { p_fridge: "bar", p_product: "cola" });
  assert.deepEqual(j(calls.at(-1).args), { p_fridge: "bar", p_product: "cola", p_org: B });
  assert.deepEqual(JSON.parse(JSON.stringify(api.orgFilter())), { filter: `org_id=eq.${B}` });
});
test("verlopen licentie telt niet mee", async () => {
  const { api } = load({ ent: { data: [{ product_key: "fill", has_access: false, org_id: A, org_name: "A" }] } });
  assert.equal((await api.resolveOrg()).ok, false);
});
