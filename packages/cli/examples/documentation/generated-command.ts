import { GetTodoCommand } from "../../../test-utils/src/test-project/output/command/index.js";
import { runGeneratedCommandCli } from "../../../test-utils/src/test-project/output/lib/command/index.js";
import type { GeneratedCommandIo } from "../../../test-utils/src/test-project/output/lib/command/index.js";

export const runGetTodoCommand = (io: GeneratedCommandIo): Promise<number> =>
  runGeneratedCommandCli(
    {
      programName: "todo-api",
      commands: [GetTodoCommand],
    },
    io
  );
