/** @type {Record<string, unknown>} */
export const expectedRootRules = {
  "eslint/complexity": ["error", { max: 10, variant: "classic" }],
  "eslint/max-depth": ["error", { max: 3 }],
  "eslint/max-lines": [
    "error",
    { max: 250, skipBlankLines: true, skipComments: false },
  ],
  "eslint/max-lines-per-function": [
    "error",
    { max: 60, skipBlankLines: true, skipComments: true },
  ],
  "eslint/max-nested-callbacks": ["error", { max: 3 }],
  "eslint/max-params": ["error", { max: 4, countThis: "except-void" }],
  "eslint/max-statements": ["error", { max: 30 }],
  "eslint/no-eval": "error",
  "eslint/no-implied-eval": "error",
  "eslint/no-new-func": "error",
  "unicorn/prefer-node-protocol": "error",
  "eslint/no-unused-vars": "off",
  "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
  "import/max-dependencies": ["error", { max: 10, ignoreTypeImports: false }],
  "import/no-cycle": "error",
  "import/no-duplicates": "error",
  "import/no-named-default": "error",
  "import/no-namespace": "error",
  "import/no-self-import": "error",
  "import/no-unassigned-import": "error",
  "sonarjs/cognitive-complexity": ["error", 12],
  "sonarjs/expression-complexity": ["error", { max: 6 }],
  "sonarjs/no-nested-switch": "error",
  "typeweaver/pure-barrel": "error",
};

/** @type {Record<string, unknown>} */
export const expectedTypeScriptRules = {
  "typescript/consistent-type-definitions": ["error", "type"],
  "typescript/no-explicit-any": "error",
  "typescript/no-floating-promises": "error",
  "typescript/no-misused-promises": "error",
  "typescript/no-non-null-assertion": "error",
  "typescript/no-unsafe-argument": "error",
  "typescript/no-unsafe-assignment": "error",
  "typescript/no-unsafe-call": "error",
  "typescript/no-unsafe-member-access": "error",
  "typescript/no-unsafe-return": "error",
  "typescript/switch-exhaustiveness-check": "error",
};

export const expectedIgnorePatterns = [
  "**/dist/**",
  "**/node_modules/**",
  ".vscode/**",
  "**/output/**",
  "**/outputs/**",
];

export const expectedTestFiles = [
  "packages/**/__test__/**/*.ts",
  "packages/**/__test__/**/*.tsx",
  "packages/**/*.test.ts",
  "packages/**/*.test.tsx",
  "packages/**/*.spec.ts",
  "packages/**/*.spec.tsx",
  "packages/**/*.tst.ts",
  "packages/**/*.tst.tsx",
  "config/**/*.test.ts",
  "config/**/*.test.tsx",
  "config/**/*.spec.ts",
  "config/**/*.spec.tsx",
  "config/**/*.tst.ts",
  "config/**/*.tst.tsx",
  "scripts/test-*.mjs",
];

export const expectedTestStructuralRelaxations = {
  "eslint/max-lines": [
    "error",
    { max: 350, skipBlankLines: true, skipComments: false },
  ],
  "eslint/max-lines-per-function": "off",
  "eslint/max-nested-callbacks": "off",
};

export const expectedTypedTestFiles = [
  "packages/**/__test__/**/*.ts",
  "packages/**/__test__/**/*.tsx",
  "packages/**/*.test.ts",
  "packages/**/*.test.tsx",
  "packages/**/*.spec.ts",
  "packages/**/*.spec.tsx",
  "packages/**/*.tst.ts",
  "packages/**/*.tst.tsx",
];

export const expectedTypeScriptFiles = [
  "packages/**/*.ts",
  "packages/**/*.tsx",
];
export const expectedTypeScriptExcludeFiles = [
  "packages/**/__test__/**",
  "packages/**/*.test.ts",
  "packages/**/*.test.tsx",
  "packages/**/*.spec.ts",
  "packages/**/*.spec.tsx",
  "packages/**/*.tst.ts",
  "packages/**/*.tst.tsx",
  "packages/**/tsdown.config.ts",
  "packages/**/examples/**",
  "packages/**/fixtures/**",
  "packages/**/test-fixtures/**",
  "packages/test-utils/src/test-server/runtimes/serve-*.ts",
];
