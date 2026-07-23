import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored Claude Code skill docs/templates — not our source (also gitignored).
    ".agents/**",
    ".claude/**",
  ]),

  // Module boundaries — enforced by path so a future monorepo split
  // (packages/core, apps/*) is already clean. See docs/module-boundaries.md.
  {
    // Domain layer stays UI-free and reusable.
    files: ["src/lib/**", "src/config/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components", "@/components/**", "@/app", "@/app/**"],
              message:
                "Domain layer (lib/config) must stay UI-free — move shared types/logic down into lib instead of importing components/app.",
            },
          ],
        },
      ],
    },
  },
  {
    // Web/client surface must not reach into admin internals.
    files: [
      "src/components/sections/**",
      "src/components/layout/**",
      "src/app/**",
    ],
    ignores: ["src/app/admin/**", "src/app/api/**", "src/app/icons/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components/admin",
                "@/components/admin/**",
                "@/app/admin",
                "@/app/admin/**",
                "@/lib/admin",
                "@/lib/admin/**",
              ],
              message:
                "Web/client surface must not import admin internals — admin is a separate module.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
