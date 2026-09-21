import { UnknownResponseError } from "@rexeus/typeweaver-core";
import {
  createDownloadFileContentRequest,
  createForbiddenErrorResponse,
  createGetFileMetadataRequest,
  createGetFileMetadataSuccessResponseBody,
  createInternalServerErrorResponse,
  createTooManyRequestsErrorResponse,
  createUnauthorizedErrorResponse,
  createUnsupportedMediaTypeErrorResponse,
  createUploadFileRequest,
  createUploadFileSuccessResponseBody,
  createValidationErrorResponse,
  DownloadFileContentRequestCommand,
  FileClient,
  GetFileMetadataRequestCommand,
  ResponseParseError,
  TestAssertionError,
  UploadFileRequestCommand,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { createRawMockFetch } from "../helpers.js";

function createFileClient(
  mockFetch: typeof globalThis.fetch,
  baseUrl = "http://localhost:3000"
) {
  return new FileClient({
    fetchFn: mockFetch,
    baseUrl,
  });
}

function createJsonMockFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = { "content-type": "application/json" }
): typeof globalThis.fetch {
  return createRawMockFetch(status, JSON.stringify(body), headers);
}

function expectResponseType<
  TResponse extends { readonly type: string },
  TType extends TResponse["type"],
>(
  result: TResponse,
  expectedType: TType
): Extract<TResponse, { readonly type: TType }> {
  expect(result.type).toBe(expectedType);
  if (result.type !== expectedType) {
    throw new TestAssertionError(`Expected response type ${expectedType}`);
  }
  return result as Extract<TResponse, { readonly type: TType }>;
}

function expectUnknownResponse(error: unknown, statusCode: number): boolean {
  return (
    error instanceof UnknownResponseError && error.statusCode === statusCode
  );
}

const uploadErrorScenarios = [
  {
    scenario: "400 validation error",
    response: createValidationErrorResponse({
      body: {
        message: "Request is invalid",
        code: "VALIDATION_ERROR",
        issues: {
          body: [
            {
              path: ["file"],
              message: "File is required",
              code: "invalid_type",
            },
          ],
        },
      },
    }),
    expectedType: "ValidationError",
    expectedStatusCode: 400,
    expectedBody: {
      message: "Request is invalid",
      code: "VALIDATION_ERROR",
      issues: {
        body: [
          {
            path: ["file"],
            message: "File is required",
            code: "invalid_type",
          },
        ],
      },
    },
  },
  {
    scenario: "401 unauthorized error",
    response: createUnauthorizedErrorResponse(),
    expectedType: "UnauthorizedError",
    expectedStatusCode: 401,
    expectedBody: {
      message: "Unauthorized request",
      code: "UNAUTHORIZED_ERROR",
    },
  },
  {
    scenario: "403 forbidden error",
    response: createForbiddenErrorResponse(),
    expectedType: "ForbiddenError",
    expectedStatusCode: 403,
    expectedBody: {
      message: "Forbidden request",
      code: "FORBIDDEN_ERROR",
    },
  },
  {
    scenario: "415 unsupported media type error",
    response: createUnsupportedMediaTypeErrorResponse({
      body: {
        message: "Unsupported media type",
        code: "UNSUPPORTED_MEDIA_TYPE_ERROR",
        context: { contentType: "text/plain" },
        expectedValues: { contentTypes: ["application/json"] },
      },
    }),
    expectedType: "UnsupportedMediaTypeError",
    expectedStatusCode: 415,
    expectedBody: {
      message: "Unsupported media type",
      code: "UNSUPPORTED_MEDIA_TYPE_ERROR",
      context: { contentType: "text/plain" },
      expectedValues: { contentTypes: ["application/json"] },
    },
  },
  {
    scenario: "429 too many requests error",
    response: createTooManyRequestsErrorResponse(),
    expectedType: "TooManyRequestsError",
    expectedStatusCode: 429,
    expectedBody: {
      message: "Too many requests",
      code: "TOO_MANY_REQUESTS_ERROR",
    },
  },
  {
    scenario: "500 internal server error",
    response: createInternalServerErrorResponse(),
    expectedType: "InternalServerError",
    expectedStatusCode: 500,
    expectedBody: {
      message: "Internal server error occurred",
      code: "INTERNAL_SERVER_ERROR",
    },
  },
];

describe("FileClient success responses", () => {
  test("returns typed upload metadata after a successful upload", async () => {
    const metadata = createUploadFileSuccessResponseBody({
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAY",
      name: "report.pdf",
      mimeType: "application/pdf",
      size: 42_000,
      createdAt: "2025-04-05T06:07:08.000Z",
    });
    const mockFetch = createJsonMockFetch(201, metadata);
    const client = createFileClient(mockFetch);
    const command = new UploadFileRequestCommand(createUploadFileRequest());

    const result = await client.send(command);

    const upload = expectResponseType(result, "UploadFileSuccess");
    expect(upload.statusCode).toBe(201);
    expect(upload.header).toEqual({ "Content-Type": "application/json" });
    expect(upload.body).toEqual(metadata);
  });

  test("returns the downloaded bytes after a successful content download", async () => {
    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const mockFetch = createRawMockFetch(200, binaryData, {
      "content-type": "application/octet-stream",
    });
    const client = createFileClient(mockFetch);
    const command = new DownloadFileContentRequestCommand(
      createDownloadFileContentRequest()
    );

    const result = await client.send(command);

    const download = expectResponseType(result, "DownloadFileContentSuccess");
    expect(download.statusCode).toBe(200);
    expect(download.header).toEqual({
      "Content-Type": "application/octet-stream",
    });
    expect(download.body).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(download.body as ArrayBuffer))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a,
    ]);
  });

  test("returns typed file metadata after a successful metadata lookup", async () => {
    const metadata = createGetFileMetadataSuccessResponseBody({
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAZ",
      name: "notes.txt",
      mimeType: "text/plain",
      size: 1_024,
      createdAt: "2025-05-06T07:08:09.000Z",
    });
    const mockFetch = createJsonMockFetch(200, metadata);
    const client = createFileClient(mockFetch);
    const command = new GetFileMetadataRequestCommand(
      createGetFileMetadataRequest()
    );

    const result = await client.send(command);

    const fileMetadata = expectResponseType(result, "GetFileMetadataSuccess");
    expect(fileMetadata.statusCode).toBe(200);
    expect(fileMetadata.header).toEqual({ "Content-Type": "application/json" });
    expect(fileMetadata.body).toEqual(metadata);
  });
});

describe("FileClient shared generated error responses", () => {
  test.each(uploadErrorScenarios)(
    "returns $scenario for upload commands",
    async scenario => {
      const mockFetch = createJsonMockFetch(
        scenario.response.statusCode,
        scenario.response.body
      );
      const client = createFileClient(mockFetch);
      const command = new UploadFileRequestCommand(createUploadFileRequest());

      const result = await client.send(command);

      expect(result.type).toBe(scenario.expectedType);
      expect(result.statusCode).toBe(scenario.expectedStatusCode);
      expect(result.header).toEqual({ "Content-Type": "application/json" });
      expect(result.body).toStrictEqual(scenario.expectedBody);
    }
  );
});

describe("FileClient shared generated authorization errors", () => {
  test("returns unauthorized errors for download commands", async () => {
    const errorResponse = createUnauthorizedErrorResponse();
    const mockFetch = createJsonMockFetch(401, errorResponse.body);
    const client = createFileClient(mockFetch);
    const command = new DownloadFileContentRequestCommand(
      createDownloadFileContentRequest()
    );

    const result = await client.send(command);

    const unauthorized = expectResponseType(result, "UnauthorizedError");
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.body.code).toBe("UNAUTHORIZED_ERROR");
  });

  test("returns unauthorized errors for metadata commands", async () => {
    const errorResponse = createUnauthorizedErrorResponse();
    const mockFetch = createJsonMockFetch(401, errorResponse.body);
    const client = createFileClient(mockFetch);
    const command = new GetFileMetadataRequestCommand(
      createGetFileMetadataRequest()
    );

    const result = await client.send(command);

    const unauthorized = expectResponseType(result, "UnauthorizedError");
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.body.code).toBe("UNAUTHORIZED_ERROR");
  });
});

describe("FileClient unknown and parse failures", () => {
  test.each([
    {
      scenario: "upload",
      send: (client: FileClient) =>
        client.send(new UploadFileRequestCommand(createUploadFileRequest())),
    },
    {
      scenario: "download",
      send: (client: FileClient) =>
        client.send(
          new DownloadFileContentRequestCommand(
            createDownloadFileContentRequest()
          )
        ),
    },
    {
      scenario: "metadata",
      send: (client: FileClient) =>
        client.send(
          new GetFileMetadataRequestCommand(createGetFileMetadataRequest())
        ),
    },
  ])(
    "rejects unknown response statuses for $scenario commands",
    async scenario => {
      const mockFetch = createJsonMockFetch(418, {
        message: "short and stout",
      });
      const client = createFileClient(mockFetch);

      await expect(scenario.send(client)).rejects.toSatisfy((error: unknown) =>
        expectUnknownResponse(error, 418)
      );
    }
  );

  test("rejects download success responses with JSON content", async () => {
    const body = { message: "not binary content" };
    const mockFetch = createJsonMockFetch(200, body);
    const client = createFileClient(mockFetch);
    const command = new DownloadFileContentRequestCommand(
      createDownloadFileContentRequest()
    );

    await expect(client.send(command)).rejects.toSatisfy((error: unknown) => {
      if (!(error instanceof UnknownResponseError)) {
        return false;
      }

      expect(error.body).toStrictEqual(body);
      return error.statusCode === 200;
    });
  });

  test("rejects metadata success responses with an invalid content type", async () => {
    const mockFetch = createRawMockFetch(200, "not metadata", {
      "content-type": "text/plain",
    });
    const client = createFileClient(mockFetch);
    const command = new GetFileMetadataRequestCommand(
      createGetFileMetadataRequest()
    );

    await expect(client.send(command)).rejects.toSatisfy((error: unknown) =>
      expectUnknownResponse(error, 200)
    );
  });

  test("rejects invalid JSON before response validation", async () => {
    const mockFetch = createRawMockFetch(200, "not{json", {
      "content-type": "application/json",
    });
    const client = createFileClient(mockFetch);
    const command = new GetFileMetadataRequestCommand(
      createGetFileMetadataRequest()
    );

    await expect(client.send(command)).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof ResponseParseError &&
        error.statusCode === 200 &&
        error.bodyPreview === "not{json"
      );
    });
  });
});
