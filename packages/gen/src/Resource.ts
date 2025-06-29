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

export type EntityResources = Record<EntityName, OperationResource[]>;

export type SharedResponseResource = IHttpResponseDefinition & {
  isShared: true;
  sourceDir: string;
  sourceFile: string;
  sourceFileName: string;
  outputFile: string;
  outputFileName: string;
  outputDir: string;
};
