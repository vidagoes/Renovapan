
(function () {
  const byId = id => document.getElementById(id);
  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const money = cents => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const day = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const visibility = { draft: "Rascunho", published: "Publicado", hidden: "Oculto", archived: "Arquivado" };
  let products = [];
  let editingProduct = null;
  let editingVariant = null;
  let historyPage = 0;
  let dashboardRequest = 0;
  let historyRequest = 0;
  let authenticated = false;
  const operations = window.RenovapanOperations({ request, run, status, escape, option, money, day, photoField, imageEditor, catalog: () => products });

  function status(message, error = false) {
    const node = byId("admin-status");
    node.textContent = message;
    node.dataset.error = String(error);
  }

  async function request(path, options = {}) {
    const { method = "GET", data, raw, type, key } = options;
    const headers = {};
    if (data !== undefined || raw) headers["Content-Type"] = type || "application/json";
    if (key) headers["Idempotency-Key"] = key;
    const response = await fetch("/api/admin/" + path, {
      method, headers, body: raw || (data === undefined ? undefined : JSON.stringify(data))
    });
    if (response.status === 204) return null;
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && authenticated) location.reload();
      const error = new Error(result.error || "Não foi possível concluir a operação.");
      error.status = response.status;
      throw error;
    }
    return result;
  }

  async function run(control, operation) {
    if (control.disabled) return;
    control.disabled = true;
    status("Processando…");
    try {
      await operation();
    } catch (error) {
      status(error.message || "Não foi possível concluir a operação.", true);
    } finally {
      control.disabled = false;
    }
  }

  function option(value, label, active = false) {
    return '<option value="' + escape(value) + '"' + (active ? ' selected' : '') + '>' + escape(label) + '</option>';
  }

  function currentProduct() {
    return products.find(product => product.id === editingProduct);
  }

  function renderList() {
    const search = byId("product-search").value.trim().toLocaleLowerCase("pt-BR");
    const matches = products.filter(product => [product.name, product.category, product.brand, product.model].join(" ").toLocaleLowerCase("pt-BR").includes(search));
    byId("product-list").innerHTML = matches.map(product =>
      '<button class="admin-choice" type="button" data-product="' + escape(product.id) + '" aria-pressed="' + (product.id === editingProduct)
      + '"><strong>' + escape(product.name) + '</strong><small>' + escape(visibility[product.visibility]) + ' · ' + escape(product.category) + '</small></button>'
    ).join("") || '<p class="admin-muted">Nenhum equipamento encontrado.</p>';
  }

  function imageEditor(form, initial, detailed = false) {
    const images = initial.map(item => detailed ? { ...item } : item);
    const list = form.querySelector(".admin-image-list");
    const inputs = [...form.querySelectorAll('input[type="file"]')];
    const submit = form.querySelector('button[type="submit"]');
    const kinds = { current: "Atual", before: "Antes da reforma", after: "Depois da reforma", reference: "Referência anterior" };
    let busy = false;

    function render() {
      list.innerHTML = images.map((photo, i) => {
        const id = detailed ? photo.id : photo;
        return '<figure><img alt="Foto ' + (i + 1) + '" src="/api/admin/media/' + encodeURIComponent(id) + '">'
          + (detailed ? '<label>Tipo<select data-photo-kind="' + i + '">' + Object.entries(kinds).map(([value, name]) => option(value, name, photo.kind === value)).join("")
            + '</select></label><label><input type="checkbox" data-photo-public="' + i + '"' + (photo.public ? " checked" : "") + ' /> Exibir no catálogo</label>' : "")
          + '<button type="button" data-image="' + i + '">Remover foto ' + (i + 1) + '</button></figure>';
      }).join("");
    }
    list.addEventListener("click", event => {
      const button = event.target.closest("button[data-image]");
      if (button) { images.splice(Number(button.dataset.image), 1); render(); }
    });
    list.addEventListener("change", event => {
      if (event.target.dataset.photoKind !== undefined) images[Number(event.target.dataset.photoKind)].kind = event.target.value;
      if (event.target.dataset.photoPublic !== undefined) images[Number(event.target.dataset.photoPublic)].public = event.target.checked;
    });
    for (const input of inputs) input.addEventListener("change", async () => {
      if (busy) return;
      const files = [...input.files];
      const invalid = files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024);
      if (invalid || files.length + images.length > 12) {
        status("Escolha até 12 imagens JPEG, PNG ou WebP de até 5 MB cada.", true);
        input.value = "";
        return;
      }
      busy = true;
      submit.disabled = true;
      for (const other of inputs) if (other !== input) other.disabled = true;
      await run(input, async () => {
        for (const file of files) {
          const { id } = await request("media", { method: "POST", raw: file, type: file.type });
          images.push(detailed ? { id, kind: "current", public: false } : id);
          render();
        }
        status("Fotos carregadas. Salve a ficha para vinculá-las.");
      });
      for (const control of inputs) control.disabled = false;
      submit.disabled = false;
      busy = false;
      input.value = "";
    });
    render();
    return images;
  }

  function photoField(label, camera = false) {
    return '<label>' + label + ' <input type="file" accept="image/jpeg,image/png,image/webp" multiple />'
      + '<small>JPEG, PNG ou WebP, até 5 MB por arquivo.</small></label>'
      + (camera ? '<label>Tirar foto <input type="file" accept="image/*" capture="environment" /></label>' : "")
      + '<div class="admin-image-list"></div>';
  }

  function renderProduct() {
    const product = currentProduct();
    const editor = byId("product-editor");
    if (!product && editingProduct !== "new") {
      editor.innerHTML = '<p class="admin-card">Selecione ou cadastre um equipamento.</p>';
      return;
    }
    const p = product || { visibility: "draft", images: [], specs: [], variants: [] };
    const input = (name, label, max, required = false) => '<label>' + label + '<input name="' + name + '" maxlength="' + max
      + '" value="' + escape(p[name]) + '"' + (required ? ' required' : '') + ' /></label>';
    editor.innerHTML = '<form id="edit-product" class="admin-card"><h2>' + (product ? escape(p.name) : "Novo equipamento") + '</h2>'
      + '<div class="admin-fields">' + input("name", "Nome", 140, true) + input("category", "Categoria", 80, true)
      + input("brand", "Marca", 100) + input("model", "Modelo", 100) + '</div>'
      + '<label>Descrição<textarea name="description" rows="4" maxlength="6000" required>' + escape(p.description) + '</textarea></label>'
      + '<label>Especificações<textarea name="specs" rows="4" maxlength="10000" placeholder="Capacidade: 40 kg">' + escape(p.specs.map(spec => spec.join(": ")).join("\n"))
      + '</textarea><small>Uma especificação por linha, no formato Nome: valor.</small></label>'
      + '<div class="admin-fields">' + input("video", "Link HTTPS do vídeo", 700) + input("leadTime", "Prazo estimado", 240)
      + '<label>Preço interno em R$<input type="number" name="price" min="0" max="1000000000" step="0.01" value="' + (p.priceCents == null ? "" : (p.priceCents / 100).toFixed(2)) + '" /></label>'
      + '<label>Preço público em R$<input type="number" name="publicPrice" min="0" max="1000000000" step="0.01" value="' + (p.publicPriceCents == null ? "" : (p.publicPriceCents / 100).toFixed(2)) + '" /></label>'
      + '<label>Ordem de exibição<input name="sortOrder" type="number" min="0" max="1000000" step="1" required value="' + (p.sortOrder || 0) + '" /></label>'
      + '<label>Visibilidade<select name="visibility">' + Object.entries(visibility).map(([value, label]) => option(value, label, p.visibility === value)).join("") + '</select></label></div>'
      + '<label><input type="checkbox" name="showPrice"' + (p.showPrice ? ' checked' : '') + ' /> Exibir preço no catálogo</label>'
      + '<label><input type="checkbox" name="featured"' + (p.featured ? ' checked' : '') + ' /> Mostrar nos destaques da página inicial</label>'
      + photoField("Fotos gerais") + '<button type="submit" class="button button--primary">Salvar equipamento</button></form>'
      + (product ? '<section class="admin-card admin-editor-section"><div class="admin-heading"><h2>Cores e quantidades</h2>'
        + '<button type="button" id="add-variant" class="button button--outline">Adicionar cor</button></div><div id="variant-list"></div><div id="variant-editor"></div></section>' : '');
    const form = byId("edit-product");
    const images = imageEditor(form, p.images);
    form.addEventListener("submit", event => {
      event.preventDefault();
      run(form.querySelector('button[type="submit"]'), async () => {
        const f = form.elements;
        const specs = f.specs.value.split("\n").filter(line => line.trim()).map(line => {
          const separator = line.indexOf(":");
          if (separator < 1 || !line.slice(separator + 1).trim()) throw new Error("Use Nome: valor em cada linha das especificações.");
          return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
        });
        const data = {
          name: f.name.value, category: f.category.value, brand: f.brand.value, model: f.model.value,
          description: f.description.value, specs, images, video: f.video.value, leadTime: f.leadTime.value,
          priceCents: f.price.value === "" ? null : Math.round(f.price.valueAsNumber * 100),
          publicPriceCents: f.publicPrice.value === "" ? null : Math.round(f.publicPrice.valueAsNumber * 100),
          sortOrder: f.sortOrder.valueAsNumber,
          visibility: f.visibility.value, showPrice: f.showPrice.checked, featured: f.featured.checked
        };
        const result = await request(product ? "products/" + product.id : "products", { method: product ? "PUT" : "POST", data });
        editingProduct = result.id;
        await refresh();
        renderProduct();
        status("Equipamento salvo.");
      });
    });

    if (!product) return;
    const duplication = document.createElement("details");
    duplication.className = "admin-card admin-editor-section";
    duplication.innerHTML = '<summary>Duplicar cadastro</summary><form><label>Nome da cópia<input name="name" maxlength="140" required value="'
      + escape(product.name.slice(0, 130) + " (cópia)") + '"></label><label><input name="copyDetails" type="checkbox" checked> Copiar descrição e especificações</label>'
      + '<label><input name="copyPhotos" type="checkbox"> Copiar fotos gerais</label><button type="submit" class="button button--primary">Criar rascunho</button></form>';
    editor.append(duplication);
    const copyForm = duplication.querySelector("form");
    copyForm.addEventListener("submit", event => {
      event.preventDefault();
      run(copyForm.querySelector('button[type="submit"]'), async () => {
        const fields = copyForm.elements;
        const { id } = await operations.mutate(copyForm, "products/" + product.id + "/duplicate", {
          name: fields.name.value, copyDetails: fields.copyDetails.checked, copyPhotos: fields.copyPhotos.checked
        });
        editingProduct = id;
        editingVariant = null;
        await refresh();
        renderProduct();
        status("Cópia salva como rascunho.");
      });
    });
    byId("variant-list").innerHTML = p.variants.map(v => '<p><button type="button" class="admin-choice" data-variant="' + escape(v.id)
      + '" aria-pressed="' + (editingVariant === v.id) + '"><strong>' + escape(v.color)
      + '</strong><small>Pronta entrega: ' + v.ready + ' · Sob encomenda: ' + v.pending + '</small></button></p>').join("")
      || '<p class="admin-muted">Cadastre uma cor para registrar seu estoque.</p>';
    byId("variant-list").addEventListener("click", event => {
      const button = event.target.closest("button[data-variant]");
      if (!button) return;
      editingVariant = button.dataset.variant;
      renderVariant(p);
    });
    byId("add-variant").addEventListener("click", () => { editingVariant = "new"; renderVariant(p); });
    renderVariant(p);
  }

  function renderVariant(product) {
    const editor = byId("variant-editor");
    const variant = product.variants.find(item => item.id === editingVariant);
    for (const button of byId("variant-list").querySelectorAll("button[data-variant]")) {
      button.setAttribute("aria-pressed", String(button.dataset.variant === editingVariant));
    }
    if (!variant && editingVariant !== "new") { editor.replaceChildren(); return; }
    editor.innerHTML = '<form id="edit-variant"><div class="admin-fields">'
      + '<label>Nome da cor<input name="color" maxlength="70" value="' + escape(variant?.color) + '" required /></label>'
      + '<label>Código da cor (opcional)<input name="hex" maxlength="7" placeholder="#DB1A22" value="' + escape(variant?.hex) + '" /></label></div>'
      + photoField("Fotos desta cor") + '<button type="submit" class="button button--primary">Salvar cor</button>'
      + (variant ? ' <button id="edit-stock" type="button" class="button button--outline">Cadastrar máquina desta cor</button>' : '') + '</form>';
    const form = byId("edit-variant");
    const images = imageEditor(form, variant?.images || []);
    form.addEventListener("submit", event => {
      event.preventDefault();
      run(form.querySelector('button[type="submit"]'), async () => {
        const url = "products/" + product.id + "/variants" + (variant ? "/" + variant.id : "");
        const data = { color: form.elements.color.value, hex: form.elements.hex.value, images };
        const result = await request(url, { method: variant ? "PUT" : "POST", data });
        editingVariant = result.id;
        await refresh();
        renderProduct();
        status("Cor salva. Cadastre as máquinas desta cor para compor o estoque.");
      });
    });
    byId("edit-stock")?.addEventListener("click", () => {
      showTab("stock");
      operations.newUnit({ productId: product.id, variantId: variant.id });
    });
  }

  async function refresh() {
    const result = await request("products");
    products = result.products;
    renderList();
  }

  async function renderDashboard() {
    const requestNumber = ++dashboardRequest;
    const container = byId("dashboard-data");
    container.textContent = "Carregando indicadores…";
    try {
      const data = await request("dashboard?days=" + byId("period").value);
      if (requestNumber !== dashboardRequest) return;
      const metrics = [
        ["Visitas medidas por aba", data.totals.visits], ["Visualizações", data.totals.views],
        ["Cliques diretos de produtos", data.totals.productClicks], ["Cliques para cotar listas", data.totals.quoteClicks],
        ["Produtos distintos por lista (soma)", data.totals.quoteProducts],
        ["Vendas registradas", data.totals.sales], ["Valor total das vendas", money(data.totals.amountCents)],
        ["Custos no período", money(data.totals.costsCents)], ["Resultado bruto estimado das vendas", money(data.financial.gross)],
        ["Procuras registradas", data.totals.demands], ["Equipamentos cadastrados", data.products], ["Unidades prontas", data.inventory.ready],
        ["Unidades sob encomenda", data.inventory.pending], ["Publicados sem estoque", data.soldOut]
      ];
      const rank = entries => entries.length ? '<ol>' + entries.map(r => '<li>' + escape(r.name) + ' · ' + r.total + '</li>').join("") + '</ol>' : '<p class="admin-muted">Ainda não há eventos.</p>';
      container.innerHTML = '<dl class="admin-kpis">' + metrics.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + escape(value) + '</dd></div>').join("")
        + '</dl><p class="admin-muted">A medição depende do consentimento. Cada clique para cotar conta os equipamentos distintos daquela lista. Cliques indicam intenção de consulta. As vendas são lançadas no painel.</p>'
        + '<p class="admin-muted">' + (data.financial.incomplete ? data.financial.incomplete + ' venda(s) com custos de aquisição ou ficha individual ausentes. ' : '')
        + data.stages.map(row => ({ waiting: 'Aguardando reforma', repair: 'Em reforma', testing: 'Em testes', ready: 'Prontas' })[row.technical] + ': ' + row.total).join(' · ') + '</p>'
        + '<div class="admin-card"><label>Indicador por dia <select id="chart-metric"><option value="views">Visualizações</option>'
        + '<option value="visits">Visitas por aba</option><option value="productClicks">Cliques diretos de produtos</option><option value="quoteClicks">Cliques para cotar listas</option><option value="quoteProducts">Produtos distintos nas listas</option><option value="sales">Vendas</option><option value="amountCents">Receita das vendas</option><option value="costsCents">Custos</option><option value="demands">Procuras</option></select></label>'
        + '<div id="daily-chart" class="admin-chart" aria-hidden="true"></div>'
        + '<details><summary>Ver dados por dia</summary><div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Data</th><th>Visitas</th><th>Visualizações</th><th>Cliques diretos</th><th>Cliques da lista</th><th>Produtos nas listas</th><th>Vendas</th><th>Receita</th><th>Custos</th><th>Procuras</th></tr></thead><tbody>'
        + data.series.map(row => '<tr><td>' + escape(row.day) + '</td><td>' + row.visits + '</td><td>' + row.views + '</td><td>' + row.productClicks + '</td><td>' + row.quoteClicks + '</td><td>' + row.quoteProducts + '</td><td>' + row.sales + '</td><td>' + escape(money(row.amountCents)) + '</td><td>' + escape(money(row.costsCents)) + '</td><td>' + row.demands + '</td></tr>').join("")
        + '</tbody></table></div></details></div><div class="admin-columns admin-dashboard-ranks"><section class="admin-card"><h2>Mais visualizados</h2>'
        + rank(data.mostViewed) + '</section><section class="admin-card"><h2>Mais cliques no WhatsApp</h2>' + rank(data.mostClicked) + '</section><section class="admin-card"><h2>Máquinas procuradas</h2>' + rank(data.mostDemanded)
        + '</section><section class="admin-card"><h2>Unidades vendidas</h2>' + rank(data.mostSold)
        + '</section><section class="admin-card"><h2>Consultas de produtos sem estoque</h2>' + rank(data.outOfStockInterest) + '</section></div>';
      const metric = byId("chart-metric");
      function chart() {
        const values = data.series.map(row => row[metric.value]);
        const max = Math.max(1, ...values);
        byId("daily-chart").replaceChildren(...data.series.map((row, i) => {
          const bar = document.createElement("span");
          bar.style.height = (100 * values[i] / max) + "%";
          bar.title = row.day + " · " + (metric.value.endsWith("Cents") ? money(values[i]) : values[i]);
          return bar;
        }));
      }
      metric.addEventListener("change", chart);
      chart();
    } catch (error) {
      if (requestNumber === dashboardRequest) container.textContent = error.message;
    }
  }

  async function renderHistory() {
    const requestNumber = ++historyRequest;
    const container = byId("history-data");
    container.textContent = "Carregando histórico…";
    try {
      const result = await request("history?page=" + historyPage);
      if (requestNumber !== historyRequest) return;
      container.innerHTML = operations.auditRows(result.history);
      byId("history-prev").disabled = historyPage === 0;
      byId("history-next").disabled = !result.more;
      byId("history-page").textContent = "Página " + (historyPage + 1);
    } catch (error) {
      if (requestNumber === historyRequest) container.textContent = error.message;
    }
  }

  const totpStatus = byId("totp-status");
  const totpBegin = byId("totp-begin");
  const totpConfirm = byId("totp-confirm");
  const totpSecret = byId("totp-secret");
  let securityView = 0;

  function clearEnrollment() {
    totpBegin.reset();
    totpConfirm.reset();
    totpBegin.hidden = true;
    totpConfirm.hidden = true;
    totpSecret.textContent = "";
  }

  async function loadSecurity(view) {
    totpStatus.textContent = "Verificando segundo fator…";
    try {
      const session = await request("session");
      if (view !== securityView) return;
      if (session.totpEnabled) totpStatus.textContent = "Segundo fator ativo.";
      else if (session.totpAvailable) {
        totpStatus.textContent = "Segundo fator desativado. Confirme sua senha para configurar.";
        totpBegin.hidden = false;
      } else totpStatus.textContent = "Configure a chave de criptografia no servidor para ativar o segundo fator.";
    } catch (error) {
      if (view === securityView) totpStatus.textContent = error.message;
    }
  }

  function showTab(tab) {
    for (const section of document.querySelectorAll("[data-panel]")) section.hidden = section.id !== tab;
    for (const button of document.querySelectorAll("[data-tab]")) button.setAttribute("aria-pressed", String(button.dataset.tab === tab));
    securityView++;
    clearEnrollment();
    if (tab === "security") loadSecurity(securityView);
    if (tab === "dashboard") renderDashboard();
    if (tab === "history") renderHistory();
    if (tab === "stock") operations.loadUnits().catch(error => status(error.message, true));
    if (tab === "demands") operations.loadDemands().catch(error => status(error.message, true));
    if (tab === "reports") operations.reports();
    if (tab === "products") refresh().catch(error => status(error.message, true));
  }

  async function openPanel(session) {
    authenticated = true;
    byId("login").hidden = true;
    byId("workspace").hidden = false;
    byId("logout").hidden = false;
    byId("admin-nav").hidden = !session.totpEnabled;
    if (session.totpEnabled) {
      await refresh();
      showTab("dashboard");
    } else showTab("security");
    status("");
  }

  byId("login").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    run(form.querySelector('button[type="submit"]'), async () => {
      const data = Object.fromEntries(new FormData(form));
      form.elements.password.value = "";
      form.elements.otp.value = "";
      await request("login", { method: "POST", data });
      form.reset();
      await openPanel(await request("session"));
    });
  });
  totpBegin.addEventListener("submit", event => {
    event.preventDefault();
    const view = securityView;
    run(totpBegin.querySelector('button[type="submit"]'), async () => {
      const password = totpBegin.elements.password.value;
      totpBegin.reset();
      const { secret } = await request("totp/begin", { method: "POST", data: { password } });
      if (view === securityView) {
        totpSecret.textContent = secret.match(/.{1,4}/g).join(" ");
        totpStatus.textContent = "Confirme o código a partir da chave abaixo.";
        totpConfirm.hidden = false;
        totpConfirm.elements.otp.focus();
      }
      status("");
    });
  });
  totpConfirm.addEventListener("submit", event => {
    event.preventDefault();
    run(totpConfirm.querySelector('button[type="submit"]'), async () => {
      const otp = totpConfirm.elements.otp.value;
      totpConfirm.reset();
      await request("totp/confirm", { method: "POST", data: { otp } });
      await openPanel({ totpEnabled: true });
      showTab("security");
      status("Segundo fator ativado. As sessões anteriores foram encerradas.");
    });
  });
  byId("logout").addEventListener("click", event => run(event.currentTarget, async () => {
    await request("logout", { method: "POST" });
    location.reload();
  }));
  for (const button of document.querySelectorAll("[data-tab]")) button.addEventListener("click", () => showTab(button.dataset.tab));
  byId("period").addEventListener("change", renderDashboard);
  byId("product-search").addEventListener("input", renderList);
  byId("add-product").addEventListener("click", () => {
    editingProduct = "new";
    editingVariant = null;
    renderList();
    renderProduct();
    byId("edit-product").elements.name.focus();
  });
  byId("product-list").addEventListener("click", event => {
    const button = event.target.closest("[data-product]");
    if (!button) return;
    editingProduct = button.dataset.product;
    editingVariant = null;
    renderList();
    renderProduct();
  });
  byId("history-prev").addEventListener("click", () => { if (historyPage > 0) { historyPage--; renderHistory(); } });
  byId("history-next").addEventListener("click", () => { historyPage++; renderHistory(); });

  request("session").then(openPanel).catch(error => {
    byId("login").hidden = authenticated;
    status(error.status === 401 ? "" : error.message, error.status !== 401);
  });
})();
