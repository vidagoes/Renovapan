
(async function () {
  const grid = document.getElementById("catalog-products");
  const filters = document.getElementById("category-filters");
  const search = document.getElementById("catalog-search");
  const count = document.getElementById("result-count");
  const empty = document.getElementById("catalog-empty");
  const clear = document.getElementById("clear-filters");
  const status = document.getElementById("catalog-status");
  const brand = document.getElementById("catalog-brand");
  const model = document.getElementById("catalog-model");
  const color = document.getElementById("catalog-color");
  const stock = document.getElementById("catalog-stock");
  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const queryCategory = new URLSearchParams(location.search).get("categoria");
  let selectedCategory = "Todos";

  try {
    const { products } = await window.RenovapanAPI.get("/api/catalog");
    function options(select, values) {
      const unique = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
      for (const value of unique) select.add(new Option(value, value));
    }
    options(brand, products.map(p => p.brand));
    options(model, products.map(p => p.model));
    options(color, products.flatMap(p => p.variants.map(v => v.color)));
    const categories = ["Todos", ...new Set(products.map(product => product.category).sort((a, b) => a.localeCompare(b, "pt-BR")))];
    const linkedCategory = categories.find(category => normalize(category) === normalize(queryCategory || ""));
    if (linkedCategory) selectedCategory = linkedCategory;
    for (const category of categories) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.dataset.category = category;
      button.textContent = category;
      filters.append(button);
    }

    function render() {
      const term = normalize(search.value);
      const matches = products.flatMap(product => {
        if (selectedCategory !== "Todos" && selectedCategory !== product.category) return [];
        if (brand.value && brand.value !== product.brand) return [];
        if (model.value && model.value !== product.model) return [];
        if (!normalize([product.name, product.category, product.brand, product.model, product.description].join(" ")).includes(term)) return [];
        const variants = color.value ? product.variants.filter(v => v.color === color.value) : product.variants;
        if (color.value && !variants.length) return [];
        const availability = variants.reduce((total, v) => ({ ready: total.ready + v.ready, pending: total.pending + v.pending }), { ready: 0, pending: 0 });
        if (stock.value === "out" && availability.ready + availability.pending > 0) return [];
        if (["ready", "pending"].includes(stock.value) && !availability[stock.value]) return [];
        return [{ ...product, variants, stock: availability, selectedColor: color.value }];
      }).sort((a, b) => Number(b.stock.ready + b.stock.pending > 0) - Number(a.stock.ready + a.stock.pending > 0));
      grid.innerHTML = matches.map(product => window.RenovapanUI.productCard(product)).join("");
      count.textContent = matches.length;
      empty.hidden = matches.length > 0;
      for (const button of filters.querySelectorAll("button")) {
        const active = button.dataset.category === selectedCategory;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    }

    status.hidden = true;
    if (!products.length) {
      status.hidden = false;
      status.textContent = "Ainda não há equipamentos publicados. Fale com a RENOVAPAN para consultar opções.";
      return;
    }
    filters.addEventListener("click", event => {
      const button = event.target.closest("button[data-category]");
      if (!button) return;
      selectedCategory = button.dataset.category;
      render();
    });
    search.addEventListener("input", render);
    for (const select of [brand, model, color, stock]) select.addEventListener("change", render);
    function reset() {
      search.value = "";
      selectedCategory = "Todos";
      for (const select of [brand, model, color, stock]) select.value = "";
      render();
      search.focus();
    }
    clear.addEventListener("click", reset);
    document.getElementById("reset-catalog").addEventListener("click", reset);
    render();
  } catch {
    status.textContent = "O catálogo está indisponível no momento. Atualize a página para tentar novamente.";
  }
})();
