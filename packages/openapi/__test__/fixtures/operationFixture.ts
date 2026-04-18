import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import type { HttpBodySchema } from "@rexeus/typeweaver-core";
import type { NormalizedRequest, NormalizedSpec } from "@rexeus/typeweaver-gen";

export type OperationFixtureOptions = {
  readonly operationId: string;
  readonly method?: HttpMethod;
  readonly path?: string;
  readonly request?: NormalizedRequest;
  readonly responseBody?: HttpBodySchema;
};

const toPascalCase = (value: string): string =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export const createOperationFixture = (
  options: OperationFixtureOptions
): NormalizedSpec => {
  const responseName = `${toPascalCase(options.operationId)}Success`;

  return {
    resources: [
      {
        name: "todo",
        operations: [
          {
            operationId: options.operationId,
            method: options.method ?? HttpMethod.GET,
            path: options.path ?? "/todos",
            summary: options.operationId,
            request: options.request ?? {},
            responses: [
              {
                source: "inline",
                responseName,
                response: {
                  name: responseName,
                  statusCode: HttpStatusCode.OK,
                  statusCodeName: "OK",
                  description: "ok",
                  ...(options.responseBody
                    ? { body: options.responseBody }
                    : {}),
                  kind: "response",
                },
              },
            ],
          },
        ],
      },
    ],
    responses: [],
  };
};
