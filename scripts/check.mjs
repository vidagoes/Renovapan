
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

for (const folder of ["server", "js", "scripts", "test"]) {
  for (const file of readdirSync(folder)) {
    if (!/\.(mjs|js|mts)$/.test(file)) continue;
    const check = spawnSync(process.execPath, ["--check", folder + "/" + file], { stdio: "inherit" });
    if (check.status !== 0) process.exit(check.status || 1);
  }
}
console.log("Sintaxe validada.");
