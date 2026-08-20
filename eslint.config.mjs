import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Layer boundaries, enforced by path. The flow is always
 *   app → modules → db → platform
 * never skipping a layer and never reversing. See docs/architecture.md.
 */

// Reused message fragments, so a violation explains the fix rather than the rule.
/** Every module barrel. Importing one pulls the whole server surface. */
const MODULE_BARRELS = [
  "@/modules/booking",
  "@/modules/catalog",
  "@/modules/clients",
  "@/modules/identity",
  "@/modules/media",
  "@/modules/notifications",
  "@/modules/studio",
  "@/modules/terms",
];

const TABLE_ACCESS =
  "Table access belongs in src/db/<table>.ts. Add (or reuse) a function there and call it — that is what keeps a column list, a soft-delete filter and a join shape to one definition each.";

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

  // ---------------------------------------------------------------- db
  {
    // Rule 1: only the data layer may query a table.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/db/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='from'][arguments.0.type='Literal']",
          message: TABLE_ACCESS,
        },
      ],
    },
  },
  {
    // Rule 2: the data layer stays underneath everything. It may reach
    // platform (the client type, the PostgREST embed helper) and shared, and
    // nothing above it.
    files: ["src/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules",
                "@/modules/**",
                "@/components",
                "@/components/**",
                "@/app",
                "@/app/**",
                "@/hooks",
                "@/hooks/**",
              ],
              message:
                "db/ is the bottom of the stack: one table per file, no authorization, no revalidation, no UI. If you need two tables or a policy decision, you are writing a service — put it in modules/<domain>/.",
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------ modules
  {
    // Rule 3: the service layer owns composition and authorization, never UI.
    files: ["src/modules/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components", "@/components/**", "@/app", "@/app/**"],
              message:
                "The service layer must stay UI-free. A type a component also needs belongs in shared/, not in a component.",
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------- shared
  {
    // Rule 4: shared/ is the isomorphic floor — pure rules, view models and
    // helpers that both a server action and a browser component can run. It may
    // reference db row *types*; it may not reach a vendor, a service or the UI.
    files: ["src/shared/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules",
                "@/modules/**",
                "@/platform/**",
                "@/components",
                "@/components/**",
                "@/app",
                "@/app/**",
              ],
              message:
                "shared/ must stay free of vendors, services and UI — that is what lets a client component import it. Server-only work belongs in modules/<domain>/.",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------- app
  {
    // Rule 5: a route renders; it does not fetch. Pages and layouts ask a
    // module one question and pass the answer down.
    files: [
      "src/app/**/page.tsx",
      "src/app/**/layout.tsx",
      "src/app/**/loading.tsx",
      "src/app/**/error.tsx",
      "src/app/**/not-found.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/db", "@/db/**", "@/platform", "@/platform/**"],
              message:
                "A page goes through modules/<domain>. If no module answers this page's question yet, add a read that does — that composition is the service layer's job, not the page's.",
            },
          ],
        },
      ],
    },
  },
  {
    // Rule 6: shared components are leaf UI. They may call server actions and
    // read through db/ (isomorphic, RLS-scoped), but a module barrel is
    // transitively server-only and would poison the browser bundle.
    //
    // Scope note: co-located `_components/` are deliberately NOT here, because
    // that folder holds server components too and a path glob cannot see the
    // "use client" directive. For those, the Turbopack build is the enforcer —
    // a stronger check than lint, since it walks the whole import graph and
    // prints the offending trace. See docs/architecture.md.
    files: ["src/components/**"],
    rules: {
      // The typescript-eslint variant, for `allowTypeImports`: a type import is
      // erased at compile time and so cannot reach the browser bundle, while a
      // value import from the same path would.
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          // Exact paths, not a glob: the ban is on the barrel itself, while
          // the files inside a module stay importable.
          paths: MODULE_BARRELS.map((name) => ({
            name,
            allowTypeImports: true,
            message:
              "A module barrel is transitively server-only (cookies, service-role, storage). Import the module's *-actions file for mutations, @/shared/* for rules and view models, or @/db/* for a reactive read. (A type-only import is fine — it is erased.)",
          })),
        },
      ],
    },
  },

  // ---------------------------------------------------- browser-only code
  {
    // Rule 7: hooks and every component — co-located or shared — run in or
    // alongside the browser. None of them may build a server Supabase client;
    // the browser client is the only one that belongs on this side.
    files: ["src/hooks/**", "src/components/**", "src/app/**/_components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/platform/supabase/server",
              message:
                "Components and hooks never build a server client. A page passes data down, or a client component reads through @/db/* with the browser client (RLS scopes it).",
            },
            {
              name: "@/platform/supabase/ssr-server",
              message:
                "Components and hooks never build a server client. Use @/platform/supabase/client in the browser.",
            },
          ],
        },
      ],
    },
  },
  {
    // Rule 8: a hook is always browser code, so the module-barrel ban is
    // unconditional here (unlike _components/, which mixes both).
    files: ["src/hooks/**"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            ...MODULE_BARRELS.map((name) => ({
              name,
              allowTypeImports: true,
              message:
                "A hook runs in the browser; a module barrel is transitively server-only. Import the module's *-actions file, @/shared/*, or @/db/*.",
            })),
            {
              name: "@/platform/supabase/server",
              message: "Hooks use @/platform/supabase/client.",
            },
            {
              name: "@/platform/supabase/ssr-server",
              message: "Hooks use @/platform/supabase/client.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
