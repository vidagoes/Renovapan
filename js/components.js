(function () {
  const page = document.body.dataset.page;
  const cart = window.RenovapanCart;
  const whatsappNumber = ((window.RENOVAPAN_DATA && window.RENOVAPAN_DATA.whatsappNumber) || "5511952031535").replace(/\D/g, "");

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function machineSvg(product) {
    const accent = product.accent || "#DB1A22";
    const common = `
      <defs>
        <linearGradient id="metal-${product.id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff"/><stop offset=".48" stop-color="#d8dfe2"/><stop offset="1" stop-color="#87949c"/>
        </linearGradient>
      </defs>`;

    const shapes = {
      mixer: `<ellipse cx="150" cy="204" rx="92" ry="14" fill="#0c1720" opacity=".18"/><path d="M88 55h124a18 18 0 0 1 18 18v44H70V73a18 18 0 0 1 18-18z" fill="url(#metal-${product.id})"/><rect x="88" y="69" width="59" height="30" rx="6" fill="#263640"/><circle cx="101" cy="84" r="5" fill="${accent}"/><path d="M85 116h130l-15 72H100z" fill="url(#metal-${product.id})"/><path d="M77 125h146l-14 40c-6 17-22 29-40 29h-38c-18 0-34-12-40-29z" fill="url(#metal-${product.id})"/><ellipse cx="150" cy="126" rx="64" ry="12" fill="#63717a"/><path d="M145 93v47c0 8 6 14 14 14h8" fill="none" stroke="#697780" stroke-width="11" stroke-linecap="round"/><path d="M103 189v18m92-18v18" stroke="#293942" stroke-width="11"/><circle cx="103" cy="208" r="8" fill="#17242c"/><circle cx="195" cy="208" r="8" fill="#17242c"/>`,
      beater: `<ellipse cx="150" cy="210" rx="79" ry="13" fill="#0c1720" opacity=".18"/><path d="M105 40h91a20 20 0 0 1 20 20v41H91V54a14 14 0 0 1 14-14z" fill="url(#metal-${product.id})"/><rect x="111" y="57" width="48" height="27" rx="5" fill="#273741"/><circle cx="126" cy="70" r="5" fill="${accent}"/><path d="M107 100h90v35h-90z" fill="#cbd4d8"/><path d="M143 113v44" stroke="#56656e" stroke-width="8"/><path d="M118 151h67l-8 38h-50z" fill="url(#metal-${product.id})"/><ellipse cx="151" cy="151" rx="37" ry="8" fill="#69767e"/><path d="M91 98h18v108H91zm107 0h18v108h-18z" fill="url(#metal-${product.id})"/><path d="M83 206h142" stroke="#263640" stroke-width="12" stroke-linecap="round"/><circle cx="103" cy="211" r="8" fill="#17242c"/><circle cx="204" cy="211" r="8" fill="#17242c"/>`,
      roller: `<ellipse cx="151" cy="211" rx="103" ry="14" fill="#0c1720" opacity=".18"/><path d="M58 70h184v45H58z" fill="url(#metal-${product.id})"/><path d="M73 115h154v67H73z" fill="#c9d2d6"/><rect x="85" y="127" width="130" height="20" rx="8" fill="#64727a"/><rect x="94" y="148" width="112" height="17" rx="7" fill="#7c8990"/><path d="M74 181h35v28H68zm117 0h35l6 28h-41z" fill="#263640"/><path d="M45 59h210v20H45z" fill="${accent}"/><path d="M76 46h148v13H76z" fill="#283942"/><circle cx="211" cy="69" r="6" fill="#ef4444"/><circle cx="82" cy="211" r="8" fill="#17242c"/><circle cx="216" cy="211" r="8" fill="#17242c"/>`,
      cylinder: `<ellipse cx="150" cy="208" rx="96" ry="13" fill="#0c1720" opacity=".18"/><path d="M69 57h162v134H69z" fill="url(#metal-${product.id})"/><path d="M54 48h192v22H54z" fill="${accent}"/><rect x="84" y="83" width="132" height="25" rx="10" fill="#65737b"/><rect x="84" y="113" width="132" height="25" rx="10" fill="#7d898f"/><path d="M93 145h114l17 31H76z" fill="#c0c9cd"/><rect x="85" y="176" width="24" height="31" fill="#263640"/><rect x="191" y="176" width="24" height="31" fill="#263640"/><circle cx="97" cy="209" r="8" fill="#17242c"/><circle cx="203" cy="209" r="8" fill="#17242c"/><circle cx="212" cy="60" r="6" fill="#ef4444"/>`,
      divider: `<ellipse cx="150" cy="211" rx="87" ry="13" fill="#0c1720" opacity=".18"/><path d="M89 42h122v53H89z" fill="url(#metal-${product.id})"/><path d="M74 95h152v92H74z" fill="#cbd4d8"/><path d="M105 28h90l16 14H89z" fill="${accent}"/><path d="M110 108h80v47h-80z" fill="#263640"/><path d="M121 118h58M121 130h58M121 142h58" stroke="#9aa5aa" stroke-width="4"/><path d="M84 187h28v21H80zm104 0h28l4 21h-32z" fill="#263640"/><circle cx="99" cy="210" r="8" fill="#17242c"/><circle cx="205" cy="210" r="8" fill="#17242c"/><circle cx="199" cy="71" r="7" fill="#ef4444"/>`,
      tilter: `<ellipse cx="151" cy="210" rx="91" ry="13" fill="#0c1720" opacity=".18"/><path d="M78 64h144l-18 121H96z" fill="url(#metal-${product.id})"/><path d="M62 92h176l-16 54c-6 21-25 35-47 35h-50c-22 0-41-14-47-35z" fill="url(#metal-${product.id})"/><ellipse cx="150" cy="93" rx="80" ry="14" fill="#67747c"/><path d="M92 56h116l-4-22H96z" fill="${accent}"/><rect x="109" y="39" width="50" height="18" rx="4" fill="#263640"/><path d="M104 181v26m91-26v26" stroke="#263640" stroke-width="12"/><circle cx="104" cy="209" r="8" fill="#17242c"/><circle cx="195" cy="209" r="8" fill="#17242c"/>`
    };

    return `<svg class="product-card__machine" viewBox="0 0 300 240" role="img" aria-label="Ilustração demonstrativa de ${escapeHtml(product.name)}">${common}${shapes[product.type] || shapes.mixer}</svg>`;
  }

  function machineVisual(product) {
    const images = { mixer: 'masseira', beater: 'batedeira', divider: 'divisora', cylinder: 'cilindro', roller: 'modeladora' };
    const image = images[product.type];
    return image ? `<img class="product-card__machine product-photo" src="assets/referencia-${image}.png" alt="Imagem ilustrativa de ${escapeHtml(product.category.toLowerCase())}" width="190" height="111" loading="lazy" />` : machineSvg(product);
  }

  function formatAddLabel(qty) {
    return qty > 0 ? `✓ No carrinho (${qty}) · +1` : "Adicionar ao carrinho";
  }

  function productCard(product, reveal = false) {
    const qty = cart ? cart.getItemQuantity(product.id) : 0;
    const inCartClass = qty > 0 ? " is-in-cart" : "";
    return `
      <article class="product-card${reveal ? " reveal" : ""}" data-product-id="${escapeHtml(product.id)}">
        <a class="product-card__main-link" href="equipamento.html?id=${encodeURIComponent(product.id)}">
          <div class="product-card__image">
            <span class="product-card__tag">Demonstração</span><span class="product-card__status" title="Disponibilidade demonstrativa"></span>
            ${machineVisual(product)}
          </div>
          <div class="product-card__body">
            <span class="product-card__category">${escapeHtml(product.category)}</span>
            <h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.description)}</p>
            <div class="product-card__footer"><span>Ver equipamento</span><b aria-hidden="true">→</b></div>
          </div>
        </a>
        <div class="product-card__actions">
          <button class="button button--primary button--full product-card__add${inCartClass}" type="button" data-add-to-cart="${escapeHtml(product.id)}">${formatAddLabel(qty)}</button>
        </div>
      </article>`;
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
          <a class="logo" href="index.html" aria-label="RENOVAPAN — página inicial"><img class="logo__image" src="assets/logo-renovapan-oficial.png" alt="RENOVAPAN — Equipamentos Para Panificação" width="264" height="146" /></a>
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
          <div class="site-footer__brand"><a class="logo" href="index.html"><img class="logo__image" src="assets/logo-renovapan-oficial.png" alt="RENOVAPAN — Equipamentos Para Panificação" width="264" height="146" /></a><p>Reforma, recuperação e comercialização de máquinas industriais para panificação.</p></div>
          <div><h3>Navegação</h3><div class="site-footer__links"><a href="index.html">Início</a><a href="catalogo.html">Equipamentos</a><a href="sobre.html">Sobre nós</a><a href="orcamento.html">Orçamento</a></div></div>
          <div class="site-footer__contact" id="contato"><h3>Contato</h3><p>Atendimento em todo o Brasil</p><div class="site-footer__links"><a href="tel:+${whatsappNumber}">(11) 95203-1535</a><a href="https://wa.me/${whatsappNumber}" target="_blank" rel="noopener noreferrer">Falar pelo WhatsApp ↗</a><a href="https://www.instagram.com/renovapan/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="https://www.facebook.com/MaquinasRenovapan/" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://www.youtube.com/channel/UCfcH87rDWBHJVYtmIADU_Zw" target="_blank" rel="noopener noreferrer">YouTube ↗</a><a href="https://linktr.ee/renovapan" target="_blank" rel="noopener noreferrer">Todos os canais ↗</a></div></div>
        </div>
        <div class="container site-footer__bottom"><p>© <span id="current-year"></span> RENOVAPAN. MVP demonstrativo.</p><p>Conteúdo, imagens e disponibilidade sujeitos à validação.</p></div>
      </footer>`;
    footer.querySelector("#current-year").textContent = new Date().getFullYear();
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
    customerForm.elements.nome.value = saved.nome;
    customerForm.elements.empresa.value = saved.empresa;
    customerForm.elements.observacao.value = saved.observacao;
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
      const qty = cart.getItemQuantity(id);
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
        .map(
          ({ product, quantity }) => `
            <li class="cart-item" data-item-id="${escapeHtml(product.id)}">
              <a class="cart-item__thumb" href="equipamento.html?id=${encodeURIComponent(product.id)}" aria-label="Ver ${escapeHtml(product.name)}">
                ${machineVisual(product)}
              </a>
              <div class="cart-item__info">
                <span class="cart-item__category">${escapeHtml(product.category)}</span>
                <a class="cart-item__name" href="equipamento.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a>
                <div class="cart-item__controls">
                  <div class="qty-control qty-control--compact" role="group" aria-label="Quantidade de ${escapeHtml(product.name)}">
                    <button type="button" data-cart-action="decrease" aria-label="Diminuir quantidade de ${escapeHtml(product.name)}">−</button>
                    <span aria-live="polite">${quantity}</span>
                    <button type="button" data-cart-action="increase" aria-label="Aumentar quantidade de ${escapeHtml(product.name)}">+</button>
                  </div>
                  <button class="cart-item__remove" type="button" data-cart-action="remove" aria-label="Remover ${escapeHtml(product.name)}">Remover</button>
                </div>
              </div>
            </li>`
        )
        .join("");
    } else {
      itemsList.innerHTML = "";
    }

    if (pendingFocus) {
      const target = pendingFocus;
      pendingFocus = null;
      const nextBtn = itemsList.querySelector(
        `[data-item-id="${CSS.escape(target.id)}"] [data-cart-action="${CSS.escape(target.action)}"]`
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
    const product = window.RENOVAPAN_DATA?.products?.find((item) => item.id === productId);
    if (cart.addItem(productId, 1) && product) {
      showToast(`${product.shortName || product.name} adicionado ao carrinho`);
    }
  });

  itemsList.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("[data-cart-action]");
    if (!actionBtn || !cart) return;
    const itemEl = actionBtn.closest("[data-item-id]");
    if (!itemEl) return;
    const productId = itemEl.dataset.itemId;
    const action = actionBtn.dataset.cartAction;
    const currentQty = cart.getItemQuantity(productId);

    if (action === "increase") {
      pendingFocus = { id: productId, action };
      cart.setQuantity(productId, currentQty + 1);
    } else if (action === "decrease") {
      if (currentQty > 1) {
        pendingFocus = { id: productId, action };
        cart.setQuantity(productId, currentQty - 1);
      } else {
        pendingFocus = { id: productId, action: "remove" };
        cart.removeItem(productId);
      }
    } else if (action === "remove") {
      pendingFocus = { id: productId, action: "remove" };
      cart.removeItem(productId);
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
  });

  if (cart) {
    cart.subscribe(() => renderCart());
    renderCart();
  }

  window.RenovapanUI = { machineSvg, machineVisual, productCard, openCart, closeCart, showToast };
})();
