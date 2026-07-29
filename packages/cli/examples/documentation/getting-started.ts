import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";

export const TodoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  completed: z.boolean(),
});

export const GetTodoSuccess = defineResponse({
  name: "GetTodoSuccess",
  statusCode: HttpStatusCode.OK,
  description: "The todo was found",
  body: TodoSchema,
});

export const TodoNotFound = defineResponse({
  name: "TodoNotFound",
  statusCode: HttpStatusCode.NOT_FOUND,
  description: "The todo does not exist",
  body: z.object({
    message: z.literal("Todo not found"),
    todoId: z.uuid(),
  }),
});

export const GetTodo = defineOperation({
  operationId: "getTodo",
  method: HttpMethod.GET,
  path: "/todos/:todoId",
  summary: "Get one todo",
  request: {
    param: z.object({
      todoId: z.uuid(),
    }),
  },
  responses: [GetTodoSuccess, TodoNotFound],
});

export const spec = defineSpec({
  metadata: {
    title: "Todo API",
    version: "1.0.0",
    description: "A small API used to learn TypeWeaver.",
    tags: [
      {
        name: "todos",
        description: "Todo management",
      },
    ],
  },
  resources: {
    todo: {
      description: "Read and manage todos.",
      tags: ["todos"],
      operations: [GetTodo],
    },
  },
});
