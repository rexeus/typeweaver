import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import type {
  ICreateTodoRequest,
  IGetTodoRequest,
  IListTodosRequest,
  IQuerySubTodoRequest,
} from "test-utils";

export const TODO_ID = "01K0W0Y49HZVW1QTN6RZJJY203";

export const AUTHORIZATION = "Bearer reference-token";

export const validCreateTodoRequest = (): ICreateTodoRequest => ({
  method: HttpMethod.POST,
  path: "/todos",
  header: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  body: {
    title: "Write reference request validator specs",
    description: "Cover the generated request validator public contract.",
    dueDate: "2026-06-01T00:00:00.000Z",
    tags: ["testing", "contracts"],
    priority: "HIGH",
  },
});

export const validGetTodoRequest = (): IGetTodoRequest => ({
  method: HttpMethod.GET,
  path: `/todos/${TODO_ID}`,
  header: {
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  param: {
    todoId: TODO_ID,
  },
});

export const validListTodosRequest = (): IListTodosRequest => ({
  method: HttpMethod.GET,
  path: "/todos",
  header: {
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  query: {
    status: "TODO",
    priority: "MEDIUM",
    tags: ["testing", "contracts"],
    limit: "25",
    nextToken: "next-page-token",
    sortBy: "createdAt",
    sortOrder: "desc",
    search: "validator",
    dateFrom: "2026-05-01",
    dateTo: "2026-05-31",
  },
});

export const validQuerySubTodoRequest = (): IQuerySubTodoRequest => ({
  method: HttpMethod.POST,
  path: `/todos/${TODO_ID}/subtodos/query`,
  header: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  param: {
    todoId: TODO_ID,
  },
  query: {
    limit: "10",
    sortBy: "createdAt",
    sortOrder: "asc",
    format: "summary",
  },
  body: {
    searchText: "reference",
    status: "TODO",
    priority: "LOW",
    dateRange: {
      from: "2026-05-01",
      to: "2026-05-31",
    },
    tags: ["testing"],
  },
});

export const requestWithRuntimePart = (
  request: IRawHttpRequest,
  part: "body" | "header" | "param" | "query",
  value: unknown
): IRawHttpRequest => ({
  ...request,
  [part]: value,
});

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(entry => typeof entry === "string");

/**
 * Parses a raw query or header record from JSON, which keeps keys such as
 * `__proto__` as own data properties, and fails unless every value is a string.
 */
export const parseRawStringRecord = (json: string): Record<string, string> => {
  const parsed: unknown = JSON.parse(json);
  if (!isStringRecord(parsed)) {
    throw new TypeError(`Expected a JSON record of strings: ${json}`);
  }

  return parsed;
};

export const issuePaths = (issues: RequestValidationError["bodyIssues"]) =>
  issues.map(issue => issue.path);

export const querySubTodoRequestWithInvalidBodyHeaderParamAndQuery =
  (): IRawHttpRequest =>
    requestWithRuntimePart(
      requestWithRuntimePart(
        requestWithRuntimePart(
          requestWithRuntimePart(validQuerySubTodoRequest(), "body", {
            status: "BLOCKED",
          }),
          "header",
          { Accept: "text/plain" }
        ),
        "param",
        { todoId: "not-a-ulid" }
      ),
      "query",
      { sortBy: "updatedAt" }
    );
