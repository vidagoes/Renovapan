
(function () {
  const optOut = navigator.globalPrivacyControl || navigator.doNotTrack === "1";
  const tracked = new Set();
  let choice;
  let viewProduct;
  try { choice = localStorage.getItem("renovapan-measurement"); } catch {}

  async function get(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = new Error("Não foi possível carregar o catálogo. Tente novamente.");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function track(event, productId = "", productCount) {
    if (event === "view") viewProduct = productId;
    if (optOut || choice !== "allowed") return;
    const key = event + ":" + productId;
    if (event === "view" && tracked.has(key)) return;
    if (event === "view") tracked.add(key);
    fetch("/api/analytics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, productId, productCount, consent: true }), keepalive: true
    }).catch(() => {});
  }

  function visit() {
    if (optOut || choice !== "allowed") return;
    try {
      if (sessionStorage.getItem("renovapan-visit")) return;
      sessionStorage.setItem("renovapan-visit", "1");
    } catch { return; }
    track("visit");
  }

  function preferences() {
    if (document.getElementById("measurement-choice")) return;
    const panel = document.createElement("aside");
    panel.id = "measurement-choice";
    panel.className = "measurement-choice";
    panel.setAttribute("aria-label", "Preferência de medição");
    panel.innerHTML = '<p>' + (optOut ? "A preferência de privacidade do navegador mantém a medição desativada." : "Você pode permitir a contagem de visitas, páginas vistas e cliques no WhatsApp. Os dados são registrados de forma agregada.") + '</p>'
      + (optOut ? '<button type="button" class="button button--outline" data-choice="denied">Fechar</button>'
        : '<button type="button" class="button button--primary" data-choice="allowed">Permitir medição</button> <button type="button" class="button button--outline" data-choice="denied">Recusar medição</button>');
    panel.addEventListener("click", event => {
      if (!event.target.dataset.choice) return;
      choice = event.target.dataset.choice;
      try { localStorage.setItem("renovapan-measurement", choice); } catch {}
      panel.remove();
      if (choice === "denied") {
        try { sessionStorage.removeItem("renovapan-visit"); } catch {}
      }
      visit();
      if (viewProduct !== undefined) track("view", viewProduct);
    });
    document.body.append(panel);
  }

  window.RenovapanAPI = { get, track };
  visit();
  if (!document.getElementById("product-detail")) track("view");
  if (!optOut && !choice) preferences();
  document.addEventListener("click", event => {
    if (event.target.closest?.("[data-metrics-settings]")) preferences();
    const link = event.target.closest?.("a[href^='https://wa.me/5511952031535']");
    if (link) track("whatsapp", link.dataset.productId);
  });
})();
