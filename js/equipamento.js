(function () {
  const root = document.getElementById("product-detail");
  const id = new URLSearchParams(window.location.search).get("id");
  const product = window.RENOVAPAN_DATA.products.find((item) => item.id === id);

  if (!product) {
    document.title = "Equipamento não encontrado | RENOVAPAN";
    root.innerHTML = `<section class="not-found"><div><span>404</span><h1>Equipamento não encontrado</h1><p>O item pode ter sido removido ou o endereço está incorreto.</p><a class="button button--dark" href="catalogo.html">Voltar ao catálogo</a></div></section>`;
    return;
  }

  document.title = `${product.name} | RENOVAPAN`;
  const specs = product.specs.map(([label, value]) => `<div class="spec"><span>${label}</span><strong>${value}</strong></div>`).join("");
  root.innerHTML = `
    <section class="product-detail">
      <div class="container">
        <nav class="breadcrumb" aria-label="Navegação estrutural"><a href="index.html">Início</a><span>/</span><a href="catalogo.html">Equipamentos</a><span>/</span><span>${product.shortName}</span></nav>
        <div class="product-detail__grid">
          <div class="product-gallery">
            <div class="product-gallery__main"><span class="product-gallery__label">Imagem demonstrativa</span>${window.RenovapanUI.machineVisual(product)}</div>
            <p class="product-gallery__caption">Imagem ilustrativa da categoria. Não representa o modelo, a capacidade ou a condição de um equipamento real.</p>
          </div>
          <div class="product-info">
            <div class="product-info__top"><span class="product-info__category">${product.category}</span><h1>${product.name}</h1><span class="availability"><i></i>${product.availability}</span></div>
            <p class="product-info__description">${product.details}</p>
            <div class="specs">${specs}</div>
            <div class="product-notice"><strong>Informação importante:</strong> este é um equipamento fictício do MVP. Capacidade, especificações, condição e disponibilidade deverão ser substituídas por dados reais validados.</div>
            <a class="button button--primary button--full" href="orcamento.html?equipamento=${encodeURIComponent(product.name)}">Tenho interesse neste equipamento <span>→</span></a>
          </div>
        </div>
        <div class="recovery-box reveal">
          <h2>Uma recuperação completa</h2><p>Frentes de trabalho previstas para os equipamentos atendidos pela RENOVAPAN.</p>
          <div class="recovery-items"><div><span>01</span><strong>Mecânica</strong></div><div><span>02</span><strong>Elétrica</strong></div><div><span>03</span><strong>Estrutural</strong></div><div><span>04</span><strong>Estética</strong></div></div>
        </div>
      </div>
    </section>`;
})();
