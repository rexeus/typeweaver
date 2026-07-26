export type GeneratedCommandInputTarget = "path" | "query" | "header";

export type GeneratedCommandInput = {
  readonly flag: string;
  readonly key: string;
  readonly target: GeneratedCommandInputTarget;
  readonly required: boolean;
  readonly multiple: boolean;
};

export type GeneratedCommandSecurityScheme =
  | {
      readonly name: string;
      readonly flag: string;
      readonly kind: "http";
      readonly scheme: "basic" | "bearer";
    }
  | {
      readonly name: string;
      readonly flag: string;
      readonly kind: "apiKey";
      readonly credentialName: string;
      readonly location: "header" | "query" | "cookie";
    }
  | {
      readonly name: string;
      readonly flag: string;
      readonly kind: "oauth2" | "openIdConnect";
    };

export type GeneratedCommandSecurity = {
  readonly requirements: readonly (readonly string[])[];
  readonly schemes: readonly GeneratedCommandSecurityScheme[];
};

export type GeneratedCommandRequest = {
  readonly param?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string | string[]>>;
  readonly header?: Readonly<Record<string, string | string[]>>;
  readonly body?: unknown;
};

export type GeneratedCommandResponse = {
  readonly type: string;
  readonly statusCode: number;
  readonly header?: unknown;
  readonly body?: unknown;
};

export type GeneratedCommandExecutionContext = {
  readonly baseUrl: string;
  readonly request: GeneratedCommandRequest;
  readonly defaultHeaders: Readonly<Record<string, string>>;
  readonly defaultQuery: Readonly<Record<string, string>>;
  readonly signal: AbortSignal;
};

export type GeneratedCommand = {
  readonly name: string;
  readonly operationId: string;
  readonly summary: string;
  readonly inputs: readonly GeneratedCommandInput[];
  readonly headerDefaults: Readonly<Record<string, string>>;
  readonly security: GeneratedCommandSecurity;
  readonly hasBody: boolean;
  readonly bodyTransport?:
    | "json"
    | "text"
    | "form-url-encoded"
    | "multipart"
    | "raw";
  readonly execute: (
    context: GeneratedCommandExecutionContext
  ) => Promise<GeneratedCommandResponse>;
};

export type GeneratedCommandProgram = {
  readonly programName: string;
  readonly commands: readonly GeneratedCommand[];
};

export type GeneratedCommandIo = {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdinIsTTY: boolean;
  readonly readFile: (filePath: string) => Promise<string>;
  readonly readStdin: () => Promise<string>;
  readonly writeStdout: (value: string) => void;
  readonly writeStderr: (value: string) => void;
};

export const defineGeneratedCommand = <Command extends GeneratedCommand>(
  command: Command
): Command => command;
