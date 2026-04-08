import { describe, expect, test } from "vitest";
import { defineOperation } from "../../src/defineOperation.js";
import { defineResponse } from "../../src/defineResponse.js";
import { DuplicateResponseNameError } from "../../src/DuplicateResponseNameError.js";
import { HttpMethod } from "../../src/HttpMethod.js";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";
import { validateUniqueResponseNames } from "../../src/validateResponseUniqueness.js";

describe("validateUniqueResponseNames", () => {
  test("accepts globally unique named responses", () => {
    expect(() =>
      validateUniqueResponseNames({
        users: {
          operations: [
            defineOperation({
              operationId: "getUser",
              path: "/users/:id",
              method: HttpMethod.GET,
              summary: "Get user",
              request: {},
              responses: [
                defineResponse({
                  name: "GetUserSuccess",
                  statusCode: HttpStatusCode.OK,
                  description: "User found",
                }),
              ],
            }),
          ],
        },
        sessions: {
          operations: [
            defineOperation({
              operationId: "createSession",
              path: "/sessions",
              method: HttpMethod.POST,
              summary: "Create session",
              request: {},
              responses: [
                defineResponse({
                  name: "CreateSessionSuccess",
                  statusCode: HttpStatusCode.CREATED,
                  description: "Session created",
                }),
              ],
            }),
          ],
        },
      })
    ).not.toThrow();
  });

  test("rejects duplicate response names from distinct definitions", () => {
    expect(() =>
      validateUniqueResponseNames({
        users: {
          operations: [
            defineOperation({
              operationId: "getUser",
              path: "/users/:id",
              method: HttpMethod.GET,
              summary: "Get user",
              request: {},
              responses: [
                defineResponse({
                  name: "SharedError",
                  statusCode: HttpStatusCode.BAD_REQUEST,
                  description: "Bad request",
                }),
              ],
            }),
          ],
        },
        sessions: {
          operations: [
            defineOperation({
              operationId: "createSession",
              path: "/sessions",
              method: HttpMethod.POST,
              summary: "Create session",
              request: {},
              responses: [
                defineResponse({
                  name: "SharedError",
                  statusCode: HttpStatusCode.UNAUTHORIZED,
                  description: "Unauthorized",
                }),
              ],
            }),
          ],
        },
      })
    ).toThrowError(DuplicateResponseNameError);
  });

  test("allows reusing the same response definition instance", () => {
    const sharedResponse = defineResponse({
      name: "SharedError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Bad request",
    });

    expect(() =>
      validateUniqueResponseNames({
        users: {
          operations: [
            defineOperation({
              operationId: "getUser",
              path: "/users/:id",
              method: HttpMethod.GET,
              summary: "Get user",
              request: {},
              responses: [sharedResponse],
            }),
          ],
        },
        sessions: {
          operations: [
            defineOperation({
              operationId: "createSession",
              path: "/sessions",
              method: HttpMethod.POST,
              summary: "Create session",
              request: {},
              responses: [sharedResponse],
            }),
          ],
        },
      })
    ).not.toThrow();
  });
});
