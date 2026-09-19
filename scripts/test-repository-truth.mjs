import assert from "node:assert/strict";
import {
  deriveMetadataFields,
  extractMetadataProjectionFields,
  metadataProjectionMatches,
} from "./lib/repository-truth.mjs";

const apiMetadataSource = [
  "export type ApiTagDefinition = {",
  "  readonly name: string;",
  "  readonly description?: string;",
  "};",
  "",
  "export type ApiMetadataDefinition = {",
  "  readonly title: string;",
  "  readonly version: string;",
  "  readonly description?: string;",
  "  readonly tags?: readonly ApiTagDefinition[];",
  "};",
  "",
].join("\n");
const supportedDocumentSource = [
  "The API `title`, `version`, and `description`, plus reusable `tags`, come from",
  "`defineSpec({ metadata: ... })`. Security schemes come from the separate",
  "`defineSpec({ securitySchemes, security })` contract, not from `metadata`.",
  "Metadata is contract data, not plugin configuration.",
  "",
].join("\n");

const expectedFields = ["title", "version", "description", "tags"];
assert.deepEqual(deriveMetadataFields(apiMetadataSource), expectedFields);
assert.deepEqual(
  extractMetadataProjectionFields(supportedDocumentSource),
  expectedFields
);
assert.equal(
  metadataProjectionMatches({
    apiMetadataSource,
    documentSource: supportedDocumentSource,
  }),
  true
);

for (const unsupportedField of [
  "summary",
  "termsOfService",
  "contact",
  "license",
  "externalDocs",
]) {
  const mutated = supportedDocumentSource.replace(
    "The API `title`, `version`, and `description`, plus reusable `tags`, come from",
    `The API \`title\`, \`version\`, \`${unsupportedField}\`, \`description\`, and \`tags\` come from`
  );
  assert.equal(
    metadataProjectionMatches({
      apiMetadataSource,
      documentSource: mutated,
    }),
    false,
    `metadata projection accepted unsupported field ${unsupportedField}`
  );
}

assert.equal(
  metadataProjectionMatches({
    apiMetadataSource,
    documentSource: supportedDocumentSource.replace(
      ", plus reusable `tags`,",
      ""
    ),
  }),
  false,
  "metadata projection accepted a missing field"
);

// The separate security sentence may mention application-owned names without
// changing the metadata projection set.
const securitySentenceSource = supportedDocumentSource.replace(
  "Security schemes come from the separate",
  "`termsOfService` and `summary` stay application-owned. Security schemes come from the separate"
);
assert.equal(
  metadataProjectionMatches({
    apiMetadataSource,
    documentSource: securitySentenceSource,
  }),
  true,
  "metadata projection rejected the separate security sentence"
);

process.stdout.write(
  "Repository truth guard rejected unsupported metadata projection fields\n"
);
