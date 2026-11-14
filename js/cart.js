(function () {
  const CART_KEY = "renovapan_cart_v1";
  const CUSTOMER_KEY = "renovapan_cart_customer_v1";
  const MAX_QTY = 99;
  const listeners = new Set();
  const catalogRegistry = new Map();

  function sanitizeQuantity(value) {
    const num = Number.parseInt(value, 10);
    if (!Number.isFinite(num) || num < 1) return 0;
    return Math.min(num, MAX_QTY);
  }

  function readStorage(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota or privacy mode errors; in-memory state continues to work.
    }
  }

  function registerProducts(products) {
    if (!Array.isArray(products)) return;
    for (const product of products) {
      if (product && product.id) {
        catalogRegistry.set(product.id, product);
      }
    }
  }

  function findProduct(productId) {
    if (!productId) return null;
    if (catalogRegistry.has(productId)) return catalogRegistry.get(productId);
    if (window.RENOVAPAN_DATA && Array.isArray(window.RENOVAPAN_DATA.products)) {
      const found = window.RENOVAPAN_DATA.products.find((p) => p.id === productId);
      if (found) return found;
    }
    return null;
  }

  let items = readStorage(window.localStorage, CART_KEY, []);
  if (!Array.isArray(items)) items = [];
  items = items
    .map((entry) => {
      const id = typeof entry?.id === "string" ? entry.id : "";
      const quantity = sanitizeQuantity(entry?.quantity);
      if (!id || quantity <= 0) return null;
      return {
        id,
        name: typeof entry.name === "string" ? entry.name : "",
        category: typeof entry.category === "string" ? entry.category : "",
        brand: typeof entry.brand === "string" ? entry.brand : "",
        model: typeof entry.model === "string" ? entry.model : "",
        code: typeof entry.code === "string" ? entry.code : "",
        color: typeof entry.color === "string" ? entry.color : "",
        image: typeof entry.image === "string" ? entry.image : "",
        priceCents: typeof entry.priceCents === "number" ? entry.priceCents : null,
        quantity
      };
    })
    .filter(Boolean);

  let customer = readStorage(window.sessionStorage, CUSTOMER_KEY, {});
  if (!customer || typeof customer !== "object") customer = {};
  customer = {
    nome: typeof customer.nome === "string" ? customer.nome : "",
    empresa: typeof customer.empresa === "string" ? customer.empresa : "",
    observacao: typeof customer.observacao === "string" ? customer.observacao : ""
  };

  function notify() {
    const snapshot = getItems();
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // Keep other subscribers updating cleanly.
      }
    });
    document.dispatchEvent(new CustomEvent("renovapan:cart-change", { detail: { items: snapshot } }));
  }

  function persistItems() {
    writeStorage(window.localStorage, CART_KEY, items);
    notify();
  }

  function getItems() {
    return items.map((entry) => {
      const fromRegistry = findProduct(entry.id);
      const product = {
        id: entry.id,
        name: entry.name || fromRegistry?.name || entry.id,
        shortName: fromRegistry?.shortName || entry.name || entry.id,
        category: entry.category || fromRegistry?.category || "",
        brand: entry.brand || fromRegistry?.brand || "",
        model: entry.model || fromRegistry?.model || "",
        code: entry.code || fromRegistry?.code || "",
        color: entry.color || "",
        image: entry.image || fromRegistry?.images?.[0] || fromRegistry?.variants?.[0]?.images?.[0] || "",
        priceCents: entry.priceCents ?? fromRegistry?.publicPriceCents ?? null
      };
      return { product, quantity: entry.quantity };
    });
  }

  function getItemQuantity(productId, color = "") {
    const entry = items.find((e) => e.id === productId && (!color || e.color === color));
    return entry ? entry.quantity : 0;
  }

  function getTotalCount() {
    return items.reduce((sum, entry) => sum + entry.quantity, 0);
  }

  function addItem(productOrId, quantity = 1, options = {}) {
    const qtyToAdd = sanitizeQuantity(quantity);
    if (qtyToAdd <= 0) return false;

    let id = "";
    let name = "";
    let category = "";
    let brand = "";
    let model = "";
    let code = "";
    let color = options.color || "";
    let image = options.image || "";
    let priceCents = null;

    if (typeof productOrId === "object" && productOrId !== null) {
      id = productOrId.id || "";
      name = productOrId.name || "";
      category = productOrId.category || "";
      brand = productOrId.brand || "";
      model = productOrId.model || "";
      code = productOrId.code || "";
      color = color || productOrId.selectedColor || "";
      image = image || productOrId.images?.[0] || productOrId.variants?.[0]?.images?.[0] || "";
      priceCents = productOrId.publicPriceCents ?? productOrId.priceCents ?? null;
      catalogRegistry.set(id, productOrId);
    } else if (typeof productOrId === "string") {
      id = productOrId;
      const found = findProduct(id);
      if (!found) return false;
      name = found.name || "";
      category = found.category || "";
      brand = found.brand || "";
      model = found.model || "";
      code = found.code || "";
      color = color || found.selectedColor || "";
      image = image || found.images?.[0] || found.variants?.[0]?.images?.[0] || "";
      priceCents = found.publicPriceCents ?? found.priceCents ?? null;
    }

    if (!id) return false;

    const existing = items.find((entry) => entry.id === id && (!color || entry.color === color));
    if (existing) {
      existing.quantity = Math.min(existing.quantity + qtyToAdd, MAX_QTY);
      if (name && !existing.name) existing.name = name;
      if (category && !existing.category) existing.category = category;
      if (code && !existing.code) existing.code = code;
      if (color && !existing.color) existing.color = color;
      if (image && !existing.image) existing.image = image;
    } else {
      items.push({
        id,
        name,
        category,
        brand,
        model,
        code,
        color,
        image,
        priceCents,
        quantity: qtyToAdd
      });
    }
    persistItems();
    return true;
  }

  function setQuantity(productId, quantity, color = "") {
    const nextQty = sanitizeQuantity(quantity);
    if (nextQty <= 0) {
      removeItem(productId, color);
      return;
    }
    const existing = items.find((entry) => entry.id === productId && (!color || entry.color === color));
    if (existing) {
      existing.quantity = nextQty;
      persistItems();
    }
  }

  function removeItem(productId, color = "") {
    const next = items.filter((entry) => !(entry.id === productId && (!color || entry.color === color)));
    if (next.length === items.length) return;
    items = next;
    persistItems();
  }

  function clear() {
    if (items.length === 0) return;
    items = [];
    persistItems();
  }

  function getCustomer() {
    return { ...customer };
  }

  function setCustomer(next) {
    customer = {
      nome: String(next?.nome ?? customer.nome).slice(0, 120),
      empresa: String(next?.empresa ?? customer.empresa).slice(0, 120),
      observacao: String(next?.observacao ?? customer.observacao).slice(0, 600)
    };
    writeStorage(window.sessionStorage, CUSTOMER_KEY, customer);
  }

  function buildMessage(customOverride) {
    const cartItems = getItems();
    const info = customOverride ? { ...customer, ...customOverride } : customer;
    const nome = (info.nome || "").trim();
    const empresa = (info.empresa || "").trim();
    const observacao = (info.observacao || "").trim();

    if (cartItems.length === 0) {
      return "Olá, equipe RENOVAPAN! Gostaria de solicitar mais informações sobre os equipamentos.";
    }

    const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const modelLabel = cartItems.length === 1 ? "modelo" : "modelos";
    const unitLabel = totalUnits === 1 ? "unidade" : "unidades";

    const lines = [
      nome ? `Olá, equipe RENOVAPAN! Meu nome é *${nome}*.` : "Olá, equipe RENOVAPAN!",
      "",
      "Gostaria de solicitar um orçamento para os seguintes equipamentos selecionados no site:",
      "",
      "*Itens do pedido:*"
    ];

    cartItems.forEach(({ product, quantity }) => {
      const details = [];
      if (product.category) details.push(product.category);
      if (product.color) details.push(`Cor: ${product.color}`);
      const detailStr = details.length ? ` (${details.join(" · ")})` : "";
      const codeStr = product.code ? ` - Cód. ${product.code}` : "";
      lines.push(`• ${quantity}x ${product.name}${detailStr}${codeStr}`);
    });

    lines.push("", `*Resumo:* ${totalUnits} ${unitLabel} (${cartItems.length} ${modelLabel})`);

    if (empresa || observacao) {
      lines.push("", "*Informações adicionais:*");
      if (empresa) lines.push(`• Empresa: ${empresa}`);
      if (observacao) lines.push(`• Observação: ${observacao}`);
    }

    lines.push("", "Aguardo o retorno sobre disponibilidade, prazos e condições!");
    return lines.join("\n");
  }

  function getWhatsAppNumber() {
    const raw = (window.RENOVAPAN_DATA && window.RENOVAPAN_DATA.whatsappNumber) || "5511952031535";
    return String(raw).replace(/\D/g, "");
  }

  function getWhatsAppUrl(customOverride) {
    const number = getWhatsAppNumber();
    const message = buildMessage(customOverride);
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function subscribe(listener) {
    if (typeof listener === "function") listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.RenovapanCart = {
    registerProducts,
    getItems,
    getItemQuantity,
    getTotalCount,
    addItem,
    setQuantity,
    removeItem,
    clear,
    getCustomer,
    setCustomer,
    buildMessage,
    getWhatsAppUrl,
    subscribe
  };
})();
