
import { isId } from "./catalog.mjs";
import { RequestError } from "./inventory.mts";
import { dateOf } from "./stock.mjs";

function csvCell(value) {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\s\uFEFF]*[=+\-@]/.test(text) && !/^-\d+(?:,\d+)?$/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

const brl = cents => cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
const stages = { waiting: "Aguardando reforma", repair: "Em reforma", testing: "Em testes", ready: "Pronta entrega" };
const states = { free: "Livre", reserved: "Reservada", sold: "Vendida", archived: "Arquivada" };

export function privateReport(db, parameters) {
  const type = parameters.get("type");
  const product = parameters.get("product") || null;
  if (product && !isId(product)) throw new RequestError(400, "Selecione um produto válido.");
  const from = parameters.get("from") ? dateOf(parameters.get("from")) : "0000-01-01";
  const to = parameters.get("to") ? dateOf(parameters.get("to")) : "9999-12-31";
  if (from > to) throw new RequestError(400, "A data inicial precisa ser anterior à final.");

  let columns;
  let rows;
  if (type === "inventory" || type === "finance") {
    const items = db.prepare(
      "SELECT u.code, u.brand, u.model, u.technical, u.commercial, u.acquired_on, u.updated_at, p.name, v.color, "
      + "(SELECT COALESCE(SUM(amount_cents),0) FROM unit_expenses e WHERE e.unit_id=u.id AND e.reversed_at IS NULL) AS costs, "
      + "(SELECT COUNT(*) FROM unit_expenses e WHERE e.unit_id=u.id AND e.category='acquisition' AND e.reversed_at IS NULL) AS acquisitions, "
      + "(SELECT amount_cents FROM deals d WHERE d.unit_id=u.id AND d.status='sold') AS revenue "
      + "FROM units u JOIN variants v ON v.id=u.variant_id JOIN products p ON p.id=v.product_id "
      + "WHERE (? IS NULL OR p.id=?) AND substr(u.updated_at,1,10) BETWEEN ? AND ? ORDER BY p.name,u.code"
    ).all(product, product, from, to);
    columns = ["Código", "Equipamento", "Marca", "Modelo", "Cor", "Etapa", "Situação", "Aquisição", "Última atualização"];
    if (type === "finance") columns.push("Custos registrados (R$)", "Receita (R$)", "Resultado bruto estimado (R$)", "Margem estimada (%)", "Custo de aquisição registrado");
    rows = items.map(u => {
      const values = [u.code, u.name, u.brand, u.model, u.color, stages[u.technical], states[u.commercial], u.acquired_on, u.updated_at];
      if (type === "finance") values.push(brl(u.costs), brl(u.revenue), brl(u.revenue == null ? null : u.revenue - u.costs),
        u.revenue > 0 ? (100 * (u.revenue - u.costs) / u.revenue).toFixed(2).replace(".", ",") : "", u.acquisitions ? "Sim" : "Não");
      return values;
    });
  } else if (type === "sales") {
    columns = ["Data", "Equipamento", "Código da máquina", "Cor", "Condição", "Quantidade", "Receita (R$)", "Observações"];
    rows = db.prepare("SELECT d.*, p.name, u.code, v.color FROM deals d JOIN variants v ON v.id=d.variant_id JOIN products p ON p.id=v.product_id LEFT JOIN units u ON u.id=d.unit_id WHERE d.status='sold' AND (? IS NULL OR p.id=?) AND d.business_date BETWEEN ? AND ? ORDER BY d.business_date DESC")
      .all(product, product, from, to).map(d => [d.business_date, d.name, d.code, d.color, d.condition === "ready" ? "Pronta entrega" : "Sob encomenda", d.quantity, brl(d.amount_cents), d.notes]);
  } else if (type === "demands") {
    columns = ["Data", "Equipamento", "Marca e modelo", "Cor", "Quantidade", "Prioridade", "Situação", "Observações"];
    rows = db.prepare("SELECT * FROM demands WHERE (? IS NULL OR product_id=?) AND business_date BETWEEN ? AND ? ORDER BY business_date DESC")
      .all(product, product, from, to).map(d => [d.business_date, d.name, d.brand_model, d.color, d.quantity, d.priority === "high" ? "Alta" : "Normal",
        ({ open: "Aberta", checking: "Em consulta", resolved: "Atendida", closed: "Encerrada" })[d.status], d.notes]);
  } else if (type === "interest") {
    columns = ["Equipamento", "Visualizações", "Cliques no WhatsApp", "Unidades procuradas", "Unidades vendidas", "Estoque livre atual"];
    rows = db.prepare(
      "SELECT p.name, COALESCE(a.views,0) AS views, COALESCE(a.clicks,0) AS clicks, COALESCE(d.total,0) AS demands, COALESCE(s.total,0) AS sales, "
      + "(SELECT COALESCE(SUM(st.ready+st.pending),0) FROM variants v JOIN variant_stock st ON st.id=v.id WHERE v.product_id=p.id) AS stock "
      + "FROM products p LEFT JOIN (SELECT product_id, SUM(total) FILTER (WHERE event='view') AS views, "
      + "SUM(total) FILTER (WHERE event='whatsapp') AS clicks FROM analytics WHERE day BETWEEN ? AND ? GROUP BY product_id) a ON a.product_id=p.id "
      + "LEFT JOIN (SELECT product_id, SUM(quantity) AS total FROM demands WHERE business_date BETWEEN ? AND ? GROUP BY product_id) d ON d.product_id=p.id "
      + "LEFT JOIN (SELECT v.product_id, SUM(d.quantity) AS total FROM deals d JOIN variants v ON v.id=d.variant_id "
      + "WHERE d.status='sold' AND d.business_date BETWEEN ? AND ? GROUP BY v.product_id) s ON s.product_id=p.id "
      + "WHERE (? IS NULL OR p.id=?) ORDER BY demands DESC, clicks DESC, views DESC, p.name"
    ).all(from, to, from, to, from, to, product, product).map(p => [p.name, p.views, p.clicks, p.demands, p.sales, p.stock]);
  } else if (type === "audit" || type === "repairs") {
    columns = ["Data", "Responsável", "Entidade", "Identificador", "Operação", "Motivo", "Antes", "Depois"];
    rows = db.prepare(
      "WITH events AS (SELECT entity, entity_id, operation, before_json, after_json, reason, actor, happened_at FROM audit_events "
      + "UNION ALL SELECT 'legacy',variant_id,kind,json_object('ready',ready_before,'pending',pending_before),"
      + "json_object('ready',ready_after,'pending',pending_after),reason,actor,happened_at FROM movements) "
      + "SELECT e.* FROM events e LEFT JOIN units u ON e.entity='unit' AND u.id=e.entity_id "
      + "LEFT JOIN legacy_stock l ON e.entity='legacy' AND l.id=e.entity_id "
      + "LEFT JOIN variants v ON v.id=COALESCE(u.variant_id,l.variant_id,CASE WHEN e.entity IN ('variant','legacy') THEN e.entity_id END) "
      + "LEFT JOIN demands d ON e.entity='demand' AND d.id=e.entity_id "
      + "WHERE (? IS NULL OR COALESCE(v.product_id,d.product_id,CASE WHEN e.entity='product' THEN e.entity_id END)=?) "
      + "AND substr(e.happened_at,1,10) BETWEEN ? AND ? AND (?=0 OR e.operation IN ('stage','restore')) ORDER BY e.happened_at DESC"
    ).all(product, product, from, to, Number(type === "repairs"))
      .map(e => [e.happened_at, e.actor, e.entity, e.entity_id, e.operation, e.reason, e.before_json, e.after_json]);
  } else {
    throw new RequestError(400, "Selecione um relatório válido.");
  }
  return { filename: "renovapan-" + type + ".csv", content: "\uFEFF" + [columns, ...rows].map(row => row.map(csvCell).join(";")).join("\r\n") };
}
