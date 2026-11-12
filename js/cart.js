(function () {
  const CART_KEY = "renovapan_cart_v1";
  const CUSTOMER_KEY = "renovapan_cart_customer_v1";
  const MAX_QTY = 99;
  const listeners = new Set();

  function getProducts() {
    return (window.RENOVAPAN_DATA && window.RENOVAPAN_DATA.products) || [];
  }

  function findProduct(productId) {
    return getProducts().find((item) => item.id === productId) || null;
  }

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

  let items = readStorage(window.localStorage, CART_KEY, []);
  if (!Array.isArray(items)) items = [];
  items = items
    .map((entry) => ({
      id: typeof entry?.id === "string" ? entry.id : "",
      quantity: sanitizeQuantity(entry?.quantity)
    }))
    .filter((entry) => entry.quantity > 0 && findProduct(entry.id));

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
    return items
      .map((entry) => {
        const product = findProduct(entry.id);
        return product ? { product, quantity: entry.quantity } : null;
      })
      .filter(Boolean);
  }

  function getItemQuantity(productId) {
    return items.find((entry) => entry.id === productId)?.quantity || 0;
  }

  function getTotalCount() {
    return items.reduce((sum, entry) => sum + entry.quantity, 0);
  }

  function addItem(productId, quantity = 1) {
    if (!findProduct(productId)) return false;
    const qtyToAdd = sanitizeQuantity(quantity);
    if (qtyToAdd <= 0) return false;

    const existing = items.find((entry) => entry.id === productId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + qtyToAdd, MAX_QTY);
    } else {
      items.push({ id: productId, quantity: qtyToAdd });
    }
    persistItems();
    return true;
  }

  function setQuantity(productId, quantity) {
    const nextQty = sanitizeQuantity(quantity);
    if (nextQty <= 0) {
      removeItem(productId);
      return;
    }
    if (!findProduct(productId)) return;

    const existing = items.find((entry) => entry.id === productId);
    if (existing) {
      existing.quantity = nextQty;
    } else {
      items.push({ id: productId, quantity: nextQty });
    }
    persistItems();
  }

  function removeItem(productId) {
    const next = items.filter((entry) => entry.id !== productId);
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
      lines.push(`• ${quantity}x ${product.name} (${product.category})`);
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
