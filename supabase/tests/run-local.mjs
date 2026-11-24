// Runs the migrations and security tests in PGlite (Postgres compiled to WASM).
// No Docker or Supabase project needed:  npm run test:db
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(readFileSync(join(here, "supabase-shim.sql"), "utf8"));

for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  try {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  } catch (err) {
    console.error(`❌ Migration ${file} failed: ${err.message}${err.where ? `\n   at ${err.where}` : ""}`);
    process.exit(1);
  }
  console.log(`applied ${file}`);
}

try {
  const results = await db.exec(readFileSync(join(here, "security_test.sql"), "utf8"));
  const last = results.flatMap((r) => r.rows).find((row) => row.result);
  if (last?.result !== "ALL SECURITY TESTS PASSED") throw new Error("Tests did not finish");
  console.log("✅ ALL SECURITY TESTS PASSED");
} catch (err) {
  console.error(`❌ Security test failed: ${err.message}${err.where ? `\n   at ${err.where}` : ""}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
