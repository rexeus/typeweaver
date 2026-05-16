export { InvalidSpecEntrypointError } from "./InvalidSpecEntrypointError.js";
export { SpecBundleError } from "./SpecBundleError.js";
export { SpecBundleOutputMissingError } from "./SpecBundleOutputMissingError.js";
export { SpecOutputWriteError } from "./SpecOutputWriteError.js";

import type { InvalidSpecEntrypointError } from "./InvalidSpecEntrypointError.js";
import type { SpecBundleError } from "./SpecBundleError.js";
import type { SpecBundleOutputMissingError } from "./SpecBundleOutputMissingError.js";
import type { SpecOutputWriteError } from "./SpecOutputWriteError.js";

export type SpecLoadError =
  | InvalidSpecEntrypointError
  | SpecBundleError
  | SpecBundleOutputMissingError
  | SpecOutputWriteError;
