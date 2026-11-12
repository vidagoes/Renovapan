
import { randomUUID } from "node:crypto";
import { audit, mutation } from "./audit.mjs";
import { field, isId, record } from "./catalog.mjs";
import { now } from "./db.mjs";
import { quantity, RequestError } from "./inventory.mts";
import { dateOf } from "./stock.mjs";

export function listDemands(db) {
  return db.prepare("SELECT * FROM demands ORDER BY business_date DESC, updated_at DESC").all();
}

export function saveDemand(db, actor, key, id, input) {
  const data = record(input);
  return mutation(db, key, ["demand", id], data, () => {
    const before = id ? db.prepare("SELECT * FROM demands WHERE id = ?").get(id) : null;
    if (id && !before) throw new RequestError(404, "Procura não encontrada.");
    const productId = data.productId || null;
    if (productId && (!isId(productId) || !db.prepare("SELECT 1 FROM products WHERE id = ?").get(productId))) {
      throw new RequestError(400, "Selecione um produto válido.");
    }
    if (!["normal", "high"].includes(data.priority) || !["open", "checking", "resolved", "closed"].includes(data.status)) {
      throw new RequestError(400, "Selecione prioridade e situação.");
    }
    const values = [productId, field(data.name, "máquina procurada", 140, true), field(data.brandModel, "marca e modelo", 160),
      field(data.color, "cor", 70), quantity(data.quantity, 1), dateOf(data.date), data.priority, data.status,
      field(data.notes, "observações", 1200), field(data.contact, "contato privado", 200), now()];
    const target = id || randomUUID();
    if (id) {
      db.prepare("UPDATE demands SET product_id=?, name=?, brand_model=?, color=?, quantity=?, business_date=?, priority=?, status=?, notes=?, contact=?, updated_at=? WHERE id=?").run(...values, id);
    } else {
      db.prepare("INSERT INTO demands VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(target, ...values);
    }
    audit(db, actor, "demand", target, id ? "edit" : "create", before, db.prepare("SELECT * FROM demands WHERE id = ?").get(target));
    return { id: target };
  });
}
