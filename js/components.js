(function () {
  const page = document.body.dataset.page;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const mediaPath = id => "/media/" + encodeURIComponent(id);
  const money = cents => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  function stockLabels({ ready, pending }) {
    if (!ready && !pending) return '<span class="stock-badge stock-badge--out">Sem estoque</span>';
    return (ready ? '<span class="stock-badge stock-badge--ready">Pronta entrega · ' + ready + '</span>' : '')
      + (pending ? '<span class="stock-badge stock-badge--pending">Sob encomenda · ' + pending + '</span>' : '');
  }

  function productCard(product, reveal = false) {
    const available = product.variants.find(variant => variant.ready + variant.pending > 0);
    const image = available?.images[0] || product.images[0] || product.variants.find(variant => variant.images.length)?.images[0];
    const photoKind = product.variants.find(variant => variant.photoKinds?.[image])?.photoKinds[image];
    const photoLabel = { before: "Antes da reforma", after: "Depois da reforma", reference: "Foto de referência" }[photoKind];
    const photo = image
      ? '<img class="catalog-actual-image" src="' + mediaPath(image) + '" alt="' + escape(product.name) + '" loading="lazy" />'
      : '<p class="catalog-photo-empty">Fotos sob consulta</p>';
    return '<a class="product-card' + (reveal ? ' reveal' : '') + '" href="equipamento.html?id=' + encodeURIComponent(product.id)
      + (product.selectedColor ? '&amp;cor=' + encodeURIComponent(product.selectedColor) : '') + '">'
      + '<div class="product-card__image">' + photo + (photoLabel ? '<span class="product-gallery__label">' + photoLabel + '</span>' : '') + '</div>'
      + '<div class="product-card__body"><span class="product-card__category">' + escape(product.category) + '</span>'
      + '<h3>' + escape(product.name) + '</h3><p class="catalog-card-description">' + escape(product.description) + '</p>'
      + '<div class="catalog-availability">' + stockLabels(product.stock) + '</div>'
      + '<div class="product-card__footer"><span>Ver equipamento</span><b aria-hidden="true">→</b></div></div></a>';
  }

  const links = [
    ["inicio", "index.html", "Início"],
    ["catalogo", "catalogo.html", "Equipamentos"],
    ["sobre", "sobre.html", "Sobre a RENOVAPAN"],
    ["servicos", "index.html#servicos", "Serviços"],
    ["contato", "#contato", "Contato"]
  ];

  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="institutional-bar"><div class="container institutional-bar__inner"><span>Mais de 30 anos no setor</span><span>Reforma e recuperação</span><span>Comercialização de equipamentos</span><span>Atendimento em todo o Brasil</span></div></div>
        <div class="container site-header__inner">
          <a class="logo" href="index.html" aria-label="RENOVAPAN — página inicial"><img class="logo__image" src="assets/logo-renovapan-2026.png" alt="RENOVAPAN — Equipamentos Para Panificação" width="720" height="480" /></a>
          <button class="menu-button" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menu"><span></span><span></span><span></span></button>
          <nav class="main-nav" id="main-nav" aria-label="Navegação principal">
            ${links.map(([key, href, label]) => `<a href="${href}"${page === key ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
            <a class="button button--primary" href="orcamento.html"${page === "orcamento" ? ' aria-current="page"' : ""}>Solicitar orçamento</a>
          </nav>
        </div>
      </header>`;

    const menuButton = header.querySelector(".menu-button");
    const nav = header.querySelector(".main-nav");
    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!open));
      menuButton.setAttribute("aria-label", open ? "Abrir menu" : "Fechar menu");
      nav.classList.toggle("is-open", !open);
      document.body.classList.toggle("menu-open", !open);
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

  window.RenovapanUI = { escape, mediaPath, money, stockLabels, productCard };
})();
