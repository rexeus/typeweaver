import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import type {
  OperationDefinition,
  SecurityRequirements,
  SecuritySchemeDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { Effect, Either } from "effect";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  ContradictorySecurityHeaderError,
  DuplicateSecuritySchemeNameError,
  DuplicateTagNameError,
  InvalidApiMetadataError,
  InvalidSecurityRequirementError,
  InvalidSecuritySchemeError,
  normalizeSpec,
  UnknownSecuritySchemeError,
  UnknownTagError,
} from "../src/index.js";
import { TestAssertionError } from "./errors/index.js";
import type { NormalizedSpec } from "../src/index.js";

const successResponse = defineResponse({
  name: "SecuritySuccess",
  statusCode: HttpStatusCode.OK,
  description: "Success",
});

const anOperation = (
  operationId: string,
  options: {
    readonly security?: SecurityRequirements;
    readonly tags?: readonly string[];
    readonly authorization?: z.ZodString | z.ZodLiteral<string>;
  } = {}
): OperationDefinition =>
  defineOperation({
    operationId,
    method: HttpMethod.GET,
    path: `/${operationId}`,
    summary: operationId,
    description: `${operationId} description`,
    deprecated: operationId === "deprecatedOperation",
    tags: options.tags,
    security: options.security,
    request:
      options.authorization === undefined
        ? {}
        : { header: z.object({ Authorization: options.authorization }) },
    responses: [successResponse],
  });

const normalize = (spec: SpecDefinition): NormalizedSpec => {
  const result = Effect.runSync(Effect.either(normalizeSpec(spec)));
  if (Either.isRight(result)) {
    return result.right;
  }
  throw result.left;
};

const failureFrom = (spec: SpecDefinition): unknown => {
  const result = Effect.runSync(Effect.either(normalizeSpec(spec)));
  if (Either.isLeft(result)) {
    return result.left;
  }
  throw new TestAssertionError("Expected spec normalization to fail.");
};

const validSchemes = (): readonly SecuritySchemeDefinition[] => [
  { name: "basicAuth", kind: "http", scheme: "basic" },
  {
    name: "bearerAuth",
    kind: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
  {
    name: "apiKey",
    kind: "apiKey",
    credentialName: "x-api-key",
    location: "header",
  },
  {
    name: "oauth",
    kind: "oauth2",
    flows: {
      authorizationCode: {
        authorizationUrl: "https://identity.example/authorize",
        tokenUrl: "https://identity.example/token",
        refreshUrl: "https://identity.example/refresh",
        scopes: { "todos:read": "Read todos", "todos:write": "Write todos" },
      },
    },
  },
  {
    name: "oidc",
    kind: "openIdConnect",
    discoveryUrl: "https://identity.example/.well-known/openid-configuration",
  },
];

const aSpec = (
  overrides: Partial<
    Pick<
      SpecDefinition,
      "metadata" | "security" | "securitySchemes" | "resources"
    >
  > = {}
): SpecDefinition =>
  defineSpec({
    metadata: overrides.metadata ?? {
      title: "Security Test API",
      version: "1.0.0",
      tags: [
        { name: "todos", description: "Todo operations" },
        { name: "admin" },
      ],
    },
    securitySchemes: overrides.securitySchemes ?? validSchemes(),
    security: overrides.security ?? [{ bearerAuth: [] }],
    resources: overrides.resources ?? {
      todo: {
        description: "Todo resource",
        tags: ["todos"],
        operations: [anOperation("listTodos")],
      },
    },
  });

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

describe("metadata and authorization validation", () => {
  test.each([
    {
      scenario: "an empty title",
      metadata: { title: " ", version: "1.0.0" },
    },
    {
      scenario: "an empty version",
      metadata: { title: "Metadata API", version: "" },
    },
    {
      scenario: "an empty tag name",
      metadata: {
        title: "Metadata API",
        version: "1.0.0",
        tags: [{ name: "" }],
      },
    },
  ])("rejects $scenario", ({ metadata }) => {
    expect(failureFrom(aSpec({ metadata }))).toBeInstanceOf(
      InvalidApiMetadataError
    );
  });

  test("rejects duplicate and unknown tags", () => {
    const duplicate = failureFrom(
      aSpec({
        metadata: {
          title: "Tags API",
          version: "1.0.0",
          tags: [{ name: "todos" }, { name: "todos" }],
        },
      })
    );
    const unknown = failureFrom(
      aSpec({
        resources: {
          todo: {
            tags: ["missing"],
            operations: [anOperation("listTaggedTodos")],
          },
        },
      })
    );

    expect(duplicate).toBeInstanceOf(DuplicateTagNameError);
    expect(unknown).toBeInstanceOf(UnknownTagError);
  });

  test("allows compatible Authorization validation and rejects contradictions", () => {
    const compatible = aSpec({
      resources: {
        todo: {
          operations: [
            anOperation("compatibleAuthorization", {
              authorization: z.string().startsWith("Bearer "),
            }),
          ],
        },
      },
    });
    const contradictory = aSpec({
      resources: {
        todo: {
          operations: [
            anOperation("contradictoryAuthorization", {
              authorization: z.literal("ApiKey only"),
            }),
          ],
        },
      },
    });

    expect(() => normalize(compatible)).not.toThrow();
    expect(failureFrom(contradictory)).toBeInstanceOf(
      ContradictorySecurityHeaderError
    );
  });
});
