(function () {
  const data = window.RENOVAPAN_DATA;
  const grid = document.getElementById("catalog-products");
  const filters = document.getElementById("category-filters");
  const search = document.getElementById("catalog-search");
  const count = document.getElementById("result-count");
  const empty = document.getElementById("catalog-empty");
  const clear = document.getElementById("clear-filters");
  const queryCategory = new URLSearchParams(window.location.search).get("categoria");
  let selectedCategory = data.categories.includes(queryCategory) ? queryCategory : "Todos";

  filters.innerHTML = data.categories.map((category) => `
    <button class="filter-chip${category === selectedCategory ? " is-active" : ""}" type="button" data-category="${category}" aria-pressed="${category === selectedCategory}">${category}</button>`).join("");

  function normalize(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function render() {
    const term = normalize(search.value);
    const products = data.products.filter((product) => {
      const inCategory = selectedCategory === "Todos" || product.category === selectedCategory;
      const searchable = normalize(`${product.name} ${product.category} ${product.description}`);
      return inCategory && searchable.includes(term);
    });
    grid.innerHTML = products.map((product) => window.RenovapanUI.productCard(product)).join("");
    count.textContent = products.length;
    grid.hidden = products.length === 0;
    empty.hidden = products.length > 0;
  }

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    selectedCategory = button.dataset.category;
    filters.querySelectorAll("button").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    render();
  });
  search.addEventListener("input", render);
  clear.addEventListener("click", () => {
    search.value = "";
    selectedCategory = "Todos";
    filters.querySelectorAll("button").forEach((item) => {
      const active = item.dataset.category === "Todos";
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    render();
    search.focus();
  });
  render();
})();
