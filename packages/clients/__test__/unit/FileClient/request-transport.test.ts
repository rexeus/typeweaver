import {
  createDownloadFileContentRequest,
  createGetFileMetadataRequest,
  createGetFileMetadataSuccessResponseBody,
  createUploadFileSuccessResponseBody,
  DownloadFileContentRequestCommand,
  GetFileMetadataRequestCommand,
  PathParameterError,
  TestAssertionError,
  UploadFileRequestCommand,
} from "test-utils";
import { describe, expect, test, vi } from "vitest";
import {
  constructWithUncheckedInput,
  createRawMockFetch,
} from "../../helpers.js";
import { createFileClient, createJsonMockFetch } from "./fixtures.js";

type FetchCallDetails = {
  readonly url: string;
  readonly init: RequestInit;
};

function anUploadCommandWithoutDefaultContentType(props: {
  readonly authorization: string;
  readonly fileName: string;
  readonly body: Blob;
}): UploadFileRequestCommand {
  return new UploadFileRequestCommand({
    header: {
      Authorization: props.authorization,
      "X-File-Name": props.fileName,
    },
    body: props.body,
  });
}

function anUploadCommandWithCallerContentType(props: {
  readonly authorization: string;
  readonly contentType: string;
  readonly fileName: string;
  readonly body: Blob;
}): UploadFileRequestCommand {
  return constructWithUncheckedInput(UploadFileRequestCommand, {
    header: {
      Authorization: props.authorization,
      "Content-Type": props.contentType,
      "X-File-Name": props.fileName,
    },
    body: props.body,
  });
}

function aMetadataCommandWithoutDefaultAccept(props: {
  readonly authorization: string;
  readonly fileId: string;
}): GetFileMetadataRequestCommand {
  return new GetFileMetadataRequestCommand({
    header: { Authorization: props.authorization },
    param: { fileId: props.fileId },
  });
}

function getFetchCall(mockFetch: typeof globalThis.fetch): FetchCallDetails {
  const call = vi.mocked(mockFetch).mock.calls[0];

  expect(call).toBeDefined();
  if (call === undefined) {
    throw new TestAssertionError("Expected fetch to be called");
  }

  const [url, init] = call;
  expect(typeof url).toBe("string");
  expect(init).toBeDefined();

  if (typeof url !== "string" || init === undefined) {
    throw new TestAssertionError(
      "Expected fetch to be called with a URL and init"
    );
  }

  return { url, init };
}

describe("FileClient transport contract", () => {
  test("sends upload requests with the generated default Content-Type and original binary body", async () => {
    const metadata = createUploadFileSuccessResponseBody({
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      name: "report.pdf",
      mimeType: "application/pdf",
      size: 42_000,
      createdAt: "2025-01-02T03:04:05.000Z",
    });
    const mockFetch = createJsonMockFetch(201, metadata);
    const client = createFileClient(mockFetch);
    const body = new Blob([new Uint8Array([1, 2, 3])], {
      type: "application/octet-stream",
    });
    const command = anUploadCommandWithoutDefaultContentType({
      authorization: "Bearer upload-token",
      fileName: "report.pdf",
      body,
    });

    await client.send(command);

    const { url, init } = getFetchCall(mockFetch);
    expect(url).toBe("http://localhost:3000/files");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/octet-stream",
      Authorization: "Bearer upload-token",
      "X-File-Name": "report.pdf",
    });
    expect(init.body).toBe(body);
  });

  test("sends a caller-supplied Content-Type instead of the generated upload default", async () => {
    const metadata = createUploadFileSuccessResponseBody();
    const mockFetch = createJsonMockFetch(201, metadata);
    const client = createFileClient(mockFetch);
    const body = new Blob([new Uint8Array([1, 2, 3])], {
      type: "application/octet-stream",
    });
    const command = anUploadCommandWithCallerContentType({
      authorization: "Bearer upload-token",
      contentType: "text/plain",
      fileName: "report.pdf",
      body,
    });

    await client.send(command);

    const { init } = getFetchCall(mockFetch);
    expect(init.headers).toMatchObject({
      "Content-Type": "text/plain",
    });
  });

  test("preserves a caller-supplied Content-Type on upload commands", () => {
    const body = new Blob([new Uint8Array([1, 2, 3])], {
      type: "application/octet-stream",
    });

    const command = anUploadCommandWithCallerContentType({
      authorization: "Bearer upload-token",
      contentType: "text/plain",
      fileName: "report.pdf",
      body,
    });

    expect(command.header["Content-Type"]).toBe("text/plain");
  });
});

describe("FileClient download path contract", () => {
  test("sends download requests to the encoded file content URL", async () => {
    const mockFetch = createRawMockFetch(200, new Uint8Array([0x01, 0x02]), {
      "content-type": "application/octet-stream",
    });
    const client = createFileClient(mockFetch);
    const command = new DownloadFileContentRequestCommand(
      createDownloadFileContentRequest({
        header: { Authorization: "Bearer download-token" },
        param: { fileId: "folder/report 1.pdf" },
      })
    );

    await client.send(command);

    const { url, init } = getFetchCall(mockFetch);
    expect(url).toBe(
      "http://localhost:3000/files/folder%2Freport%201.pdf/content"
    );
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ Authorization: "Bearer download-token" });
    expect(init.body).toBeUndefined();
  });

  test("rejects download requests when the file ID is a current-directory dot segment", async () => {
    const mockFetch = createRawMockFetch(200, new Uint8Array([0x01]), {
      "content-type": "application/octet-stream",
    });
    const client = createFileClient(mockFetch);
    const command = new DownloadFileContentRequestCommand(
      createDownloadFileContentRequest({ param: { fileId: "." } })
    );

    await expect(client.send(command)).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof PathParameterError &&
        error.paramName === "fileId" &&
        error.path === "/files/:fileId/content"
      );
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects metadata requests when the file ID is a parent-directory dot segment", async () => {
    const metadata = createGetFileMetadataSuccessResponseBody();
    const mockFetch = createJsonMockFetch(200, metadata);
    const client = createFileClient(mockFetch);
    const command = new GetFileMetadataRequestCommand(
      createGetFileMetadataRequest({ param: { fileId: ".." } })
    );

    await expect(client.send(command)).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof PathParameterError &&
        error.paramName === "fileId" &&
        error.path === "/files/:fileId"
      );
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("FileClient metadata transport contract", () => {
  test("sends metadata requests with scalar and multi-value headers", async () => {
    const metadata = createGetFileMetadataSuccessResponseBody({
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
      name: "notes.txt",
      mimeType: "text/plain",
      size: 1_024,
      createdAt: "2025-02-03T04:05:06.000Z",
    });
    const mockFetch = createJsonMockFetch(200, metadata);
    const client = createFileClient(mockFetch);
    const command = new GetFileMetadataRequestCommand(
      createGetFileMetadataRequest({
        header: {
          Authorization: "Bearer metadata-token",
          "X-Single-Value": "single",
          "X-Multi-Value": ["a", "b"],
        },
        param: { fileId: "folder/notes 1.txt" },
      })
    );

    await client.send(command);

    const { url, init } = getFetchCall(mockFetch);
    expect(url).toBe("http://localhost:3000/files/folder%2Fnotes%201.txt");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer metadata-token",
      "X-Single-Value": "single",
      "X-Multi-Value": "a, b",
    });
    expect(init.body).toBeUndefined();
  });

  test("sends metadata requests with the generated default Accept header when the command input omits it", async () => {
    const metadata = createGetFileMetadataSuccessResponseBody({
      id: "01ARZ3NDEKTSV4RRFFQ69G5FBA",
      name: "default-accept.txt",
      mimeType: "text/plain",
      size: 1_024,
      createdAt: "2025-06-07T08:09:10.000Z",
    });
    const mockFetch = createJsonMockFetch(200, metadata);
    const client = createFileClient(mockFetch);
    const command = aMetadataCommandWithoutDefaultAccept({
      authorization: "Bearer metadata-token",
      fileId: "folder/default accept.txt",
    });

    await client.send(command);

    const { init } = getFetchCall(mockFetch);
    expect(init.headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer metadata-token",
    });
  });

  test("omits only optional metadata headers explicitly set to undefined", async () => {
    const metadata = createGetFileMetadataSuccessResponseBody({
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
      name: "empty-headers.txt",
      mimeType: "text/plain",
      size: 512,
      createdAt: "2025-03-04T05:06:07.000Z",
    });
    const mockFetch = createJsonMockFetch(200, metadata);
    const client = createFileClient(mockFetch);
    const request = createGetFileMetadataRequest({
      header: {
        Authorization: "Bearer metadata-token",
        "X-Single-Value": "kept-before-override",
        "X-Multi-Value": ["kept-before-override"],
      },
      param: { fileId: "file-metadata-undefined" },
    });
    const header = request.header as Record<
      string,
      string | readonly string[] | undefined
    >;
    header["X-Single-Value"] = "";
    header["X-Multi-Value"] = undefined;
    const command = new GetFileMetadataRequestCommand(request);

    await client.send(command);

    const { init } = getFetchCall(mockFetch);
    const headers = init.headers;
    expect(headers).not.toHaveProperty("X-Multi-Value");
    expect(headers).toStrictEqual({
      Accept: "application/json",
      Authorization: "Bearer metadata-token",
      "X-Single-Value": "",
    });
  });
});
