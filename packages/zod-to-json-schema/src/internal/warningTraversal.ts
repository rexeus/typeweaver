import { collectSchemaRoot, createWarning } from "./warningRules.js";
import {
  getSchemaType,
  isZodSchema,
  isZodTransparentWrapperType,
} from "./zodIntrospection.js";
import type { WarningCollector } from "./warningRules.js";
import type { ZodDef, ZodSchema } from "./zodIntrospection.js";
type ChildSchemaField =
  | "element"
  | "in"
  | "keyType"
  | "left"
  | "out"
  | "right"
  | "valueType";
type ChildTraversal = {
  readonly field: ChildSchemaField;
  readonly path: readonly string[];
};
type NestedWarningPlan =
  | { readonly kind: "children"; readonly children: readonly ChildTraversal[] }
  | { readonly kind: "lazy" }
  | { readonly kind: "object" }
  | { readonly kind: "options"; readonly keyword: "anyOf" }
  | { readonly kind: "tuple" };
const PLANS: ReadonlyMap<string, NestedWarningPlan> = new Map([
  ["object", { kind: "object" }],
  [
    "array",
    { kind: "children", children: [{ field: "element", path: ["items"] }] },
  ],
  ["union", { kind: "options", keyword: "anyOf" }],
  [
    "intersection",
    {
      kind: "children",
      children: [
        { field: "left", path: ["allOf", "0"] },
        { field: "right", path: ["allOf", "1"] },
      ],
    },
  ],
  ["tuple", { kind: "tuple" }],
  ["lazy", { kind: "lazy" }],
  [
    "record",
    {
      kind: "children",
      children: [
        { field: "keyType", path: ["propertyNames"] },
        { field: "valueType", path: ["additionalProperties"] },
      ],
    },
  ],
  [
    "pipe",
    {
      kind: "children",
      children: [
        { field: "in", path: ["x-typeweaver", "pipeIn"] },
        { field: "out", path: ["x-typeweaver", "pipeOut"] },
      ],
    },
  ],
  [
    "map",
    {
      kind: "children",
      children: [
        { field: "keyType", path: ["x-typeweaver", "mapKey"] },
        { field: "valueType", path: ["x-typeweaver", "mapValue"] },
      ],
    },
  ],
  [
    "set",
    { kind: "children", children: [{ field: "valueType", path: ["items"] }] },
  ],
]);
export const collectWarnings = (
  schema: ZodSchema,
  collector: WarningCollector,
  path: readonly string[]
): void => collectSchemaRoot(schema, collector, collectNestedWarnings, path);
function collectNestedWarnings(
  def: ZodDef,
  schemaType: string,
  collector: WarningCollector,
  path: readonly string[]
): void {
  const plan = PLANS.get(schemaType);
  if (plan === undefined)
    return collectTransparentChild(def, schemaType, collector, path);
  if (plan.kind === "object")
    return collectObjectWarnings(def, collector, path);
  if (plan.kind === "options")
    return collectOptionWarnings(def, plan, collector, path);
  if (plan.kind === "tuple") return collectTupleWarnings(def, collector, path);
  if (plan.kind === "lazy") return collectLazyWarnings(def, collector, path);
  collectPlannedChildren(plan.children, def, collector, path);
}
function collectTransparentChild(
  def: ZodDef,
  schemaType: string,
  collector: WarningCollector,
  path: readonly string[]
): void {
  if (isZodTransparentWrapperType(schemaType))
    collectChild(def.innerType, collector, path);
}
function collectOptionWarnings(
  def: ZodDef,
  plan: Extract<NestedWarningPlan, { readonly kind: "options" }>,
  collector: WarningCollector,
  path: readonly string[]
): void {
  for (const [index, option] of (def.options ?? []).entries())
    collectChild(option, collector, [...path, plan.keyword, String(index)]);
}
function collectTupleWarnings(
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[]
): void {
  for (const [index, item] of (def.items ?? []).entries())
    collectChild(item, collector, [...path, "prefixItems", String(index)]);
  collectChild(def.rest, collector, [...path, "items"]);
}
function collectLazyWarnings(
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[]
): void {
  try {
    collectChild(def.getter?.(), collector, path);
  } catch (error) {
    collector.warnings.push(
      createWarning({
        code: "conversion-error",
        schemaType: "lazy",
        path,
        message:
          error instanceof Error
            ? error.message
            : "Failed to convert schema to JSON Schema.",
      })
    );
  }
}
function collectPlannedChildren(
  children: readonly ChildTraversal[],
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[]
): void {
  for (const child of children)
    collectChild(def[child.field], collector, [...path, ...child.path]);
}
function collectObjectWarnings(
  def: ZodDef,
  collector: WarningCollector,
  path: readonly string[]
): void {
  for (const [key, value] of Object.entries(def.shape ?? {}))
    collectChild(value, collector, [...path, "properties", key]);
  if (def.catchall !== undefined && getSchemaType(def.catchall) === "never")
    return;
  collectChild(def.catchall, collector, [...path, "additionalProperties"]);
}
function collectChild(
  value: unknown,
  collector: WarningCollector,
  path: readonly string[]
): void {
  if (isZodSchema(value)) collectWarnings(value, collector, path);
}
