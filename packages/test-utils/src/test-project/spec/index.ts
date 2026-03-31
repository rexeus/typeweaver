import { defineSpec } from "@rexeus/typeweaver-core";
import { RegisterAccountDefinition } from "./account";
import { AccessTokenDefinition, RefreshTokenDefinition } from "./auth";
import {
  DownloadFileContentDefinition,
  GetFileMetadataDefinition,
  UploadFileDefinition,
} from "./file";
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
} from "./todo";

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
