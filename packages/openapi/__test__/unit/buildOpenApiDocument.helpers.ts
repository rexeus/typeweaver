import type {
  NormalizedOperation,
  NormalizedResponse,
  NormalizedResponseUsage,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { z } from "zod";

type TreeNode = {
  readonly name: string;
  readonly children: readonly TreeNode[];
};

export function todoApiInfo() {
  return { info: { title: "Todo API", version: "1.0.0" } };
}

export function aTodoSpecWith(
  overrides: {
    readonly operations?: readonly NormalizedOperation[];
    readonly responses?: readonly NormalizedResponse[];
  } = {}
): NormalizedSpec {
  return aNormalizedSpecWith({
    resources: [{ name: "Todos", operations: overrides.operations ?? [] }],
    responses: overrides.responses ?? [],
  });
}

export function aNormalizedSpecWith(
  overrides: Partial<NormalizedSpec> = {}
): NormalizedSpec {
  return {
    resources: [],
    responses: [],
    ...overrides,
  };
}

export function anOperationWith(
  overrides: Partial<NormalizedOperation> = {}
): NormalizedOperation {
  return {
    operationId: "getTodo",
    method: "GET" as NormalizedOperation["method"],
    path: "/todos",
    summary: "",
    responses: [],
    ...overrides,
  };
}

export function aResponseWith(
  overrides: Partial<NormalizedResponse> = {}
): NormalizedResponse {
  return {
    name: "OkResponse",
    statusCode: 200 as NormalizedResponse["statusCode"],
    statusCodeName: "Ok",
    description: "OK",
    kind: "response",
    ...overrides,
  };
}

export function anInlineResponseUsage(
  response: NormalizedResponse
): NormalizedResponseUsage {
  return {
    responseName: response.name,
    source: "inline",
    response,
  };
}

export function aCanonicalResponseUsage(
  responseName: string
): NormalizedResponseUsage {
  return { responseName, source: "canonical" };
}

export function aQuerySchemaForBuilder(
  schema: z.core.$ZodType
): NonNullable<NormalizedOperation["request"]>["query"] {
  return schema as unknown as NonNullable<
    NormalizedOperation["request"]
  >["query"];
}

export function aHeaderSchemaForBuilder(
  schema: z.core.$ZodType
): NormalizedResponse["header"] {
  return schema as unknown as NormalizedResponse["header"];
}

export function aRecursiveTreeNodeSchema(): z.ZodType<TreeNode> {
  const treeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
    z.object({ name: z.string(), children: z.array(treeNodeSchema) })
  );

  return treeNodeSchema;
}
