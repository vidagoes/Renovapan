
(async function () {
  const status = document.getElementById("print-status");
  const root = document.getElementById("print-products");
  const button = document.getElementById("print-catalog");
  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  function availability(stock) {
    return [stock.ready ? "Pronta entrega: " + stock.ready : "", stock.pending ? "Sob encomenda: " + stock.pending : ""].filter(Boolean).join(" · ") || "Sem estoque";
  }
  try {
    const response = await fetch("/api/catalog");
    if (!response.ok) throw new Error("Catálogo indisponível.");
    const { products } = await response.json();
    if (!products.length) { status.textContent = "Ainda não há equipamentos publicados."; return; }
    root.innerHTML = products.map(p => {
      const variant = p.variants.find(v => v.images.length);
      const photo = p.images[0] || variant?.images[0];
      const label = { reference: "Foto de referência", before: "Antes da reforma", after: "Depois da reforma" }[variant?.photoKinds?.[photo]];
      return '<article class="print-product"><h2>' + escape(p.name) + '</h2><div class="print-product__row">'
        + (photo ? '<figure><img src="/media/' + encodeURIComponent(photo) + '" alt="' + escape(p.name) + '" width="170" height="130" />'
          + (label ? '<figcaption>' + label + '</figcaption>' : '') + '</figure>' : '')
        + '<div class="print-product__info"><p>' + escape([p.brand, p.model].filter(Boolean).join(" · ")) + '</p><p>' + escape(p.description)
        + '</p><p><strong>' + availability(p.stock) + '</strong> · Código ' + escape(p.code) + '</p>'
        + (p.specs.length ? '<ul>' + p.specs.map(([key, value]) => '<li>' + escape(key) + ': ' + escape(value) + '</li>').join("") + '</ul>' : '')
        + (p.variants.length ? '<ul>' + p.variants.map(v => '<li>' + escape(v.color) + ' · ' + availability(v) + '</li>').join("") + '</ul>' : '')
        + '</div></div></article>';
    }).join("");
    status.hidden = true;
    await Promise.allSettled([...root.querySelectorAll("img")].map(img => img.decode()));
    button.disabled = false;
    button.addEventListener("click", () => window.print());
  } catch (error) {
    status.textContent = error.message;
  }
})();
