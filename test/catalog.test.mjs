
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { once } from "node:events";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createApp } from "../server/app.mjs";
import { authenticate, sessionOwner, setOwner } from "../server/auth.mjs";
import { openDatabase } from "../server/db.mjs";
import { businessDay } from "../server/stock.mjs";

const sample = {
  name: "Masseira de teste", category: "Masseiras", brand: "Marca de teste", model: "Modelo de teste",
  description: "Equipamento para validar o catálogo em um banco de teste.",
  specs: [["Capacidade", "40 kg"]], images: [], video: "", leadTime: "",
  priceCents: 987650, showPrice: false, featured: true, visibility: "published"
};
const date = businessDay();

function otpFor(secret, step) {
  let buffer = 0;
  let bits = 0;
  const bytes = [];
  for (const letter of secret) {
    buffer = (buffer << 5) | "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(letter);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  return ((mac.readUInt32BE(mac.at(-1) & 15) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}

test("API com banco persistente: catálogo, estoque, segurança e indicadores", async t => {
  const folder = mkdtempSync(join(tmpdir(), "renovapan-test-"));
  const file = join(folder, "catalog.sqlite");
  const db = openDatabase(file);
  t.after(() => {
    db.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      try { unlinkSync(file + suffix); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    rmdirSync(folder);
  });
  const password = randomUUID();
  setOwner(db, "teste", password);
  let time = Date.now();
  t.mock.method(Date, "now", () => time);
  const app = createApp(db, { origin: "http://localhost", totpEncryptionKey: randomBytes(32) });
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  t.after(() => new Promise(resolve => app.close(resolve)));
  let cookie = "";
  const api = (path, { method = "GET", data, session = false, origin = "http://localhost", key, raw, type, extra } = {}) => new Promise((resolve, reject) => {
    const payload = raw || (data === undefined ? undefined : JSON.stringify(data));
    const headers = { Host: "localhost", "User-Agent": "Mozilla/5.0 RENOVAPAN Integration", ...extra };
    if (origin) headers.Origin = origin;
    if (session) headers.Cookie = cookie;
    if (payload) {
      headers["Content-Type"] = type || "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    if (key) headers["Idempotency-Key"] = key;
    const req = request({ host: "127.0.0.1", port: app.address().port, path, method, headers }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const bytes = Buffer.concat(chunks);
        resolve({
          status: res.statusCode, headers: res.headers, bytes,
          data: res.headers["content-type"]?.startsWith("application/json") ? JSON.parse(bytes.toString()) : null
        });
      });
    });
    req.on("error", reject);
    req.end(payload);
  });
  const write = (path, data, method = "POST", key) => api("/api/admin/" + path, { method, data, session: true, key });
  const unitData = (variantId, code, technical) => ({
    variantId, code, technical, reason: "Conferência de teste", confirmUnit: true, images: []
  });
  const unit = (variantId, code, technical) => write("units", unitData(variantId, code, technical), "POST", randomUUID());
  const action = (unitId, data, key = randomUUID()) => write("units/" + unitId + "/actions", { reason: "Teste automatizado", ...data }, "POST", key);
  const variant = (productId, color, images = []) => write("products/" + productId + "/variants", { color, hex: "", images });
  const get = id => api("/api/product?id=" + id);
  const unauthorized = [
    await api("/api/admin/products"),
    await api("/api/admin/dashboard"),
    await api("/api/admin/history"),
    await api("/api/admin/units"),
    await api("/api/admin/demands"),
    await api("/api/admin/report?type=finance"),
    await api("/api/admin/products", { method: "POST", data: sample }),
    await api("/api/admin/movements", { method: "POST", data: {} }),
    await api("/api/admin/totp/begin", { method: "POST", data: { password } }),
    await api("/api/admin/totp/confirm", { method: "POST", data: { otp: "123456" } }),
    await api("/api/admin/media", { method: "POST", raw: "x", type: "image/png" })
  ];
  for (const response of unauthorized) assert.equal(response.status, 401);
  assert.equal((await api("/.renovapan/catalog.sqlite")).status, 404);
  const loginAsOwner = otp => api("/api/admin/login", { method: "POST", data: { username: "teste", password, otp } });
  const login = await loginAsOwner();
  assert.equal(login.status, 200);
  const header = login.headers["set-cookie"][0];
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Strict/);
  cookie = header.split(";")[0];
  assert.equal((await api("/api/admin/session", { session: true })).data.totpEnabled, false);
  assert.equal((await api("/api/admin/products", { session: true })).status, 403);
  assert.equal((await write("products", sample)).status, 403);
  assert.equal((await write("totp/begin", { password: "errada" })).status, 400);
  const pending = await write("totp/begin", { password });
  assert.equal(pending.status, 200);
  assert.equal(pending.headers["cache-control"], "no-store");
  const { secret } = pending.data;
  assert.match(secret, /^[A-Z2-7]{32}$/);
  const encrypted = db.prepare("SELECT encrypted_secret FROM totp_enrollment").get().encrypted_secret;
  assert.match(encrypted, /^v1:/);
  assert.ok(!encrypted.includes(secret));
  const step = Math.floor(time / 30000);
  const codes = [step - 1, step, step + 1, step + 2].map(counter => otpFor(secret, counter));
  const invalid = ["000000", "000001", "000002", "000003", "000004"].find(code => !codes.includes(code));
  assert.equal((await write("totp/confirm", { otp: invalid })).status, 400);
  const confirmed = await write("totp/confirm", { otp: codes[1] });
  assert.equal(confirmed.status, 200);
  assert.equal((await api("/api/admin/session", { session: true })).status, 401);
  cookie = confirmed.headers["set-cookie"][0].split(";")[0];
  assert.deepEqual((await api("/api/admin/session", { session: true })).data, { username: "teste", totpEnabled: true, totpAvailable: true });
  assert.equal(db.prepare("SELECT totp_secret FROM owner").get().totp_secret, encrypted);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM totp_enrollment").get().total, 0);
  assert.equal((await loginAsOwner()).status, 401);
  assert.equal((await loginAsOwner(invalid)).status, 401);
  assert.equal((await loginAsOwner(codes[1])).status, 401);
  time += 30000;
  const verified = await loginAsOwner(codes[2]);
  assert.equal(verified.status, 200);
  const freshStep = db.prepare("SELECT last_totp FROM owner").get().last_totp;
  assert.ok(freshStep > step);
  assert.equal((await loginAsOwner(codes[2])).status, 401);
  cookie = verified.headers["set-cookie"][0].split(";")[0];
  assert.equal((await api("/api/admin/products", { method: "POST", data: sample, session: true, origin: "https://elsewhere.example" })).status, 403);
  assert.equal((await api("/api/admin/products", { method: "POST", data: sample, session: true, origin: "" })).status, 403);

  const draft = await write("products", { ...sample, visibility: "draft", name: "Rascunho de teste" });
  assert.equal(draft.status, 201);
  assert.equal((await get(draft.data.id)).status, 404);
  const created = await write("products", sample);
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.deepEqual((await get(id)).data.product.stock, { ready: 0, pending: 0 });
  const zero = await write("products", { ...sample, name: "A sem estoque" });
  assert.equal(zero.status, 201);
  const white = (await variant(id, "Branca")).data.id;
  const red = (await variant(id, "Vermelha")).data.id;
  const grey = (await variant(id, "Cinza")).data.id;
  assert.equal((await variant(id, " BRANCA ")).status, 409);
  assert.equal((await write("units", { ...unitData(white, "RP-NO", "ready"), confirmUnit: false }, "POST", randomUUID())).status, 400);
  const w1 = (await unit(white, "RP-001", "ready")).data.id;
  const w2 = (await unit(white, "RP-002", "ready")).data.id;
  const w3 = (await unit(white, "RP-003", "waiting")).data.id;
  const r1 = (await unit(red, "RP-004", "repair")).data.id;
  assert.equal((await unit(red, "RP-005", "waiting")).status, 201);
  assert.equal((await unit(red, "RP-006", "testing")).status, 201);
  assert.equal((await unit(white, "rp-001", "ready")).status, 409);
  assert.equal((await write("movements", { kind: "adjust", quantity: -1 })).status, 410);

  const catalog = await api("/api/catalog");
  assert.equal(catalog.data.products.length, 2);
  assert.equal(catalog.data.products[0].id, id);
  assert.equal(catalog.data.products[1].id, zero.data.id);
  const product = catalog.data.products[0];
  assert.deepEqual(product.variants.map(v => [v.color, v.ready, v.pending]), [["Branca", 2, 1], ["Vermelha", 0, 3], ["Cinza", 0, 0]]);
  assert.doesNotMatch(JSON.stringify(catalog.data), /priceCents|price_cents|987650|showPrice|visibility|notes/);
  assert.equal((await api("/api/admin/products", { session: true })).data.products.find(p => p.id === id).priceCents, sample.priceCents);
  assert.equal((await write("products/" + id, { ...sample, showPrice: true, publicPriceCents: 34500 }, "PUT")).status, 200);
  assert.equal((await get(id)).data.product.publicPriceCents, 34500);
  assert.equal((await write("products/" + id, sample, "PUT")).status, 200);

  await checkProductScreen(product, red, grey);
  await checkProductScreen({ ...product, variants: product.variants.map(v => ({ ...v, ready: 0, pending: 0 })), stock: { ready: 0, pending: 0 } }, red, grey, true);

  const before = (await get(id)).data.product.stock;
  assert.equal((await action(w3, { kind: "stage", technical: "ready", revision: 1 })).status, 200);
  const after = (await get(id)).data.product.stock;
  assert.deepEqual(after, { ready: 3, pending: 3 });
  assert.equal(before.ready + before.pending, after.ready + after.pending);
  const cost = await action(w1, { kind: "expense", category: "acquisition", amountCents: 350000, date, revision: 1 });
  assert.equal(cost.status, 200);
  const sale = { kind: "sell", revision: 2, amountCents: 850000, date, notes: "Observação privada" };
  const sales = await Promise.all([action(w1, sale), action(w1, sale)]);
  assert.deepEqual(sales.map(s => s.status).sort(), [200, 409]);
  assert.equal((await action(w1, { ...sale, revision: 3 })).status, 409);
  const stored = (await get(id)).data.product;
  assert.deepEqual(stored.variants.map(v => [v.ready, v.pending]), [[2, 0], [0, 3], [0, 0]]);
  assert.doesNotMatch(JSON.stringify(stored), /Observação privada|850000|350000|RP-001/);

  const reservation = { kind: "reserve", revision: 1, date };
  const key = randomUUID();
  const reserve = await action(r1, reservation, key);
  const repeat = await action(r1, reservation, key);
  assert.deepEqual(repeat.data, reserve.data);
  assert.equal((await action(r1, { ...reservation, revision: 2 }, key)).status, 409);
  assert.equal((await get(id)).data.product.variants[1].pending, 2);
  assert.equal((await action(r1, { kind: "cancel", revision: 2 })).status, 200);
  assert.equal((await get(id)).data.product.variants[1].pending, 3);
  assert.equal((await action(r1, { kind: "cancel", revision: 3 })).status, 409);
  assert.equal((await action(r1, { ...reservation, revision: 3 })).status, 200);
  assert.equal((await action(r1, { kind: "confirm", revision: 4, amountCents: 150000, date })).status, 200);
  assert.equal((await get(id)).data.product.variants[1].pending, 2);
  assert.equal((await action(r1, { kind: "reverse_sale", revision: 5 })).status, 200);
  assert.equal((await get(id)).data.product.variants[1].pending, 3);
  assert.equal((await action(r1, { kind: "sell", revision: 6, amountCents: 150000, date })).status, 200);
  const copied = await write("products/" + id + "/duplicate", { name: "Cópia de teste", copyDetails: true, copyPhotos: true }, "POST", randomUUID());
  assert.equal(copied.status, 201);
  const copy = (await api("/api/admin/products", { session: true })).data.products.find(p => p.id === copied.data.id);
  assert.equal(copy.visibility, "draft");
  assert.equal(copy.variants.length, 0);
  assert.equal(copy.priceCents, null);
  assert.equal(copy.description, sample.description);
  assert.deepEqual(copy.stock, { ready: 0, pending: 0 });
  assert.equal((await get(copy.id)).status, 404);
  assert.equal((await write("demands", { name: "Procura teste", productId: zero.data.id, quantity: 3, date, priority: "high", status: "open", contact: "Contato privado" }, "POST", randomUUID())).status, 201);
  assert.doesNotMatch(JSON.stringify((await api("/api/catalog")).data), /Contato privado|Procura teste/);
  const finance = await api("/api/admin/report?type=finance&product=" + id, { session: true });
  assert.equal(finance.status, 200);
  assert.match(finance.bytes.toString(), /3500,00/);
  assert.match(finance.headers["content-disposition"], /renovapan-finance.csv/);
  for (const type of ["inventory", "sales", "repairs", "audit", "demands", "interest"]) {
    assert.equal((await api("/api/admin/report?type=" + type, { session: true })).status, 200);
  }
  assert.equal((await api("/catalogo-impressao.html")).status, 200);

  const stockBeforeClick = (await get(id)).data.product.stock;
  for (const data of [
    { event: "visit" }, { event: "whatsapp", productId: id }, { event: "whatsapp", productId: zero.data.id },
    { event: "view", productId: id }, { event: "view" }, { event: "quote", productCount: 2 },
    { event: "quote", productCount: 1 }, { event: "quote", productCount: -1 }
  ]) await api("/api/analytics", { method: "POST", data: { ...data, consent: true } });
  await api("/api/analytics", { method: "POST", data: { event: "view", productId: id } });
  await api("/api/analytics", { method: "POST", data: { event: "view", productId: id, consent: true }, extra: { "Sec-GPC": "1" } });
  await api("/api/analytics", { method: "POST", data: { event: "quote", productCount: 4 } });
  await api("/api/analytics", { method: "POST", data: { event: "quote", productCount: 4, consent: true }, extra: { DNT: "1" } });
  assert.deepEqual((await get(id)).data.product.stock, stockBeforeClick);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM deals").get().count, 4);
  for (const days of [7, 30, 90]) {
    const summary = (await api("/api/admin/dashboard?days=" + days, { session: true })).data;
    assert.equal(summary.series.length, days);
    assert.deepEqual(summary.totals, {
      visits: 1, views: 2, clicks: 2, productClicks: 2, quoteClicks: 2, quoteProducts: 3,
      sales: 2, amountCents: 1000000, costsCents: 350000, demands: 1
    });
    assert.equal(summary.financial.gross, 650000);
    assert.equal(summary.financial.incomplete, 1);
    assert.equal(summary.soldOut, 1);
    assert.equal(summary.mostViewed[0].id, id);
    assert.equal(summary.mostDemanded[0].total, 3);
    assert.equal(summary.outOfStockInterest[0].id, zero.data.id);
  }
  const audit = (await api("/api/admin/units/" + w3 + "/history", { session: true })).data.history;
  assert(audit.some(row => row.operation === "stage" && JSON.parse(row.before_json).unit.technical === "waiting" && JSON.parse(row.after_json).unit.technical === "ready" && row.actor === "teste"));

  const invalidImage = await api("/api/admin/media", { method: "POST", session: true, raw: "<svg></svg>", type: "image/png" });
  assert.equal(invalidImage.status, 415);
  const tooBig = await api("/api/admin/media", { method: "POST", session: true, raw: Buffer.alloc(5 * 1024 * 1024 + 1), type: "image/png" });
  assert.equal(tooBig.status, 413);
  const png = readFileSync(new URL("../assets/logo-renovapan-oficial.png", import.meta.url));
  const upload = await api("/api/admin/media", { method: "POST", session: true, raw: png, type: "image/png" });
  assert.equal(upload.status, 201);
  const photo = upload.data.id;
  assert.equal((await api("/media/" + photo)).status, 404);
  assert.equal((await api("/api/admin/media/" + photo)).status, 401);
  assert.equal((await api("/api/admin/media/" + photo, { session: true })).status, 200);
  assert.equal((await write("units/" + w2, { ...unitData(white, "RP-002", "ready"), revision: 1, images: [{ id: photo, kind: "after", public: false }] }, "PUT", randomUUID())).status, 200);
  assert.equal((await api("/media/" + photo)).status, 404);
  assert.equal((await write("units/" + w2, { ...unitData(white, "RP-002", "ready"), revision: 2, images: [{ id: photo, kind: "after", public: true }] }, "PUT", randomUUID())).status, 200);
  assert.equal((await get(id)).data.product.variants[0].photoKinds[photo], "after");
  assert.deepEqual((await api("/media/" + photo)).bytes, png);
  assert.equal((await write("products/" + id, { ...sample, visibility: "hidden" }, "PUT")).status, 200);
  assert.equal((await get(id)).status, 404);
  assert.equal((await api("/media/" + photo)).status, 404);
  assert.equal((await api("/api/catalog")).data.products.length, 1);

  const reopened = openDatabase(file);
  assert.equal(reopened.prepare("SELECT COUNT(*) AS count FROM products").get().count, 4);
  assert.equal(reopened.prepare("SELECT ready FROM variant_stock WHERE id = ?").get(white).ready, 2);
  reopened.close();

  const logout = await api("/api/admin/logout", { method: "POST", session: true });
  assert.equal(logout.status, 204);
  assert.match(logout.headers["set-cookie"][0], /Max-Age=0/);
  assert.equal((await api("/api/admin/session", { session: true })).status, 401);
});

async function checkProductScreen(product, red, grey, zero = false) {
  const handlers = {};
  const root = { innerHTML: "", addEventListener: (name, fn) => { handlers[name] = fn; }, querySelector: () => ({ focus() {} }) };
  const stock = { innerHTML: "" };
  const photos = { innerHTML: "" };
  const window = { RenovapanAPI: { get: async () => ({ product }), track() {} } };
  const context = {
    window, URLSearchParams, location: { search: "?id=" + product.id },
    document: { body: { dataset: {} }, getElementById: id => ({ "product-detail": root, "product-stock": stock, "product-photos": photos }[id]) }
  };
  runInNewContext(readFileSync(new URL("../js/components.js", import.meta.url), "utf8"), context);
  await runInNewContext(readFileSync(new URL("../js/equipamento.js", import.meta.url), "utf8"), context);
  assert(stock.innerHTML.includes('data-variant="' + grey + '" aria-pressed="false" disabled'));
  assert(stock.innerHTML.includes("Cinza · Esgotada"));
  assert.match(decodeURIComponent(stock.innerHTML), /Cor de interesse: Cinza/);
  if (zero) {
    assert.match(stock.innerHTML, /Sem estoque|Consultar possibilidade de encomenda/);
    assert.match(decodeURIComponent(stock.innerHTML), /Situação: sem estoque/);
  } else {
    assert.match(stock.innerHTML, /Pronta entrega · 2/);
    assert.match(stock.innerHTML, /Sob encomenda · 1/);
    handlers.click({ target: { closest: selector => selector === "[data-variant]:enabled" ? { dataset: { variant: red } } : null } });
    assert.match(stock.innerHTML, /Sob encomenda · 3/);
    assert.doesNotMatch(stock.innerHTML, /Pronta entrega · /);
    assert.match(decodeURIComponent(stock.innerHTML), /Cor de interesse: Vermelha/);
  }
}

test("autenticação do proprietário valida usuário e senha e revoga sessões anteriores", () => {
  const db = openDatabase(":memory:");
  const password = randomUUID();
  for (const weak of ["abcd", "aaaaaaaaaaaaaa", "Password-Strong-looking-1"]) {
    assert.throws(() => setOwner(db, "teste", weak), /senha forte de 14/);
  }
  setOwner(db, "teste", password);
  assert.equal(authenticate(db, "teste", "senha-errada"), null);
  assert.equal(authenticate(db, "outro", password), null);
  const token = authenticate(db, "teste", password);
  assert.ok(token);
  assert.equal(typeof token, "string");
  assert.ok(sessionOwner(db, token));
  assert.throws(() => setOwner(db, "teste", "abcd"), /senha forte/);
  assert.ok(sessionOwner(db, token));
  const newPassword = randomUUID();
  setOwner(db, "teste", newPassword);
  assert.equal(sessionOwner(db, token), null);
  assert.equal(authenticate(db, "teste", password), null);
  assert.ok(authenticate(db, "teste", newPassword));
  db.close();
});

test("migração de saldo antigo conserva registros e só publica máquinas conferidas", async () => {
  const { saveUnit, unitAction, closeLegacy, legacyStock } = await import("../server/units.mjs");
  const { products } = await import("../server/catalog.mjs");
  const folder = mkdtempSync(join(tmpdir(), "renovapan-migration-"));
  const file = join(folder, "legacy.sqlite");
  const productId = randomUUID();
  const variantId = randomUUID();
  const oldReservation = randomUUID();
  const oldSale = randomUUID();
  const old = new DatabaseSync(file);
  old.exec(readFileSync(new URL("../server/migrations/001-initial.sql", import.meta.url), "utf8"));
  old.exec("PRAGMA user_version=1");
  old.prepare("INSERT INTO products VALUES (?, 'Masseira legada', 'Masseiras', '', '', 'Ficha anterior', '[]', '[]', '', '', 3000, 1, 0, 'published', ?)").run(productId, new Date().toISOString());
  old.prepare("INSERT INTO variants VALUES (?, ?, 'Branca', 'branca', '', '[]', 2, 1)").run(variantId, productId);
  old.prepare("INSERT INTO deals VALUES (?, ?, 'ready', 1, 'reserved', NULL, ?, 'Reserva legada', ?)").run(oldReservation, variantId, date, new Date().toISOString());
  old.prepare("INSERT INTO deals VALUES (?, ?, 'ready', 1, 'sold', 4000, ?, '', ?)").run(oldSale, variantId, date, new Date().toISOString());
  old.close();
  const db = openDatabase(file);
  try {
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 3);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM units").get().total, 0);
    assert.deepEqual(products(db)[0].stock, { ready: 0, pending: 0 });
    assert.equal(products(db)[0].publicPriceCents, 3000);
    assert.equal(legacyStock(db).reduce((sum, row) => sum + row.remaining, 0), 4);
    const machine = { variantId, code: "RP-C-01", technical: "ready", reason: "Conferência física", confirmUnit: true, images: [] };
    assert.throws(() => saveUnit(db, "teste", randomUUID(), null, machine), /Concilie/);
    const readyId = variantId + ":ready";
    const operation = randomUUID();
    const first = saveUnit(db, "teste", operation, null, { ...machine, legacyId: readyId });
    assert.deepEqual(saveUnit(db, "teste", operation, null, { ...machine, legacyId: readyId }), first);
    assert.equal(products(db)[0].stock.ready, 1);
    assert.equal(legacyStock(db).find(item => item.id === readyId).remaining, 1);
    const reserved = saveUnit(db, "teste", randomUUID(), null, { ...machine, code: "RP-C-02", legacyId: oldReservation });
    assert.equal(products(db)[0].stock.ready, 1);
    assert.equal(db.prepare("SELECT status FROM deals WHERE id = ?").get(oldReservation).status, "reserved");
    assert.equal(db.prepare("SELECT status FROM deals WHERE id = ?").get(oldSale).status, "sold");
    unitAction(db, "teste", randomUUID(), reserved.id, { revision: 1, kind: "cancel", reason: "Cancelamento confirmado" });
    assert.equal(products(db)[0].stock.ready, 2);
    closeLegacy(db, "teste", randomUUID(), readyId, { remaining: 1, reason: "Saldo sem unidade física após conferência" });
    assert.equal(legacyStock(db).find(item => item.id === readyId), undefined);
    assert.equal(products(db)[0].stock.ready, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM audit_events WHERE operation = 'reconcile'").get().total, 2);
  } finally {
    db.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      try { unlinkSync(file + suffix); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    rmdirSync(folder);
  }
});

test("filtros combinam cor e condição e encontram cores esgotadas", async () => {
  const nodes = new Map();
  function element() {
    return { value: "", textContent: "", innerHTML: "", dataset: {}, handlers: {}, children: [], classList: { toggle() {} },
      addEventListener(name, fn) { this.handlers[name] = fn; }, setAttribute() {}, append(child) { this.children.push(child); },
      add() {}, querySelectorAll() { return this.children; }, focus() {} };
  }
  const getElementById = id => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const active = { ...sample, id: "active", variants: [{ color: "Branca", ready: 1, pending: 0 }, { color: "Vermelha", ready: 0, pending: 0 }] };
  const empty = { ...sample, id: "empty", variants: [{ color: "Branca", ready: 0, pending: 0 }] };
  const context = {
    URLSearchParams, Option: function () {}, location: { search: "?categoria=Masseiras" },
    document: { getElementById, createElement: element },
    window: { RenovapanAPI: { get: async () => ({ products: [empty, active] }) }, RenovapanUI: { productCard: p => p.id + ":" + p.stock.ready + ":" + p.selectedColor } }
  };
  await runInNewContext(readFileSync(new URL("../js/catalogo.js", import.meta.url), "utf8"), context);
  assert.equal(getElementById("result-count").textContent, 2);
  const color = getElementById("catalog-color");
  const stock = getElementById("catalog-stock");
  const brand = getElementById("catalog-brand");
  brand.value = sample.brand;
  color.value = "Vermelha";
  stock.value = "ready";
  stock.handlers.change();
  assert.equal(getElementById("result-count").textContent, 0);
  stock.value = "out";
  stock.handlers.change();
  assert.equal(getElementById("catalog-products").innerHTML, "active:0:Vermelha");
  color.value = "Branca";
  color.handlers.change();
  assert.equal(getElementById("catalog-products").innerHTML, "empty:0:Branca");
});
