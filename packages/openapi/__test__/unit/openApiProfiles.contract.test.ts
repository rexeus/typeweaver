import type {
  NormalizedSpec,
  PluginValidationContext,
} from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import {
  buildOpenApiDocument,
  openApiPlugin,
  OPENAPI_WARNING_ISSUE_REGISTRY,
} from "../../src/index.js";
import {
  aNormalizedSpecWith,
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
} from "./buildOpenApiDocument.helpers.js";
import type { OpenApiTarget } from "../../src/index.js";

const profileSpec = (): NormalizedSpec =>
  aNormalizedSpecWith({
    metadata: {
      title: "Contract API",
      version: "2.0.0",
      description: "Contract metadata description",
      tags: [{ name: "contracts", description: "Contract operations" }],
    },
    securitySchemes: [
      {
        name: "basicAuth",
        kind: "http",
        scheme: "basic",
        description: "Basic credentials",
      },
      {
        name: "bearerAuth",
        kind: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      {
        name: "headerKey",
        kind: "apiKey",
        credentialName: "X-API-Key",
        location: "header",
      },
      {
        name: "queryKey",
        kind: "apiKey",
        credentialName: "api_key",
        location: "query",
      },
      {
        name: "cookieKey",
        kind: "apiKey",
        credentialName: "session",
        location: "cookie",
      },
      {
        name: "oauth",
        kind: "oauth2",
        flows: {
          authorizationCode: {
            authorizationUrl: "https://identity.example/authorize",
            tokenUrl: "https://identity.example/token",
            refreshUrl: "https://identity.example/refresh",
            scopes: { "contracts:read": "Read contracts" },
          },
        },
      },
      {
        name: "oidc",
        kind: "openIdConnect",
        discoveryUrl:
          "https://identity.example/.well-known/openid-configuration",
      },
    ],
    security: {
      requirements: [{ bearerAuth: [] }],
      source: "spec",
    },
    resources: [
      {
        name: "contract",
        description: "Contract resource",
        tags: ["contracts"],
        security: {
          requirements: [{ bearerAuth: [] }],
          source: "spec",
        },
        operations: [
          anOperationWith({
            operationId: "readContract",
            summary: "Read a contract",
            description: "Returns one contract",
            deprecated: true,
            tags: ["contracts"],
            security: {
              requirements: [
                { bearerAuth: [], headerKey: [] },
                { oauth: ["contracts:read"] },
              ],
              source: "operation",
            },
            responses: [anInlineResponseUsage(aResponseWith())],
          }),
          anOperationWith({
            operationId: "publicContract",
            path: "/contracts/public",
            security: { requirements: [], source: "operation" },
            responses: [anInlineResponseUsage(aResponseWith())],
          }),
        ],
      },
    ],
  });

describe("OpenAPI target profiles", () => {
  test.each(["3.1.2", "3.2.0"] satisfies readonly OpenApiTarget[])(
    "projects metadata and security into OpenAPI %s",
    target => {
      const result = buildOpenApiDocument(profileSpec(), { target });
      const operation = result.document.paths["/todos"]?.get;

      expect(result.document.openapi).toBe(target);
      expect(result.document.info).toEqual({
        title: "Contract API",
        version: "2.0.0",
        description: "Contract metadata description",
      });
      expect(result.document.tags).toEqual([
        { name: "contracts", description: "Contract operations" },
      ]);
      expect(result.document.security).toEqual([{ bearerAuth: [] }]);
      expect(result.document.components?.securitySchemes).toEqual({
        basicAuth: {
          type: "http",
          scheme: "basic",
          description: "Basic credentials",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        headerKey: { type: "apiKey", name: "X-API-Key", in: "header" },
        queryKey: { type: "apiKey", name: "api_key", in: "query" },
        cookieKey: { type: "apiKey", name: "session", in: "cookie" },
        oauth: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: "https://identity.example/authorize",
              tokenUrl: "https://identity.example/token",
              refreshUrl: "https://identity.example/refresh",
              scopes: { "contracts:read": "Read contracts" },
            },
          },
        },
        oidc: {
          type: "openIdConnect",
          openIdConnectUrl:
            "https://identity.example/.well-known/openid-configuration",
        },
      });
      expect(operation).toMatchObject({
        summary: "Read a contract",
        description: "Returns one contract",
        deprecated: true,
        tags: ["contracts"],
        security: [
          { bearerAuth: [], headerKey: [] },
          { oauth: ["contracts:read"] },
        ],
      });
      expect(result.document.paths["/contracts/public"]?.get?.security).toEqual(
        []
      );
    }
  );
});

describe("OpenAPI validation issues", () => {
  test("maps builder warnings through the side-effect-free plugin hook", () => {
    const plugin = openApiPlugin({ target: "3.2.0" });
    if (plugin.validate === undefined) {
      throw new Error("OpenAPI plugin must define a validation stage.");
    }
    const validationContext: PluginValidationContext = {
      inputDir: "/workspace/spec",
      config: {},
    };
    const warningSpec = aNormalizedSpecWith({
      resources: [
        {
          name: "item",
          tags: [],
          security: { requirements: [], source: "none" },
          operations: [
            anOperationWith({
              operationId: "getItem",
              path: "/items/:itemId",
              responses: [anInlineResponseUsage(aResponseWith())],
            }),
          ],
        },
      ],
    });

    const issues = Effect.runSync(
      plugin.validate(warningSpec, validationContext)
    );

    expect(issues).toEqual([
      {
        code: "TW-PLUGIN-OPENAPI-003",
        severity: "warning",
        message: "Path parameter 'itemId' is missing a schema.",
        path: "/paths/~1items~1{itemId}/get/parameters/0/schema",
        hint: "Declare a request.param schema for every path parameter.",
        fixable: false,
      },
    ]);
  });

  test("keeps warning codes unique, sequential, and exhaustive", () => {
    const entries = Object.values(OPENAPI_WARNING_ISSUE_REGISTRY);

    expect(entries.map(entry => entry.code)).toEqual(
      entries.map(
        (_entry, index) =>
          `TW-PLUGIN-OPENAPI-${String(index + 1).padStart(3, "0")}`
      )
    );
    expect(new Set(entries.map(entry => entry.code)).size).toBe(entries.length);
  });

  test("reports resource descriptions that cannot map losslessly", () => {
    const plugin = openApiPlugin();
    if (plugin.validate === undefined) {
      throw new Error("OpenAPI plugin must define a validation stage.");
    }

    const issues = Effect.runSync(
      plugin.validate(profileSpec(), {
        inputDir: "/workspace/spec",
        config: {},
      })
    );

    expect(issues).toContainEqual({
      code: "TW-PLUGIN-OPENAPI-010",
      severity: "info",
      message:
        "Resource 'contract' description cannot be projected losslessly because one resource may span multiple OpenAPI paths.",
      path: "/paths",
      hint: "Describe individual operations or document the resource outside the OpenAPI projection.",
      fixable: false,
    });
  });
});
