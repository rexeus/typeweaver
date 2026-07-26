import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const packageReadme = readFileSync(
  new URL("../../README.md", import.meta.url),
  "utf8"
);
const rootReadme = readFileSync(
  new URL("../../../../README.md", import.meta.url),
  "utf8"
);

describe("OpenAPI documentation contract", () => {
  test("advertises both explicit profiles and the compatibility default", () => {
    expect(rootReadme).toContain(
      "Generates validated OpenAPI 3.1.2 and 3.2.0 JSON documents"
    );
    expect(packageReadme).toContain("`3.1.2` is the default");
    expect(packageReadme).toContain('`target: "3.2.0"`');
    expect(packageReadme).toContain("OpenAPI 3.1.1");
  });

  test("publishes supported, lossy, and out-of-scope boundaries", () => {
    expect(packageReadme).toContain("## Support matrix");
    expect(packageReadme).toContain("### Supported");
    expect(packageReadme).toContain("### Lossy with diagnostics");
    expect(packageReadme).toContain("### Out of scope");
    expect(packageReadme).toContain("TW-PLUGIN-OPENAPI-");
  });

  test("rejects importer and round-trip overclaims explicitly", () => {
    expect(packageReadme).toContain("does not import OpenAPI");
    expect(packageReadme).toContain(
      "does not provide bidirectional Zod/OpenAPI/Effect Schema round-tripping"
    );
  });
});
