/**
 * @typedef {object} Identifier
 * @property {string} type
 * @property {string} name
 *
 * @typedef {object} Specifier
 * @property {Identifier} [local]
 * @property {string} [exportKind]
 *
 * @typedef {object} Statement
 * @property {string} type
 * @property {unknown} [source]
 * @property {Statement | null} [declaration]
 * @property {boolean} [declare]
 * @property {string} [exportKind]
 * @property {string} [name]
 * @property {Specifier[]} [specifiers]
 *
 * @typedef {{ body: readonly Statement[] }} Program
 * @typedef {{ report: (diagnostic: { node: Statement, messageId: string }) => void }} RuleContext
 */

const typeDeclarations = new Set([
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
]);

/** @param {Statement} statement */
const isDirectReExport = statement =>
  (statement.type === "ExportNamedDeclaration" && statement.source != null) ||
  statement.type === "ExportAllDeclaration";

/**
 * @param {Statement} statement
 * @returns {boolean}
 */
const isTypeDeclaration = statement =>
  typeDeclarations.has(statement.type) ||
  statement.declare === true ||
  (statement.type === "ExportNamedDeclaration" &&
    statement.declaration != null &&
    isTypeDeclaration(statement.declaration));

/**
 * @param {Specifier} specifier
 * @param {Set<string>} importedBindings
 */
const exportsImportedBinding = (specifier, importedBindings) =>
  specifier.local?.type === "Identifier" &&
  importedBindings.has(specifier.local.name);

/**
 * @param {Statement} statement
 * @param {Set<string>} importedBindings
 */
const isImportedBindingExport = (statement, importedBindings) => {
  if (statement.exportKind === "type") return true;
  return (statement.specifiers ?? []).every(
    specifier =>
      specifier.exportKind === "type" ||
      exportsImportedBinding(specifier, importedBindings)
  );
};

/**
 * A local `export { … }` or `export type { … }` without `from` that exports an
 * imported binding is barrel wiring, exactly like `export … from`.
 *
 * @param {Statement} statement
 * @param {Set<string>} importedBindings
 */
const isLocalReExport = (statement, importedBindings) =>
  statement.type === "ExportNamedDeclaration" &&
  statement.source == null &&
  statement.declaration == null &&
  (statement.specifiers ?? []).some(specifier =>
    exportsImportedBinding(specifier, importedBindings)
  );

/**
 * @param {readonly Statement[]} statements
 * @param {Set<string>} importedBindings
 */
const doesBarrelWiring = (statements, importedBindings) =>
  statements.some(
    statement =>
      isDirectReExport(statement) ||
      isLocalReExport(statement, importedBindings)
  );

/** @param {readonly Statement[]} statements */
const importedBindingsFor = statements => {
  /** @type {Set<string>} */
  const importedBindings = new Set();
  for (const statement of statements) {
    if (statement.type !== "ImportDeclaration") continue;
    for (const specifier of statement.specifiers ?? []) {
      if (specifier.local === undefined) continue;
      importedBindings.add(specifier.local.name);
    }
  }
  return importedBindings;
};

/**
 * @param {Statement} statement
 * @param {Set<string>} importedBindings
 */
const isAllowedNamedExport = (statement, importedBindings) => {
  if (statement.source != null || isTypeDeclaration(statement)) return true;
  if (statement.declaration != null) return false;
  return isImportedBindingExport(statement, importedBindings);
};

/**
 * @param {Statement} statement
 * @param {Set<string>} importedBindings
 */
const isImportedDefaultExport = (statement, importedBindings) => {
  const declaration = statement.declaration;
  return (
    declaration !== null &&
    declaration !== undefined &&
    declaration.type === "Identifier" &&
    declaration.name !== undefined &&
    importedBindings.has(declaration.name)
  );
};

/**
 * @param {Statement} statement
 * @param {Set<string>} importedBindings
 */
const isAllowedStatement = (statement, importedBindings) => {
  if (statement.type === "ImportDeclaration") return true;
  if (isTypeDeclaration(statement)) return true;
  if (statement.type === "ExportAllDeclaration") return true;
  if (statement.type === "ExportNamedDeclaration") {
    return isAllowedNamedExport(statement, importedBindings);
  }
  return (
    statement.type === "ExportDefaultDeclaration" &&
    isImportedDefaultExport(statement, importedBindings)
  );
};

const pureBarrelRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require files that re-export imported bindings to contain only barrel wiring",
    },
    messages: {
      mixedImplementation:
        "Files that re-export imported bindings may not contain runtime implementation.",
    },
    schema: [],
  },
  /**
   * @param {RuleContext} context
   * @returns {{ Program: (program: Program) => void }}
   */
  create(context) {
    return {
      Program(program) {
        const importedBindings = importedBindingsFor(program.body);
        if (!doesBarrelWiring(program.body, importedBindings)) return;
        for (const statement of program.body) {
          if (isAllowedStatement(statement, importedBindings)) continue;
          context.report({ node: statement, messageId: "mixedImplementation" });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "typeweaver" },
  rules: { "pure-barrel": pureBarrelRule },
};

export { pureBarrelRule };
export default plugin;
