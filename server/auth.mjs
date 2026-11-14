
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { transaction } from "./db.mjs";
import { RequestError } from "./inventory.mts";
import { decryptTotp, encryptTotp, newTotpSecret, totpKey, verifiedTotp } from "./totp.mjs";

const sessionDuration = 8 * 60 * 60 * 1000;
const passwordOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const dummyHash = "00000000000000000000000000000000:" + "00".repeat(64);
const digest = value => createHash("sha256").update(value).digest("hex");

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64, passwordOptions).toString("hex");
}

export function strongPassword(password) {
  return typeof password === "string" && password.length >= 14 && password.length <= 256
    && new Set(password.trim().toLowerCase()).size >= 8
    && !/^(password|senha|renovapan|qwerty|123456)/i.test(password.trim());
}

function passwordMatches(password, stored) {
  const [salt, hash] = (stored || dummyHash).split(":");
  return timingSafeEqual(scryptSync(password, salt, 64, passwordOptions), Buffer.from(hash, "hex"));
}

export function setOwner(db, username, password) {
  if (!strongPassword(password)) throw new RequestError(400, "Use uma senha forte de 14 a 256 caracteres.");
  const hash = hashPassword(password);
  transaction(db, () => {
    db.prepare("INSERT INTO owner (id, username, password_hash, totp_secret) VALUES (1, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET username=excluded.username, password_hash=excluded.password_hash, totp_secret=NULL, last_totp=-1").run(username, hash);
    db.exec("DELETE FROM sessions");
  });
}

export function authenticate(db, username, password, otp, key = totpKey()) {
  if (typeof username !== "string" || username.length > 64 || typeof password !== "string" || password.length > 256) return null;
  const owner = db.prepare("SELECT * FROM owner WHERE username = ?").get(username.trim().toLowerCase());
  const valid = passwordMatches(password, owner?.password_hash);
  if (!owner || !valid) return null;
  let step = null;
  if (owner.totp_secret) {
    try { step = verifiedTotp(decryptTotp(owner.totp_secret, key), otp, owner.last_totp); }
    catch { return null; }
    if (step === null) return null;
  }

  return transaction(db, () => {
    const current = db.prepare("SELECT password_hash, totp_secret, last_totp FROM owner WHERE id = 1").get();
    if (current?.password_hash !== owner.password_hash || current.totp_secret !== owner.totp_secret) return null;
    if (step !== null) {
      if (current.last_totp >= step) return null;
      db.prepare("UPDATE owner SET last_totp = ? WHERE id = 1").run(step);
    }
    return createSession(db);
  });
}

function createSession(db) {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES (?, 1, ?)").run(digest(token), Date.now() + sessionDuration);
  return token;
}

export function beginTotp(db, token, password, key = totpKey()) {
  if (!key) throw new RequestError(503, "Configure a chave TOTP no servidor antes de ativar.");
  return transaction(db, () => {
    if (!sessionOwner(db, token)) throw new RequestError(401, "Entre no painel para continuar.");
    const owner = db.prepare("SELECT password_hash, totp_secret FROM owner WHERE id = 1").get();
    if (owner.totp_secret) throw new RequestError(409, "O segundo fator já está ativo.");
    if (typeof password !== "string" || password.length > 256 || !passwordMatches(password, owner.password_hash)) {
      throw new RequestError(400, "Confira a senha atual.");
    }
    if (!strongPassword(password)) throw new RequestError(400, "Redefina a senha pelo terminal antes de ativar o segundo fator.");
    const secret = newTotpSecret();
    db.prepare("INSERT OR REPLACE INTO totp_enrollment VALUES (?, ?, ?)").run(digest(token), encryptTotp(secret, key), Date.now() + 10 * 60 * 1000);
    return { secret };
  });
}

export function confirmTotp(db, token, otp, key = totpKey()) {
  if (!key) throw new RequestError(503, "Chave TOTP indisponível no servidor.");
  return transaction(db, () => {
    const owner = sessionOwner(db, token);
    if (!owner) throw new RequestError(401, "Entre no painel para continuar.");
    if (owner.totpEnabled) throw new RequestError(409, "O segundo fator já está ativo.");
    const pending = db.prepare("SELECT encrypted_secret FROM totp_enrollment WHERE session_hash = ? AND expires_at > ?").get(digest(token), Date.now());
    if (!pending) throw new RequestError(409, "A ativação expirou. Gere uma nova chave.");
    const step = verifiedTotp(decryptTotp(pending.encrypted_secret, key), otp, -1);
    if (step === null) throw new RequestError(400, "Código inválido. Confira o autenticador.");
    db.prepare("UPDATE owner SET totp_secret = ?, last_totp = ? WHERE id = 1").run(pending.encrypted_secret, step);
    db.exec("DELETE FROM sessions");
    return createSession(db);
  });
}

export function sessionToken(request, secure) {
  const name = secure ? "__Host-renovapan" : "renovapan_session";
  return (request.headers.cookie || "").split(";").map(part => part.trim())
    .find(part => part.startsWith(name + "="))?.slice(name.length + 1);
}

export function sessionOwner(db, token) {
  if (!/^[a-f0-9]{64}$/.test(token || "")) return null;
  return db.prepare("SELECT owner.username, owner.totp_secret IS NOT NULL AS totpEnabled FROM sessions JOIN owner ON owner.id = sessions.owner_id WHERE token_hash = ? AND expires_at > ?").get(digest(token), Date.now()) || null;
}

export function endSession(db, token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(digest(token));
}

export function sessionCookie(token, secure) {
  const name = secure ? "__Host-renovapan" : "renovapan_session";
  return name + "=" + (token || "") + "; Path=/; HttpOnly; SameSite=Strict; Max-Age="
    + (token ? sessionDuration / 1000 : 0) + (secure ? "; Secure" : "");
}
