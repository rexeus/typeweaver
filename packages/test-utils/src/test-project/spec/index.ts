import { defineSpec } from "@rexeus/typeweaver-core";
import { RegisterAccountDefinition } from "../definition/account";
import {
  AccessTokenDefinition,
  RefreshTokenDefinition,
} from "../definition/auth";
import {
  DownloadFileContentDefinition,
  GetFileMetadataDefinition,
  UploadFileDefinition,
} from "../definition/file";
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
} from "../definition/todo";

export default defineSpec({
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
