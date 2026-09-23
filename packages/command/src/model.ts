import { getRequestHeaderDefaults } from "@rexeus/typeweaver-clients";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { kebabCase, pascalCase } from "polycase";
import {
  buildInputs,
  buildSecurityModel,
  unsupportedTargets,
} from "./modelHelpers.js";
import type { CommandOperationModel } from "./modelTypes.js";

export const buildCommandOperationModels = (
  spec: NormalizedSpec
): readonly CommandOperationModel[] =>
  spec.resources.flatMap((resource, resourceIndex) =>
    resource.operations.map((operation, operationIndex) => {
      const security = buildSecurityModel(spec, operation);
      const headerDefaultEntries =
        getRequestHeaderDefaults(operation.request)?.entries ?? [];
      const headerDefaults = Object.fromEntries(
        headerDefaultEntries.map(entry => [entry.key, entry.value])
      );
      const headerDefaultKeys = new Set(
        headerDefaultEntries.map(entry => entry.key.toLowerCase())
      );
      return {
        resourceIndex,
        operationIndex,
        resourceName: resource.name,
        operationId: operation.operationId,
        exportName: `${pascalCase(operation.operationId)}Command`,
        commandName: kebabCase(operation.operationId),
        summary: operation.summary,
        method: operation.method,
        path: operation.path,
        inputs: buildInputs({
          request: operation.request,
          security,
          headerDefaultKeys,
        }),
        headerDefaults,
        security,
        hasHeader: operation.request?.header !== undefined,
        hasParam: operation.request?.param !== undefined,
        hasQuery: operation.request?.query !== undefined,
        hasBody: operation.request?.body !== undefined,
        ...(operation.request?.body === undefined
          ? {}
          : { bodyTransport: operation.request.body.transport }),
        unsupportedTargets: unsupportedTargets(operation.request),
      };
    })
  );
