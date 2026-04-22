import { createLoadSpecCheck } from "./loadSpec.js";
import { createOperationIdStyleCheck } from "./operationIdStyle.js";
import { createPathStyleCheck } from "./pathStyle.js";
import { createPluginValidatorsCheck } from "./pluginValidators.js";
import type { ValidateCheck } from "../types.js";

export type ValidateCheckSelection = {
  /** When false, the plugin validator check is omitted entirely. */
  readonly plugins?: boolean;
  /** When false, style checks are omitted (in addition to being rule-disabled). */
  readonly style?: boolean;
};

/**
 * Assemble the validation check pipeline.
 *
 * Callers can opt out of plugin validators (`{ plugins: false }`) or style
 * rules (`{ style: false }`). The `generate` pre-flight uses both disabled so
 * generation isn't blocked on cosmetic preferences or plugin availability.
 */
export const createValidateChecks = (
  selection: ValidateCheckSelection = {}
): readonly ValidateCheck[] => {
  const pluginsEnabled = selection.plugins ?? true;
  const styleEnabled = selection.style ?? true;

  const checks: ValidateCheck[] = [createLoadSpecCheck()];

  if (styleEnabled) {
    checks.push(createOperationIdStyleCheck());
    checks.push(createPathStyleCheck());
  }

  if (pluginsEnabled) {
    checks.push(createPluginValidatorsCheck());
  }

  return checks;
};

export { LOAD_SPEC_ID } from "./loadSpec.js";
export { OPERATION_ID_STYLE_ID } from "./operationIdStyle.js";
export { PATH_STYLE_ID } from "./pathStyle.js";
export { PLUGIN_VALIDATORS_ID } from "./pluginValidators.js";
