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
import { Effect, Result } from "effect";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  ContradictorySecurityHeaderError,
  DuplicateTagNameError,
  InvalidApiMetadataError,
  normalizeSpec,
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
  const result = Effect.runSync(Effect.result(normalizeSpec(spec)));
  if (Result.isSuccess(result)) {
    return result.success;
  }
  throw result.failure;
};

const failureFrom = (spec: SpecDefinition): unknown => {
  const result = Effect.runSync(Effect.result(normalizeSpec(spec)));
  if (Result.isFailure(result)) {
    return result.failure;
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
