export function runtime(env = process.env) {
  const prototype = env.RENOVAPAN_PROTOTIPO === "1";
  const port = Number(env.PORT || 8080);
  const origin = env.RENOVAPAN_ORIGIN || "http://127.0.0.1:" + port;
  if (prototype) {
    assertPrototype(origin, env);
    if (env.RENOVAPAN_DB) throw new Error("Remova RENOVAPAN_DB. O protótipo usa .renovapan/prototipo.sqlite.");
  }
  return { prototype, port, origin, database: prototype ? ".renovapan/prototipo.sqlite" : env.RENOVAPAN_DB };
}

export function assertPrototype(origin, env = process.env) {
  const url = new URL(origin);
  if (env.NODE_ENV === "production" || url.protocol !== "http:"
    || !["127.0.0.1", "localhost"].includes(url.hostname)
    || (env.RENOVAPAN_HOST && env.RENOVAPAN_HOST !== "127.0.0.1")) {
    throw new Error("O modo protótipo só pode rodar por HTTP local em 127.0.0.1 fora de produção.");
  }
}
