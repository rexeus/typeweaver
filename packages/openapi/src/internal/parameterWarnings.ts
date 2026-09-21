import {
  escapeJsonPointerSegment,
  isJsonPointerAtOrBelow,
  jsonPointer,
} from "./jsonPointer.js";
import type { OpenApiBuildWarning } from "../types.js";
import type { OperationContext } from "./operationContext.js";

export function rebaseParameterSchemaWarnings(options: {
  readonly warnings: readonly OpenApiBuildWarning[];
  readonly context: OperationContext;
  readonly parameterNames: readonly string[];
  readonly startIndex: number;
}): readonly OpenApiBuildWarning[] {
  return options.warnings.map(warning => {
    if (warning.origin !== "schema-conversion") return warning;
    const parameterIndex = options.parameterNames.findIndex(name =>
      isJsonPointerAtOrBelow(
        warning.schemaPath,
        `/properties/${escapeJsonPointerSegment(name)}`
      )
    );
    if (parameterIndex === -1) return warning;
    const parameterName = options.parameterNames[parameterIndex];
    if (parameterName === undefined) return warning;
    const schemaPath = `/properties/${escapeJsonPointerSegment(parameterName)}`;
    const suffix = warning.schemaPath.slice(schemaPath.length);
    return {
      ...warning,
      documentPath: `${jsonPointer([
        "paths",
        options.context.openApiPath,
        options.context.method,
        "parameters",
        String(options.startIndex + parameterIndex),
        "schema",
      ])}${suffix}`,
      location: { ...warning.location, parameterName },
    };
  });
}
