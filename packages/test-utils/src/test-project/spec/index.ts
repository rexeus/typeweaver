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
  resources: {
    account: {
      operations: [RegisterAccountDefinition],
    },
    auth: {
      operations: [AccessTokenDefinition, RefreshTokenDefinition],
    },
    file: {
      operations: [
        UploadFileDefinition,
        DownloadFileContentDefinition,
        GetFileMetadataDefinition,
      ],
    },
    todo: {
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
