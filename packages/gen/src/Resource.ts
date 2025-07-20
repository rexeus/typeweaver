import type {
  IHttpOperationDefinition,
  IHttpResponseDefinition,
} from "@rexeus/typeweaver-core";

export type GetResourcesResult = {
  entityResources: EntityResources;
  sharedResponseResources: SharedResponseResource[];
};

export type ExtendedResponseDefinition = IHttpResponseDefinition & {
  statusCodeName: string;
  isReference: boolean;
};

export type EntityName = string;
export type OperationResource = {
  sourceDir: string;
  sourceFile: string;
  sourceFileName: string;
  definition: Omit<IHttpOperationDefinition, "responses"> & {
    responses: ExtendedResponseDefinition[];
  };
  outputDir: string;
  entityName: EntityName;
  outputRequestFile: string;
  outputRequestFileName: string;
  outputResponseFile: string;
  outputResponseFileName: string;
  outputRequestValidationFile: string;
  outputRequestValidationFileName: string;
  outputResponseValidationFile: string;
  outputResponseValidationFileName: string;
  outputClientFile: string;
  outputClientFileName: string;
};

export type EntityResources = Record<
  EntityName,
  {
    operations: OperationResource[];
    responses: EntityResponseResource[];
  }
>;

export type SharedResponseResource = IHttpResponseDefinition & {
  sourceDir: string;
  sourceFile: string;
  sourceFileName: string;
  outputFile: string;
  outputFileName: string;
  outputDir: string;
};

export type EntityResponseResource = IHttpResponseDefinition & {
  sourceDir: string;
  sourceFile: string;
  sourceFileName: string;
  outputFile: string;
  outputFileName: string;
  outputDir: string;
  entityName: EntityName;
};
