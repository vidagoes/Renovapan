
import { businessDay } from "./stock.mjs";

export function rateLimit() {
  const windows = new Map();
  return (key, limit, duration) => {
    const time = Date.now();
    let entry = windows.get(key);
    if (!entry || entry.until <= time) {
      if (windows.size >= 5000) {
        for (const [name, item] of windows) if (item.until <= time) windows.delete(name);
        if (windows.size >= 5000 && !windows.has(key)) return false;
      }
      entry = { count: 0, until: time + duration };
      windows.set(key, entry);
    }
    if (entry.count >= limit) return false;
    entry.count += 1;
    return true;
  };
}

export function track(db, event, productId, productCount) {
  if (event === "quote" && !productId) {
    if (!Number.isInteger(productCount) || productCount < 1 || productCount > 10000) return;
    db.prepare("INSERT INTO quote_analytics VALUES (?, 1, ?) ON CONFLICT(day) DO UPDATE SET clicks = clicks + 1, products = products + excluded.products")
      .run(businessDay(), productCount);
    return;
  }
  if (!["view", "whatsapp", "visit"].includes(event) || (event === "visit" && productId)) return;
  if (productId && !db.prepare("SELECT 1 FROM products WHERE id = ? AND visibility = 'published'").get(productId)) return;
  db.prepare("INSERT INTO analytics VALUES (?, ?, ?, 1) ON CONFLICT DO UPDATE SET total = total + 1")
    .run(businessDay(), event, productId || "");
}

export function dashboard(db, days) {
  const today = new Date(businessDay() + "T12:00:00Z");
  const dates = Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (days - 1 - i));
    return date.toISOString().slice(0, 10);
  });
  const from = dates[0];
  const latest = dates.at(-1);
  const totals = db.prepare("SELECT day, event, SUM(total) AS total FROM analytics WHERE day BETWEEN ? AND ? GROUP BY day, event").all(from, latest);
  const byDay = new Map(totals.map(row => [row.day + ":" + row.event, row.total]));
  const productClicks = new Map(db.prepare("SELECT day, SUM(total) AS total FROM analytics WHERE event = 'whatsapp' AND product_id <> '' AND day BETWEEN ? AND ? GROUP BY day")
    .all(from, latest).map(row => [row.day, row.total]));
  const quoteClicks = new Map(db.prepare("SELECT * FROM quote_analytics WHERE day BETWEEN ? AND ?")
    .all(from, latest).map(row => [row.day, row]));
  const salesRows = db.prepare("SELECT business_date, COUNT(*) AS sales, COALESCE(SUM(amount_cents), 0) AS amount FROM deals WHERE status='sold' AND business_date BETWEEN ? AND ? GROUP BY business_date").all(from, latest);
  const salesByDay = new Map(salesRows.map(row => [row.business_date, row]));
  const costsByDay = new Map(db.prepare("SELECT business_date, SUM(amount_cents) AS total FROM unit_expenses WHERE reversed_at IS NULL AND business_date BETWEEN ? AND ? GROUP BY business_date")
    .all(from, latest).map(row => [row.business_date, row.total]));
  const demandByDay = new Map(db.prepare("SELECT business_date, COUNT(*) AS total FROM demands WHERE business_date BETWEEN ? AND ? GROUP BY business_date")
    .all(from, latest).map(row => [row.business_date, row.total]));
  const series = dates.map(day => ({
    day, visits: byDay.get(day + ":visit") || 0, views: byDay.get(day + ":view") || 0, clicks: byDay.get(day + ":whatsapp") || 0,
    productClicks: productClicks.get(day) || 0, quoteClicks: quoteClicks.get(day)?.clicks || 0,
    quoteProducts: quoteClicks.get(day)?.products || 0,
    sales: salesByDay.get(day)?.sales || 0, amountCents: salesByDay.get(day)?.amount || 0,
    costsCents: costsByDay.get(day) || 0, demands: demandByDay.get(day) || 0
  }));
  const rank = db.prepare(
    "SELECT p.id, p.name, SUM(a.total) AS total FROM analytics a JOIN products p ON p.id = a.product_id "
    + "WHERE a.event = ? AND a.day BETWEEN ? AND ? GROUP BY p.id ORDER BY total DESC, p.name LIMIT 5"
  );
  const financial = db.prepare(
    "SELECT COALESCE(SUM(d.amount_cents - COALESCE(e.cost,0)),0) AS gross, "
    + "COUNT(*) FILTER (WHERE d.unit_id IS NULL OR COALESCE(e.acquisition,0) = 0) AS incomplete "
    + "FROM deals d LEFT JOIN (SELECT unit_id, SUM(amount_cents) AS cost, "
    + "COUNT(*) FILTER (WHERE category = 'acquisition') AS acquisition FROM unit_expenses WHERE reversed_at IS NULL GROUP BY unit_id) e ON e.unit_id = d.unit_id "
    + "WHERE d.status = 'sold' AND d.business_date BETWEEN ? AND ?"
  ).get(from, latest);
  return {
    series,
    totals: series.reduce((acc, row) => ({
      visits: acc.visits + row.visits, views: acc.views + row.views, clicks: acc.clicks + row.clicks,
      productClicks: acc.productClicks + row.productClicks, quoteClicks: acc.quoteClicks + row.quoteClicks,
      quoteProducts: acc.quoteProducts + row.quoteProducts,
      sales: acc.sales + row.sales, amountCents: acc.amountCents + row.amountCents,
      costsCents: acc.costsCents + row.costsCents, demands: acc.demands + row.demands
    }), { visits: 0, views: 0, clicks: 0, productClicks: 0, quoteClicks: 0, quoteProducts: 0, sales: 0, amountCents: 0, costsCents: 0, demands: 0 }),
    financial,
    products: db.prepare("SELECT COUNT(*) AS total FROM products").get().total,
    inventory: db.prepare("SELECT COALESCE(SUM(ready), 0) AS ready, COALESCE(SUM(pending), 0) AS pending FROM variant_stock").get(),
    stages: db.prepare("SELECT technical, COUNT(*) AS total FROM units WHERE commercial IN ('free','reserved') GROUP BY technical").all(),
    soldOut: db.prepare("SELECT COUNT(*) AS total FROM products p WHERE p.visibility = 'published' AND NOT EXISTS (SELECT 1 FROM variants v JOIN variant_stock s ON s.id = v.id WHERE v.product_id = p.id AND s.ready + s.pending > 0)").get().total,
    mostViewed: rank.all("view", from, latest),
    mostClicked: rank.all("whatsapp", from, latest),
    mostDemanded: db.prepare("SELECT COALESCE(p.name, d.name) AS name, SUM(d.quantity) AS total FROM demands d LEFT JOIN products p ON p.id = d.product_id WHERE d.business_date BETWEEN ? AND ? GROUP BY d.product_id, CASE WHEN d.product_id IS NULL THEN lower(d.name) END ORDER BY total DESC, name LIMIT 5").all(from, latest),
    mostSold: db.prepare("SELECT p.id, p.name, SUM(d.quantity) AS total FROM deals d JOIN variants v ON v.id=d.variant_id JOIN products p ON p.id=v.product_id WHERE d.status='sold' AND d.business_date BETWEEN ? AND ? GROUP BY p.id ORDER BY total DESC, p.name LIMIT 5").all(from, latest),
    outOfStockInterest: db.prepare("SELECT p.id, p.name, SUM(a.total) AS total FROM analytics a JOIN products p ON p.id=a.product_id WHERE a.event='whatsapp' AND a.day BETWEEN ? AND ? AND p.visibility='published' AND NOT EXISTS (SELECT 1 FROM variants v JOIN variant_stock s ON s.id=v.id WHERE v.product_id=p.id AND s.ready+s.pending>0) GROUP BY p.id ORDER BY total DESC, p.name LIMIT 5").all(from, latest)
  };
}
