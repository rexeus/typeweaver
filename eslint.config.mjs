/* eslint-disable import/no-named-as-default-member */
import eslint from "@eslint/js";
import { globalIgnores } from "eslint/config";
import eslintPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
const config = tseslint.config(
  {
    settings: {
      "import/resolver": {
        typescript: true,
        node: true,
      },
      "import/parsers": {
        "@typescript-eslint/parser": [".ts"],
      },
      "import/core-modules": ["./cli"],
    },
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  importPlugin.flatConfigs.recommended,
  globalIgnores([
    "**/dist/**",
    "**/node_modules/**",
    ".vscode/**",
    "**/output/**",
    "**/outputs/**",
  ]),
  {
    plugins: {
      unicorn,
    },
    rules: {
      "unicorn/prefer-node-protocol": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "none", argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "import/no-useless-path-segments": "error",
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      // "import/exports-last": "warn",
      "import/first": "error",
      "import/max-dependencies": [
        "error",
        {
          max: 10,
          ignoreTypeImports: false,
        },
      ],
      "import/newline-after-import": [
        "error",
        { count: 1, considerComments: true },
      ],
      "import/no-duplicates": ["error", { "prefer-inline": false }],
      "import/no-named-default": "error",
      "import/no-namespace": "error",
      "import/no-unassigned-import": "error",
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          pathGroups: [
            {
              pattern: "@rexeus/typeweaver-core",
              group: "internal",
              position: "before",
            },
            {
              pattern: "@rexeus/typeweaver-*",
              group: "internal",
            },
          ],
          "newlines-between": "never",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
            orderImportKind: "asc",
          },
          named: {
            enabled: true,
            types: "types-last",
          },
        },
      ],
    },
  },
  eslintPrettier
);

export default config;
