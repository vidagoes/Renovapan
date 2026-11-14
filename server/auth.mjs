
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { transaction } from "./db.mjs";

const sessionDuration = 8 * 60 * 60 * 1000;
const passwordOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const dummyHash = "00000000000000000000000000000000:" + "00".repeat(64);
const digest = value => createHash("sha256").update(value).digest("hex");

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64, passwordOptions).toString("hex");
}

export function setOwner(db, username, password) {
  const hash = hashPassword(password);
  transaction(db, () => {
    db.prepare("INSERT INTO owner (id, username, password_hash, totp_secret) VALUES (1, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET username=excluded.username, password_hash=excluded.password_hash, totp_secret=NULL, last_totp=-1").run(username, hash);
    db.exec("DELETE FROM sessions");
  });
}

export function authenticate(db, username, password) {
  if (typeof username !== "string" || username.length > 64 || typeof password !== "string" || password.length > 256) return null;
  const owner = db.prepare("SELECT * FROM owner WHERE username = ?").get(username.trim().toLowerCase());
  const [salt, hash] = (owner?.password_hash || dummyHash).split(":");
  const valid = timingSafeEqual(scryptSync(password, salt, 64, passwordOptions), Buffer.from(hash, "hex"));
  if (!owner || !valid) return null;

  return transaction(db, () => {
    const current = db.prepare("SELECT password_hash FROM owner WHERE id = 1").get();
    if (current?.password_hash !== owner.password_hash) return null;
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES (?, 1, ?)").run(digest(token), Date.now() + sessionDuration);
    return token;
  });
}

export function sessionToken(request, secure) {
  const name = secure ? "__Host-renovapan" : "renovapan_session";
  return (request.headers.cookie || "").split(";").map(part => part.trim())
    .find(part => part.startsWith(name + "="))?.slice(name.length + 1);
}

export function sessionOwner(db, token) {
  if (!/^[a-f0-9]{64}$/.test(token || "")) return null;
  return db.prepare("SELECT owner.username FROM sessions JOIN owner ON owner.id = sessions.owner_id WHERE token_hash = ? AND expires_at > ?").get(digest(token), Date.now()) || null;
}

export function endSession(db, token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(digest(token));
}

export function sessionCookie(token, secure) {
  const name = secure ? "__Host-renovapan" : "renovapan_session";
  return name + "=" + (token || "") + "; Path=/; HttpOnly; SameSite=Strict; Max-Age="
    + (token ? sessionDuration / 1000 : 0) + (secure ? "; Secure" : "");
}
