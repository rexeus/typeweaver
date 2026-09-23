import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  aCanonicalResponse,
  renderCanonicalResponseSource,
} from "./fixtures.js";

describe("ResponseGenerator canonical response factories", () => {
  test("renders a header-and-body response factory with typed input and payload mapping", () => {
    const response = aCanonicalResponse({
      name: "headerAndBody",
      statusCode: HttpStatusCode.OK,
      statusCodeName: "OK",
      header: z.object({ "x-request-id": z.string() }),
      body: z.object({ id: z.string() }),
    });
    const source = renderCanonicalResponseSource(response);
    expect(source).toContain("input: {");
    expect(source).toContain("header: IHeaderAndBodyResponseHeader;");
    expect(source).toContain("body: IHeaderAndBodyResponseBody;");
    expect(source).toContain('type: "headerAndBody"');
    expect(source).toContain("statusCode: HttpStatusCode.OK");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: input.body");
  });

  test("renders a header-only response factory with header input and undefined body", () => {
    const response = aCanonicalResponse({
      name: "headerOnly",
      statusCode: HttpStatusCode.ACCEPTED,
      statusCodeName: "ACCEPTED",
      header: z.object({ "x-request-id": z.string() }),
      body: undefined,
    });
    const source = renderCanonicalResponseSource(response);
    expect(source).toContain("input: {");
    expect(source).toContain("header: IHeaderOnlyResponseHeader;");
    expect(source).not.toContain("body: IHeaderOnlyResponseBody;");
    expect(source).toContain('type: "headerOnly"');
    expect(source).toContain("statusCode: HttpStatusCode.ACCEPTED");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: undefined");
  });

  test("renders a body-only response factory with body input and undefined header", () => {
    const response = aCanonicalResponse({
      name: "bodyOnly",
      statusCode: HttpStatusCode.OK,
      statusCodeName: "OK",
      header: undefined,
      body: z.object({ id: z.string() }),
    });
    const source = renderCanonicalResponseSource(response);
    expect(source).toContain("input: {");
    expect(source).not.toContain("header: IBodyOnlyResponseHeader;");
    expect(source).toContain("body: IBodyOnlyResponseBody;");
    expect(source).toContain('type: "bodyOnly"');
    expect(source).toContain("statusCode: HttpStatusCode.OK");
    expect(source).toContain("header: undefined");
    expect(source).toContain("body: input.body");
  });

  test("renders header input for a response whose header fields are optional", () => {
    const response = aCanonicalResponse({
      name: "optionalHeader",
      statusCode: HttpStatusCode.OK,
      statusCodeName: "OK",
      header: z.object({ "x-trace-id": z.string().optional() }),
      body: undefined,
    });
    const source = renderCanonicalResponseSource(response);

    expect(source).toContain('"x-trace-id"?: string | undefined;');
    expect(source).toContain("input: {");
    expect(source).toContain("header: IOptionalHeaderResponseHeader;");
    expect(source).toContain("header: input.header");
    expect(source).toContain("body: undefined");
  });

  test("renders an empty response factory with no input and undefined payload", () => {
    const response = aCanonicalResponse({
      name: "emptyResponse",
      statusCode: HttpStatusCode.NO_CONTENT,
      statusCodeName: "NO_CONTENT",
      header: undefined,
      body: undefined,
    });
    const source = renderCanonicalResponseSource(response);
    expect(source).toContain(
      "export const createEmptyResponseResponse = (): IEmptyResponseResponse"
    );
    expect(source).not.toContain("input: {");
    expect(source).toContain('type: "emptyResponse"');
    expect(source).toContain("statusCode: HttpStatusCode.NO_CONTENT");
    expect(source).toContain("header: undefined");
    expect(source).toContain("body: undefined");
  });
});
