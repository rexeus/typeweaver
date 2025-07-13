import path from "path";
import fs from "fs";
import type {
  ExtendedResponseDefinition,
  OperationResource,
  SharedResponseResource,
  GetResourcesResult,
} from "@rexeus/typeweaver-gen";
import {
  type HttpMethod,
  HttpOperationDefinition,
  HttpResponseDefinition,
  HttpStatusCode,
  HttpStatusCodeNameMap,
  type HttpBodySchema,
  type HttpHeaderSchema,
  type HttpParamSchema,
  type HttpQuerySchema,
  type IHttpRequestDefinition,
  type IHttpResponseDefinition,
} from "@rexeus/typeweaver-core";
import { InvalidSharedDirError } from "./errors/InvalidSharedDirError";
import { InvalidSharedResponseDefinitionError } from "./errors/InvalidSharedResponseDefinitionError";

export type ResourceReaderConfig = {
  readonly sourceDir: string;
  readonly outputDir: string;
  readonly sharedSourceDir: string;
  readonly sharedOutputDir: string;
};

export class ResourceReader {
  public constructor(private readonly config: ResourceReaderConfig) {
    //
  }

  public async getResources(): Promise<GetResourcesResult> {
    const contents = fs.readdirSync(this.config.sourceDir, {
      withFileTypes: true,
    });

    const result: GetResourcesResult = {
      entityResources: {},
      sharedResponseResources: [],
    };

    const sharedDefinitions = contents.find(
      content => content.name === "shared"
    );
    if (sharedDefinitions) {
      if (!sharedDefinitions.isDirectory()) {
        throw new InvalidSharedDirError("'shared' is a file, not a directory");
      }

      result.sharedResponseResources = await this.getSharedResponseResources();

      console.info(
        `Found '${result.sharedResponseResources.length}' shared responses`
      );
    } else {
      console.info("No 'shared' directory found");
    }

    for (const content of contents) {
      if (!content.isDirectory()) {
        console.info(`Skipping '${content.name}' as it is not a directory`);
        continue;
      }
      if (content.name === "shared") {
        continue;
      }

      const entityName = content.name;
      const entitySourceDir = path.join(this.config.sourceDir, entityName);

      const operationResources = await this.getEntityOperationResources(
        entitySourceDir,
        entityName
      );

      result.entityResources[entityName] = operationResources;

      console.info(
        `Found '${operationResources.length}' operation definitions for entity '${entityName}'`
      );
    }

    return result;
  }

  private async getSharedResponseResources(): Promise<
    SharedResponseResource[]
  > {
    const sharedContents = fs.readdirSync(this.config.sharedSourceDir, {
      withFileTypes: true,
    });

    const sharedResponseResources: SharedResponseResource[] = [];

    for (const content of sharedContents) {
      if (!content.isFile()) {
        console.info(`Skipping '${content.name}' as it is not a file`);
        continue;
      }

      const sourceFileName = content.name;
      const sourceFile = path.join(this.config.sharedSourceDir, sourceFileName);
      const definition = (await import(sourceFile)) as {
        default: HttpResponseDefinition<
          string,
          HttpStatusCode,
          string,
          HttpHeaderSchema | undefined,
          HttpBodySchema | undefined,
          boolean
        >;
      };

      if (!definition.default) {
        console.info(
          `Skipping '${sourceFile}' as it does not have a default export`
        );
        continue;
      }

      if (!(definition.default instanceof HttpResponseDefinition)) {
        console.info(
          `Skipping '${sourceFile}' as it is not an instance of HttpResponseDefinition`
        );
        continue;
      }

      if (!definition.default.isShared) {
        throw new InvalidSharedResponseDefinitionError(
          sourceFileName,
          this.config.sharedSourceDir,
          sourceFile,
          "'isShared' property is not set to 'true'"
        );
      }

      const outputDir = this.config.sharedOutputDir;
      const outputFileName = `${definition.default.name}Response.ts`;
      const outputFile = path.join(outputDir, outputFileName);

      sharedResponseResources.push({
        ...definition.default,
        isShared: true,
        sourceDir: this.config.sharedSourceDir,
        sourceFile: sourceFile,
        sourceFileName,
        outputFile,
        outputFileName,
        outputDir,
      });
    }

    return sharedResponseResources;
  }

  private async getEntityOperationResources(
    sourceDir: string,
    entityName: string
  ): Promise<OperationResource[]> {
    const contents = fs.readdirSync(sourceDir, {
      withFileTypes: true,
    });

    const definitions: OperationResource[] = [];

    for (const content of contents) {
      if (!content.isFile()) {
        console.info(`Skipping '${content.name}' as it is not a file`);
        continue;
      }

      const sourceFileName = content.name;
      const sourceFile = path.join(sourceDir, sourceFileName);
      const definition = (await import(sourceFile)) as {
        default: HttpOperationDefinition<
          string,
          string,
          HttpMethod,
          string,
          HttpHeaderSchema | undefined,
          HttpParamSchema | undefined,
          HttpQuerySchema | undefined,
          HttpBodySchema | undefined,
          IHttpRequestDefinition<
            HttpHeaderSchema | undefined,
            HttpParamSchema | undefined,
            HttpQuerySchema | undefined,
            HttpBodySchema | undefined
          >,
          IHttpResponseDefinition[]
        >;
      };

      if (!definition.default) {
        console.info(
          `Skipping '${sourceFile}' as it does not have a default export`
        );
        continue;
      }

      if (!(definition.default instanceof HttpOperationDefinition)) {
        console.info(
          `Skipping '${sourceFile}' as it is not an instance of HttpOperationDefinition`
        );
        continue;
      }

      const { operationId } = definition.default as HttpOperationDefinition<
        string,
        string,
        HttpMethod,
        string,
        HttpHeaderSchema | undefined,
        HttpParamSchema | undefined,
        HttpQuerySchema | undefined,
        HttpBodySchema | undefined,
        IHttpRequestDefinition<
          HttpHeaderSchema | undefined,
          HttpParamSchema | undefined,
          HttpQuerySchema | undefined,
          HttpBodySchema | undefined
        >,
        IHttpResponseDefinition[]
      >;
      const outputDir = path.join(this.config.outputDir, entityName);
      const outputRequestFileName = `${operationId}Request.ts`;
      const outputRequestFile = path.join(outputDir, outputRequestFileName);
      const outputResponseFileName = `${operationId}Response.ts`;
      const outputResponseFile = path.join(outputDir, outputResponseFileName);
      const outputRequestValidationFileName = `${operationId}RequestValidator.ts`;
      const outputRequestValidationFile = path.join(
        outputDir,
        outputRequestValidationFileName
      );
      const outputResponseValidationFileName = `${operationId}ResponseValidator.ts`;
      const outputResponseValidationFile = path.join(
        outputDir,
        outputResponseValidationFileName
      );
      const outputClientFileName = `${operationId}Client.ts`;
      const outputClientFile = path.join(outputDir, outputClientFileName);

      const operationResource: OperationResource = {
        sourceDir,
        sourceFile,
        sourceFileName,
        definition: {
          ...definition.default,
          responses: [],
        },
        outputDir,
        entityName,
        outputRequestFile,
        outputResponseFile,
        outputResponseValidationFile,
        outputRequestValidationFile,
        outputRequestFileName,
        outputRequestValidationFileName,
        outputResponseFileName,
        outputResponseValidationFileName,
        outputClientFile,
        outputClientFileName,
      };

      if (!definition.default.responses) {
        throw new Error(
          `Operation '${operationId}' does not have any responses`
        );
      }

      for (const response of definition.default.responses) {
        const extendedResponse: ExtendedResponseDefinition = {
          ...response,
          statusCodeName:
            HttpStatusCodeNameMap[
              response.statusCode as unknown as HttpStatusCode
            ],
        };
        operationResource.definition.responses.push(extendedResponse);
      }

      definitions.push(operationResource);
    }

    return definitions;
  }
}
