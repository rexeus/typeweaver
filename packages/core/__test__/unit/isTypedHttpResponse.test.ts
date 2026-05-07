import { describe, expect, test } from "vitest";
import { isTypedHttpResponse } from '../../src/HttpResponse.js';
import type { ITypedHttpResponse } from '../../src/HttpResponse.js';
import { HttpStatusCode } from "../../src/HttpStatusCode.js";

const valuesThatAreNotTypedResponses: readonly {
  readonly case: string;
  readonly value: unknown;
}[] = [
  { case: "null", value: null },
  { case: "undefined", value: undefined },
  { case: "number", value: 42 },
  { case: "string", value: "hello" },
  { case: "boolean", value: true },
  { case: "array", value: [] },
  {
    case: "array carrying response-like fields",
    value: Object.assign([], {
      type: "Success",
      statusCode: HttpStatusCode.OK,
    }),
  },
  { case: "empty object", value: {} },
  { case: "missing statusCode", value: { type: "Success" } },
  { case: "missing type", value: { statusCode: HttpStatusCode.OK } },
  {
    case: "numeric type",
    value: { type: 123, statusCode: HttpStatusCode.OK },
  },
  {
    case: "string statusCode",
    value: { type: "Success", statusCode: "200" },
  },
  {
    case: "enum status name",
    value: { type: "Success", statusCode: "OK" },
  },
  {
    case: "NaN statusCode",
    value: { type: "Success", statusCode: Number.NaN },
  },
  {
    case: "unregistered numeric statusCode",
    value: { type: "Success", statusCode: 299 },
  },
  {
    case: "near miss with alternate field names",
    value: { kind: "Success", status: HttpStatusCode.OK },
  },
  {
    case: "inherited marker fields",
    value: Object.create({
      type: "Success",
      statusCode: HttpStatusCode.OK,
    }),
  },
];

const responsesWithInvalidHeaders: readonly {
  readonly case: string;
  readonly header: unknown;
}[] = [
  { case: "null header", header: null },
  { case: "string header", header: "Content-Type: application/json" },
  { case: "number header", header: 123 },
  { case: "array header", header: ["Content-Type", "application/json"] },
  {
    case: "object header value",
    header: { "X-Request-Id": { id: "request-1" } },
  },
  {
    case: "non-string array header value",
    header: { "X-Retry-After": [30] },
  },
  {
    case: "custom-prototype header record",
    header: Object.assign(Object.create({ inherited: "ok" }), {
      "X-Request-Id": "request-1",
    }),
  },
];

const registeredStatusCodesAcrossClasses: readonly {
  readonly case: string;
  readonly statusCode: HttpStatusCode;
}[] = [
  { case: "2xx success", statusCode: HttpStatusCode.OK },
  { case: "3xx redirect", statusCode: HttpStatusCode.SEE_OTHER },
  { case: "4xx client error", statusCode: HttpStatusCode.NOT_FOUND },
  {
    case: "5xx server error",
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
  },
];

const typedStatusLabel = (value: unknown): string => {
  if (!isTypedHttpResponse(value)) {
    return "not typed";
  }

  return `${value.type}:${value.statusCode}`;
};

class ResponseLikeInstance {
  public readonly type = "Success";
  public readonly statusCode = HttpStatusCode.OK;
  public readonly header = { "X-Request-Id": "request-1" };
  public readonly body = { ok: true };
}

const withObjectPrototypeProperties = <T>(
  properties: Record<string, PropertyDescriptor>,
  run: () => T
): T => {
  const previousDescriptors: Record<string, PropertyDescriptor | undefined> =
    {};

  for (const property of Object.keys(properties)) {
    previousDescriptors[property] = Object.getOwnPropertyDescriptor(
      Object.prototype,
      property
    );
  }

  try {
    for (const [property, descriptor] of Object.entries(properties)) {
      Object.defineProperty(Object.prototype, property, descriptor);
    }

    return run();
  } finally {
    for (const property of Object.keys(properties)) {
      const previousDescriptor = previousDescriptors[property];

      if (previousDescriptor) {
        Object.defineProperty(Object.prototype, property, previousDescriptor);
      } else {
        delete (Object.prototype as Partial<Record<string, unknown>>)[property];
      }
    }
  }
};

describe("isTypedHttpResponse", () => {
  test.each(valuesThatAreNotTypedResponses)(
    "rejects $case as a typed HTTP response",
    ({ value }) => {
      expect(isTypedHttpResponse(value)).toBe(false);
    }
  );

  test("accepts a minimal typed HTTP response", () => {
    const response = {
      type: "Success",
      statusCode: HttpStatusCode.OK,
    };

    expect(isTypedHttpResponse(response)).toBe(true);
  });

  test("accepts a typed HTTP response with explicit empty payload fields", () => {
    const response = {
      type: "NoContent",
      statusCode: HttpStatusCode.NO_CONTENT,
      header: undefined,
      body: undefined,
    };

    expect(isTypedHttpResponse(response)).toBe(true);
  });

  test("accepts explicit undefined header values as omitted optional headers", () => {
    const response = {
      type: "OptionalHeaderResponse",
      statusCode: HttpStatusCode.OK,
      header: {
        "X-Optional": undefined,
      },
    } satisfies ITypedHttpResponse;

    expect(isTypedHttpResponse(response)).toBe(true);
  });

  test("accepts a null-prototype typed HTTP response", () => {
    const response = Object.assign(Object.create(null), {
      type: "NullPrototypeResponse",
      statusCode: HttpStatusCode.OK,
    });

    expect(isTypedHttpResponse(response)).toBe(true);
  });

  test("accepts a realistic typed HTTP response with header and body", () => {
    const response = {
      type: "TodoCreated",
      statusCode: HttpStatusCode.CREATED,
      header: {
        "Content-Type": "application/json",
        "X-Request-Id": "request-1",
      },
      body: {
        id: "todo-1",
        title: "Ship tests",
      },
    } satisfies ITypedHttpResponse;

    expect(isTypedHttpResponse(response)).toBe(true);
  });

  test("accepts string-array header values from the public header shape", () => {
    const response = {
      type: "CachedTodo",
      statusCode: HttpStatusCode.OK,
      header: {
        "Cache-Control": ["public", "max-age=60"],
      },
    } satisfies ITypedHttpResponse;

    expect(isTypedHttpResponse(response)).toBe(true);
  });

  test("accepts a null-prototype header record with string values", () => {
    const header = Object.assign(Object.create(null), {
      "X-Request-Id": "request-1",
    });
    const response = {
      type: "NullPrototypeHeaderResponse",
      statusCode: HttpStatusCode.OK,
      header,
    };

    expect(isTypedHttpResponse(response)).toBe(true);
  });

  test.each(responsesWithInvalidHeaders)(
    "rejects a typed HTTP response with $case",
    ({ header }) => {
      const response = {
        type: "InvalidHeaderResponse",
        statusCode: HttpStatusCode.OK,
        header,
      };

      expect(isTypedHttpResponse(response)).toBe(false);
    }
  );

  test.each(registeredStatusCodesAcrossClasses)(
    "accepts a registered $case status code",
    ({ statusCode }) => {
      const response = {
        type: "RegisteredStatusResponse",
        statusCode,
      };

      expect(isTypedHttpResponse(response)).toBe(true);
    }
  );

  test("rejects an Error instance with response-looking own fields", () => {
    const response = Object.assign(new Error("boom"), {
      type: "ErrorResponse",
      statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
      header: { "X-Request-Id": "request-1" },
      body: { message: "boom" },
    });

    expect(isTypedHttpResponse(response)).toBe(false);
  });

  test("rejects a custom-prototype instance with response-looking own fields", () => {
    const response = new ResponseLikeInstance();

    expect(isTypedHttpResponse(response)).toBe(false);
  });

  test("rejects prototype-polluted marker fields on plain objects", () => {
    withObjectPrototypeProperties(
      {
        type: {
          configurable: true,
          value: "Success",
        },
        statusCode: {
          configurable: true,
          value: HttpStatusCode.OK,
        },
      },
      () => {
        const response = {};

        expect(isTypedHttpResponse(response)).toBe(false);
      }
    );
  });

  test("ignores inherited header values when the response has no own header", () => {
    withObjectPrototypeProperties(
      {
        header: {
          configurable: true,
          value: null,
        },
      },
      () => {
        const response = {
          type: "InheritedHeaderResponse",
          statusCode: HttpStatusCode.OK,
        };

        expect(isTypedHttpResponse(response)).toBe(true);
      }
    );
  });

  test("narrows unknown values to typed HTTP responses for consumer code", () => {
    const response: unknown = {
      type: "TodoCreated",
      statusCode: HttpStatusCode.CREATED,
    };

    expect(typedStatusLabel(response)).toBe("TodoCreated:201");
  });
});
