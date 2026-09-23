import fs from "node:fs";
import path from "node:path";

/**
 * Writes `spec/index.ts` with one `getItem` operation and returns its path.
 */
export const writeTinySpec = (workspace: string): string => {
  const specFile = path.join(workspace, "spec", "index.ts");
  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(
    specFile,
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      'import { z } from "zod";',
      "",
      "const itemLoaded = defineResponse({",
      '  name: "ItemLoaded",',
      "  statusCode: HttpStatusCode.OK,",
      '  description: "Item loaded",',
      "  body: z.object({ id: z.string() }),",
      "});",
      "",
      "export const spec = defineSpec({",
      '  metadata: { title: "Items API", version: "1.0.0" },',
      "  resources: {",
      "    item: {",
      "      operations: [",
      "        defineOperation({",
      '          operationId: "getItem",',
      '          path: "/items/:itemId",',
      "          method: HttpMethod.GET,",
      '          summary: "Get item",',
      "          request: { param: z.object({ itemId: z.string() }) },",
      "          responses: [itemLoaded],",
      "        }),",
      "      ],",
      "    },",
      "  },",
      "});",
      "",
    ].join("\n")
  );
  return specFile;
};

export type HealthSpecOptions = {
  readonly title?: string;
  /** Adds a second resource that reuses the `ping` operation ID. */
  readonly duplicateOperationId?: boolean;
};

/**
 * Writes `spec/index.ts` with one `ping` operation and returns its path.
 */
export const writeHealthSpec = (
  workspace: string,
  options: HealthSpecOptions = {}
): string => {
  const specPath = path.join(workspace, "spec", "index.ts");
  const duplicateResource = options.duplicateOperationId
    ? [
        "    duplicate: {",
        "      operations: [",
        "        defineOperation({",
        '          operationId: "ping",',
        '          path: "/duplicate",',
        "          method: HttpMethod.GET,",
        '          summary: "Duplicate ping",',
        "          request: {},",
        "          responses: [ok],",
        "        }),",
        "      ],",
        "    },",
      ]
    : [];

  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(
    specPath,
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      "",
      "const ok = defineResponse({",
      '  name: "Ok",',
      "  statusCode: HttpStatusCode.OK,",
      '  description: "OK",',
      "});",
      "",
      "export const spec = defineSpec({",
      `  metadata: { title: ${JSON.stringify(options.title ?? "Health API")}, version: "1.0.0" },`,
      "  resources: {",
      "    health: {",
      "      operations: [",
      "        defineOperation({",
      '          operationId: "ping",',
      '          path: "/ping",',
      "          method: HttpMethod.GET,",
      '          summary: "Ping",',
      "          request: {},",
      "          responses: [ok],",
      "        }),",
      "      ],",
      "    },",
      ...duplicateResource,
      "  },",
      "});",
      "",
    ].join("\n")
  );
  return specPath;
};

/**
 * Writes a `spec/index.ts` without resources and returns its path.
 */
export const writeEmptySpec = (workspace: string): string => {
  const specPath = path.join(workspace, "spec", "index.ts");
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(
    specPath,
    [
      'import { defineSpec } from "@rexeus/typeweaver-core";',
      "",
      'export const spec = defineSpec({ metadata: { title: "Empty API", version: "1.0.0" }, resources: {} });',
      "",
    ].join("\n")
  );
  return specPath;
};
