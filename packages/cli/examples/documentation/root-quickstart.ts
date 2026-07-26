import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";

export const UserNotFoundErrorDefinition = defineResponse({
  name: "UserNotFoundError",
  statusCode: HttpStatusCode.NOT_FOUND,
  description: "User not found",
  body: z.object({ message: z.literal("User not found") }),
});

export const sharedResponses = [
  defineResponse({
    name: "UnauthorizedError",
    statusCode: HttpStatusCode.UNAUTHORIZED,
    description: "Authentication required",
    body: z.object({ message: z.literal("Unauthorized") }),
  }),
] as const;

export const GetUserDefinition = defineOperation({
  operationId: "getUser",
  method: HttpMethod.GET,
  path: "/users/:userId",
  summary: "Get a user by id",
  request: {
    param: z.object({ userId: z.uuid() }),
  },
  responses: [
    defineResponse({
      name: "GetUserSuccess",
      statusCode: HttpStatusCode.OK,
      description: "User successfully retrieved",
      header: z.object({
        "Content-Type": z.literal("application/json"),
      }),
      body: z.object({
        id: z.uuid(),
        name: z.string(),
        email: z.email(),
      }),
    }),
    UserNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});

export const spec = defineSpec({
  resources: {
    user: {
      operations: [GetUserDefinition],
    },
  },
});
