import path from "node:path";
import { pascalCase } from "polycase";
import { relative } from "../../helpers/path.js";
import { MissingCanonicalResponseError } from "../../plugins/errors/MissingCanonicalResponseError.js";
import type {
  NormalizedResponse,
  NormalizedSpec,
} from "../../NormalizedSpec.js";

export const makeOperationOutputPaths = (
  outputDir: string,
  resourceName: string,
  operationId: string
) => {
  const resourceOutputDir = path.join(outputDir, resourceName);
  const fileBase = pascalCase(operationId);
  const requestFileName = `${fileBase}Request.ts`;
  const responseFileName = `${fileBase}Response.ts`;
  const requestValidationFileName = `${fileBase}RequestValidator.ts`;
  const responseValidationFileName = `${fileBase}ResponseValidator.ts`;
  const clientFileName = `${fileBase}Client.ts`;
  return {
    outputDir: resourceOutputDir,
    requestFileName,
    responseFileName,
    requestValidationFileName,
    responseValidationFileName,
    clientFileName,
    requestFile: path.join(resourceOutputDir, requestFileName),
    responseFile: path.join(resourceOutputDir, responseFileName),
    requestValidationFile: path.join(
      resourceOutputDir,
      requestValidationFileName
    ),
    responseValidationFile: path.join(
      resourceOutputDir,
      responseValidationFileName
    ),
    clientFile: path.join(resourceOutputDir, clientFileName),
  };
};

export const findCanonicalResponse = (
  normalizedSpec: NormalizedSpec,
  responseName: string
): NormalizedResponse => {
  const response = normalizedSpec.responses.find(
    candidate => candidate.name === responseName
  );
  if (response === undefined) {
    throw new MissingCanonicalResponseError({ responseName });
  }
  return response;
};

export const canonicalResponseFile = (
  responsesOutputDir: string,
  responseName: string
): string =>
  path.join(responsesOutputDir, `${pascalCase(responseName)}Response.ts`);

export const canonicalResponseImportPath = (params: {
  readonly importerDir: string;
  readonly responsesOutputDir: string;
  readonly responseName: string;
}): string =>
  relative(
    params.importerDir,
    canonicalResponseFile(
      params.responsesOutputDir,
      params.responseName
    ).replace(/\.ts$/u, ".js")
  );

export const specImportPath = (
  importerDir: string,
  specOutputDir: string
): string => relative(importerDir, path.join(specOutputDir, "spec.js"));
