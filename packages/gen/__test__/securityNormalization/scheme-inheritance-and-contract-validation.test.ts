import { defineSpec } from "@rexeus/typeweaver-core";
import type { SecuritySchemeDefinition } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  DuplicateSecuritySchemeNameError,
  InvalidSecurityRequirementError,
  InvalidSecuritySchemeError,
  UnknownSecuritySchemeError,
} from "../../src/index.js";
import {
  anOperation,
  aSpec,
  failureFrom,
  normalize,
  validSchemes,
} from "./fixtures.js";

describe("metadata and security normalization", () => {
  test("preserves every scheme and resolves every inheritance state", () => {
    const spec = aSpec({
      resources: {
        inherited: {
          tags: ["todos"],
          operations: [anOperation("specInherited", { tags: ["admin"] })],
        },
        overridden: {
          security: [{ apiKey: [] }],
          operations: [
            anOperation("resourceInherited"),
            anOperation("operationOverride", {
              security: [{ bearerAuth: [], apiKey: [] }],
            }),
            anOperation("explicitPublic", { security: [] }),
            anOperation("deprecatedOperation"),
          ],
        },
      },
    });

    const normalized = normalize(spec);

    expect(normalized.metadata).toEqual(spec.metadata);
    expect(normalized.securitySchemes).toEqual(validSchemes());
    expect(normalized.security).toEqual({
      requirements: [{ bearerAuth: [] }],
      source: "spec",
    });
    expect(normalized.resources[0]).toMatchObject({
      description: undefined,
      tags: ["todos"],
      security: {
        requirements: [{ bearerAuth: [] }],
        source: "spec",
      },
    });
    expect(normalized.resources[0]?.operations[0]).toMatchObject({
      description: "specInherited description",
      deprecated: false,
      tags: ["todos", "admin"],
      security: {
        requirements: [{ bearerAuth: [] }],
        source: "spec",
      },
    });
    expect(normalized.resources[1]?.operations[0]?.security).toEqual({
      requirements: [{ apiKey: [] }],
      source: "resource",
    });
    expect(normalized.resources[1]?.operations[1]?.security).toEqual({
      requirements: [{ bearerAuth: [], apiKey: [] }],
      source: "operation",
    });
    expect(normalized.resources[1]?.operations[2]?.security).toEqual({
      requirements: [],
      source: "operation",
    });
    expect(normalized.resources[1]?.operations[3]?.deprecated).toBe(true);
  });

  test("distinguishes absent security from an explicit public spec", () => {
    const absent = normalize(
      defineSpec({
        metadata: { title: "Public API", version: "1.0.0" },
        resources: {
          public: { operations: [anOperation("publicOperation")] },
        },
      })
    );
    const explicit = normalize(
      defineSpec({
        metadata: { title: "Public API", version: "1.0.0" },
        security: [],
        resources: {
          public: { operations: [anOperation("explicitPublicOperation")] },
        },
      })
    );

    expect(absent.security).toEqual({ requirements: [], source: "none" });
    expect(explicit.security).toEqual({
      requirements: [],
      source: "spec",
    });
  });
});

describe("security contract validation", () => {
  test("rejects duplicate scheme names", () => {
    const error = failureFrom(
      aSpec({
        securitySchemes: [
          { name: "duplicate", kind: "http", scheme: "basic" },
          { name: "duplicate", kind: "http", scheme: "bearer" },
        ],
        security: [],
      })
    );

    expect(error).toBeInstanceOf(DuplicateSecuritySchemeNameError);
  });

  test("rejects unknown security requirements", () => {
    const error = failureFrom(aSpec({ security: [{ missing: [] }] }));

    expect(error).toBeInstanceOf(UnknownSecuritySchemeError);
  });

  test.each([
    {
      scenario: "scopes on an HTTP scheme",
      security: [{ bearerAuth: ["todos:read"] }],
    },
    {
      scenario: "an unknown OAuth2 scope",
      security: [{ oauth: ["todos:delete"] }],
    },
    {
      scenario: "an empty requirement object",
      security: [{}],
    },
  ])("rejects $scenario", ({ security }) => {
    const error = failureFrom(aSpec({ security }));

    expect(error).toBeInstanceOf(InvalidSecurityRequirementError);
  });

  test.each([
    {
      scenario: "an OAuth2 scheme without flows",
      scheme: { name: "oauth", kind: "oauth2", flows: {} },
    },
    {
      scenario: "a relative OAuth2 URL",
      scheme: {
        name: "oauth",
        kind: "oauth2",
        flows: {
          password: {
            tokenUrl: "/token",
            scopes: {},
          },
        },
      },
    },
    {
      scenario: "a non-HTTP OpenID Connect URL",
      scheme: {
        name: "oidc",
        kind: "openIdConnect",
        discoveryUrl: "file:///openid-configuration",
      },
    },
  ] satisfies readonly {
    readonly scenario: string;
    readonly scheme: SecuritySchemeDefinition;
  }[])("rejects $scenario", ({ scheme }) => {
    const error = failureFrom(
      aSpec({ securitySchemes: [scheme], security: [] })
    );

    expect(error).toBeInstanceOf(InvalidSecuritySchemeError);
  });
});
