
import { createServer } from "node:http";
import { createHmac, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { authenticate, beginTotp, confirmTotp, endSession, sessionCookie, sessionOwner, sessionToken } from "./auth.mjs";
import { totpKey } from "./totp.mjs";
import { duplicateProduct, getImage, isId, products, record, saveProduct, saveVariant, storeImage } from "./catalog.mjs";
import { auditHistory } from "./audit.mjs";
import { listDemands, saveDemand } from "./demands.mjs";
import { openDatabase } from "./db.mjs";
import { quantity, RequestError } from "./inventory.mts";
import { dashboard, rateLimit, track } from "./metrics.mjs";
import { privateReport } from "./reports.mjs";
import { closeLegacy, legacyStock, listUnits, saveUnit, unitAction, unitDetails } from "./units.mjs";

const pages = new Set(["/index.html", "/catalogo.html", "/equipamento.html", "/sobre.html", "/orcamento.html", "/catalogo-impressao.html"]);
const mime = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml"
};
const mediaLimit = 5 * 1024 * 1024;
const idPattern = "[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}";
const productRoute = new RegExp("^/api/admin/products/(" + idPattern + ")$");
const duplicateRoute = new RegExp("^/api/admin/products/(" + idPattern + ")/duplicate$");
const unitRoute = new RegExp("^/api/admin/units/(" + idPattern + ")(?:/(actions|history))?$");
const demandRoute = new RegExp("^/api/admin/demands/(" + idPattern + ")$");
const legacyRoute = new RegExp("^/api/admin/legacy/(" + idPattern + "(?::ready|:pending)?)/close$");
const variantRoute = new RegExp("^/api/admin/products/(" + idPattern + ")/variants(?:/(" + idPattern + "))?$");
const adminMedia = new RegExp("^/api/admin/media/(" + idPattern + ")$");
const publicMedia = new RegExp("^/media/(" + idPattern + ")$");

function json(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function body(request, limit) {
  if (Number(request.headers["content-length"]) > limit) {
    request.resume();
    throw new RequestError(413, "Arquivo ou solicitação acima do limite permitido.");
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    let chunks = [];
    request.on("data", chunk => {
      size += chunk.length;
      if (size > limit) {
        chunks = [];
        reject(new RequestError(413, "Arquivo ou solicitação acima do limite permitido."));
      } else {
        chunks.push(chunk);
      }
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function jsonBody(request) {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json") {
    throw new RequestError(415, "Envie os dados em JSON.");
  }
  const raw = await body(request, 64 * 1024);
  try { return record(JSON.parse(raw.toString("utf8"))); }
  catch { throw new RequestError(400, "Dados inválidos."); }
}

function headers(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}

async function staticFile(pathname, request, response) {
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin/index.html";
  const allowed = pages.has(pathname) || pathname === "/admin/index.html"
    || /^\/(?:assets|css|js)\/(?:[\w-]+\/)*[\w.-]+$/.test(pathname);
  const type = mime[extname(pathname)];
  if (!allowed || !type) throw new RequestError(404, "Página não encontrada.");
  let data;
  try { data = await readFile(new URL(".." + pathname, import.meta.url)); }
  catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") throw new RequestError(404, "Arquivo não encontrado.");
    throw error;
  }
  response.writeHead(200, { "Content-Type": type, "Content-Length": data.length });
  response.end(request.method === "HEAD" ? undefined : data);
}

function image(db, id, admin, request, response) {
  const found = getImage(db, id, admin);
  if (!found) throw new RequestError(404, "Imagem não encontrada.");
  response.writeHead(200, { "Content-Type": found.mime, "Content-Length": found.body.length });
  response.end(request.method === "HEAD" ? undefined : found.body);
}

export function createApp(db, { origin, totpEncryptionKey = totpKey() } = {}) {
  const expected = new URL(origin);
  const secure = expected.protocol === "https:";
  if (!secure && (expected.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(expected.hostname))) {
    throw new Error("Use HTTPS fora do ambiente local.");
  }
  const allowLogin = rateLimit();
  const allowEnrollment = rateLimit();
  const allowEvent = rateLimit();
  const salt = randomBytes(32);
  const clientKey = request => createHmac("sha256", salt).update(request.socket.remoteAddress || "local").digest("hex");

  return createServer({ requestTimeout: 20000, headersTimeout: 10000 }, async (request, response) => {
    headers(response);
    try {
      if (request.headers.host !== expected.host) throw new RequestError(400, "Endereço inválido.");
      const url = new URL(request.url, expected.origin);
      const pathname = decodeURIComponent(url.pathname);
      const method = request.method;
      if (method !== "GET" && method !== "HEAD" && request.headers.origin !== expected.origin) {
        throw new RequestError(403, "Origem não autorizada.");
      }
      if (secure) response.setHeader("Strict-Transport-Security", "max-age=31536000");

      if (method === "GET" && pathname === "/api/catalog") {
        return json(response, 200, { products: products(db) });
      }
      if (method === "GET" && pathname === "/api/product") {
        const id = url.searchParams.get("id");
        const product = isId(id) && products(db, { id })[0];
        if (!product) throw new RequestError(404, "Equipamento não encontrado.");
        return json(response, 200, { product });
      }
      if ((method === "GET" || method === "HEAD") && publicMedia.test(pathname)) {
        return image(db, pathname.match(publicMedia)[1], false, request, response);
      }
      if (method === "POST" && pathname === "/api/analytics") {
        const ua = request.headers["user-agent"] || "";
        if (!ua || /bot|crawler|spider|headless/i.test(ua) || request.headers["sec-gpc"] === "1" || request.headers.dnt === "1") {
          request.resume();
          return response.writeHead(204).end();
        }
        const key = clientKey(request);
        if (!allowEvent("total", 600, 60000) || !allowEvent(key, 80, 60000)) throw new RequestError(429, "Limite de eventos atingido.");
        const data = await jsonBody(request);
        if (data.consent === true && (!data.productId || isId(data.productId))) track(db, data.event, data.productId, data.productCount);
        return response.writeHead(204).end();
      }
      if (method === "POST" && pathname === "/api/admin/login") {
        const key = clientKey(request);
        if (!allowLogin("total", 30, 60000) || !allowLogin(key, 8, 900000)) throw new RequestError(429, "Muitas tentativas. Tente novamente em alguns minutos.");
        const data = await jsonBody(request);
        const token = authenticate(db, data.username, data.password, data.otp, totpEncryptionKey);
        if (!token) throw new RequestError(401, "Credenciais inválidas. Confira a senha e o código, se ativado.");
        endSession(db, sessionToken(request, secure));
        response.setHeader("Set-Cookie", sessionCookie(token, secure));
        return json(response, 200, { ok: true });
      }
      if (pathname.startsWith("/api/admin/")) {
        const token = sessionToken(request, secure);
        const owner = sessionOwner(db, token);
        if (!owner) throw new RequestError(401, "Entre no painel para continuar.");
        if (method === "GET" && pathname === "/api/admin/session") {
          return json(response, 200, { username: owner.username, totpEnabled: Boolean(owner.totpEnabled), totpAvailable: Boolean(totpEncryptionKey) });
        }
        if (method === "POST" && pathname === "/api/admin/logout") {
          endSession(db, token);
          response.setHeader("Set-Cookie", sessionCookie(null, secure));
          return response.writeHead(204).end();
        }
        if (method === "POST" && ["/api/admin/totp/begin", "/api/admin/totp/confirm"].includes(pathname)) {
          if (!allowEnrollment(owner.username, 12, 600000)) throw new RequestError(429, "Muitas tentativas de ativação. Tente mais tarde.");
          const { password, otp } = await jsonBody(request);
          if (pathname.endsWith("/begin")) return json(response, 200, beginTotp(db, token, password, totpEncryptionKey));
          const renewed = confirmTotp(db, token, otp, totpEncryptionKey);
          response.setHeader("Set-Cookie", sessionCookie(renewed, secure));
          return json(response, 200, { totpEnabled: true });
        }
        if (!owner.totpEnabled) throw new RequestError(403, "Ative o segundo fator para acessar os dados do painel.");
        if (method === "GET") {
          if (pathname === "/api/admin/products") return json(response, 200, { products: products(db, { admin: true }) });
          if (pathname === "/api/admin/units") return json(response, 200, { units: listUnits(db), legacy: legacyStock(db) });
          if (pathname === "/api/admin/demands") return json(response, 200, { demands: listDemands(db) });
          if (pathname === "/api/admin/report") {
            const { filename, content } = privateReport(db, url.searchParams);
            response.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="' + filename + '"' });
            return response.end(content);
          }
          const unit = pathname.match(unitRoute);
          if (unit && !unit[2]) return json(response, 200, unitDetails(db, unit[1]));
          if (pathname === "/api/admin/history" || unit?.[2] === "history") {
            const page = quantity(Number(url.searchParams.get("page") || 0), 0, 20000);
            const rows = auditHistory(db, { page, unitId: unit?.[1] });
            return json(response, 200, { history: rows.slice(0, 50), more: rows.length > 50 });
          }
          if (pathname === "/api/admin/dashboard") {
            const days = Number(url.searchParams.get("days") || 30);
            if (![7, 30, 90].includes(days)) throw new RequestError(400, "Período inválido.");
            return json(response, 200, dashboard(db, days));
          }
        }
        if ((method === "GET" || method === "HEAD") && adminMedia.test(pathname)) {
          return image(db, pathname.match(adminMedia)[1], true, request, response);
        }
        if (method === "POST" || method === "PUT") {
          const upload = pathname === "/api/admin/media" && method === "POST";
          const data = upload ? await body(request, mediaLimit) : await jsonBody(request);
          if (!sessionOwner(db, token)?.totpEnabled) throw new RequestError(401, "A sessão expirou.");
          if (upload) return json(response, 201, storeImage(db, request.headers["content-type"], data));
          const actor = owner.username;
          const key = request.headers["idempotency-key"];
          if (pathname === "/api/admin/products" && method === "POST") return json(response, 201, saveProduct(db, null, data, actor));
          const product = pathname.match(productRoute);
          if (product && method === "PUT") return json(response, 200, saveProduct(db, product[1], data, actor));
          const duplicate = pathname.match(duplicateRoute);
          if (duplicate && method === "POST") return json(response, 201, duplicateProduct(db, actor, key, duplicate[1], data));
          const variant = pathname.match(variantRoute);
          if (variant && ((!variant[2] && method === "POST") || (variant[2] && method === "PUT"))) {
            return json(response, variant[2] ? 200 : 201, saveVariant(db, variant[1], variant[2], data, actor));
          }
          const unit = pathname.match(unitRoute);
          if (pathname === "/api/admin/units" && method === "POST") return json(response, 201, saveUnit(db, actor, key, null, data));
          if (unit && !unit[2] && method === "PUT") return json(response, 200, saveUnit(db, actor, key, unit[1], data));
          if (unit?.[2] === "actions" && method === "POST") return json(response, 200, unitAction(db, actor, key, unit[1], data));
          if (pathname === "/api/admin/demands" && method === "POST") return json(response, 201, saveDemand(db, actor, key, null, data));
          const demand = pathname.match(demandRoute);
          if (demand && method === "PUT") return json(response, 200, saveDemand(db, actor, key, demand[1], data));
          const legacy = pathname.match(legacyRoute);
          if (legacy && method === "POST") return json(response, 200, closeLegacy(db, actor, key, legacy[1], data));
          if (pathname === "/api/admin/movements" && method === "POST") {
            throw new RequestError(410, "Selecione uma unidade física para movimentar o estoque.");
          }
        }
        throw new RequestError(404, "Operação não encontrada.");
      }
      if (pathname.startsWith("/api/") || (method !== "GET" && method !== "HEAD")) {
        throw new RequestError(404, "Operação não encontrada.");
      }
      await staticFile(pathname, request, response);
    } catch (error) {
      if (response.headersSent || response.destroyed) return;
      if (error instanceof RequestError) return json(response, error.status, { error: error.message });
      if (error instanceof URIError) return json(response, 400, { error: "Endereço inválido." });
      if (error.errcode === 5) return json(response, 503, { error: "Banco ocupado. Tente novamente." });
      console.error("Falha ao processar a solicitação:", error.code || error.name);
      json(response, 500, { error: "Não foi possível concluir a solicitação." });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8080);
  const origin = process.env.RENOVAPAN_ORIGIN || "http://127.0.0.1:" + port;
  const db = openDatabase();
  const app = createApp(db, { origin });
  const host = origin.startsWith("https:") ? process.env.RENOVAPAN_HOST || "127.0.0.1" : "127.0.0.1";
  app.listen(port, host, () => console.log("RENOVAPAN disponível em " + origin));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => app.close(() => db.close()));
}
