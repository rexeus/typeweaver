/**
 * Side-effect-free programmatic API.
 *
 * CLI startup belongs exclusively to the `typeweaver` binary. Importing this
 * module only exposes the Effect runtime and generator service; it never
 * parses argv or changes process state.
 */
export { effectRuntime, ProductionLayer } from "./effectRuntime.js";
export { Generator } from "./services/Generator.js";
export type {
  GenerateFailure,
  GenerateParams,
} from "./services/generatorTypes.js";
