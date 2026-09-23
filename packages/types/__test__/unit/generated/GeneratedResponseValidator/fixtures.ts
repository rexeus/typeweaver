import assert from "node:assert";
import {
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  InvalidResponseIssue,
  InvalidStatusCodeIssue,
} from "@rexeus/typeweaver-core";
import { expect } from "vitest";
import type {
  ICreateTodoSuccessResponseBody,
  ICreateTodoSuccessResponseHeader,
  IDeleteTodoSuccessResponseHeader,
  IOptionsTodoSuccessResponseHeader,
} from "test-utils";

export type RuntimeResponse = {
  readonly type?: string;
  readonly statusCode?: unknown;
  readonly header?: unknown;
  readonly body?: unknown;
};

export type RuntimeResponsePart = "body" | "header" | "statusCode";

export const validCreateTodoBody = (): ICreateTodoSuccessResponseBody => ({
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  accountId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  title: "Write reference-quality response validator specs",
  description: "Replace broad checks with public contract examples",
  status: "TODO",
  dueDate: "2026-05-08T00:00:00.000Z",
  tags: ["contracts", "validators"],
  priority: "HIGH",
  createdAt: "2026-05-07T08:00:00.000Z",
  modifiedAt: "2026-05-07T09:00:00.000Z",
  createdBy: "ada",
  modifiedBy: "grace",
});

export const validCreateTodoHeader = (): ICreateTodoSuccessResponseHeader => ({
  "Content-Type": "application/json",
  "X-Single-Value": "request-1",
  "X-Multi-Value": ["alpha", "0"],
});

export const validCreateTodoResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.CREATED,
  header: validCreateTodoHeader(),
  body: validCreateTodoBody(),
});

export const validValidationErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.BAD_REQUEST,
  header: validCreateTodoHeader(),
  body: {
    message: "Request is invalid",
    code: "VALIDATION_ERROR",
    issues: {
      body: [
        {
          path: ["title"],
          message: "Required field missing",
          code: "invalid_type",
        },
      ],
      query: undefined,
      param: undefined,
      header: undefined,
    },
  },
});

export const validUnauthorizedErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.UNAUTHORIZED,
  header: validCreateTodoHeader(),
  body: {
    message: "Unauthorized request",
    code: "UNAUTHORIZED_ERROR",
  },
});

export const validForbiddenErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.FORBIDDEN,
  header: validCreateTodoHeader(),
  body: {
    message: "Forbidden request",
    code: "FORBIDDEN_ERROR",
  },
});

export const validTooManyRequestsErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
  header: validCreateTodoHeader(),
  body: {
    message: "Too many requests",
    code: "TOO_MANY_REQUESTS_ERROR",
  },
});

export const validUnsupportedMediaTypeErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE,
  header: validCreateTodoHeader(),
  body: {
    message: "Unsupported media type",
    code: "UNSUPPORTED_MEDIA_TYPE_ERROR",
    context: {
      contentType: "text/plain",
    },
    expectedValues: {
      contentTypes: ["application/json"],
    },
  },
});

export const validInternalServerErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
  header: validCreateTodoHeader(),
  body: {
    message: "Internal server error occurred",
    code: "INTERNAL_SERVER_ERROR",
  },
});

export const responseWithRuntimePart = (
  response: RuntimeResponse,
  part: RuntimeResponsePart,
  value: unknown
): RuntimeResponse => ({
  ...response,
  [part]: value,
});

export const asHttpResponse = (response: unknown): IHttpResponse =>
  response as IHttpResponse;

export const responseIssueFor = (
  error: ResponseValidationError,
  responseName: string
): InvalidResponseIssue => {
  const issue = error.issues.find(
    candidate =>
      candidate.type === "INVALID_RESPONSE" &&
      candidate.responseName === responseName
  );
  assert(issue?.type === "INVALID_RESPONSE");
  return issue;
};

export const issuePaths = (
  issues: readonly { readonly path: readonly (string | number | symbol)[] }[]
): string[] => issues.map(issue => issue.path.join("."));

export const expectNoPartialData = (result: {
  readonly isValid: boolean;
  readonly data?: unknown;
}): void => {
  expect(result.isValid).toBe(false);
  expect("data" in result).toBe(false);
};

export const validOptionsTodoHeader =
  (): IOptionsTodoSuccessResponseHeader => ({
    Allow: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "Access-Control-Allow-Headers": ["Content-Type", "Authorization"],
    "Access-Control-Allow-Methods": [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    "Access-Control-Max-Age": "3600",
    "Access-Control-Allow-Origin": "*",
  });

export const validOptionsTodoResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.OK,
  header: validOptionsTodoHeader(),
});

export const validDeleteTodoHeader = (): IDeleteTodoSuccessResponseHeader => ({
  "Content-Type": "application/json",
  "X-Single-Value": "delete-1",
  "X-Multi-Value": ["deleted"],
});

export const validDeleteTodoSuccessResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.NO_CONTENT,
  header: validDeleteTodoHeader(),
});

export const validDeleteTodoNoContentResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.NO_CONTENT,
});

export const withoutRuntimePart = (
  response: RuntimeResponse,
  part: RuntimeResponsePart
): RuntimeResponse => {
  const copy: Record<string, unknown> = { ...response };
  delete copy[part];
  return copy;
};

export const statusCodeIssueFor = (
  error: ResponseValidationError
): InvalidStatusCodeIssue => {
  const issue = error.issues.find(
    candidate => candidate.type === "INVALID_STATUS_CODE"
  );
  assert(issue?.type === "INVALID_STATUS_CODE");
  return issue;
};
