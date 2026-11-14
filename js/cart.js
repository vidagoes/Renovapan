(function () {
  const CART_KEY = "renovapan_cart_v1";
  const CUSTOMER_KEY = "renovapan_cart_customer_v1";
  const MAX_QTY = 99;
  const conditions = {
    ready: "Pronta entrega",
    pending: "Sob encomenda",
    future: "Consulta de disponibilidade futura",
    any: "A combinar"
  };
  const listeners = new Set();
  const catalog = new Map();
  let revision = 0;

  function quantity(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 ? Math.min(number, MAX_QTY) : 0;
  }

  function readStorage(storage, key, fallback) {
    try { return JSON.parse(window[storage].getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function writeStorage(storage, key, value) {
    try { window[storage].setItem(key, JSON.stringify(value)); } catch {}
  }

  function keyFor(id, { variantId, color, condition } = {}) {
    return JSON.stringify([id, variantId || "", variantId ? "" : color || "", Object.hasOwn(conditions, condition) ? condition : "any"]);
  }

  const saved = readStorage("localStorage", CART_KEY, []);
  let items = (Array.isArray(saved) ? saved : []).flatMap(entry => {
    if (typeof entry?.id !== "string" || !entry.id || !quantity(entry.quantity)) return [];
    return [{
      id: entry.id, name: typeof entry.name === "string" ? entry.name : "",
      variantId: typeof entry.variantId === "string" ? entry.variantId : "",
      color: typeof entry.color === "string" ? entry.color : "",
      condition: Object.hasOwn(conditions, entry.condition) ? entry.condition : "any",
      quantity: quantity(entry.quantity),
      snapshot: typeof entry.snapshot === "string" ? entry.snapshot : ""
    }];
  });
  let customer = {};
  setCustomer(readStorage("sessionStorage", CUSTOMER_KEY, {}));

  function registerProducts(products) {
    for (const product of products) catalog.set(product.id, product);
  }

  function lookup(entry) {
    const product = catalog.get(entry.id);
    if (!product) return { outcome: "product" };
    const variant = entry.variantId ? product.variants.find(v => v.id === entry.variantId)
      : entry.color ? product.variants.find(v => v.color === entry.color) : null;
    if ((entry.variantId || entry.color) && !variant) return { product, outcome: "color" };
    return { product, variant, stock: variant || product.stock };
  }

  function snapshot({ product, variant, stock, outcome }) {
    return outcome || JSON.stringify([product.name, product.code, product.brand, product.model, variant?.id, variant?.color, stock.ready, stock.pending]);
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  function persistItems() {
    revision++;
    writeStorage("localStorage", CART_KEY, items);
    notify();
  }

  function getItems() {
    return items.map(entry => {
      const { product, variant, stock, outcome } = lookup(entry);
      // A missing entry in an incomplete page cache is not proof of removal.
      const issue = entry.snapshot === "product" || entry.snapshot === "color"
        ? entry.snapshot : product && outcome === "color" ? outcome : "";
      const name = product?.name || entry.name || "Equipamento";
      const color = variant?.color || entry.color;
      const checked = stock && !issue && entry.snapshot === snapshot({ product, variant, stock });
      const available = checked ? (entry.condition === "ready" || entry.condition === "pending"
        ? stock[entry.condition] : stock.ready + stock.pending) : null;
      return {
        key: keyFor(entry.id, entry), quantity: entry.quantity, issue,
        product: { id: entry.id, name, color, code: product?.code, brand: product?.brand,
          model: product?.model, category: product?.category, image: variant?.images?.[0] || product?.images?.[0] },
        condition: conditions[entry.condition],
        stock: checked ? { ready: stock.ready, pending: stock.pending } : null,
        excess: available === null ? 0 : Math.max(0, entry.quantity - available)
      };
    });
  }

  function getItemQuantity(id, options) {
    return items.find(entry => keyFor(entry.id, entry) === keyFor(id, options))?.quantity || 0;
  }

  function addItem(productOrId, requested = 1, options = {}) {
    const product = typeof productOrId === "string" ? catalog.get(productOrId) : productOrId;
    const units = quantity(requested);
    if (!product?.id || !units) return false;
    registerProducts([product]);
    const variant = options.variantId ? product.variants.find(v => v.id === options.variantId)
      : options.color ? product.variants.find(v => v.color === options.color) : null;
    if ((options.variantId || options.color) && !variant) return false;
    const entry = {
      id: product.id, name: product.name, variantId: variant?.id || "", color: variant?.color || "",
      condition: Object.hasOwn(conditions, options.condition) ? options.condition : "any", quantity: units
    };
    const existing = items.find(item => keyFor(item.id, item) === keyFor(entry.id, entry));
    if (existing) existing.quantity = Math.min(MAX_QTY, existing.quantity + units);
    else {
      entry.snapshot = snapshot({ product, variant, stock: variant || product.stock });
      items.push(entry);
    }
    persistItems();
    return true;
  }

  function setQuantity(key, requested) {
    const entry = items.find(item => keyFor(item.id, item) === key);
    if (!entry) return;
    const units = quantity(requested);
    if (units) entry.quantity = units;
    else items = items.filter(item => item !== entry);
    persistItems();
  }

  async function revalidate() {
    const sequence = revision;
    const { products } = await window.RenovapanAPI.get("/api/catalog", { cache: "no-store" });
    if (!Array.isArray(products)) throw new Error("Catálogo indisponível.");
    if (revision !== sequence) return { changed: true, blocked: false };
    catalog.clear();
    registerProducts(products);
    let changed = false;
    let blocked = false;
    const reconciled = new Map();
    for (const entry of items) {
      const found = lookup(entry);
      const current = snapshot(found);
      changed ||= current !== entry.snapshot;
      blocked ||= Boolean(found.outcome);
      entry.snapshot = current;
      if (found.product) entry.name = found.product.name;
      if (found.variant) {
        entry.variantId = found.variant.id;
        entry.color = found.variant.color;
      }
      const key = keyFor(entry.id, entry);
      if (reconciled.has(key)) {
        const previous = reconciled.get(key);
        previous.quantity = Math.min(MAX_QTY, previous.quantity + entry.quantity);
        changed = true;
      } else reconciled.set(key, entry);
    }
    items = [...reconciled.values()];
    persistItems();
    return { changed, blocked };
  }

  function setCustomer(next) {
    customer = {
      nome: String(next?.nome ?? customer.nome ?? "").slice(0, 120),
      empresa: String(next?.empresa ?? customer.empresa ?? "").slice(0, 120),
      observacao: String(next?.observacao ?? customer.observacao ?? "").slice(0, 600)
    };
    writeStorage("sessionStorage", CUSTOMER_KEY, customer);
  }

  function stockDescription(stock) {
    const counts = "Pronta entrega: " + stock.ready + " · Sob encomenda: " + stock.pending;
    return stock.ready + stock.pending === 0 ? "Sem estoque · " + counts : counts;
  }

  function buildMessage() {
    const valid = getItems().filter(item => !item.issue && item.stock);
    if (!valid.length) return "";
    const lines = [
      customer.nome.trim() ? "Olá, equipe RENOVAPAN! Meu nome é " + customer.nome.trim() + "." : "Olá, equipe RENOVAPAN!",
      "", "Gostaria de solicitar uma cotação.", "", "*Equipamentos de interesse:*"
    ];
    for (const { product, quantity: units, condition, stock, excess } of valid) {
      const title = [product.name, product.brand, product.model].filter(Boolean).join(" · ");
      lines.push("• " + title + " · Cód. " + product.code,
        "Cor: " + (product.color || "A definir") + " | Condição: " + condition + " | Quantidade desejada: " + units,
        "Disponibilidade atual — " + stockDescription(stock));
      if (stock.ready + stock.pending === 0) lines.push("Gostaria de consultar uma possível aquisição e reforma futura.");
      else if (excess) lines.push(excess + " unidade(s) acima do saldo da condição desejada, sujeitas a confirmação comercial e possível aquisição/reforma futura.");
    }
    if (customer.empresa.trim()) lines.push("", "Empresa: " + customer.empresa.trim());
    if (customer.observacao.trim()) lines.push("", "Observação: " + customer.observacao.trim());
    lines.push("", "Disponibilidade, valores e prazos sujeitos a confirmação.");
    return lines.join("\n");
  }

  async function prepareQuote() {
    const validation = await revalidate();
    if (validation.blocked || validation.changed || !items.length) return validation;
    const message = buildMessage();
    if (!message) return { blocked: true };
    return { url: "https://wa.me/5511952031535?text=" + encodeURIComponent(message),
      productCount: new Set(items.map(item => item.id)).size };
  }

  window.RenovapanCart = {
    registerProducts, getItems, getItemQuantity, addItem, setQuantity, revalidate, prepareQuote,
    getTotalCount: () => items.reduce((sum, item) => sum + item.quantity, 0),
    clear() { items = []; persistItems(); },
    getCustomer: () => ({ ...customer }), setCustomer, buildMessage, stockDescription,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
})();
