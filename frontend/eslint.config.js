import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "src/api/schema.d.ts", "public/theme-init.js"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, jsxA11y.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          // Hooks and helpers that live beside their provider or component by design.
          allowExportNames: [
            "useAuth",
            "useToast",
            "useTheme",
            "safeNext",
            "MARKETING_NAV",
            "createQueryClient",
            "router",
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Never inject HTML: render user content as text (see components/RichText.tsx).",
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "localStorage",
          message: "Never store tokens or personal data in localStorage. Wrap preference storage in try/catch.",
        },
      ],
    },
  },
  {
    // Preference storage (theme, signed-in hint) is deliberate and documented in these files.
    files: ["src/lib/theme.tsx", "src/api/auth.ts", "src/test/**", "src/**/*.test.{ts,tsx}"],
    rules: { "no-restricted-globals": "off" },
  },
  {
    files: ["vite.config.ts", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
);
