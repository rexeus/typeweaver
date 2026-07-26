import { defineSpec } from "@rexeus/typeweaver-core";
import { RegisterAccountDefinition } from "./account/index.js";
import { AccessTokenDefinition, RefreshTokenDefinition } from "./auth/index.js";
import {
  DownloadFileContentDefinition,
  GetFileMetadataDefinition,
  UploadFileDefinition,
} from "./file/index.js";
import {
  CreateSubTodoDefinition,
  CreateTodoDefinition,
  DeleteSubTodoDefinition,
  DeleteTodoDefinition,
  GetTodoDefinition,
  HeadTodoDefinition,
  ListSubTodosDefinition,
  ListTodosDefinition,
  OptionsTodoDefinition,
  PutTodoDefinition,
  QuerySubTodoDefinition,
  QueryTodoDefinition,
  UpdateSubTodoDefinition,
  UpdateTodoDefinition,
  UpdateTodoStatusDefinition,
} from "./todo/index.js";

export const spec = defineSpec({
  metadata: {
    title: "TypeWeaver Test API",
    version: "1.0.0",
    description:
      "Executable fixture for metadata, security, transport, and generator contracts.",
    tags: [
      { name: "account", description: "Account registration" },
      { name: "auth", description: "Token lifecycle" },
      { name: "files", description: "Binary file operations" },
      { name: "todos", description: "Todo management" },
      { name: "read", description: "Read-only operations" },
    ],
  },
  securitySchemes: [
    {
      name: "bearerAuth",
      kind: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    },
    {
      name: "apiKeyAuth",
      kind: "apiKey",
      credentialName: "X-API-Key",
      location: "header",
    },
    {
      name: "oauth2Auth",
      kind: "oauth2",
      flows: {
        authorizationCode: {
          authorizationUrl: "https://identity.example.test/authorize",
          tokenUrl: "https://identity.example.test/token",
          scopes: {
            "tokens:write": "Create and refresh access tokens",
          },
        },
      },
    },
  ],
  security: [{ bearerAuth: [] }],
  resources: {
    account: {
      description: "Public account registration",
      tags: ["account"],
      security: [],
      operations: [RegisterAccountDefinition],
    },
    auth: {
      description: "OAuth2 token lifecycle",
      tags: ["auth"],
      security: [{ oauth2Auth: ["tokens:write"] }],
      operations: [AccessTokenDefinition, RefreshTokenDefinition],
    },
    file: {
      description: "API-key-protected file transfer",
      tags: ["files"],
      security: [{ apiKeyAuth: [] }],
      operations: [
        UploadFileDefinition,
        DownloadFileContentDefinition,
        GetFileMetadataDefinition,
      ],
    },
    todo: {
      description: "Bearer-protected todo operations",
      tags: ["todos"],
      operations: [
        CreateSubTodoDefinition,
        CreateTodoDefinition,
        DeleteSubTodoDefinition,
        DeleteTodoDefinition,
        GetTodoDefinition,
        HeadTodoDefinition,
        ListSubTodosDefinition,
        ListTodosDefinition,
        OptionsTodoDefinition,
        PutTodoDefinition,
        QuerySubTodoDefinition,
        QueryTodoDefinition,
        UpdateSubTodoDefinition,
        UpdateTodoDefinition,
        UpdateTodoStatusDefinition,
      ],
    },
  },
});
