import type { Issue, NormalizedSpec } from "@rexeus/typeweaver-gen";
import { buildCommandOperationModels } from "./model.js";
import type { CommandOperationModel } from "./model.js";

const RESERVED_COMMAND_NAMES = new Set(["help"]);

const operationPath = (model: CommandOperationModel): `/${string}` =>
  `/resources/${model.resourceIndex}/operations/${model.operationIndex}`;

const childPath = (
  model: CommandOperationModel,
  suffix: string
): `/${string}` => `${operationPath(model)}/${suffix}`;

const reservedNameIssue = (model: CommandOperationModel): Issue | undefined =>
  RESERVED_COMMAND_NAMES.has(model.commandName)
    ? {
        code: "TW-PLUGIN-COMMAND-001",
        severity: "error",
        message: `Operation '${model.operationId}' maps to reserved command name '${model.commandName}'.`,
        path: childPath(model, "operationId"),
        hint: "Rename the operation ID so its kebab-case command is not reserved.",
        fixable: false,
      }
    : undefined;

const commandCollisionIssue = (
  model: CommandOperationModel,
  priorOperationId: string | undefined
): Issue | undefined =>
  priorOperationId === undefined
    ? undefined
    : {
        code: "TW-PLUGIN-COMMAND-002",
        severity: "error",
        message: `Operations '${priorOperationId}' and '${model.operationId}' both map to command '${model.commandName}'.`,
        path: childPath(model, "operationId"),
        hint: "Rename one operation ID so generated command names are unique.",
        fixable: false,
      };

const flagCollisionIssue = (
  model: CommandOperationModel
): Issue | undefined => {
  const seen = new Set<string>();
  for (const input of model.inputs) {
    if (seen.has(input.flag)) {
      return {
        code: "TW-PLUGIN-COMMAND-003",
        severity: "error",
        message: `Operation '${model.operationId}' has multiple inputs that map to '--${input.flag}'.`,
        path: childPath(model, `request/${input.target}`),
        hint: "Rename colliding request keys so every generated flag is unique.",
        fixable: false,
      };
    }
    seen.add(input.flag);
  }
  return undefined;
};

const unsupportedContainerIssues = (
  model: CommandOperationModel
): readonly Issue[] =>
  model.unsupportedTargets.map(target => ({
    code: "TW-PLUGIN-COMMAND-004",
    severity: "error",
    message: `Operation '${model.operationId}' uses a dynamic ${target} record that cannot map to deterministic flags.`,
    path: childPath(model, `request/${target}`),
    hint: `Use an object schema with named ${target} fields for command generation.`,
    fixable: false,
  }));

export const validateCommandSpec = (spec: NormalizedSpec): readonly Issue[] => {
  const issues: Issue[] = [];
  const operationsByCommandName = new Map<string, string>();

  for (const model of buildCommandOperationModels(spec)) {
    const reserved = reservedNameIssue(model);
    if (reserved !== undefined) issues.push(reserved);

    const collision = commandCollisionIssue(
      model,
      operationsByCommandName.get(model.commandName)
    );
    if (collision !== undefined) issues.push(collision);
    if (!operationsByCommandName.has(model.commandName)) {
      operationsByCommandName.set(model.commandName, model.operationId);
    }

    const flagCollision = flagCollisionIssue(model);
    if (flagCollision !== undefined) issues.push(flagCollision);
    issues.push(...unsupportedContainerIssues(model));
  }

  return issues;
};
