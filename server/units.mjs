
import { randomUUID } from "node:crypto";
import { audit, mutation } from "./audit.mjs";
import { field, isId, record, videoLink } from "./catalog.mjs";
import { now } from "./db.mjs";
import { quantity, RequestError, unitTransition } from "./inventory.mts";
import { dateOf } from "./stock.mjs";

const stages = ["waiting", "repair", "testing", "ready"];
const photoKinds = ["current", "before", "after", "reference"];
const costCategories = ["acquisition", "parts", "paint", "electrical", "mechanical", "labor", "transport", "other"];

function oneOf(value, values, message) {
  if (!values.includes(value)) throw new RequestError(400, message);
  return value;
}

function checkedPhotos(db, input) {
  if (!Array.isArray(input) || input.length > 12) throw new RequestError(400, "Informe até 12 fotos.");
  const exists = db.prepare("SELECT 1 FROM media WHERE id = ?");
  const ids = new Set();
  return input.map(photo => {
    const { id, kind, public: shown } = record(photo);
    if (!isId(id) || !exists.get(id) || ids.has(id)) throw new RequestError(400, "Foto inválida ou repetida.");
    ids.add(id);
    return { id, kind: oneOf(kind, photoKinds, "Selecione o tipo da foto."), public: shown === true };
  });
}

function unitRecord(db, id) {
  const unit = db.prepare("SELECT * FROM units WHERE id = ?").get(id);
  if (!unit) throw new RequestError(404, "Máquina não encontrada.");
  return unit;
}

function currentUnit(db, id, input) {
  const unit = unitRecord(db, id);
  if (quantity(input.revision, 1, Number.MAX_SAFE_INTEGER) !== unit.revision) {
    throw new RequestError(409, "A ficha mudou. Recarregue antes de repetir a operação.");
  }
  return unit;
}

function linkedVariant(db, id) {
  const variant = isId(id) && db.prepare("SELECT * FROM variants WHERE id = ?").get(id);
  if (!variant) throw new RequestError(400, "Selecione uma cor cadastrada.");
  return variant;
}

function activeDeal(db, unitId) {
  return db.prepare("SELECT * FROM deals WHERE unit_id = ? AND status IN ('reserved','sold')").get(unitId) || null;
}

export function listUnits(db, id = null) {
  return db.prepare(
    "SELECT u.*, v.color, p.name AS product, p.id AS product_id, "
    + "(SELECT COALESCE(SUM(amount_cents),0) FROM unit_expenses e WHERE e.unit_id = u.id AND e.reversed_at IS NULL) AS cost_cents, "
    + "(SELECT COUNT(*) FROM unit_expenses e WHERE e.unit_id = u.id AND e.reversed_at IS NULL AND e.category = 'acquisition') AS acquisition_entries, "
    + "(SELECT amount_cents FROM deals d WHERE d.unit_id = u.id AND d.status = 'sold') AS revenue_cents "
    + "FROM units u JOIN variants v ON v.id = u.variant_id JOIN products p ON p.id = v.product_id "
    + "WHERE (? IS NULL OR u.id = ?) ORDER BY u.updated_at DESC, u.code"
  ).all(id, id).map(unit => ({ ...unit, images: JSON.parse(unit.images) }));
}

export function unitDetails(db, id) {
  const unit = listUnits(db, id)[0];
  if (!unit) throw new RequestError(404, "Máquina não encontrada.");
  return {
    unit, deal: activeDeal(db, id),
    expenses: db.prepare("SELECT * FROM unit_expenses WHERE unit_id = ? ORDER BY business_date DESC, rowid DESC").all(id)
  };
}

export function legacyStock(db) {
  return db.prepare(
    "SELECT l.*, p.name AS product, v.color, d.business_date FROM legacy_stock l JOIN variants v ON v.id = l.variant_id "
    + "JOIN products p ON p.id = v.product_id LEFT JOIN deals d ON d.id = l.legacy_deal_id "
    + "WHERE l.remaining > 0 ORDER BY p.name, v.color, l.condition"
  ).all();
}

export function closeLegacy(db, actor, key, id, input) {
  return mutation(db, key, ["legacy-close", id], input, () => {
    const row = db.prepare("SELECT * FROM legacy_stock WHERE id = ? AND remaining > 0").get(id);
    if (!row || quantity(input.remaining, 1) !== row.remaining) {
      throw new RequestError(409, "O saldo legado mudou. Atualize antes de encerrar.");
    }
    const reason = field(input.reason, "motivo da divergência", 300, true);
    db.prepare("UPDATE legacy_stock SET remaining = 0 WHERE id = ?").run(id);
    audit(db, actor, "legacy", id, "reconcile_close", row, { ...row, remaining: 0 }, reason);
    return { id };
  });
}

export function saveUnit(db, actor, key, id, input) {
  const data = record(input);
  return mutation(db, key, ["unit-save", id], data, () => {
    const reason = field(data.reason, "motivo", 300, true);
    const variant = linkedVariant(db, data.variantId);
    const code = field(data.code, "código da máquina", 40, true).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_.-]*$/.test(code)) throw new RequestError(400, "Use letras, números, ponto, hífen ou sublinhado no código.");
    const existing = db.prepare("SELECT id FROM units WHERE code = ?").get(code);
    if (existing && existing.id !== id) throw new RequestError(409, "Esse código já pertence a outra máquina.");
    const values = [
      code, variant.id, field(data.brand, "marca", 100), field(data.model, "modelo", 100),
      data.acquiredOn ? dateOf(data.acquiredOn) : null,
      field(data.technicalDescription, "descrição técnica", 5000), field(data.notes, "observações", 2000),
      JSON.stringify(checkedPhotos(db, data.images)), videoLink(data.video), now()
    ];
    if (id) {
      const before = currentUnit(db, id, data);
      const oldVariant = linkedVariant(db, before.variant_id);
      if (oldVariant.product_id !== variant.product_id || (before.commercial !== "free" && before.variant_id !== variant.id)) {
        throw new RequestError(409, "Mude a cor apenas em máquinas livres do mesmo produto.");
      }
      db.prepare("UPDATE units SET code=?, variant_id=?, brand=?, model=?, acquired_on=?, technical_description=?, notes=?, images=?, video=?, updated_at=?, revision=revision+1 WHERE id=?").run(...values, id);
      audit(db, actor, "unit", id, "edit", before, unitRecord(db, id), reason);
      return { id };
    }

    if (data.confirmUnit !== true) throw new RequestError(400, "Confirme que está cadastrando uma máquina física identificada.");
    const technical = oneOf(data.technical, stages, "Selecione a etapa da máquina.");
    let legacy = null;
    if (data.legacyId) {
      legacy = db.prepare("SELECT * FROM legacy_stock WHERE id = ? AND variant_id = ? AND remaining > 0")
        .get(field(data.legacyId, "saldo legado", 64, true), variant.id);
      if (!legacy || legacy.condition !== (technical === "ready" ? "ready" : "pending")) {
        throw new RequestError(409, "A cor e a etapa precisam corresponder ao saldo legado escolhido.");
      }
    } else if (db.prepare("SELECT 1 FROM legacy_stock WHERE variant_id = ? AND remaining > 0").get(variant.id)) {
      throw new RequestError(409, "Concilie o saldo antigo desta cor antes de cadastrar uma aquisição nova.");
    }
    const newId = randomUUID();
    const commercial = legacy?.legacy_deal_id ? "reserved" : "free";
    db.prepare(
      "INSERT INTO units (id, code, variant_id, brand, model, acquired_on, technical_description, notes, images, video, updated_at, technical, commercial, revision)"
      + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)"
    ).run(newId, ...values, technical, commercial);
    if (legacy) {
      db.prepare("UPDATE legacy_stock SET remaining = remaining - 1 WHERE id = ?").run(legacy.id);
      if (legacy.legacy_deal_id) {
        const old = db.prepare("SELECT * FROM deals WHERE id = ?").get(legacy.legacy_deal_id);
        db.prepare("INSERT INTO deals VALUES (?, ?, ?, 1, 'reserved', NULL, ?, ?, ?, ?)")
          .run(randomUUID(), variant.id, legacy.condition, old.business_date, old.notes, now(), newId);
      }
      audit(db, actor, "legacy", legacy.id, "reconcile", legacy, { ...legacy, remaining: legacy.remaining - 1, unitId: newId }, reason);
    }
    audit(db, actor, "unit", newId, "create", null, { unit: unitRecord(db, newId), deal: activeDeal(db, newId) }, reason);
    return { id: newId };
  });
}

export function unitAction(db, actor, key, id, input) {
  const data = record(input);
  return mutation(db, key, ["unit-action", id], data, () => {
    const unit = currentUnit(db, id, data);
    const reason = field(data.reason, "motivo", 300, true);
    const beforeDeal = activeDeal(db, id);
    let expenseBefore = null;
    let expenseAfter = null;
    const kind = data.kind;
    let technical = unit.technical;
    let commercial = unit.commercial;
    if (kind === "stage") {
      if (!["free", "reserved"].includes(commercial)) throw new RequestError(409, "A etapa só pode mudar em máquinas livres ou reservadas.");
      technical = oneOf(data.technical, stages, "Selecione a etapa da reforma.");
    } else if (kind === "expense") {
      const category = oneOf(data.category, costCategories, "Selecione a categoria do custo.");
      const expenseId = randomUUID();
      db.prepare("INSERT INTO unit_expenses VALUES (?, ?, ?, ?, ?, ?, NULL)")
        .run(expenseId, id, category, quantity(data.amountCents, 1, 100000000000), dateOf(data.date), field(data.notes, "observações", 1200));
      expenseAfter = db.prepare("SELECT * FROM unit_expenses WHERE id = ?").get(expenseId);
    } else if (kind === "void_expense") {
      expenseBefore = isId(data.expenseId) && db.prepare("SELECT * FROM unit_expenses WHERE id = ? AND unit_id = ? AND reversed_at IS NULL").get(data.expenseId, id);
      if (!expenseBefore) throw new RequestError(409, "Esse custo já foi estornado ou não existe.");
      const reversedAt = now();
      db.prepare("UPDATE unit_expenses SET reversed_at = ? WHERE id = ?").run(reversedAt, data.expenseId);
      expenseAfter = { ...expenseBefore, reversed_at: reversedAt };
    } else {
      commercial = unitTransition(commercial, kind);
      const condition = technical === "ready" ? "ready" : "pending";
      if (kind === "reserve" || kind === "sell") {
        const amount = kind === "sell" ? quantity(data.amountCents, 0, 100000000000) : null;
        db.prepare("INSERT INTO deals VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)")
          .run(randomUUID(), unit.variant_id, condition, commercial, amount, dateOf(data.date), field(data.notes, "observações", 1200), now(), id);
      } else if (kind === "confirm") {
        db.prepare("UPDATE deals SET status = 'sold', condition = ?, amount_cents = ?, business_date = ?, notes = ? WHERE id = ?")
          .run(condition, quantity(data.amountCents, 0, 100000000000), dateOf(data.date), field(data.notes, "observações", 1200) || beforeDeal.notes, beforeDeal.id);
      } else if (kind === "cancel" || kind === "reverse_sale") {
        db.prepare("UPDATE deals SET status = 'cancelled' WHERE id = ?").run(beforeDeal.id);
      }
    }
    db.prepare("UPDATE units SET technical=?, commercial=?, updated_at=?, revision=revision+1 WHERE id=?")
      .run(technical, commercial, now(), id);
    const afterDeal = beforeDeal
      ? db.prepare("SELECT * FROM deals WHERE id = ?").get(beforeDeal.id)
      : activeDeal(db, id);
    audit(db, actor, "unit", id, kind,
      { unit, deal: beforeDeal, expense: expenseBefore },
      { unit: unitRecord(db, id), deal: afterDeal, expense: expenseAfter }, reason);
    return { id };
  });
}
