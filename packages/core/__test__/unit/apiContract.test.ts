import { describe, expect, test } from "vitest";
import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "../../src/index.js";

const response = defineResponse({
  name: "ApiContractSuccess",
  statusCode: HttpStatusCode.OK,
  description: "Success",
});

describe("API metadata and security authoring contract", () => {
  test("preserves metadata, scheme, resource, and operation identities", () => {
    const metadata = {
      title: "Contract API",
      version: "1.0.0",
      tags: [{ name: "contract" }],
    } as const;
    const securitySchemes = [
      { name: "bearerAuth", kind: "http", scheme: "bearer" },
    ] as const;
    const operation = defineOperation({
      operationId: "readContract",
      method: HttpMethod.GET,
      path: "/contract",
      summary: "Read contract",
      description: "Reads the contract",
      deprecated: false,
      tags: ["contract"],
      security: [],
      request: {},
      responses: [response],
    });
    const resource = {
      description: "Contract resource",
      tags: ["contract"],
      security: [{ bearerAuth: [] }],
      operations: [operation],
    } as const;

    const spec = defineSpec({
      metadata,
      securitySchemes,
      security: [{ bearerAuth: [] }],
      resources: { contract: resource },
    });

    expect(spec.metadata).toBe(metadata);
    expect(spec.securitySchemes).toBe(securitySchemes);
    expect(spec.resources.contract).toBe(resource);
    expect(spec.resources.contract.operations[0]).toBe(operation);
    expect(operation).toMatchObject({
      description: "Reads the contract",
      deprecated: false,
      tags: ["contract"],
      security: [],
    });
  });
});
