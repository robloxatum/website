import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The secret-key Supabase client (bypasses RLS) is for sending push notifications only.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/push/send.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/lib/supabase/admin", "**/supabase/admin"], message: "The secret-key client is for lib/push/send.ts only." }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // End-to-end test builds and reports.
    ".next-e2e/**",
    ".next-prodcheck/**",
    "playwright-report/**",
    "test-results/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
