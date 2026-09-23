import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  anInlineOperationResponse,
  anInlineResponseUsage,
  renderOperationResponseSource,
} from "./fixtures.js";

describe("ResponseGenerator inline response factories", () => {
  test.each([
    {
      case: "header-and-body",
      response: anInlineOperationResponse({
        name: "headerAndBody",
        statusCode: HttpStatusCode.OK,
        statusCodeName: "OK",
        header: z.object({ "x-request-id": z.string() }),
        body: z.object({ id: z.string() }),
      }),
      includes: [
        "export const createHeaderAndBodyResponse = (",
        "\n    input: {\n",
        "\n    ): IHeaderAndBodyResponse",
        "header: IHeaderAndBodyResponseHeader;",
        "body: IHeaderAndBodyResponseBody;",
        "header: input.header",
        "body: input.body",
      ],
      excludes: ["\ninput: {\n", "\n): IHeaderAndBodyResponse"],
    },
    {
      case: "header-only",
      response: anInlineOperationResponse({
        name: "headerOnly",
        statusCode: HttpStatusCode.ACCEPTED,
        statusCodeName: "ACCEPTED",
        header: z.object({ "x-request-id": z.string() }),
        body: undefined,
      }),
      includes: [
        "export const createHeaderOnlyResponse = (",
        "header: IHeaderOnlyResponseHeader;",
        "header: input.header",
        "body: undefined",
      ],
      excludes: ["body: IHeaderOnlyResponseBody;"],
    },
    {
      case: "body-only",
      response: anInlineOperationResponse({
        name: "bodyOnly",
        statusCode: HttpStatusCode.OK,
        statusCodeName: "OK",
        header: undefined,
        body: z.object({ id: z.string() }),
      }),
      includes: [
        "export const createBodyOnlyResponse = (",
        "body: IBodyOnlyResponseBody;",
        "header: undefined",
        "body: input.body",
      ],
      excludes: ["header: IBodyOnlyResponseHeader;"],
    },
    {
      case: "empty",
      response: anInlineOperationResponse({
        name: "emptyResponse",
        statusCode: HttpStatusCode.NO_CONTENT,
        statusCodeName: "NO_CONTENT",
        header: undefined,
        body: undefined,
      }),
      includes: [
        "export const createEmptyResponseResponse = (): IEmptyResponseResponse",
        "header: undefined",
        "body: undefined",
      ],
      excludes: ["input: {"],
    },
  ])(
    "renders inline $case response factory with operation-local indentation",
    ({ response, includes, excludes }) => {
      const source = renderOperationResponseSource([
        anInlineResponseUsage(response),
      ]);

      for (const expected of includes) {
        expect(source).toContain(expected);
      }
      for (const unexpected of excludes) {
        expect(source).not.toContain(unexpected);
      }
    }
  );
});
