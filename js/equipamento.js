
(async function () {
  const root = document.getElementById("product-detail");
  const id = new URLSearchParams(location.search).get("id");
  const { escape, stockLabels, mediaPath, money } = window.RenovapanUI;
  const labels = { ready: "Pronta entrega", pending: "Sob encomenda" };
  let product;
  try {
    ({ product } = await window.RenovapanAPI.get("/api/product?id=" + encodeURIComponent(id || "")));
  } catch (error) {
    const missing = error.status === 404;
    root.innerHTML = '<section class="not-found"><div><h1>' + (missing ? "Equipamento não encontrado" : "Catálogo indisponível")
      + '</h1><p>' + (missing ? "O equipamento pode ter sido despublicado." : "Não foi possível carregar o equipamento agora.")
      + '</p><a class="button button--dark" href="catalogo.html">Voltar ao catálogo</a></div></section>';
    return;
  }

  document.title = product.name + " | RENOVAPAN";
  window.RenovapanAPI.track("view", product.id);
  const available = variant => variant.ready + variant.pending > 0;
  const requestedColor = new URLSearchParams(location.search).get("cor");
  let selected = product.variants.find(v => v.color === requestedColor && available(v)) || product.variants.find(available) || null;
  let condition = selected?.ready ? "ready" : "pending";
  let activeImage = 0;

  function whatsapp(variant, state) {
    const description = [product.name, product.brand, product.model].filter(Boolean).join(" · ");
    const color = variant ? " Cor de interesse: " + variant.color + "." : "";
    const situation = state === "out"
      ? " Situação: " + (variant && product.stock.ready + product.stock.pending > 0 ? "cor esgotada" : "sem estoque") + "."
      : " Condição: " + labels[state] + ".";
    const question = state === "out"
      ? " Gostaria de consultar a possibilidade de obter uma unidade para aquisição e reforma. Poderiam verificar valores e condições?"
      : " Poderiam informar valores e condições?";
    return "https://wa.me/5511952031535?text=" + encodeURIComponent(
      "Olá! Tenho interesse em " + description + " (código " + product.code + ")." + color + situation + question
    );
  }

  const specs = product.specs.map(([label, value]) => '<div class="spec"><span>' + escape(label) + '</span><strong>' + escape(value) + "</strong></div>").join("");
  root.innerHTML = '<section class="product-detail"><div class="container">'
    + '<nav class="breadcrumb" aria-label="Navegação estrutural"><a href="index.html">Início</a><span>/</span><a href="catalogo.html">Equipamentos</a><span>/</span><span>' + escape(product.name) + '</span></nav>'
    + '<div class="product-detail__grid"><div class="product-gallery" id="product-photos"></div>'
    + '<div class="product-info"><span class="product-info__category">' + escape(product.category) + '</span><h1>' + escape(product.name) + '</h1>'
    + '<p>' + escape([product.brand, product.model].filter(Boolean).join(" · ")) + '</p>'
    + '<p class="product-info__description catalog-description">' + escape(product.description) + '</p>'
    + (specs ? '<div class="specs">' + specs + '</div>' : '')
    + (product.leadTime ? '<p>Prazo estimado: ' + escape(product.leadTime) + '. Confirme durante o atendimento.</p>' : '')
    + (product.video ? '<p><a class="reference-link" href="' + escape(product.video) + '" target="_blank" rel="noopener noreferrer">Assistir à demonstração ↗</a></p>' : '')
    + (product.publicPriceCents != null ? '<p><strong>' + escape(money(product.publicPriceCents)) + '</strong></p>' : '')
    + '<div id="product-stock"></div><p class="product-gallery__caption">Código ' + escape(product.code) + '</p>'
    + '</div></div><div class="recovery-box"><h2>Uma recuperação completa</h2><p>Frentes de trabalho para os equipamentos atendidos pela RENOVAPAN.</p>'
    + '<div class="recovery-items"><div><span>01</span><strong>Mecânica</strong></div><div><span>02</span><strong>Elétrica</strong></div>'
    + '<div><span>03</span><strong>Estrutural</strong></div><div><span>04</span><strong>Estética</strong></div></div></div></div></section>';

  function showPhotos() {
    const photos = [...new Set([...(selected?.images || []), ...product.images])];
    const current = photos[activeImage];
    const caption = { before: "Antes da reforma", after: "Depois da reforma", reference: "Foto de referência de reforma anterior" }[selected?.photoKinds?.[current]];
    const alt = escape(product.name + (selected?.images.includes(current) ? " na cor " + selected.color : ""));
    document.getElementById("product-photos").innerHTML = '<div class="product-gallery__main">'
      + (current ? '<img class="catalog-actual-image" src="' + mediaPath(current) + '" alt="' + alt + '" />' : '<p>Fotos sob consulta</p>')
      + '</div>' + (caption ? '<p class="product-gallery__caption">' + caption + '</p>' : '') + (photos.length > 1 ? '<div class="catalog-thumbs" aria-label="Fotos do equipamento">' + photos.map((photo, index) =>
        '<button type="button" aria-label="Foto ' + (index + 1) + '" aria-pressed="' + (index === activeImage) + '" data-photo="' + index + '"><img alt="" src="' + mediaPath(photo) + '" loading="lazy" /></button>'
      ).join("") + '</div>' : '');
  }

  function showStock() {
    const colors = product.variants.map(variant => {
      const disabled = !available(variant);
      return '<div class="catalog-color"><button type="button" class="filter-chip" data-variant="' + escape(variant.id)
        + '" aria-pressed="' + (selected?.id === variant.id) + '"' + (disabled ? ' disabled' : '')
        + '>' + escape(variant.color) + (disabled ? ' · Esgotada' : '') + '</button>'
        + (disabled ? '<a class="catalog-color-query" data-product-id="' + escape(product.id) + '" href="' + whatsapp(variant, "out")
          + '" target="_blank" rel="noopener noreferrer">Consultar cor ' + escape(variant.color) + '</a>' : '') + '</div>';
    }).join("");
    const states = selected ? Object.keys(labels).filter(key => selected[key] > 0) : [];
    const stateOptions = states.length > 1 ? '<label class="catalog-condition">Condição de interesse <select id="catalog-condition">'
      + states.map(key => '<option value="' + key + '"' + (condition === key ? ' selected' : '') + '>' + labels[key] + '</option>').join("")
      + '</select></label>' : '';
    const outMessage = selected ? '' : '<p class="product-notice">Sem unidades disponíveis no momento. Consulte a possibilidade de encomendar este equipamento. Nossa equipe poderá verificar a disponibilidade para aquisição e reforma.</p>';
    const cta = selected ? "Ver valores no WhatsApp" : "Consultar possibilidade de encomenda";
    document.getElementById("product-stock").innerHTML = (colors ? '<h2 class="catalog-colors-title">Cores</h2><div class="catalog-colors">' + colors + '</div>' : '')
      + '<div class="catalog-availability" aria-live="polite">' + stockLabels(selected || product.stock) + '</div>'
      + stateOptions + outMessage + '<a id="product-whatsapp" class="button button--primary button--full" target="_blank" rel="noopener noreferrer" data-product-id="'
      + escape(product.id) + '" href="' + whatsapp(selected, selected ? condition : "out") + '">' + cta + ' ↗</a>';
  }

  root.addEventListener("click", event => {
    const color = event.target.closest("[data-variant]:enabled");
    const photo = event.target.closest("[data-photo]");
    if (color) {
      selected = product.variants.find(variant => variant.id === color.dataset.variant && available(variant));
      condition = selected.ready ? "ready" : "pending";
      activeImage = 0;
      showPhotos();
      showStock();
      root.querySelector('[data-variant="' + selected.id + '"]').focus();
    }
    if (photo) {
      activeImage = Number(photo.dataset.photo);
      showPhotos();
      root.querySelector('[data-photo="' + activeImage + '"]').focus();
    }
  });
  root.addEventListener("change", event => {
    if (event.target.id !== "catalog-condition") return;
    condition = event.target.value;
    document.getElementById("product-whatsapp").href = whatsapp(selected, condition);
  });
  showPhotos();
  showStock();
})();
