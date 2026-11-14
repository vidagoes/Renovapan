import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const purpose = Buffer.from("RENOVAPAN owner TOTP v1");

export function totpKey(value = process.env.RENOVAPAN_TOTP_KEY) {
  if (!/^[0-9a-f]{64}$/i.test(value || "")) return null;
  return Buffer.from(value, "hex");
}

export function newTotpSecret() {
  const bits = [...randomBytes(20)].map(byte => byte.toString(2).padStart(8, "0")).join("");
  return bits.match(/.{5}/g).map(chunk => alphabet[parseInt(chunk, 2)]).join("");
}

export function encryptTotp(secret, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(purpose);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return "v1:" + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decryptTotp(value, key) {
  if (!key || !value.startsWith("v1:")) throw new Error("Chave TOTP indisponível.");
  const bytes = Buffer.from(value.slice(3), "base64url");
  const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  cipher.setAAD(purpose);
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8");
}

export function verifiedTotp(secret, value, lastUsed) {
  if (typeof value !== "string" || !/^\d{6}$/.test(value)) return null;
  const bits = [...secret].map(character => alphabet.indexOf(character).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g).map(chunk => parseInt(chunk, 2)));
  const current = Math.floor(Date.now() / 30000);
  for (const step of [current, current - 1, current + 1]) {
    if (step <= lastUsed || step < 0) continue;
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(step));
    const mac = createHmac("sha1", key).update(message).digest();
    const offset = mac[mac.length - 1] & 15;
    const code = ((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
    if (timingSafeEqual(Buffer.from(code), Buffer.from(value))) return step;
  }
  return null;
}
