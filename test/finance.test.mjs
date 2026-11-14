import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { saveProduct, saveVariant } from "../server/catalog.mjs";
import { openDatabase } from "../server/db.mjs";
import { dashboard } from "../server/metrics.mjs";
import { privateReport } from "../server/reports.mjs";
import { businessDay } from "../server/stock.mjs";
import { unitAction, saveUnit, unitDetails } from "../server/units.mjs";

const actor = "qa";
const date = businessDay();

function makeUnit(db) {
  const product = saveProduct(db, null, {
    name: "Masseira QA", category: "Masseiras", description: "Somente teste", specs: [], images: [], visibility: "published"
  }, actor).id;
  const variantId = saveVariant(db, product, null, { color: "Branca", images: [] }, actor).id;
  return saveUnit(db, actor, randomUUID(), null, { variantId, code: "QA-FIN-01", technical: "ready",
    confirmUnit: true, images: [], reason: "Cenário fictício" }).id;
}

test("custos por categoria, estorno e resultado em centavos persistem após reabrir o SQLite", () => {
  const directory = mkdtempSync(join(tmpdir(), "renovapan-finance-"));
  const filename = join(directory, "qa.sqlite");
  let db = openDatabase(filename);
  try {
    const unit = makeUnit(db);
    let revision = 1;
    const record = data => unitAction(db, actor, randomUUID(), unit, { revision: revision++, reason: "Auditoria fictícia", date, ...data });
    for (const [category, amountCents] of Object.entries({
      acquisition: 100000, parts: 1101, paint: 1202, electrical: 1303,
      mechanical: 1404, labor: 1505, transport: 1606, other: 1707
    })) record({ kind: "expense", category, amountCents });
    record({ kind: "sell", amountCents: 200000 });
    const before = unitDetails(db, unit);
    assert.equal(before.unit.cost_cents, 109828);
    const expenseId = before.expenses.find(cost => cost.category === "other").id;
    record({ kind: "void_expense", expenseId });
    db.close();
    db = openDatabase(filename);
    const detail = unitDetails(db, unit);
    assert.equal(detail.unit.cost_cents, 108121);
    assert.equal(detail.unit.revenue_cents, 200000);
    assert.ok(detail.expenses.find(cost => cost.id === expenseId).reversed_at);
    const finance = privateReport(db, new URLSearchParams("type=finance")).content;
    assert.match(finance, /"1081,21";"2000,00";"918,79";"45,94";"Sim"/);
    assert.equal(dashboard(db, 7).financial.gross, 91879);
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      try { unlinkSync(filename + suffix); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    rmdirSync(directory);
  }
});

test("relatórios filtram eventos após meia-noite UTC pelo dia de São Paulo", () => {
  const db = openDatabase(":memory:");
  try {
    const unit = makeUnit(db);
    const happenedAt = "2025-01-02T01:30:00.000Z";
    db.prepare("UPDATE units SET updated_at = ? WHERE id = ?").run(happenedAt, unit);
    db.prepare("UPDATE audit_events SET happened_at = ? WHERE entity_id = ?").run(happenedAt, unit);
    for (const type of ["inventory", "finance", "audit"]) {
      const report = day => privateReport(db, new URLSearchParams({ type, from: day, to: day })).content;
      assert.match(report("2025-01-01"), /2025-01-02T01:30:00/);
      assert.doesNotMatch(report("2025-01-02"), /2025-01-02T01:30:00/);
    }
  } finally {
    db.close();
  }
});
