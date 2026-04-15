const STARTER_SPEC_DIR = "spec";
const STARTER_RESOURCE_DIR = `${STARTER_SPEC_DIR}/todo`;
const STARTER_SHARED_DIR = `${STARTER_SPEC_DIR}/shared`;

export type StarterTemplateFile = {
  readonly relativePath: string;
  readonly content: string;
};

export type StarterTemplate = {
  readonly files: readonly StarterTemplateFile[];
  readonly resourceCount: number;
  readonly operationCount: number;
  readonly responseCount: number;
};

export const STARTER_SPEC_ENTRYPOINT = `${STARTER_SPEC_DIR}/index.ts`;

const starterReadme = `# Typeweaver starter

This starter gives you a working first spec with:

- one \`todo\` resource
- three operations (list, get, create)
- shared request/response helpers
- shared error responses
- a single \`spec/index.ts\` entrypoint

Next steps:

1. Run \`typeweaver validate --config ./typeweaver.config.mjs\`
2. Run \`typeweaver generate --config ./typeweaver.config.mjs\`
3. Replace the starter schemas and operations with your real API
`;

const starterSpecEntrypoint = `import { defineSpec } from "@rexeus/typeweaver-core";
import { CreateTodoDefinition, GetTodoDefinition, ListTodosDefinition } from "./todo/index.js";

export const spec = defineSpec({
  resources: {
    todo: {
      operations: [CreateTodoDefinition, GetTodoDefinition, ListTodosDefinition],
    },
  },
});
`;

const starterTodoIndex = `export { CreateTodoDefinition } from "./CreateTodoDefinition.js";
export { GetTodoDefinition } from "./GetTodoDefinition.js";
export { ListTodosDefinition } from "./ListTodosDefinition.js";
`;

const starterTodoSchema = `import { z } from "zod";

export const todoStatusSchema = z.enum(["pending", "done"]);

export const todoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  status: todoStatusSchema,
});

export const createTodoBodySchema = todoSchema.omit({
  id: true,
  status: true,
});
`;

const starterListTodosDefinition = `import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  defaultRequestHeadersWithoutPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../shared/index.js";
import { todoSchema } from "./todoSchema.js";

export const ListTodosDefinition = defineOperation({
  operationId: "listTodos",
  method: HttpMethod.GET,
  path: "/todos",
  summary: "List todos",
  request: {
    header: defaultRequestHeadersWithoutPayload,
    query: z.object({
      status: z.enum(["pending", "done"]).optional(),
    }),
  },
  responses: [
    defineResponse({
      name: "ListTodosSuccess",
      statusCode: HttpStatusCode.OK,
      description: "Todos retrieved successfully",
      header: defaultResponseHeader,
      body: z.object({
        items: z.array(todoSchema),
      }),
    }),
    ...sharedResponses,
  ],
});
`;

const starterGetTodoDefinition = `import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  defaultRequestHeadersWithoutPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../shared/index.js";
import { todoSchema } from "./todoSchema.js";

export const GetTodoDefinition = defineOperation({
  operationId: "getTodo",
  method: HttpMethod.GET,
  path: "/todos/:todoId",
  summary: "Get a todo",
  request: {
    param: z.object({
      todoId: z.string().min(1),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    defineResponse({
      name: "GetTodoSuccess",
      statusCode: HttpStatusCode.OK,
      description: "Todo retrieved successfully",
      header: defaultResponseHeader,
      body: todoSchema,
    }),
    ...sharedResponses,
  ],
});
`;

const starterCreateTodoDefinition = `import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import {
  defaultRequestHeadersWithPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../shared/index.js";
import { createTodoBodySchema, todoSchema } from "./todoSchema.js";

export const CreateTodoDefinition = defineOperation({
  operationId: "createTodo",
  method: HttpMethod.POST,
  path: "/todos",
  summary: "Create a todo",
  request: {
    header: defaultRequestHeadersWithPayload,
    body: createTodoBodySchema,
  },
  responses: [
    defineResponse({
      name: "CreateTodoSuccess",
      statusCode: HttpStatusCode.CREATED,
      description: "Todo created successfully",
      header: defaultResponseHeader,
      body: todoSchema,
    }),
    ...sharedResponses,
  ],
});
`;

const starterSharedIndex = `export { ForbiddenErrorDefinition } from "./ForbiddenErrorDefinition.js";
export { InternalServerErrorDefinition } from "./InternalServerErrorDefinition.js";
export { ValidationErrorDefinition } from "./ValidationErrorDefinition.js";
export * from "./defaultRequestHeader.js";
export * from "./defaultResponseHeader.js";
export * from "./sharedResponses.js";
`;

const starterDefaultRequestHeader = `import { z } from "zod";

export const defaultRequestHeadersWithPayload = z.object({
  "Content-Type": z.literal("application/json"),
  Accept: z.literal("application/json"),
  Authorization: z.string(),
});

export const defaultRequestHeadersWithoutPayload = z.object({
  Accept: z.literal("application/json"),
  Authorization: z.string(),
});
`;

const starterDefaultResponseHeader = `import { z } from "zod";

export const defaultResponseHeader = z.object({
  "Content-Type": z.literal("application/json"),
});
`;

const starterForbiddenErrorDefinition = `import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader.js";

export const ForbiddenErrorDefinition = defineResponse({
  name: "ForbiddenError",
  statusCode: HttpStatusCode.FORBIDDEN,
  description: "Forbidden request",
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Forbidden request"),
    code: z.literal("FORBIDDEN_ERROR"),
  }),
});
`;

const starterInternalServerErrorDefinition = `import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader.js";

export const InternalServerErrorDefinition = defineResponse({
  name: "InternalServerError",
  statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
  description: "Internal server error",
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Internal server error"),
    code: z.literal("INTERNAL_SERVER_ERROR"),
  }),
});
`;

const starterValidationErrorDefinition = `import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader.js";

export const ValidationErrorDefinition = defineResponse({
  name: "ValidationError",
  statusCode: HttpStatusCode.BAD_REQUEST,
  description: "Request validation failed",
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Request validation failed"),
    code: z.literal("VALIDATION_ERROR"),
    issues: z.object({
      body: z.array(z.any()).optional(),
      header: z.array(z.any()).optional(),
      param: z.array(z.any()).optional(),
      query: z.array(z.any()).optional(),
    }),
  }),
});
`;

const starterSharedResponses = `import { ForbiddenErrorDefinition } from "./ForbiddenErrorDefinition.js";
import { InternalServerErrorDefinition } from "./InternalServerErrorDefinition.js";
import { ValidationErrorDefinition } from "./ValidationErrorDefinition.js";

export const sharedResponses = [
  ForbiddenErrorDefinition,
  InternalServerErrorDefinition,
  ValidationErrorDefinition,
];
`;

export const createStarterTemplate = (): StarterTemplate => {
  return {
    resourceCount: 1,
    operationCount: 3,
    responseCount: 6,
    files: [
      {
        relativePath: `${STARTER_SPEC_DIR}/README.md`,
        content: starterReadme,
      },
      {
        relativePath: STARTER_SPEC_ENTRYPOINT,
        content: starterSpecEntrypoint,
      },
      {
        relativePath: `${STARTER_RESOURCE_DIR}/index.ts`,
        content: starterTodoIndex,
      },
      {
        relativePath: `${STARTER_RESOURCE_DIR}/todoSchema.ts`,
        content: starterTodoSchema,
      },
      {
        relativePath: `${STARTER_RESOURCE_DIR}/ListTodosDefinition.ts`,
        content: starterListTodosDefinition,
      },
      {
        relativePath: `${STARTER_RESOURCE_DIR}/GetTodoDefinition.ts`,
        content: starterGetTodoDefinition,
      },
      {
        relativePath: `${STARTER_RESOURCE_DIR}/CreateTodoDefinition.ts`,
        content: starterCreateTodoDefinition,
      },
      {
        relativePath: `${STARTER_SHARED_DIR}/index.ts`,
        content: starterSharedIndex,
      },
      {
        relativePath: `${STARTER_SHARED_DIR}/defaultRequestHeader.ts`,
        content: starterDefaultRequestHeader,
      },
      {
        relativePath: `${STARTER_SHARED_DIR}/defaultResponseHeader.ts`,
        content: starterDefaultResponseHeader,
      },
      {
        relativePath: `${STARTER_SHARED_DIR}/ForbiddenErrorDefinition.ts`,
        content: starterForbiddenErrorDefinition,
      },
      {
        relativePath: `${STARTER_SHARED_DIR}/InternalServerErrorDefinition.ts`,
        content: starterInternalServerErrorDefinition,
      },
      {
        relativePath: `${STARTER_SHARED_DIR}/ValidationErrorDefinition.ts`,
        content: starterValidationErrorDefinition,
      },
      {
        relativePath: `${STARTER_SHARED_DIR}/sharedResponses.ts`,
        content: starterSharedResponses,
      },
    ],
  };
};
