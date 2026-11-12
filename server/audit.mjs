
import { createHash } from "node:crypto";
import { now, transaction } from "./db.mjs";
import { RequestError } from "./inventory.mts";

export function audit(db, actor, entity, id, operation, before, after, reason = "") {
  db.prepare("INSERT INTO audit_events (entity, entity_id, operation, before_json, after_json, reason, actor, happened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(entity, id, operation, before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after), reason, actor, now());
}

export function mutation(db, key, context, input, operation) {
  if (typeof key !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(key)) {
    throw new RequestError(400, "Identificador de operação inválido.");
  }
  const fingerprint = createHash("sha256").update(JSON.stringify([context, input])).digest("hex");
  return transaction(db, () => {
    const previous = db.prepare("SELECT fingerprint, result FROM requests WHERE id = ?").get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new RequestError(409, "Identificador já usado em outra operação.");
      return JSON.parse(previous.result);
    }
    const result = operation();
    db.prepare("INSERT INTO requests VALUES (?, ?, ?)").run(key, fingerprint, JSON.stringify(result));
    return result;
  });
}

export function auditHistory(db, { page = 0, unitId = null } = {}) {
  if (unitId) return db.prepare(
    "SELECT * FROM audit_events WHERE entity = 'unit' AND entity_id = ? ORDER BY id DESC LIMIT 51 OFFSET ?"
  ).all(unitId, page * 50);
  return db.prepare(
    "SELECT entity, entity_id, operation, before_json, after_json, reason, actor, happened_at FROM ("
    + "SELECT id AS sequence, entity, entity_id, operation, before_json, after_json, reason, actor, happened_at FROM audit_events"
    + " UNION ALL SELECT rowid AS sequence, 'legacy', variant_id, kind, "
    + "json_object('ready',ready_before,'pending',pending_before), json_object('ready',ready_after,'pending',pending_after),"
    + "reason, actor, happened_at FROM movements)"
    + " ORDER BY happened_at DESC, sequence DESC LIMIT 51 OFFSET ?"
  ).all(page * 50);
}
