import type {
  NormalizedHttpBody,
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

type RequestBuilder = Omit<
  NonNullable<NormalizedOperation["request"]>,
  "body"
> & {
  readonly body?: z.ZodType | NormalizedHttpBody;
};

type OperationBuilderOverrides = Omit<
  Partial<NormalizedOperation>,
  "request"
> & {
  readonly request?: RequestBuilder;
};

type ResponseBuilderOverrides = Omit<Partial<NormalizedResponse>, "body"> & {
  readonly body?: z.ZodType | NormalizedHttpBody;
};

export function aJsonNormalizedBody(schema: z.ZodType): NormalizedHttpBody {
  return {
    schema,
    mediaType: "application/json",
    mediaTypeSource: "body-schema",
    transport: "json",
  };
}

function normalizeBodyForBuilder(
  body: z.ZodType | NormalizedHttpBody | undefined
): NormalizedHttpBody | undefined {
  if (body === undefined) {
    return undefined;
  }

  return "schema" in body ? body : aJsonNormalizedBody(body);
}

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
    warnings: [],
    ...overrides,
  };
}

export function anOperationWith(
  overrides: OperationBuilderOverrides = {}
): NormalizedOperation {
  const request = overrides.request;

  return {
    operationId: "getTodo",
    method: "GET" as NormalizedOperation["method"],
    path: "/todos",
    summary: "",
    responses: [],
    ...overrides,
    request:
      request === undefined
        ? undefined
        : { ...request, body: normalizeBodyForBuilder(request.body) },
  };
}

export function aResponseWith(
  overrides: ResponseBuilderOverrides = {}
): NormalizedResponse {
  return {
    name: "OkResponse",
    statusCode: 200 as NormalizedResponse["statusCode"],
    statusCodeName: "Ok",
    description: "OK",
    kind: "response",
    ...overrides,
    body: normalizeBodyForBuilder(overrides.body),
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
