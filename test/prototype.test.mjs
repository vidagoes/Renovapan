import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { createApp } from "../server/app.mjs";
import { sessionOwner, setOwner } from "../server/auth.mjs";
import { openDatabase } from "../server/db.mjs";
import { runtime } from "../server/runtime.mjs";

test("modo protótipo exige opção explícita, loopback e banco próprio", () => {
  assert.equal(runtime({}).prototype, false);
  assert.equal(runtime({ RENOVAPAN_PROTOTIPO: "0" }).prototype, false);
  const env = { RENOVAPAN_PROTOTIPO: "1", PORT: "4183" };
  assert.deepEqual(runtime(env), {
    prototype: true, port: 4183, origin: "http://127.0.0.1:4183", database: ".renovapan/prototipo.sqlite"
  });
  for (const field of [
    { NODE_ENV: "production" }, { RENOVAPAN_ORIGIN: "https://localhost" },
    { RENOVAPAN_ORIGIN: "http://example.test" }, { RENOVAPAN_HOST: "0.0.0.0" }
  ]) assert.throws(() => runtime({ ...env, ...field }), /HTTP local/);
  assert.throws(() => runtime({ ...env, RENOVAPAN_DB: "dados.sqlite" }), /Remova RENOVAPAN_DB/);
});

test("login local de oito caracteres protege o painel sem exigir TOTP", async () => {
  const db = openDatabase(":memory:");
  const credentials = { username: "teste", password: "Teste-42" };
  assert.throws(() => setOwner(db, "teste", "Teste-4", { prototype: true }), /8 a 256/);
  assert.throws(() => setOwner(db, "teste", credentials.password), /senha forte/);
  setOwner(db, credentials.username, credentials.password, { prototype: true });
  assert.notEqual(db.prepare("SELECT password_hash FROM owner").get().password_hash, credentials.password);
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  try {
    await once(listener, "listening");
    const origin = "http://127.0.0.1:" + listener.address().port;
    listener.on("request", createApp(db, { origin, prototype: true }).listeners("request")[0]);
    const api = (path, { data, cookie, extra } = {}) => fetch(origin + path, {
      method: data ? "POST" : "GET",
      headers: { Origin: origin, "Content-Type": "application/json", ...(cookie && { Cookie: cookie }), ...extra },
      body: data ? JSON.stringify(data) : undefined
    });
    assert.match(await (await api("/admin")).text(), /data-prototype="true"/);
    assert.equal((await api("/api/admin/products")).status, 401);
    assert.equal((await api("/api/admin/login", { data: { ...credentials, password: "errada" } })).status, 401);
    assert.equal((await api("/admin", { extra: { "X-Forwarded-Host": "example.test" } })).status, 403);
    const login = await api("/api/admin/login", { data: credentials });
    assert.equal(login.status, 200);
    const header = login.headers.get("set-cookie");
    assert.match(header, /^renovapan_prototipo=.*HttpOnly.*SameSite=Strict/);
    const cookie = header.split(";")[0];
    const token = cookie.slice("renovapan_prototipo=".length);
    assert.equal(sessionOwner(db, token), null);
    assert.equal((await api("/api/admin/dashboard", { cookie })).status, 200);
    assert.equal((await api("/api/admin/totp/begin", { data: credentials, cookie })).status, 404);
    assert.equal((await api("/api/admin/logout", { data: {}, cookie })).status, 204);
    assert.equal((await api("/api/admin/products", { cookie })).status, 401);
  } finally {
    await new Promise(resolve => listener.close(resolve));
    db.close();
  }
});
