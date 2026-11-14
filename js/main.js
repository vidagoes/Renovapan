(async function () {
  const featuredContainer = document.getElementById("featured-products");

  // Content is visible until an observer can safely manage its entrance.
  const useMotion = "IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const observer = useMotion ? new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.classList.remove("reveal-pending");
      observer.unobserve(target);
    });
  }, { rootMargin: "0px 0px -20px" }) : null;

  function reveal(root) {
    if (!observer) return;
    root.querySelectorAll(".reveal").forEach((item) => {
      if (item.getBoundingClientRect().top < window.innerHeight) return;
      item.classList.add("reveal-pending");
      observer.observe(item);
    });
  }

  reveal(document);
  if (!featuredContainer) return;
  const status = document.getElementById("featured-status");
  try {
    const { products } = await window.RenovapanAPI.get("/api/catalog");
    const featured = products.filter(product => product.featured);
    window.RenovapanCart?.registerProducts(featured);
    featuredContainer.innerHTML = featured.map(product => window.RenovapanUI.productCard(product, true)).join("");
    status.hidden = featured.length > 0;
    if (!featured.length) status.textContent = "Os próximos destaques serão publicados aqui.";
    reveal(featuredContainer);
  } catch {
    status.textContent = "Os destaques estão indisponíveis no momento.";
  }
})();
