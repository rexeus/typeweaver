import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  aCanonicalResponse,
  anInlineOperationResponse,
  anInlineResponseUsage,
  renderCanonicalResponseSource,
  renderOperationResponseSource,
} from "./fixtures.js";

describe("ResponseGenerator response names and documentation", () => {
  test("uses PascalCase exports and raw discriminants for camelCase inline responses", () => {
    const source = renderOperationResponseSource([
      anInlineResponseUsage(
        anInlineOperationResponse({
          name: "createdTodo",
          header: z.object({ "x-request-id": z.string() }),
          body: z.object({ id: z.string() }),
        })
      ),
    ]);

    expect(source).toContain("export type ICreatedTodoResponse");
    expect(source).toContain("export const createCreatedTodoResponse");
    expect(source).toMatch(/ITypedHttpResponse<\s*"createdTodo"/);
    expect(source).toContain('type: "createdTodo"');
  });

  test("renders response descriptions as JSDoc above response aliases and factories", () => {
    const source = renderCanonicalResponseSource(
      aCanonicalResponse({
        name: "documentedResponse",
        description: "Documented response",
      })
    );

    expect(source).toContain(
      "/**\n * Documented response\n */\nexport type IDocumentedResponseResponse"
    );
    expect(source).toContain(
      "/**\n * Documented response\n */\nexport const createDocumentedResponseResponse"
    );
  });

  test("preserves multiline response descriptions in generated JSDoc", () => {
    const source = renderCanonicalResponseSource(
      aCanonicalResponse({
        name: "multilineResponse",
        description: "First line\n\nSecond line",
      })
    );

    expect(source).toContain("/**\n * First line\n * \n * Second line\n */");
  });

  test("sanitizes response descriptions before emitting generated JSDoc", () => {
    const source = renderCanonicalResponseSource(
      aCanonicalResponse({
        name: "sanitizedResponse",
        description: "Do not close */ comments",
      })
    );

    expect(source).toContain("Do not close *\\/ comments");
    expect(source).not.toContain("Do not close */ comments");
  });
});
