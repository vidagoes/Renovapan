
window.RenovapanOperations = function ({ request, run, status, escape, option, money, day, photoField, imageEditor, catalog }) {
  const byId = id => document.getElementById(id);
  const stages = { waiting: "Aguardando reforma", repair: "Em reforma", testing: "Em testes", ready: "Pronta entrega" };
  const states = { free: "Livre", reserved: "Reservada", sold: "Vendida", archived: "Arquivada" };
  const categories = { acquisition: "Aquisição", parts: "Peças e componentes", paint: "Pintura", electrical: "Elétrica", mechanical: "Mecânica", labor: "Mão de obra", transport: "Transporte", other: "Outros" };
  const dealActions = {
    free: { stage: "Alterar etapa de reforma", reserve: "Registrar reserva acordada", sell: "Registrar venda", archive: "Arquivar máquina" },
    reserved: { stage: "Alterar etapa de reforma", confirm: "Converter reserva em venda", cancel: "Cancelar e liberar reserva" },
    sold: { reverse_sale: "Estornar venda e liberar máquina" },
    archived: { reopen: "Reativar máquina" }
  };
  const demandStates = { open: "Aberta", checking: "Em consulta", resolved: "Atendida", closed: "Encerrada" };
  const priorities = { normal: "Normal", high: "Alta" };
  const pending = new WeakMap();
  let units = [];
  let legacy = [];
  let demands = [];
  let unitId = "";
  let demandId = "";
  let unitRequest = 0;
  let demandRequest = 0;

  const opts = (labels, selected) => Object.entries(labels).map(([value, label]) => option(value, label, value === selected)).join("");
  const cents = input => Math.round(input.valueAsNumber * 100);

  async function mutate(form, path, data, method = "POST") {
    const fingerprint = JSON.stringify([path, data]);
    const last = pending.get(form);
    const key = last?.fingerprint === fingerprint ? last.key : crypto.randomUUID();
    pending.set(form, { fingerprint, key });
    const result = await request(path, { method, data, key });
    pending.delete(form);
    return result;
  }

  function submit(form, action) {
    form.addEventListener("submit", event => {
      event.preventDefault();
      run(form.querySelector('button[type="submit"]'), action);
    });
  }

  function unitList() {
    const search = byId("unit-search").value.trim().toLocaleLowerCase("pt-BR");
    const filter = byId("unit-filter").value;
    byId("unit-list").innerHTML = units.filter(u =>
      (!filter || [u.technical, u.commercial].includes(filter))
      && [u.code, u.product, u.brand, u.model, u.color].join(" ").toLocaleLowerCase("pt-BR").includes(search)
    ).map(u => '<button class="admin-choice" type="button" data-unit="' + escape(u.id) + '" aria-pressed="' + (u.id === unitId) + '"><strong>'
      + escape(u.code) + ' · ' + escape(u.product) + '</strong><small>' + escape(u.color) + ' · ' + stages[u.technical] + ' · ' + states[u.commercial] + '</small></button>'
    ).join("") || '<p class="admin-muted">Nenhuma máquina encontrada.</p>';
  }

  function legacyList() {
    const root = byId("legacy-stock");
    root.innerHTML = legacy.length ? '<details class="admin-card admin-editor-section" open><summary>Conciliação do estoque anterior</summary>'
      + '<p>Identifique as máquinas físicas antes de vincular o saldo. A disponibilidade pública considera as fichas cadastradas.</p>'
      + legacy.map((l, index) => '<div class="admin-reservation"><p><strong>' + escape(l.product) + ' · ' + escape(l.color) + '</strong> · '
        + (l.condition === "ready" ? "Pronta entrega" : "Sob encomenda") + (l.legacy_deal_id ? ' · Reserva anterior' : '')
        + ' · ' + l.remaining + ' a conferir</p><button type="button" class="button button--outline" data-reconcile="' + index + '">Vincular máquina</button>'
        + '<details><summary>Encerrar saldo por divergência</summary><form data-close-legacy="' + index + '">'
        + '<label>Motivo da divergência <input name="reason" maxlength="300" required /></label>'
        + '<button type="submit" class="button button--outline">Encerrar ' + l.remaining + ' pendência(s)</button></form></details></div>').join("")
      + '</details>' : "";
    for (const button of root.querySelectorAll("[data-reconcile]")) button.addEventListener("click", () => newUnit({ legacyRow: legacy[Number(button.dataset.reconcile)] }));
    for (const form of root.querySelectorAll("[data-close-legacy]")) submit(form, async () => {
      const row = legacy[Number(form.dataset.closeLegacy)];
      await mutate(form, "legacy/" + encodeURIComponent(row.id) + "/close", { remaining: row.remaining, reason: form.elements.reason.value });
      await loadUnits();
      status("Divergência registrada no histórico.");
    });
  }

  async function loadUnits() {
    const sequence = ++unitRequest;
    const data = await request("units");
    if (sequence !== unitRequest) return;
    ({ units, legacy } = data);
    unitList();
    legacyList();
  }

  function newUnit({ productId = "", variantId = "", legacyRow = null } = {}) {
    unitId = "";
    unitList();
    renderUnit({ unit: null, deal: null, expenses: [], productId, variantId, legacyRow });
  }

  async function openUnit(id) {
    unitId = id;
    unitList();
    const root = byId("unit-editor");
    root.textContent = "Carregando ficha…";
    try {
      const data = await request("units/" + encodeURIComponent(id));
      if (unitId === id) renderUnit(data);
    } catch (error) {
      if (unitId === id) root.textContent = error.message;
    }
  }

  function renderUnit({ unit: u, deal, expenses, productId, variantId, legacyRow }) {
    const root = byId("unit-editor");
    const products = catalog().filter(p => p.variants.length);
    if (!products.length) {
      root.innerHTML = '<p class="admin-card">Cadastre um equipamento e ao menos uma cor antes de cadastrar a máquina física.</p>';
      return;
    }
    if (legacyRow) productId = products.find(p => p.variants.some(v => v.id === legacyRow.variant_id))?.id;
    const field = (name, label, value, limit, required = false) => '<label>' + label + '<input name="' + name + '" maxlength="' + limit
      + '" value="' + escape(value) + '"' + (required ? ' required' : '') + ' /></label>';
    root.innerHTML = '<form class="admin-card" id="unit-form"><h2>' + (u ? escape(u.code) + ' · ' + escape(u.product) : "Nova máquina física") + '</h2>'
      + (u ? '<p class="admin-muted">' + stages[u.technical] + ' · ' + states[u.commercial] + ' · Atualizada em '
        + escape(new Date(u.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })) + '</p>' : '')
      + '<div class="admin-fields">' + field("code", "Código único", u?.code, 40, true)
      + '<label>Produto<select name="productId"' + (u || legacyRow ? ' disabled' : '') + '>'
      + products.map(p => option(p.id, p.name, p.id === (u?.product_id || productId))).join("") + '</select></label>'
      + '<label>Cor<select name="variantId"' + (legacyRow || (u && u.commercial !== "free") ? ' disabled' : '') + ' required></select></label>'
      + (u ? '' : '<label>Etapa inicial<select name="technical">' + opts(stages, legacyRow?.condition === "ready" ? "ready" : "waiting") + '</select></label>')
      + '</div>' + (legacyRow ? '<p>Vinculando saldo anterior da cor ' + escape(legacyRow.color) + '.</p>' : '')
      + '<details><summary>Ficha técnica e fotos</summary><div class="admin-fields">'
      + field("brand", "Marca da unidade", u?.brand, 100) + field("model", "Modelo da unidade", u?.model, 100)
      + '<label>Data de aquisição<input type="date" name="acquiredOn" max="' + day() + '" value="' + escape(u?.acquired_on) + '" /></label>'
      + field("video", "Link HTTPS do vídeo", u?.video, 700) + '</div>'
      + '<label>Descrição técnica<textarea name="technicalDescription" rows="3" maxlength="5000">' + escape(u?.technical_description) + '</textarea></label>'
      + '<label>Observações privadas<textarea name="notes" rows="2" maxlength="2000">' + escape(u?.notes) + '</textarea></label>'
      + photoField("Fotos da máquina", true) + '</details>'
      + field("reason", "Motivo do cadastro ou ajuste", "", 300, true)
      + (u ? '' : '<label><input type="checkbox" name="confirmUnit" required /> Confirmo que esta é uma máquina física identificada.</label>')
      + '<button type="submit" class="button button--primary">Salvar ficha</button></form>'
      + (u ? '<div id="unit-actions"></div><div id="unit-finance"></div><details id="unit-history" class="admin-card admin-editor-section"><summary>Histórico desta máquina</summary><div id="unit-history-data"></div></details>' : '');

    const form = byId("unit-form");
    const fields = form.elements;
    const images = imageEditor(form, u?.images || [], true);
    function colors(selected) {
      const colors = products.find(p => p.id === fields.productId.value)?.variants || [];
      fields.variantId.innerHTML = colors.map(v => option(v.id, v.color, v.id === selected)).join("");
    }
    colors(u?.variant_id || legacyRow?.variant_id || variantId);
    fields.productId.addEventListener("change", () => colors());
    submit(form, async () => {
      const data = {
        code: fields.code.value, variantId: fields.variantId.value, brand: fields.brand.value, model: fields.model.value,
        acquiredOn: fields.acquiredOn.value, technicalDescription: fields.technicalDescription.value, notes: fields.notes.value,
        video: fields.video.value, images, reason: fields.reason.value
      };
      if (u) data.revision = u.revision;
      else Object.assign(data, { technical: fields.technical.value, confirmUnit: fields.confirmUnit.checked, legacyId: legacyRow?.id || "" });
      const result = await mutate(form, u ? "units/" + u.id : "units", data, u ? "PUT" : "POST");
      await loadUnits();
      await openUnit(result.id);
      status("Ficha salva.");
    });

    if (!u) return;
    renderActions(u, deal, expenses);
    renderFinance(u, expenses);
    byId("unit-history").addEventListener("toggle", event => {
      if (event.currentTarget.open) loadUnitHistory(u.id, 0);
    });
  }

  function renderActions(unit, deal, expenses) {
    const actions = { ...dealActions[unit.commercial], expense: "Registrar custo" };
    const activeCosts = expenses.filter(item => !item.reversed_at);
    if (activeCosts.length) actions.void_expense = "Estornar custo";
    const root = byId("unit-actions");
    root.innerHTML = '<form class="admin-card admin-editor-section" id="unit-action-form"><h2>Reforma, vendas e reservas</h2>'
      + (deal ? '<p class="admin-muted">' + (deal.status === "sold" ? 'Venda · ' + money(deal.amount_cents) : 'Reserva ativa') + ' · ' + escape(deal.business_date) + '</p>' : '')
      + '<label>Operação<select name="kind">' + opts(actions) + '</select></label>'
      + '<label data-field="stage">Etapa<select name="technical">' + opts(stages, unit.technical) + '</select></label>'
      + '<label data-field="expense">Categoria do custo<select name="category">' + opts(categories) + '</select></label>'
      + '<label data-field="void_expense">Custo a estornar<select name="expenseId">' + activeCosts.map(e => option(e.id, categories[e.category] + " · " + money(e.amount_cents) + " · " + e.business_date)).join("") + '</select></label>'
      + '<label data-field="amount">Valor total em R$<input name="amount" type="number" min="0" max="1000000000" step="0.01" /></label>'
      + '<label data-field="date">Data<input name="date" type="date" value="' + day() + '" max="' + day() + '" /></label>'
      + '<label data-field="notes">Observações<textarea name="notes" rows="2" maxlength="1200"></textarea></label>'
      + '<label>Motivo<input name="reason" maxlength="300" required /></label><button type="submit" class="button button--primary">Registrar operação</button></form>';
    const form = byId("unit-action-form");
    const fields = form.elements;
    function sync() {
      const kind = fields.kind.value;
      const saleOrCost = ["sell", "confirm", "expense"].includes(kind);
      const dated = saleOrCost || kind === "reserve";
      const enabled = { stage: kind === "stage", expense: kind === "expense", void_expense: kind === "void_expense", amount: saleOrCost, date: dated, notes: dated };
      for (const label of form.querySelectorAll("[data-field]")) {
        label.hidden = !enabled[label.dataset.field];
        const input = label.querySelector("input, select, textarea");
        input.disabled = label.hidden;
        input.required = !label.hidden && label.dataset.field !== "notes";
      }
      fields.amount.min = kind === "expense" ? "0.01" : "0";
    }
    fields.kind.addEventListener("change", sync);
    sync();
    submit(form, async () => {
      const data = { revision: unit.revision, kind: fields.kind.value, reason: fields.reason.value };
      for (const name of ["technical", "category", "expenseId", "date", "notes"]) if (!fields[name].disabled) data[name] = fields[name].value;
      if (!fields.amount.disabled) data.amountCents = cents(fields.amount);
      await mutate(form, "units/" + unit.id + "/actions", data);
      await loadUnits();
      await openUnit(unit.id);
      status("Operação registrada.");
    });
  }

  function renderFinance(unit, expenses) {
    const income = unit.revenue_cents;
    const result = income == null ? null : income - unit.cost_cents;
    const margin = income > 0 ? new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(result / income) : "—";
    byId("unit-finance").innerHTML = '<details class="admin-card admin-editor-section"><summary>Ficha financeira</summary>'
      + '<dl class="admin-kpis"><div><dt>Custos registrados</dt><dd>' + money(unit.cost_cents) + '</dd></div><div><dt>Receita da venda</dt><dd>' + (income == null ? "—" : money(income))
      + '</dd></div><div><dt>Resultado bruto estimado</dt><dd>' + (result == null ? "—" : money(result)) + '</dd></div><div><dt>Margem estimada</dt><dd>' + margin + '</dd></div></dl>'
      + (!unit.acquisition_entries ? '<p>Custo de aquisição ainda não registrado. O resultado pode estar incompleto.</p>' : '<p>Estimativa baseada nos valores registrados nesta ficha.</p>')
      + (expenses.length ? '<ul>' + expenses.map(e => '<li>' + escape(e.business_date) + ' · ' + categories[e.category] + ' · ' + money(e.amount_cents)
        + (e.reversed_at ? ' · Estornado' : '') + (e.notes ? ' · ' + escape(e.notes) : '') + '</li>').join("") + '</ul>' : '<p>Nenhum custo registrado.</p>') + '</details>';
  }

  async function loadUnitHistory(id, page) {
    const target = byId("unit-history-data");
    try {
      const result = await request("units/" + id + "/history?page=" + page);
      if (target !== byId("unit-history-data")) return;
      target.innerHTML = auditRows(result.history)
        + '<div class="admin-pagination"><button type="button" data-page="' + (page - 1) + '"' + (page === 0 ? " disabled" : "") + '>Anterior</button>'
        + '<button type="button" data-page="' + (page + 1) + '"' + (!result.more ? " disabled" : "") + '>Próxima</button></div>';
      for (const button of target.querySelectorAll("[data-page]")) button.addEventListener("click", () => loadUnitHistory(id, Number(button.dataset.page)));
    } catch (error) { target.textContent = error.message; }
  }

  function auditRows(rows) {
    const labels = { create: "Cadastro", edit: "Edição", duplicate: "Duplicação", stage: "Etapa da reforma", reserve: "Reserva", sell: "Venda", cancel: "Cancelamento de reserva", confirm: "Reserva convertida em venda", reverse_sale: "Estorno de venda", archive: "Arquivamento", reopen: "Reativação", expense: "Custo registrado", void_expense: "Estorno de custo", reconcile: "Conciliação de máquina", reconcile_close: "Encerramento de saldo", adjust: "Ajuste anterior", restore: "Reforma anterior" };
    const entities = { product: "Produto", variant: "Cor", unit: "Máquina", demand: "Procura", legacy: "Estoque anterior" };
    const keys = { name: "Nome", color: "Cor", code: "Código", technical: "Etapa", commercial: "Situação", ready: "Pronta entrega", pending: "Sob encomenda", price_cents: "Preço interno em centavos", public_price_cents: "Preço público em centavos", amount_cents: "Valor em centavos", remaining: "Saldo a conciliar", visibility: "Publicação", notes: "Observações", category: "Categoria", status: "Situação", contact: "Contato", unit: "Máquina", deal: "Negociação", expense: "Custo" };
    const format = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
    function describe(value) {
      if (value == null) return "—";
      const data = JSON.parse(value);
      return Object.entries(data).map(([key, item]) => (keys[key] || key) + ": "
        + (key === "technical" ? stages[item] : key === "commercial" ? states[item] : typeof item === "object" ? JSON.stringify(item) : item)).join("\n");
    }
    return rows.length ? rows.map(row => '<details class="admin-audit"><summary><strong>' + escape(labels[row.operation] || row.operation)
      + '</strong> · ' + escape(entities[row.entity]) + ' · ' + escape(format.format(new Date(row.happened_at))) + ' · ' + escape(row.actor) + '</summary>'
      + (row.reason ? '<p>' + escape(row.reason) + '</p>' : '')
      + '<div class="admin-fields"><div><strong>Antes</strong><pre>' + escape(describe(row.before_json)) + '</pre></div><div><strong>Depois</strong><pre>'
      + escape(describe(row.after_json)) + '</pre></div></div></details>').join("") : '<p class="admin-muted">Ainda não há movimentações.</p>';
  }

  function demandList() {
    const term = byId("demand-search").value.trim().toLocaleLowerCase("pt-BR");
    byId("demand-list").innerHTML = demands.filter(d => [d.name, d.brand_model, d.color].join(" ").toLocaleLowerCase("pt-BR").includes(term))
      .map(d => '<button type="button" class="admin-choice" data-demand="' + escape(d.id) + '" aria-pressed="' + (d.id === demandId)
        + '"><strong>' + escape(d.name) + '</strong><small>' + demandStates[d.status] + ' · ' + d.quantity + ' un. · ' + escape(d.business_date) + '</small></button>').join("")
      || '<p class="admin-muted">Nenhuma procura registrada.</p>';
  }

  async function loadDemands() {
    const sequence = ++demandRequest;
    const result = await request("demands");
    if (sequence !== demandRequest) return;
    demands = result.demands;
    demandList();
  }

  function renderDemand(d = {}) {
    demandId = d.id || "";
    demandList();
    const field = (name, label, value, max, required = false) => '<label>' + label + '<input name="' + name + '" value="' + escape(value)
      + '" maxlength="' + max + '"' + (required ? " required" : "") + ' /></label>';
    byId("demand-editor").innerHTML = '<form class="admin-card" id="demand-form"><h2>' + (d.id ? "Editar procura" : "Nova procura") + '</h2>'
      + '<div class="admin-fields">' + field("name", "Equipamento procurado", d.name, 140, true)
      + '<label>Vincular ao catálogo<select name="productId">' + option("", "Sem vínculo")
      + catalog().map(p => option(p.id, p.name, p.id === d.product_id)).join("") + '</select></label>'
      + field("brandModel", "Marca e modelo", d.brand_model, 160) + field("color", "Cor desejada", d.color, 70)
      + '<label>Quantidade<input name="quantity" type="number" min="1" max="1000000" required value="' + (d.quantity || 1) + '" /></label>'
      + '<label>Data<input name="date" type="date" max="' + day() + '" value="' + escape(d.business_date || day()) + '" required /></label>'
      + '<label>Prioridade<select name="priority">' + opts(priorities, d.priority) + '</select></label>'
      + '<label>Situação<select name="status">' + opts(demandStates, d.status) + '</select></label></div>'
      + field("contact", "Contato do interessado (opcional e privado)", d.contact, 200)
      + '<label>Observações<textarea name="notes" rows="3" maxlength="1200">' + escape(d.notes) + '</textarea></label>'
      + '<button type="submit" class="button button--primary">Salvar procura</button></form>';
    const form = byId("demand-form");
    form.elements.productId.addEventListener("change", () => {
      const product = catalog().find(p => p.id === form.elements.productId.value);
      if (!form.elements.name.value && product) form.elements.name.value = product.name;
    });
    submit(form, async () => {
      const data = Object.fromEntries(new FormData(form));
      data.quantity = form.elements.quantity.valueAsNumber;
      const result = await mutate(form, d.id ? "demands/" + d.id : "demands", data, d.id ? "PUT" : "POST");
      await loadDemands();
      renderDemand(demands.find(item => item.id === result.id));
      status("Procura registrada.");
    });
  }

  byId("add-unit").addEventListener("click", () => newUnit());
  byId("unit-search").addEventListener("input", unitList);
  byId("unit-filter").addEventListener("change", unitList);
  byId("unit-list").addEventListener("click", event => {
    const button = event.target.closest("[data-unit]");
    if (button) openUnit(button.dataset.unit);
  });
  byId("add-demand").addEventListener("click", () => renderDemand());
  byId("demand-search").addEventListener("input", demandList);
  byId("demand-list").addEventListener("click", event => {
    const button = event.target.closest("[data-demand]");
    if (button) renderDemand(demands.find(d => d.id === button.dataset.demand));
  });
  const report = byId("report-form");
  submit(report, async () => {
    const query = new URLSearchParams(new FormData(report));
    const response = await fetch("/api/admin/report?" + query);
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error);
    }
    const file = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = file;
    link.download = "renovapan-" + query.get("type") + ".csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(file), 1000);
    status("Relatório gerado.");
  });

  function reports() {
    report.elements.product.innerHTML = option("", "Todos os produtos")
      + catalog().map(p => option(p.id, p.name)).join("");
  }

  return { loadUnits, newUnit, loadDemands, auditRows, reports, mutate };
};
