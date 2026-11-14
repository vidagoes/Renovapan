
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { encryptTotp, totpKey } from "./totp.mjs";
import { businessDay } from "./stock.mjs";

const migrations = ["001-initial.sql", "002-units.sql", "003-quote-and-totp.sql"];

export function openDatabase(filename = process.env.RENOVAPAN_DB || ".renovapan/catalogo.sqlite") {
  if (filename !== ":memory:") mkdirSync(dirname(resolve(filename)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.function("business_day", { deterministic: true }, timestamp => businessDay(new Date(timestamp)));
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA secure_delete = ON;");
  try {
    transaction(db, () => {
      const version = db.prepare("PRAGMA user_version").get().user_version;
      if (version > migrations.length) throw new Error("A versão do banco é mais recente do que este servidor.");
      for (let index = version; index < migrations.length; index++) {
        if (migrations[index] === "003-quote-and-totp.sql") {
          const legacy = db.prepare("SELECT totp_secret FROM owner WHERE id = 1").get()?.totp_secret;
          if (legacy && !legacy.startsWith("v1:")) {
            const key = totpKey();
            if (!key || !/^[A-Z2-7]{32}$/.test(legacy)) {
              throw new Error("Configure RENOVAPAN_TOTP_KEY e confira o segundo fator legado antes de migrar.");
            }
            db.prepare("UPDATE owner SET totp_secret = ? WHERE id = 1").run(encryptTotp(legacy, key));
          }
        }
        db.exec(readFileSync(new URL("./migrations/" + migrations[index], import.meta.url), "utf8"));
        db.exec("PRAGMA user_version = " + (index + 1));
      }
    });
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function transaction(db, operation) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export const now = () => new Date().toISOString();
