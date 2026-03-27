import {
  createDownloadFileContentRequest,
  createGetFileMetadataRequest,
  createUploadFileRequest,
  createUploadFileSuccessResponseBody,
  DownloadFileContentRequestCommand,
  FileClient,
  GetFileMetadataRequestCommand,
  UploadFileRequestCommand,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { createRawMockFetch } from "../helpers";

function createFileClient(mockFetch: typeof globalThis.fetch) {
  return new FileClient({
    fetchFn: mockFetch,
    baseUrl: "http://localhost:3000",
  });
}

describe("FileClient", () => {
  test("upload: Blob request → JSON UploadFileSuccessResponse", async () => {
    const metadata = createUploadFileSuccessResponseBody({
      name: "report.pdf",
      mimeType: "application/pdf",
      size: 42_000,
    });
    const mockFetch = createRawMockFetch(201, JSON.stringify(metadata), {
      "content-type": "application/json",
    });
    const client = createFileClient(mockFetch);
    const command = new UploadFileRequestCommand(createUploadFileRequest());

    const result = await client.send(command);

    expect(result._tag).toBe("UploadFileSuccess");
    if (result._tag !== "UploadFileSuccess") return;
    expect(result.body.id).toBe(metadata.id);
    expect(result.body.name).toBe("report.pdf");
    expect(result.body.mimeType).toBe("application/pdf");
    expect(result.body.size).toBe(42_000);
    expect(result.body.createdAt).toBe(metadata.createdAt);
  });

  test("download: GET → binary DownloadFileContentSuccessResponse", async () => {
    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const mockFetch = createRawMockFetch(200, binaryData, {
      "content-type": "application/octet-stream",
    });
    const client = createFileClient(mockFetch);
    const command = new DownloadFileContentRequestCommand(
      createDownloadFileContentRequest()
    );

    const result = await client.send(command);

    expect(result._tag).toBe("DownloadFileContentSuccess");
    if (result._tag !== "DownloadFileContentSuccess") return;
    expect(result.body).toBeInstanceOf(ArrayBuffer);
    const bytes = new Uint8Array(result.body as ArrayBuffer);
    expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  });

  test("metadata: GET → JSON GetFileMetadataSuccessResponse", async () => {
    const metadata = createUploadFileSuccessResponseBody({
      name: "notes.txt",
      mimeType: "text/plain",
      size: 1_024,
    });
    const mockFetch = createRawMockFetch(200, JSON.stringify(metadata), {
      "content-type": "application/json",
    });
    const client = createFileClient(mockFetch);
    const command = new GetFileMetadataRequestCommand(
      createGetFileMetadataRequest()
    );

    const result = await client.send(command);

    expect(result._tag).toBe("GetFileMetadataSuccess");
    if (result._tag !== "GetFileMetadataSuccess") return;
    expect(result.body.id).toBe(metadata.id);
    expect(result.body.name).toBe("notes.txt");
    expect(result.body.mimeType).toBe("text/plain");
    expect(result.body.size).toBe(1_024);
    expect(result.body.createdAt).toBe(metadata.createdAt);
  });
});
