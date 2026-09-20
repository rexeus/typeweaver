import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  IValidatedHttpRequest,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { createRequest } from "../../src/data/createRequest.js";
import { createResponse } from "../../src/data/createResponse.js";

describe("test data factory overrides", () => {
  test("applies explicitly provided falsy request parts", () => {
    const request = createRequest<
      IValidatedHttpRequest,
      boolean,
      string,
      number,
      boolean
    >(
      { method: HttpMethod.POST, path: "/default" },
      {
        body: (input = true) => input,
        header: (input = "default-header") => input,
        param: (input = 1) => input,
        query: (input = true) => input,
      },
      { path: "", body: false, header: "", param: 0, query: false }
    );

    expect(request).toEqual({
      method: HttpMethod.POST,
      path: "",
      body: false,
      header: "",
      param: 0,
      query: false,
    });
  });

  test("applies explicitly provided falsy response parts", () => {
    const response = createResponse<IHttpResponse, boolean, string>(
      { statusCode: HttpStatusCode.OK },
      {
        body: (input = true) => input,
        header: (input = "default-header") => input,
      },
      { body: false, header: "" }
    );

    expect(response).toEqual({
      statusCode: HttpStatusCode.OK,
      body: false,
      header: "",
    });
  });
});
