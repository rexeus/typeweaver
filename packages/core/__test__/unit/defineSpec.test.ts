import { describe, expect, test } from "vitest";
import { defineOperation } from "../../src/defineOperation";
import { defineResponse } from "../../src/defineResponse";
import { DuplicateResponseNameError, defineSpec } from "../../src/defineSpec";
import { HttpMethod } from "../../src/HttpMethod";
import { HttpStatusCode } from "../../src/HttpStatusCode";

describe("defineSpec", () => {
  test("accepts globally unique response names", () => {
    const spec = defineSpec({
      resources: {
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
      },
    });

    expect(Object.keys(spec.resources)).toEqual(["users", "sessions"]);
  });

  test("rejects duplicate response names across resources", () => {
    expect(() =>
      defineSpec({
        resources: {
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
        },
      })
    ).toThrowError(DuplicateResponseNameError);
  });

  test("allows reusing the same named response definition", () => {
    const sharedResponse = defineResponse({
      name: "SharedError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Bad request",
    });

    const spec = defineSpec({
      resources: {
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
      },
    });

    expect(spec.resources.users.operations[0]?.responses[0]).toBe(
      sharedResponse
    );
    expect(spec.resources.sessions.operations[0]?.responses[0]).toBe(
      sharedResponse
    );
  });
});
