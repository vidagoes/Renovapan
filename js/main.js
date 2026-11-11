(function () {
  const featuredContainer = document.getElementById("featured-products");
  if (featuredContainer && window.RENOVAPAN_DATA) {
    featuredContainer.innerHTML = window.RENOVAPAN_DATA.products
      .filter((product) => product.featured)
      .map((product) => window.RenovapanUI.productCard(product, true))
      .join("");
  }

  // Content is visible until an observer can safely manage its entrance.
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.classList.remove("reveal-pending");
      observer.unobserve(target);
    });
  }, { rootMargin: "0px 0px -20px" });

  document.querySelectorAll(".reveal").forEach((item) => {
    if (item.getBoundingClientRect().top < window.innerHeight) return;
    item.classList.add("reveal-pending");
    observer.observe(item);
  });
})();
