(function () {
  const page = document.body.dataset.page;

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

    return `<svg class="product-card__machine" viewBox="0 0 300 240" role="img" aria-label="Ilustração demonstrativa de ${product.name}">${common}${shapes[product.type] || shapes.mixer}</svg>`;
  }

  function machineVisual(product) {
    const images = { mixer: 'masseira', beater: 'batedeira', divider: 'divisora', cylinder: 'cilindro', roller: 'modeladora' };
    const image = images[product.type];
    return image ? `<img class="product-card__machine product-photo" src="assets/referencia-${image}.png" alt="Imagem ilustrativa de ${product.category.toLowerCase()}" width="190" height="111" loading="lazy" />` : machineSvg(product);
  }

  function productCard(product, reveal = false) {
    return `
      <a class="product-card${reveal ? " reveal" : ""}" href="equipamento.html?id=${encodeURIComponent(product.id)}">
        <div class="product-card__image">
          <span class="product-card__tag">Demonstração</span><span class="product-card__status" title="Disponibilidade demonstrativa"></span>
          ${machineVisual(product)}
        </div>
        <div class="product-card__body">
          <span class="product-card__category">${product.category}</span>
          <h3>${product.name}</h3><p>${product.description}</p>
          <div class="product-card__footer"><span>Ver equipamento</span><b aria-hidden="true">→</b></div>
        </div>
      </a>`;
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
          <a class="logo" href="index.html" aria-label="RENOVAPAN — página inicial"><img class="logo__image" src="assets/logo-renovapan-oficial.png" alt="RENOVAPAN — Equipamentos Para Panificação" width="264" height="146" /></a>
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
          <div class="site-footer__brand"><a class="logo" href="index.html"><img class="logo__image" src="assets/logo-renovapan-oficial.png" alt="RENOVAPAN — Equipamentos Para Panificação" width="264" height="146" /></a><p>Reforma, recuperação e comercialização de máquinas industriais para panificação.</p></div>
          <div><h3>Navegação</h3><div class="site-footer__links"><a href="index.html">Início</a><a href="catalogo.html">Equipamentos</a><a href="sobre.html">Sobre nós</a><a href="orcamento.html">Orçamento</a></div></div>
          <div class="site-footer__contact" id="contato"><h3>Contato</h3><p>Atendimento em todo o Brasil</p><div class="site-footer__links"><a href="tel:+5511952031535">(11) 95203-1535</a><a href="https://wa.me/5511952031535" target="_blank" rel="noopener noreferrer">Falar pelo WhatsApp ↗</a><a href="https://www.instagram.com/renovapan/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="https://www.facebook.com/MaquinasRenovapan/" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://www.youtube.com/channel/UCfcH87rDWBHJVYtmIADU_Zw" target="_blank" rel="noopener noreferrer">YouTube ↗</a><a href="https://linktr.ee/renovapan" target="_blank" rel="noopener noreferrer">Todos os canais ↗</a></div></div>
        </div>
        <div class="container site-footer__bottom"><p>© <span id="current-year"></span> RENOVAPAN. MVP demonstrativo.</p><p>Conteúdo, imagens e disponibilidade sujeitos à validação.</p></div>
      </footer>`;
    footer.querySelector("#current-year").textContent = new Date().getFullYear();
  }

  window.RenovapanUI = { machineSvg, machineVisual, productCard };
})();
