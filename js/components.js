(function () {
  const page = document.body.dataset.page;
  const cart = window.RenovapanCart;
  const whatsappNumber = "5511952031535";

  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  const mediaPath = id => "/media/" + encodeURIComponent(id);
  const money = cents => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  function stockLabels({ ready, pending } = {}) {
    if (!ready && !pending) return '<span class="stock-badge stock-badge--out">Sem estoque</span>';
    return (ready ? '<span class="stock-badge stock-badge--ready">Pronta entrega · ' + ready + '</span>' : '')
      + (pending ? '<span class="stock-badge stock-badge--pending">Sob encomenda · ' + pending + '</span>' : '');
  }

  function formatAddLabel(qty) {
    return qty > 0 ? `✓ No carrinho (${qty}) · +1` : "Adicionar ao carrinho";
  }

  function productCard(product, reveal = false) {
    if (cart && typeof cart.registerProducts === "function") {
      cart.registerProducts([product]);
    }
    const available = product.variants?.find(variant => (variant.ready || 0) + (variant.pending || 0) > 0);
    const image = available?.images?.[0] || product.images?.[0] || product.variants?.find(variant => variant.images?.length)?.images?.[0];
    const photoKind = product.variants?.find(variant => variant.photoKinds?.[image])?.photoKinds?.[image];
    const photoLabel = { before: "Antes da reforma", after: "Depois da reforma", reference: "Foto de referência" }[photoKind];
    const photo = image
      ? '<img class="catalog-actual-image" src="' + mediaPath(image) + '" alt="' + escape(product.name) + '" loading="lazy" />'
      : '<p class="catalog-photo-empty">Fotos sob consulta</p>';

    const color = product.selectedColor || "";
    const qty = cart ? cart.getItemQuantity(product.id, color) : 0;
    const inCartClass = qty > 0 ? " is-in-cart" : "";

    return '<article class="product-card' + (reveal ? ' reveal' : '') + '" data-product-id="' + escape(product.id) + '">'
      + '<a class="product-card__main-link" href="equipamento.html?id=' + encodeURIComponent(product.id)
      + (color ? '&amp;cor=' + encodeURIComponent(color) : '') + '">'
      + '<div class="product-card__image">' + photo + (photoLabel ? '<span class="product-gallery__label">' + photoLabel + '</span>' : '') + '</div>'
      + '<div class="product-card__body"><span class="product-card__category">' + escape(product.category) + '</span>'
      + '<h3>' + escape(product.name) + '</h3><p class="catalog-card-description">' + escape(product.description) + '</p>'
      + '<div class="catalog-availability">' + stockLabels(product.stock) + '</div>'
      + '<div class="product-card__footer"><span>Ver equipamento</span><b aria-hidden="true">→</b></div></div></a>'
      + '<div class="product-card__actions">'
      + '<button class="button button--primary button--full product-card__add' + inCartClass + '" type="button" data-add-to-cart="'
      + escape(product.id) + '"' + (color ? ' data-product-color="' + escape(color) + '"' : '') + '>'
      + formatAddLabel(qty) + '</button>'
      + '</div></article>';
  }

  const links = [
    ["inicio", "index.html", "Início"],
    ["catalogo", "catalogo.html", "Equipamentos"],
    ["sobre", "sobre.html", "Sobre a RENOVAPAN"],
    ["servicos", "index.html#servicos", "Serviços"],
    ["contato", "#contato", "Contato"]
  ];

  let menuButton = null;
  let nav = null;

  function setMenuOpen(open) {
    if (!menuButton || !nav) return;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  }

  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="institutional-bar"><div class="container institutional-bar__inner"><span>Mais de 30 anos no setor</span><span>Reforma e recuperação</span><span>Comercialização de equipamentos</span><span>Atendimento em todo o Brasil</span></div></div>
        <div class="container site-header__inner">
          <a class="logo" href="index.html" aria-label="RENOVAPAN — página inicial"><img class="logo__image" src="assets/logo-renovapan-2026.png" alt="RENOVAPAN — Equipamentos Para Panificação" width="720" height="480" /></a>
          <nav class="main-nav" id="main-nav" aria-label="Navegação principal">
            ${links.map(([key, href, label]) => `<a href="${href}"${page === key ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
            <a class="button button--primary" href="orcamento.html"${page === "orcamento" ? ' aria-current="page"' : ""}>Solicitar orçamento</a>
          </nav>
          <div class="header-actions">
            <button class="cart-button" id="cart-toggle-btn" type="button" aria-label="Abrir carrinho de orçamento" aria-haspopup="dialog" aria-expanded="false" aria-controls="cart-drawer">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 10.5a1 1 0 0 0 1 .8h9.8a1 1 0 0 0 1-.8L21 7H6.2"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17.5" cy="19.5" r="1.4"/></svg>
              <span class="cart-button__label">Carrinho</span>
              <span class="cart-button__badge" id="cart-badge" hidden>0</span>
            </button>
            <button class="menu-button" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menu"><span></span><span></span><span></span></button>
          </div>
        </div>
      </header>`;

    menuButton = header.querySelector(".menu-button");
    nav = header.querySelector(".main-nav");
    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") === "true";
      setMenuOpen(!open);
    });
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="container site-footer__main">
          <div class="site-footer__brand"><a class="logo" href="index.html"><img class="logo__image" src="assets/logo-renovapan-2026.png" alt="RENOVAPAN — Equipamentos Para Panificação" width="720" height="480" /></a><p>Reforma, recuperação e comercialização de máquinas industriais para panificação.</p></div>
          <div><h3>Navegação</h3><div class="site-footer__links"><a href="index.html">Início</a><a href="catalogo.html">Equipamentos</a><a href="sobre.html">Sobre nós</a><a href="orcamento.html">Orçamento</a></div></div>
          <div class="site-footer__contact" id="contato"><h3>Contato</h3><p>Atendimento em todo o Brasil</p><div class="site-footer__links"><a href="tel:+5511952031535">(11) 95203-1535</a><a href="https://wa.me/5511952031535" target="_blank" rel="noopener noreferrer">Falar pelo WhatsApp ↗</a><a href="https://www.instagram.com/renovapan/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="https://www.facebook.com/MaquinasRenovapan/" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://www.youtube.com/channel/UCfcH87rDWBHJVYtmIADU_Zw" target="_blank" rel="noopener noreferrer">YouTube ↗</a><a href="https://linktr.ee/renovapan" target="_blank" rel="noopener noreferrer">Todos os canais ↗</a></div></div>
        </div>
        <div class="container site-footer__bottom"><p>© <span id="current-year"></span> RENOVAPAN.</p><button type="button" class="measurement-settings" data-metrics-settings>Preferências de medição</button><p>Consulte condições e disponibilidade no WhatsApp.</p></div>
      </footer>`;
    footer.querySelector("#current-year").textContent = new Date().getFullYear();
  }

  // Guard for headless / test environments without full DOM support
  if (!document || typeof document.createElement !== "function" || !document.body || typeof document.body.appendChild !== "function") {
    window.RenovapanUI = {
      escape,
      mediaPath,
      money,
      stockLabels,
      productCard
    };
    return;
  }

  // Cart drawer & toast UI
  const drawerRoot = document.createElement("div");
  drawerRoot.innerHTML = `
    <div class="cart-backdrop" id="cart-backdrop" hidden></div>
    <aside class="cart-drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" hidden tabindex="-1">
      <div class="cart-drawer__header">
        <div>
          <h2 id="cart-drawer-title">Carrinho de orçamento</h2>
          <p class="cart-drawer__count" id="cart-drawer-count">Nenhum item selecionado</p>
        </div>
        <button class="cart-drawer__close" id="cart-close-btn" type="button" aria-label="Fechar carrinho">×</button>
      </div>
      <div class="cart-drawer__body">
        <div class="cart-empty" id="cart-empty">
          <span class="cart-empty__icon" aria-hidden="true">🛒</span>
          <h3>Seu carrinho está vazio</h3>
          <p>Adicione equipamentos do catálogo para montar seu pedido e enviar direto para o nosso WhatsApp.</p>
          <a class="button button--primary" href="catalogo.html">Ver equipamentos →</a>
        </div>
        <div id="cart-content" hidden>
          <ul class="cart-items" id="cart-items"></ul>
          <form class="cart-form" id="cart-customer-form" novalidate>
            <h3>Personalizar mensagem</h3>
            <label class="cart-field">
              <span>Seu nome (opcional)</span>
              <input name="nome" type="text" maxlength="120" placeholder="Ex.: João Silva" autocomplete="name" />
            </label>
            <label class="cart-field">
              <span>Empresa / Padaria (opcional)</span>
              <input name="empresa" type="text" maxlength="120" placeholder="Ex.: Padaria Central" autocomplete="organization" />
            </label>
            <label class="cart-field">
              <span>Observação personalizada (opcional)</span>
              <textarea name="observacao" rows="2" maxlength="600" placeholder="Ex.: Prazo de entrega, voltagem, cidade..."></textarea>
            </label>
          </form>
          <details class="cart-preview">
            <summary>Ver prévia da mensagem do WhatsApp</summary>
            <pre id="cart-message-preview"></pre>
          </details>
        </div>
      </div>
      <div class="cart-drawer__footer" id="cart-drawer-footer" hidden>
        <a class="button button--whatsapp button--full" id="cart-whatsapp-link" href="#" target="_blank" rel="noopener noreferrer">Finalizar e enviar no WhatsApp ↗</a>
        <p class="cart-sent-feedback" id="cart-sent-feedback" hidden>WhatsApp aberto com seus produtos e quantidades!</p>
        <button class="cart-clear-btn" id="cart-clear-btn" type="button">Limpar carrinho</button>
      </div>
    </aside>
    <div class="cart-toast" id="cart-toast" role="status" aria-live="polite" hidden>
      <span id="cart-toast-text"></span>
      <button type="button" id="cart-toast-open">Ver carrinho</button>
    </div>`;
  document.body.appendChild(drawerRoot);

  const toggleBtn = document.getElementById("cart-toggle-btn");
  const badge = document.getElementById("cart-badge");
  const backdrop = document.getElementById("cart-backdrop");
  const drawer = document.getElementById("cart-drawer");
  const closeBtn = document.getElementById("cart-close-btn");
  const countText = document.getElementById("cart-drawer-count");
  const emptyBox = document.getElementById("cart-empty");
  const contentBox = document.getElementById("cart-content");
  const itemsList = document.getElementById("cart-items");
  const footerBox = document.getElementById("cart-drawer-footer");
  const customerForm = document.getElementById("cart-customer-form");
  const previewBox = document.getElementById("cart-message-preview");
  const whatsappLink = document.getElementById("cart-whatsapp-link");
  const clearBtn = document.getElementById("cart-clear-btn");
  const sentFeedback = document.getElementById("cart-sent-feedback");
  const toast = document.getElementById("cart-toast");
  const toastText = document.getElementById("cart-toast-text");
  const toastOpen = document.getElementById("cart-toast-open");

  let lastTrigger = null;
  let toastTimer = null;
  let pendingFocus = null;

  if (cart && customerForm) {
    const saved = cart.getCustomer();
    customerForm.elements.nome.value = saved.nome || "";
    customerForm.elements.empresa.value = saved.empresa || "";
    customerForm.elements.observacao.value = saved.observacao || "";
  }

  function syncWhatsAppLinkAndPreview() {
    if (!cart) return;
    if (whatsappLink) whatsappLink.href = cart.getWhatsAppUrl();
    if (previewBox) previewBox.textContent = cart.buildMessage();
  }

  function updateCardButtons() {
    if (!cart) return;
    document.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
      const id = btn.dataset.addToCart;
      const color = btn.dataset.productColor || "";
      const qty = cart.getItemQuantity(id, color);
      btn.classList.toggle("is-in-cart", qty > 0);
      btn.textContent = formatAddLabel(qty);
    });
  }

  function renderCart() {
    if (!cart) return;
    const cartItems = cart.getItems();
    const totalCount = cart.getTotalCount();

    if (badge) {
      badge.textContent = String(totalCount);
      badge.hidden = totalCount === 0;
    }
    if (toggleBtn) {
      toggleBtn.setAttribute(
        "aria-label",
        totalCount > 0 ? `Abrir carrinho de orçamento (${totalCount} ${totalCount === 1 ? "item" : "itens"})` : "Abrir carrinho de orçamento"
      );
    }
    if (countText) {
      if (totalCount === 0) {
        countText.textContent = "Nenhum item selecionado";
      } else {
        const unitWord = totalCount === 1 ? "unidade" : "unidades";
        const modelWord = cartItems.length === 1 ? "modelo" : "modelos";
        countText.textContent = `${totalCount} ${unitWord} (${cartItems.length} ${modelWord})`;
      }
    }

    const isEmpty = cartItems.length === 0;
    emptyBox.hidden = !isEmpty;
    contentBox.hidden = isEmpty;
    footerBox.hidden = isEmpty;
    if (isEmpty && sentFeedback) sentFeedback.hidden = true;

    if (!isEmpty) {
      itemsList.innerHTML = cartItems
        .map(({ product, quantity }) => {
          const itemKey = `${product.id}__${product.color || ""}`;
          const thumbHtml = product.image
            ? `<img class="cart-item__img" src="${mediaPath(product.image)}" alt="${escape(product.name)}" />`
            : `<span class="cart-item__placeholder" aria-hidden="true">🥖</span>`;
          const detailsList = [];
          if (product.category) detailsList.push(escape(product.category));
          if (product.color) detailsList.push(`Cor: ${escape(product.color)}`);
          if (product.code) detailsList.push(`Cód. ${escape(product.code)}`);
          const detailsStr = detailsList.join(" · ");

          return `
            <li class="cart-item" data-item-id="${escape(product.id)}" data-item-color="${escape(product.color || "")}">
              <a class="cart-item__thumb" href="equipamento.html?id=${encodeURIComponent(product.id)}" aria-label="Ver ${escape(product.name)}">
                ${thumbHtml}
              </a>
              <div class="cart-item__info">
                ${detailsStr ? `<span class="cart-item__category">${detailsStr}</span>` : ""}
                <a class="cart-item__name" href="equipamento.html?id=${encodeURIComponent(product.id)}">${escape(product.name)}</a>
                <div class="cart-item__controls">
                  <div class="qty-control qty-control--compact" role="group" aria-label="Quantidade de ${escape(product.name)}">
                    <button type="button" data-cart-action="decrease" aria-label="Diminuir quantidade de ${escape(product.name)}">−</button>
                    <span aria-live="polite">${quantity}</span>
                    <button type="button" data-cart-action="increase" aria-label="Aumentar quantidade de ${escape(product.name)}">+</button>
                  </div>
                  <button class="cart-item__remove" type="button" data-cart-action="remove" aria-label="Remover ${escape(product.name)}">Remover</button>
                </div>
              </div>
            </li>`;
        })
        .join("");
    } else {
      itemsList.innerHTML = "";
    }

    if (pendingFocus) {
      const target = pendingFocus;
      pendingFocus = null;
      const nextBtn = itemsList.querySelector(
        `[data-item-id="${CSS.escape(target.id)}"][data-item-color="${CSS.escape(target.color || "")}"] [data-cart-action="${CSS.escape(target.action)}"]`
      );
      if (nextBtn) nextBtn.focus();
      else closeBtn.focus();
    }

    syncWhatsAppLinkAndPreview();
    updateCardButtons();
  }

  function openCart(triggerElement) {
    lastTrigger = triggerElement || document.activeElement;
    setMenuOpen(false);
    hideToast();
    if (sentFeedback) sentFeedback.hidden = true;
    backdrop.hidden = false;
    drawer.hidden = false;
    requestAnimationFrame(() => {
      backdrop.classList.add("is-open");
      drawer.classList.add("is-open");
    });
    document.body.classList.add("cart-open");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
    closeBtn.focus();
  }

  function closeCart() {
    backdrop.classList.remove("is-open");
    drawer.classList.remove("is-open");
    document.body.classList.remove("cart-open");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      if (!drawer.classList.contains("is-open")) {
        backdrop.hidden = true;
        drawer.hidden = true;
      }
    }, 220);
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
  }

  function showToast(message) {
    if (!toast || !toastText) return;
    toastText.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 3600);
  }

  function hideToast() {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.classList.remove("is-visible");
    setTimeout(() => {
      if (!toast.classList.contains("is-visible")) toast.hidden = true;
    }, 200);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (drawer.classList.contains("is-open")) closeCart();
      else openCart(toggleBtn);
    });
  }
  closeBtn.addEventListener("click", closeCart);
  backdrop.addEventListener("click", closeCart);
  toastOpen.addEventListener("click", () => openCart(toggleBtn));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("is-open")) {
      closeCart();
    }
  });

  document.addEventListener("click", (event) => {
    const addBtn = event.target.closest("[data-add-to-cart]");
    if (!addBtn || !cart) return;
    const productId = addBtn.dataset.addToCart;
    const color = addBtn.dataset.productColor || "";
    if (cart.addItem(productId, 1, { color })) {
      const items = cart.getItems();
      const added = items.find((i) => i.product.id === productId);
      const name = added?.product?.name || "Equipamento";
      showToast(`${name} adicionado ao carrinho`);
    }
  });

  itemsList.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("[data-cart-action]");
    if (!actionBtn || !cart) return;
    const itemEl = actionBtn.closest("[data-item-id]");
    if (!itemEl) return;
    const productId = itemEl.dataset.itemId;
    const color = itemEl.dataset.itemColor || "";
    const action = actionBtn.dataset.cartAction;
    const currentQty = cart.getItemQuantity(productId, color);

    if (action === "increase") {
      pendingFocus = { id: productId, color, action };
      cart.setQuantity(productId, currentQty + 1, color);
    } else if (action === "decrease") {
      if (currentQty > 1) {
        pendingFocus = { id: productId, color, action };
        cart.setQuantity(productId, currentQty - 1, color);
      } else {
        pendingFocus = { id: productId, color, action: "remove" };
        cart.removeItem(productId, color);
      }
    } else if (action === "remove") {
      pendingFocus = { id: productId, color, action: "remove" };
      cart.removeItem(productId, color);
    }
  });

  customerForm.addEventListener("input", () => {
    if (!cart) return;
    cart.setCustomer({
      nome: customerForm.elements.nome.value,
      empresa: customerForm.elements.empresa.value,
      observacao: customerForm.elements.observacao.value
    });
    syncWhatsAppLinkAndPreview();
  });

  clearBtn.addEventListener("click", () => {
    cart?.clear();
  });

  whatsappLink.addEventListener("click", () => {
    if (sentFeedback) sentFeedback.hidden = false;
    window.RenovapanAPI?.track?.("whatsapp", "cart");
  });

  if (cart) {
    cart.subscribe(() => renderCart());
    renderCart();
  }

  window.RenovapanUI = {
    escape,
    mediaPath,
    money,
    stockLabels,
    productCard,
    openCart,
    closeCart,
    showToast
  };
})();
