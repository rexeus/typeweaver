import { HttpMethod } from "@rexeus/typeweaver-core";
import { createPluginTestKit } from "@rexeus/typeweaver-gen";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { honoPlugin } from "../../src/index.js";
import { validateHonoSpec } from "../../src/validation.js";

const aSpec = (path: string): NormalizedSpec => ({
  metadata: { title: "File API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [
    {
      name: "file",
      tags: [],
      security: { requirements: [], source: "none" },
      operations: [
        {
          operationId: "getFile",
          method: HttpMethod.GET,
          path,
          summary: "Get a file",
          deprecated: false,
          tags: [],
          security: { requirements: [], source: "none" },
          responses: [],
        },
      ],
    },
  ],
  responses: [],
  warnings: [],
});

describe("validateHonoSpec", () => {
  test("accepts standalone slash-delimited path parameters", () => {
    expect(validateHonoSpec(aSpec("/files/:fileId/content"))).toEqual([]);
  });

  test.each(["/files/:fileId.:format", "/assets/:name-:hash.:ext"])(
    "rejects embedded path parameters in %s",
    path => {
      expect(validateHonoSpec(aSpec(path))).toEqual([
        expect.objectContaining({
          code: "TW-PLUGIN-HONO-001",
          severity: "error",
          path: "/resources/0/operations/0/path",
        }),
      ]);
    }
  );

  test("fails generation before writing files for an embedded path", () => {
    const kit = createPluginTestKit({
      normalizedSpec: aSpec("/files/:fileId.:format"),
    });
    const generate = honoPlugin.generate?.(kit.buildGeneratorContext());

    expect(() => Effect.runSync(generate ?? Effect.void)).toThrow(
      /TW-PLUGIN-HONO-001/
    );
    expect(kit.files.list()).toEqual([]);
  });
});
