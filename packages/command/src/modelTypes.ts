import type {
  NormalizedOperation,
  NormalizedRequest,
} from "@rexeus/typeweaver-gen";

export type CommandInputTarget = "path" | "query" | "header";

export type CommandInputModel = {
  readonly flag: string;
  readonly key: string;
  readonly target: CommandInputTarget;
  readonly required: boolean;
  readonly multiple: boolean;
};

export type CommandSecuritySchemeModel =
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

export type CommandSecurityModel = {
  readonly requirements: readonly (readonly string[])[];
  readonly schemes: readonly CommandSecuritySchemeModel[];
};

export type CommandOperationModel = {
  readonly resourceIndex: number;
  readonly operationIndex: number;
  readonly resourceName: string;
  readonly operationId: string;
  readonly exportName: string;
  readonly commandName: string;
  readonly summary: string;
  readonly method: NormalizedOperation["method"];
  readonly path: string;
  readonly inputs: readonly CommandInputModel[];
  readonly headerDefaults: Readonly<Record<string, string>>;
  readonly security: CommandSecurityModel;
  readonly hasHeader: boolean;
  readonly hasParam: boolean;
  readonly hasQuery: boolean;
  readonly hasBody: boolean;
  readonly bodyTransport?: NonNullable<NormalizedRequest["body"]>["transport"];
  readonly unsupportedTargets: readonly CommandInputTarget[];
};
