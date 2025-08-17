import fs from "fs";
import path from "path";
import {
  HttpOperationDefinition,
  HttpResponseDefinition,
  HttpStatusCode,
  HttpStatusCodeNameMap,
} from "@rexeus/typeweaver-core";
import type {
  HttpBodySchema,
  HttpHeaderSchema,
  HttpMethod,
  HttpParamSchema,
  HttpQuerySchema,
  IHttpRequestDefinition,
  IHttpResponseDefinition,
} from "@rexeus/typeweaver-core";
import type {
  EntityResponseResource,
  ExtendedResponseDefinition,
  GetResourcesResult,
  OperationResource,
  SharedResponseResource,
} from "@rexeus/typeweaver-gen";
import { DefinitionValidator } from "./DefinitionValidator";
import { InvalidSharedDirError } from "./errors/InvalidSharedDirError";

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

    const validator = new DefinitionValidator();

    // Check if shared directory exists
    if (fs.existsSync(this.config.sharedSourceDir)) {
      const sharedStats = fs.statSync(this.config.sharedSourceDir);
      if (!sharedStats.isDirectory()) {
        throw new InvalidSharedDirError(
          `'${this.config.sharedSourceDir}' is a file, not a directory`
        );
      }

      result.sharedResponseResources =
        await this.getSharedResponseResources(validator);

      console.info(
        `Found '${result.sharedResponseResources.length}' shared responses in '${this.config.sharedSourceDir}'`
      );
    } else {
      console.info(
        `No shared directory found at '${this.config.sharedSourceDir}'`
      );
    }

    const normalizedSharedPath = path.resolve(this.config.sharedSourceDir);

    for (const content of contents) {
      if (!content.isDirectory()) {
        console.info(`Skipping '${content.name}' as it is not a directory`);
        continue;
      }

      const entityName = content.name;
      const entitySourceDir = path.resolve(this.config.sourceDir, entityName);

      // Skip the shared directory if it's inside the source directory
      // Check if this directory is the shared directory or contains it
      if (
        entitySourceDir === normalizedSharedPath ||
        normalizedSharedPath.startsWith(entitySourceDir + path.sep)
      ) {
        console.info(
          `Skipping '${content.name}' as it is or contains the shared directory`
        );
        continue;
      }

      const responseResources = await this.getEntityResponseResources(
        entitySourceDir,
        entityName,
        validator
      );

      const operationResources = await this.getEntityOperationResources(
        entitySourceDir,
        entityName,
        validator,
        [...result.sharedResponseResources, ...responseResources]
      );

      result.entityResources[entityName] = {
        operations: operationResources,
        responses: responseResources,
      };

      console.info(
        `Found '${operationResources.length}' operation definitions for entity '${entityName}'`
      );

      if (responseResources.length > 0) {
        console.info(
          `Found '${responseResources.length}' response definitions for entity '${entityName}'`
        );
      }
    }

    return result;
  }

  private scanDirectoryRecursively(dir: string): string[] {
    const files: string[] = [];
    const contents = fs.readdirSync(dir, { withFileTypes: true });

    for (const content of contents) {
      const fullPath = path.join(dir, content.name);
      if (content.isDirectory()) {
        // Recursively scan subdirectories
        files.push(...this.scanDirectoryRecursively(fullPath));
      } else if (content.isFile() && content.name.endsWith(".ts")) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async getSharedResponseResources(
    validator: DefinitionValidator
  ): Promise<SharedResponseResource[]> {
    const files = this.scanDirectoryRecursively(this.config.sharedSourceDir);
    const sharedResponseResources: SharedResponseResource[] = [];

    for (const sourceFile of files) {
      const sourceFileName = path.basename(sourceFile);
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

      // Validate the response definition
      validator.validateResponse(definition.default, sourceFile);

      const outputDir = this.config.sharedOutputDir;
      const outputFileName = `${definition.default.name}Response.ts`;
      const outputFile = path.join(outputDir, outputFileName);

      sharedResponseResources.push({
        ...definition.default,
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
    entityName: string,
    validator: DefinitionValidator,
    referencedResponses: (SharedResponseResource | EntityResponseResource)[]
  ): Promise<OperationResource[]> {
    const files = this.scanDirectoryRecursively(sourceDir);
    const definitions: OperationResource[] = [];

    for (const sourceFile of files) {
      const sourceFileName = path.basename(sourceFile);
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

      // Validate the operation definition
      validator.validateOperation(definition.default, sourceFile);

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
        if (referencedResponses.some(ref => ref.name === response.name)) {
          // This is a reference to an existing response - don't generate types locally
          const referencedResponse: ExtendedResponseDefinition = {
            ...response,
            statusCodeName:
              HttpStatusCodeNameMap[
                response.statusCode as unknown as HttpStatusCode
              ],
            isReference: true,
          };
          operationResource.definition.responses.push(referencedResponse);
        } else {
          // This is a new operation-specific response - generate types locally
          const extendedResponse: ExtendedResponseDefinition = {
            ...response,
            statusCodeName:
              HttpStatusCodeNameMap[
                response.statusCode as unknown as HttpStatusCode
              ],
            isReference: false,
          };
          operationResource.definition.responses.push(extendedResponse);
        }
      }

      definitions.push(operationResource);
    }

    return definitions;
  }

  private async getEntityResponseResources(
    sourceDir: string,
    entityName: string,
    validator: DefinitionValidator
  ): Promise<EntityResponseResource[]> {
    const files = this.scanDirectoryRecursively(sourceDir);
    const responseResources: EntityResponseResource[] = [];

    for (const sourceFile of files) {
      const sourceFileName = path.basename(sourceFile);
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
        continue;
      }

      if (!(definition.default instanceof HttpResponseDefinition)) {
        continue;
      }

      // Don't skip responses marked as shared - they belong to this entity
      // Entity-specific responses can still extend from shared definitions

      // Validate the response definition
      validator.validateResponse(definition.default, sourceFile);

      const outputFileName = `${definition.default.name}Response.ts`;
      const outputFile = path.join(
        this.config.outputDir,
        entityName,
        outputFileName
      );

      responseResources.push({
        ...definition.default,
        sourceDir,
        sourceFile,
        sourceFileName,
        outputFile,
        outputFileName,
        outputDir: path.join(this.config.outputDir, entityName),
        entityName,
      });
    }

    return responseResources;
  }
}
