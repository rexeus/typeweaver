import { HttpStatusCode } from "@rexeus/typeweaver-core";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  aCanonicalResponse,
  aCanonicalResponseUsage,
  aNormalizedSpecWith,
  aResourceWithOperationResponses,
  getGeneratedSource,
  renderResponseSources,
} from "./fixtures.js";

describe("ResponseGenerator shared response naming and unions", () => {
  test("uses PascalCase exports and raw discriminants for non-identifier response names", () => {
    const validationError = aCanonicalResponse({
      name: "validation-error",
      statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
      statusCodeName: "UNPROCESSABLE_ENTITY",
      body: z.object({ code: z.literal("VALIDATION_ERROR") }),
    });

    const writtenFiles = renderResponseSources(
      aNormalizedSpecWith({
        responses: [validationError],
        resources: [
          aResourceWithOperationResponses([
            aCanonicalResponseUsage(validationError.name),
          ]),
        ],
      })
    );
    const sharedResponse = getGeneratedSource(
      writtenFiles,
      "responses/ValidationErrorResponse.ts"
    );
    const operationResponse = getGeneratedSource(
      writtenFiles,
      "todos/CreateTodoResponse.ts"
    );

    expect(sharedResponse).toContain("export type IValidationErrorResponse");
    expect(sharedResponse).toContain(
      "export const createValidationErrorResponse"
    );
    expect(sharedResponse).toMatch(/ITypedHttpResponse<\s*"validation-error"/);
    expect(sharedResponse).toContain('type: "validation-error"');
    expect(operationResponse).toContain(
      'import type { IValidationErrorResponse } from "../responses/ValidationErrorResponse";'
    );
  });

  test("renders a shared-only operation response union without inline factories", () => {
    const badRequest = aCanonicalResponse({ name: "BadRequestError" });
    const unauthorized = aCanonicalResponse({
      name: "UnauthorizedError",
      statusCode: HttpStatusCode.UNAUTHORIZED,
      statusCodeName: "UNAUTHORIZED",
    });
    const normalizedSpec: NormalizedSpec = aNormalizedSpecWith({
      responses: [badRequest, unauthorized],
      resources: [
        aResourceWithOperationResponses([
          aCanonicalResponseUsage(badRequest.name),
          aCanonicalResponseUsage(unauthorized.name),
        ]),
      ],
    });

    const writtenFiles = renderResponseSources(normalizedSpec);
    const source = getGeneratedSource(
      writtenFiles,
      "todos/CreateTodoResponse.ts"
    );

    expect(source).toContain(
      'import type { IBadRequestErrorResponse } from "../responses/BadRequestErrorResponse";'
    );
    expect(source).toContain(
      'import type { IUnauthorizedErrorResponse } from "../responses/UnauthorizedErrorResponse";'
    );
    expect(source).not.toContain("export const create");
    expect(source).toMatch(
      /export type CreateTodoResponse =\s*\| IBadRequestErrorResponse\s*\| IUnauthorizedErrorResponse\s*;/
    );
  });
});
