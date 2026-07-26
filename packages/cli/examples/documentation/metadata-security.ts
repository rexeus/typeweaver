import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";

const HealthSuccess = defineResponse({
  name: "HealthSuccess",
  statusCode: HttpStatusCode.OK,
  description: "Service is healthy",
});

const GetHealth = defineOperation({
  operationId: "getHealth",
  method: HttpMethod.GET,
  path: "/health",
  summary: "Public health check",
  description: "Reports service health without requiring credentials.",
  tags: ["health"],
  security: [],
  request: {},
  responses: [HealthSuccess],
});

export const metadataSecuritySpec = defineSpec({
  metadata: {
    title: "Service API",
    version: "1.0.0",
    description: "Contract for service clients and servers",
    tags: [{ name: "health", description: "Service health" }],
  },
  securitySchemes: [
    { name: "bearerAuth", kind: "http", scheme: "bearer" },
    {
      name: "apiKeyAuth",
      kind: "apiKey",
      credentialName: "X-API-Key",
      location: "header",
    },
  ],
  security: [{ bearerAuth: [] }],
  resources: {
    health: {
      description: "Bearer and API-key protected service operations",
      tags: ["health"],
      security: [{ bearerAuth: [], apiKeyAuth: [] }],
      operations: [GetHealth],
    },
  },
});
