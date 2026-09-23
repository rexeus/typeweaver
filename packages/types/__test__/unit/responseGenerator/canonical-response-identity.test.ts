import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  aCanonicalResponse,
  aCanonicalResponseUsage,
  anOperationWithResponses,
  aNormalizedSpecWith,
  getGeneratedSource,
  renderResponseSources,
} from "./fixtures.js";

describe("ResponseGenerator canonical response identity", () => {
  test("reuses a canonical response across operation response unions", () => {
    const sharedError = aCanonicalResponse();
    const normalizedSpec: NormalizedSpec = aNormalizedSpecWith({
      responses: [sharedError],
      resources: [
        {
          name: "todos",
          tags: [],
          security: { requirements: [], source: "none" },
          operations: [
            anOperationWithResponses([
              aCanonicalResponseUsage(sharedError.name),
            ]),
          ],
        },
        {
          name: "projects",
          tags: [],
          security: { requirements: [], source: "none" },
          operations: [
            anOperationWithResponses(
              [aCanonicalResponseUsage(sharedError.name)],
              {
                operationId: "createProject",
                path: "/projects",
              }
            ),
          ],
        },
      ],
    });

    const writtenFiles = renderResponseSources(normalizedSpec);
    const todoResponse = getGeneratedSource(
      writtenFiles,
      "todos/CreateTodoResponse.ts"
    );
    const projectResponse = getGeneratedSource(
      writtenFiles,
      "projects/CreateProjectResponse.ts"
    );

    expect(writtenFiles.has("responses/SharedErrorResponse.ts")).toBe(true);
    expect(writtenFiles.has("todos/SharedErrorResponse.ts")).toBe(false);
    expect(writtenFiles.has("projects/SharedErrorResponse.ts")).toBe(false);
    expect(todoResponse).toContain("| ISharedErrorResponse");
    expect(projectResponse).toContain("| ISharedErrorResponse");
  });

  test("uses PascalCase identifiers and raw discriminants for camelCase canonical responses", () => {
    const validationError = aCanonicalResponse({
      name: "validationError",
      header: z.object({ "Content-Type": z.literal("application/json") }),
      body: z.object({ code: z.literal("VALIDATION_ERROR") }),
    });
    const normalizedSpec: NormalizedSpec = aNormalizedSpecWith({
      responses: [validationError],
      resources: [
        {
          name: "todos",
          tags: [],
          security: { requirements: [], source: "none" },
          operations: [
            anOperationWithResponses([
              aCanonicalResponseUsage(validationError.name),
            ]),
          ],
        },
      ],
    });

    const writtenFiles = renderResponseSources(normalizedSpec);

    const sharedResponse = writtenFiles.get(
      "responses/ValidationErrorResponse.ts"
    );
    const operationResponse = writtenFiles.get("todos/CreateTodoResponse.ts");
    expect(sharedResponse).toContain("export type IValidationErrorResponse");
    expect(sharedResponse).toContain('ITypedHttpResponse<\n"validationError"');
    expect(sharedResponse).toContain(
      "export const createValidationErrorResponse"
    );
    expect(sharedResponse).toContain('type: "validationError"');
    expect(operationResponse).toContain(
      'import type { IValidationErrorResponse } from "../responses/ValidationErrorResponse";'
    );
    expect(operationResponse).toContain("| IValidationErrorResponse");
  });
});
