import {
  HttpMethod,
  HttpStatusCode,
  defineOperation,
  defineResponse,
  defineSpec,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
  let target = {};
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
    });
  if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
  return target;
};
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/defaultResponseHeader.ts
const defaultResponseHeader = z.object({
  "Content-Type": z.literal("application/json"),
  "X-Single-Value": z.string().optional(),
  "X-Multi-Value": z.array(z.string()).optional(),
});
defineResponse({
  name: "ConflictError",
  body: z.object({
    message: z.literal("Conflicted request"),
    code: z.literal("CONFLICT_ERROR"),
  }),
  header: defaultResponseHeader,
  statusCode: HttpStatusCode.CONFLICT,
  description: "Conflicted request",
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/ForbiddenErrorDefinition.ts
var ForbiddenErrorDefinition_default = defineResponse({
  name: "ForbiddenError",
  body: z.object({
    message: z.literal("Forbidden request"),
    code: z.literal("FORBIDDEN_ERROR"),
  }),
  header: defaultResponseHeader,
  statusCode: HttpStatusCode.FORBIDDEN,
  description: "Forbidden request",
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/InternalServerErrorDefinition.ts
var InternalServerErrorDefinition_default = defineResponse({
  name: "InternalServerError",
  description: "Internal server error occurred",
  statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Internal server error occurred"),
    code: z.literal("INTERNAL_SERVER_ERROR"),
  }),
});
defineResponse({
  statusCode: HttpStatusCode.NOT_FOUND,
  name: "NotFoundError",
  description: "Resource not found",
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Resource not found"),
    code: z.literal("NOT_FOUND_ERROR"),
  }),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/TooManyRequestsErrorDefinition.ts
var TooManyRequestsErrorDefinition_default = defineResponse({
  name: "TooManyRequestsError",
  description: "Too many requests",
  statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Too many requests"),
    code: z.literal("TOO_MANY_REQUESTS_ERROR"),
  }),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/UnauthorizedErrorDefinition.ts
var UnauthorizedErrorDefinition_default = defineResponse({
  name: "UnauthorizedError",
  description: "Unauthorized request",
  statusCode: HttpStatusCode.UNAUTHORIZED,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Unauthorized request"),
    code: z.literal("UNAUTHORIZED_ERROR"),
  }),
});
defineResponse({
  statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
  name: "UnprocessableEntityError",
  description: "Unprocessable entity error",
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Unprocessable entity"),
    code: z.literal("UNPROCESSABLE_ENTITY_ERROR"),
  }),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/UnsupportedMediaTypeErrorDefinition.ts
var UnsupportedMediaTypeErrorDefinition_default = defineResponse({
  name: "UnsupportedMediaTypeError",
  body: z.object({
    message: z.literal("Unsupported media type"),
    code: z.literal("UNSUPPORTED_MEDIA_TYPE_ERROR"),
    context: z.object({ contentType: z.string() }),
    expectedValues: z.object({ contentTypes: z.tuple([z.literal("application/json")]) }),
  }),
  header: defaultResponseHeader,
  statusCode: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE,
  description: "Unsupported media type",
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/ValidationErrorDefinition.ts
var ValidationErrorDefinition_default = defineResponse({
  name: "ValidationError",
  description: "Validation error",
  statusCode: HttpStatusCode.BAD_REQUEST,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Request is invalid"),
    code: z.literal("VALIDATION_ERROR"),
    issues: z.object({
      body: z.array(z.any()).optional(),
      query: z.array(z.any()).optional(),
      param: z.array(z.any()).optional(),
      header: z.array(z.any()).optional(),
    }),
  }),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/defaultRequestHeader.ts
const defaultRequestHeadersWithPayload = z.object({
  "Content-Type": z.literal("application/json"),
  Accept: z.literal("application/json"),
  Authorization: z.string(),
  "X-Single-Value": z.string().optional(),
  "X-Multi-Value": z.array(z.string()).optional(),
});
const defaultRequestHeadersWithoutPayload = z.object({
  Accept: z.literal("application/json"),
  Authorization: z.string(),
  "X-Single-Value": z.string().optional(),
  "X-Multi-Value": z.array(z.string()).optional(),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/sharedResponses.ts
const sharedResponses = [
  ForbiddenErrorDefinition_default,
  InternalServerErrorDefinition_default,
  TooManyRequestsErrorDefinition_default,
  UnauthorizedErrorDefinition_default,
  UnsupportedMediaTypeErrorDefinition_default,
  ValidationErrorDefinition_default,
];
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/schemas/listResponseSchema.ts
function listResponseSchema(schema) {
  return z.object({
    results: z.array(schema),
    nextToken: z.string().optional(),
  });
}
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/shared/schemas/metadataSchema.ts
const metadataSchema = z.object({
  createdAt: z.string(),
  modifiedAt: z.string(),
  createdBy: z.string(),
  modifiedBy: z.string(),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/account/accountSchema.ts
const accountSchema = z.object({
  id: z.string().max(256),
  email: z.email().max(256),
  ...metadataSchema.shape,
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/account/RegisterAccountDefinition.ts
var RegisterAccountDefinition_default = defineOperation({
  operationId: "RegisterAccount",
  path: "/accounts",
  summary: "Register new account",
  method: HttpMethod.POST,
  request: {
    body: z.object({
      email: z.email().max(256),
      password: z.string().max(256),
    }),
    header: defaultRequestHeadersWithPayload.omit({ Authorization: true }),
  },
  responses: [
    defineResponse({
      statusCode: HttpStatusCode.CREATED,
      description: "Account created successfully",
      body: accountSchema,
      name: "RegisterAccountSuccess",
      header: defaultResponseHeader,
    }),
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/auth/AccessTokenDefinition.ts
var AccessTokenDefinition_default = defineOperation({
  operationId: "AccessToken",
  path: "/auth/access-token",
  summary: "Get access token by email and password",
  method: HttpMethod.POST,
  request: {
    body: z.object({
      email: z.email().max(256),
      password: z.string().max(256),
    }),
    header: defaultRequestHeadersWithPayload.omit({ Authorization: true }),
  },
  responses: [
    defineResponse({
      statusCode: HttpStatusCode.OK,
      description: "Access token created successfully",
      body: z.object({
        accessToken: z.string().max(1028),
        refreshToken: z.string().max(1028),
      }),
      header: defaultResponseHeader,
      name: "AccessTokenSuccess",
    }),
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/auth/RefreshTokenDefinition.ts
var RefreshTokenDefinition_default = defineOperation({
  operationId: "RefreshToken",
  path: "/auth/refresh-token",
  summary: "Refresh access token by refresh token",
  method: HttpMethod.POST,
  request: {
    body: z.object({ refreshToken: z.string().max(1028) }),
    header: defaultRequestHeadersWithPayload.omit({ Authorization: true }),
  },
  responses: [
    defineResponse({
      statusCode: HttpStatusCode.OK,
      description: "Refreshed token successfully",
      body: z.object({
        accessToken: z.string().max(1028),
        refreshToken: z.string().max(1028),
      }),
      header: defaultResponseHeader,
      name: "RefreshTokenSuccess",
    }),
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/file/fileSchema.ts
const fileMetadataSchema = z.object({
  id: z.ulid(),
  name: z.string(),
  size: z.number(),
  mimeType: z.string(),
  createdAt: z.string(),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/file/UploadFileDefinition.ts
var UploadFileDefinition_default = defineOperation({
  operationId: "UploadFile",
  path: "/files",
  summary: "Upload a file",
  method: HttpMethod.POST,
  request: {
    body: z.any(),
    header: z.object({
      "Content-Type": z.literal("application/octet-stream"),
      Authorization: z.string(),
      "X-File-Name": z.string(),
    }),
  },
  responses: [
    defineResponse({
      statusCode: HttpStatusCode.CREATED,
      description: "File uploaded successfully",
      body: fileMetadataSchema,
      name: "UploadFileSuccess",
      header: defaultResponseHeader,
    }),
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/file/DownloadFileContentDefinition.ts
var DownloadFileContentDefinition_default = defineOperation({
  operationId: "DownloadFileContent",
  path: "/files/:fileId/content",
  summary: "Download file content",
  method: HttpMethod.GET,
  request: {
    param: z.object({ fileId: z.ulid() }),
    header: z.object({ Authorization: z.string() }),
  },
  responses: [
    defineResponse({
      statusCode: HttpStatusCode.OK,
      description: "File content retrieved successfully",
      body: z.any(),
      name: "DownloadFileContentSuccess",
      header: z.object({ "Content-Type": z.literal("application/octet-stream") }),
    }),
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/file/GetFileMetadataDefinition.ts
var GetFileMetadataDefinition_default = defineOperation({
  operationId: "GetFileMetadata",
  path: "/files/:fileId",
  summary: "Get file metadata",
  method: HttpMethod.GET,
  request: {
    param: z.object({ fileId: z.ulid() }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    defineResponse({
      statusCode: HttpStatusCode.OK,
      description: "File metadata retrieved successfully",
      body: fileMetadataSchema,
      name: "GetFileMetadataSuccess",
      header: defaultResponseHeader,
    }),
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/todoSchema.ts
const todoStatus = z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]);
const todoSchema = z.object({
  id: z.ulid(),
  accountId: z.ulid(),
  parentId: z.ulid().optional(),
  title: z.string(),
  description: z.string().optional(),
  status: todoStatus,
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  ...metadataSchema.shape,
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/errors/SubTodoNotChangeableErrorDefinition.ts
var SubTodoNotChangeableErrorDefinition_default = defineResponse({
  name: "SubTodoNotChangeableError",
  description: "SubTodo in current status or because of parent todo status cannot be changed",
  statusCode: HttpStatusCode.CONFLICT,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal(
      "SubTodo in current status or because of parent todo status cannot be changed",
    ),
    code: z.literal("SUBTODO_NOT_CHANGEABLE_ERROR"),
    context: z.object({
      todoId: z.ulid(),
      subtodoId: z.ulid(),
      currentTodoStatus: todoStatus,
      currentSubtodoStatus: todoStatus,
    }),
    expectedValues: z.object({
      allowedTodoStatuses: z.array(todoStatus),
      allowedSubtodoStatuses: z.array(todoStatus),
    }),
  }),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/errors/SubTodoNotFoundErrorDefinition.ts
var SubTodoNotFoundErrorDefinition_default = defineResponse({
  name: "SubTodoNotFoundError",
  description: "SubTodo not found",
  statusCode: HttpStatusCode.NOT_FOUND,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("SubTodo not found"),
    code: z.literal("SUBTODO_NOT_FOUND_ERROR"),
    context: z.object({ todoId: z.ulid() }),
    actualValues: z.object({ subtodoId: z.ulid() }),
  }),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/errors/SubTodoStatusTransitionInvalidErrorDefinition.ts
var SubTodoStatusTransitionInvalidErrorDefinition_default = defineResponse({
  name: "SubTodoStatusTransitionInvalidError",
  description: "SubTodo status transition is conflicting with its status or parent todo status",
  statusCode: HttpStatusCode.CONFLICT,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal(
      "SubTodo status transition is conflicting with its status or parent todo status",
    ),
    code: z.literal("SUBTODO_STATUS_TRANSITION_INVALID_ERROR"),
    context: z.object({
      todoId: z.ulid(),
      subtodoId: z.ulid(),
      currentTodoStatus: todoStatus,
      currentSubtodoStatus: todoStatus,
    }),
    actualValues: z.object({ requestedSubtodoStatus: todoStatus }),
    expectedValues: z.object({ allowedSubtodoStatuses: z.array(todoStatus) }),
  }),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/errors/TodoNotChangeableErrorDefinition.ts
var TodoNotChangeableErrorDefinition_default = defineResponse({
  name: "TodoNotChangeableError",
  description: "Todo in current status cannot be changed",
  statusCode: HttpStatusCode.CONFLICT,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Todo in current status cannot be changed"),
    code: z.literal("TODO_NOT_CHANGEABLE_ERROR"),
    context: z.object({
      todoId: z.ulid(),
      currentStatus: todoStatus,
    }),
    expectedValues: z.object({ allowedStatuses: z.array(todoStatus) }),
  }),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/errors/TodoNotFoundErrorDefinition.ts
var TodoNotFoundErrorDefinition_default = defineResponse({
  name: "TodoNotFoundError",
  description: "Todo not found",
  statusCode: HttpStatusCode.NOT_FOUND,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Todo not found"),
    code: z.literal("TODO_NOT_FOUND_ERROR"),
    actualValues: z.object({ todoId: z.ulid() }),
  }),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/errors/TodoStatusTransitionInvalidErrorDefinition.ts
var TodoStatusTransitionInvalidErrorDefinition_default = defineResponse({
  name: "TodoStatusTransitionInvalidError",
  description: "Todo status transition is conflicting with current status",
  statusCode: HttpStatusCode.CONFLICT,
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Todo status transition is conflicting with current status"),
    code: z.literal("TODO_STATUS_TRANSITION_INVALID_ERROR"),
    context: z.object({
      todoId: z.ulid(),
      currentStatus: todoStatus,
    }),
    actualValues: z.object({ requestedStatus: todoStatus }),
    expectedValues: z.object({ allowedStatuses: z.array(todoStatus) }),
  }),
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/mutations/CreateSubTodoDefinition.ts
var CreateSubTodoDefinition_default = defineOperation({
  operationId: "CreateSubTodo",
  summary: "Create new subtodo",
  method: HttpMethod.POST,
  path: "/todos/:todoId/subtodos",
  request: {
    param: z.object({ todoId: z.ulid() }),
    body: todoSchema.omit({
      id: true,
      accountId: true,
      parentId: true,
      createdAt: true,
      createdBy: true,
      modifiedBy: true,
      modifiedAt: true,
      status: true,
    }),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    defineResponse({
      name: "CreateSubTodoSuccess",
      body: todoSchema,
      description: "SubTodo created successfully",
      statusCode: HttpStatusCode.CREATED,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/mutations/CreateTodoDefinition.ts
var CreateTodoDefinition_default = defineOperation({
  operationId: "CreateTodo",
  summary: "Create new todo",
  method: HttpMethod.POST,
  path: "/todos",
  request: {
    body: todoSchema.omit({
      id: true,
      parentId: true,
      accountId: true,
      createdAt: true,
      createdBy: true,
      modifiedBy: true,
      modifiedAt: true,
      status: true,
    }),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    defineResponse({
      name: "CreateTodoSuccess",
      body: todoSchema,
      description: "Todo created successfully",
      statusCode: HttpStatusCode.CREATED,
      header: defaultResponseHeader,
    }),
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/mutations/DeleteSubTodoDefinition.ts
var DeleteSubTodoDefinition_default = defineOperation({
  operationId: "DeleteSubTodo",
  summary: "Delete subtodo",
  method: HttpMethod.DELETE,
  path: "/todos/:todoId/subtodos/:subtodoId",
  request: {
    param: z.object({
      todoId: z.ulid(),
      subtodoId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    defineResponse({
      name: "DeleteSubTodoSuccess",
      body: z.object({ message: z.string() }),
      description: "SubTodo deleted successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    SubTodoNotFoundErrorDefinition_default,
    TodoNotFoundErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/mutations/DeleteTodoDefinition.ts
var DeleteTodoDefinition_default = defineOperation({
  operationId: "DeleteTodo",
  summary: "Delete todo",
  method: HttpMethod.DELETE,
  path: "/todos/:todoId",
  request: {
    param: z.object({ todoId: z.ulid() }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    defineResponse({
      name: "DeleteTodoSuccess",
      description: "Todo deleted successfully",
      statusCode: HttpStatusCode.NO_CONTENT,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/mutations/PutTodoDefinition.ts
var PutTodoDefinition_default = defineOperation({
  operationId: "PutTodo",
  path: "/todos/:todoId",
  request: {
    param: z.object({ todoId: z.ulid() }),
    body: todoSchema.omit({
      id: true,
      createdBy: true,
      createdAt: true,
      modifiedBy: true,
      modifiedAt: true,
    }),
    header: defaultRequestHeadersWithPayload,
  },
  method: HttpMethod.PUT,
  summary: "Replace todo completely",
  responses: [
    defineResponse({
      name: "PutTodoSuccess",
      body: todoSchema,
      description: "Todo replaced successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition_default,
    TodoNotChangeableErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/mutations/UpdateSubTodoDefinition.ts
var UpdateSubTodoDefinition_default = defineOperation({
  operationId: "UpdateSubTodo",
  summary: "Update subtodo",
  method: HttpMethod.PUT,
  path: "/todos/:todoId/subtodos/:subtodoId",
  request: {
    param: z.object({
      todoId: z.ulid(),
      subtodoId: z.ulid(),
    }),
    body: todoSchema
      .omit({
        id: true,
        accountId: true,
        parentId: true,
        createdAt: true,
        createdBy: true,
        modifiedBy: true,
        modifiedAt: true,
      })
      .partial(),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    defineResponse({
      name: "UpdateSubTodoSuccess",
      body: todoSchema,
      description: "SubTodo updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    SubTodoNotFoundErrorDefinition_default,
    SubTodoNotChangeableErrorDefinition_default,
    SubTodoStatusTransitionInvalidErrorDefinition_default,
    TodoNotFoundErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/mutations/UpdateTodoDefinition.ts
var UpdateTodoDefinition_default = defineOperation({
  operationId: "UpdateTodo",
  path: "/todos/:todoId",
  request: {
    param: z.object({ todoId: z.ulid() }),
    body: todoSchema
      .omit({
        id: true,
        parentId: true,
        createdBy: true,
        createdAt: true,
        modifiedBy: true,
        modifiedAt: true,
        accountId: true,
        status: true,
      })
      .partial(),
    header: defaultRequestHeadersWithPayload,
  },
  method: HttpMethod.PATCH,
  summary: "Update todo",
  responses: [
    defineResponse({
      name: "UpdateTodoSuccess",
      body: todoSchema,
      description: "Todo updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition_default,
    TodoNotChangeableErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/mutations/UpdateTodoStatusDefinition.ts
var UpdateTodoStatusDefinition_default = defineOperation({
  operationId: "UpdateTodoStatus",
  path: "/todos/:todoId/status",
  method: HttpMethod.PUT,
  summary: "Update todo status",
  request: {
    param: z.object({ todoId: z.ulid() }),
    body: z.object({ value: todoSchema.shape.status }),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    defineResponse({
      name: "UpdateTodoStatusSuccess",
      body: todoSchema,
      description: "Todo status updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition_default,
    TodoStatusTransitionInvalidErrorDefinition_default,
    TodoNotChangeableErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/queries/GetTodoDefinition.ts
var GetTodoDefinition_default = defineOperation({
  operationId: "GetTodo",
  request: {
    param: z.object({ todoId: z.ulid() }),
    header: defaultRequestHeadersWithoutPayload,
  },
  method: HttpMethod.GET,
  summary: "Get todo",
  path: "/todos/:todoId",
  responses: [
    defineResponse({
      name: "GetTodoSuccess",
      body: todoSchema,
      description: "Todo retrieved successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/queries/HeadTodoDefinition.ts
var HeadTodoDefinition_default = defineOperation({
  operationId: "HeadTodo",
  request: {
    param: z.object({ todoId: z.ulid() }),
    header: defaultRequestHeadersWithoutPayload,
  },
  method: HttpMethod.HEAD,
  summary: "Check if todo exists",
  path: "/todos/:todoId",
  responses: [
    defineResponse({
      name: "HeadTodoSuccess",
      description: "Todo exists",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/queries/ListSubTodosDefinition.ts
const listSubTodosQuerySchema = z.object({
  limit: z.string().optional(),
  nextToken: z.string().optional(),
  sortBy: z.enum(["title", "dueDate", "priority", "createdAt", "modifiedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
var ListSubTodosDefinition_default = defineOperation({
  operationId: "ListSubTodos",
  request: {
    param: z.object({ todoId: z.ulid() }),
    header: defaultRequestHeadersWithoutPayload,
    query: listSubTodosQuerySchema.optional(),
  },
  method: HttpMethod.GET,
  summary: "List subtodos for a specific todo",
  path: "/todos/:todoId/subtodos",
  responses: [
    defineResponse({
      name: "ListSubTodosSuccess",
      body: listResponseSchema(todoSchema),
      description: "Subtodos retrieved successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/queries/ListTodosDefinition.ts
const listTodosQuerySchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.string().optional(),
  nextToken: z.string().optional(),
  sortBy: z.enum(["title", "dueDate", "priority", "createdAt", "modifiedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
var ListTodosDefinition_default = defineOperation({
  operationId: "ListTodos",
  summary: "List todos with filtering, pagination, and search",
  method: HttpMethod.GET,
  path: "/todos",
  request: {
    header: defaultRequestHeadersWithoutPayload,
    query: listTodosQuerySchema,
  },
  responses: [
    defineResponse({
      name: "ListTodosSuccess",
      description: "List todos successfully",
      statusCode: HttpStatusCode.OK,
      body: listResponseSchema(todoSchema),
      header: defaultResponseHeader,
    }),
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/queries/OptionsTodoDefinition.ts
var OptionsTodoDefinition_default = defineOperation({
  operationId: "OptionsTodo",
  request: {
    param: z.object({ todoId: z.ulid() }),
    header: z.object({
      ...defaultRequestHeadersWithoutPayload.shape,
      "Access-Control-Request-Method": z.string().optional(),
      "Access-Control-Request-Headers": z.array(z.string()).optional(),
    }),
  },
  method: HttpMethod.OPTIONS,
  summary: "Get allowed methods for todo resource",
  path: "/todos/:todoId",
  responses: [
    defineResponse({
      name: "OptionsTodoSuccess",
      description: "Allowed methods for todo resource",
      statusCode: HttpStatusCode.OK,
      header: z.object({
        Allow: z.array(z.string()),
        "Access-Control-Allow-Origin": z.string().optional(),
        "Access-Control-Allow-Methods": z.array(z.string()).optional(),
        "Access-Control-Allow-Headers": z.array(z.string()).optional(),
        "Access-Control-Max-Age": z.string().optional(),
      }),
    }),
    TodoNotFoundErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/queries/QuerySubTodoDefinition.ts
const querySubTodoRequestBodySchema = z.object({
  searchText: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dateRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
});
const querySubTodoRequestQuerySchema = z.object({
  limit: z.string().optional(),
  nextToken: z.string().optional(),
  sortBy: z.enum(["title", "dueDate", "priority", "createdAt", "modifiedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  format: z.enum(["summary", "detailed"]).optional(),
});
var QuerySubTodoDefinition_default = defineOperation({
  operationId: "QuerySubTodo",
  request: {
    param: z.object({ todoId: z.ulid() }),
    header: defaultRequestHeadersWithPayload,
    query: querySubTodoRequestQuerySchema,
    body: querySubTodoRequestBodySchema,
  },
  method: HttpMethod.POST,
  summary: "Query subtodos for a specific todo",
  path: "/todos/:todoId/subtodos/query",
  responses: [
    defineResponse({
      name: "QuerySubTodoSuccess",
      body: listResponseSchema(todoSchema),
      description: "Subtodos query results",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    TodoNotFoundErrorDefinition_default,
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/todo/queries/QueryTodoDefinition.ts
const queryTodoRequestBodySchema = z.object({
  searchText: z.string().optional(),
  accountId: z.ulid().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dateRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  hasParent: z.boolean().optional(),
});
var QueryTodoDefinition_default = defineOperation({
  operationId: "QueryTodo",
  request: {
    header: defaultRequestHeadersWithPayload,
    query: z.object({
      limit: z.string().optional(),
      nextToken: z.string().optional(),
      sortBy: z.enum(["title", "dueDate", "priority", "createdAt", "modifiedAt"]).optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
    }),
    body: queryTodoRequestBodySchema,
  },
  method: HttpMethod.POST,
  summary: "Query todos with advanced search criteria",
  path: "/todos/query",
  responses: [
    defineResponse({
      name: "QueryTodoSuccess",
      body: listResponseSchema(todoSchema),
      description: "Todos query results",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    }),
    ...sharedResponses,
  ],
});
//#endregion
//#region ../../Users/denniswentzien/Development/rexeus/typeweaver/packages/test-utils/src/test-project/spec/index.ts
var spec_exports = /* @__PURE__ */ __exportAll({ default: () => spec_default });
var spec_default = defineSpec({
  resources: {
    account: { operations: [RegisterAccountDefinition_default] },
    auth: { operations: [AccessTokenDefinition_default, RefreshTokenDefinition_default] },
    file: {
      operations: [
        UploadFileDefinition_default,
        DownloadFileContentDefinition_default,
        GetFileMetadataDefinition_default,
      ],
    },
    todo: {
      operations: [
        CreateSubTodoDefinition_default,
        CreateTodoDefinition_default,
        DeleteSubTodoDefinition_default,
        DeleteTodoDefinition_default,
        GetTodoDefinition_default,
        HeadTodoDefinition_default,
        ListSubTodosDefinition_default,
        ListTodosDefinition_default,
        OptionsTodoDefinition_default,
        PutTodoDefinition_default,
        QuerySubTodoDefinition_default,
        QueryTodoDefinition_default,
        UpdateSubTodoDefinition_default,
        UpdateTodoDefinition_default,
        UpdateTodoStatusDefinition_default,
      ],
    },
  },
});
//#endregion
//#region ../../private/tmp/typeweaver-spec-loader-TgkmuE/spec-entrypoint.ts
const resolvedSpec =
  Reflect.get(spec_exports, "default") ?? Reflect.get(spec_exports, "spec") ?? spec_exports;
const spec = resolvedSpec;
//#endregion
export { resolvedSpec as default, spec };
