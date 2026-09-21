import type { HttpRequestBoundaryIssuesFor } from "./httpRequestBoundaryIssues.js";
import type { ClientHttpScalar } from "./httpRequestBoundaryTypes.js";
import type { RequestDefinition } from "./RequestDefinition.js";

export type { ClientHttpScalar };
export type ClientHttpParam =
  | Readonly<Record<string, ClientHttpScalar>>
  | undefined;
export type ClientHttpQuery =
  | Readonly<
      Record<string, ClientHttpScalar | readonly ClientHttpScalar[] | undefined>
    >
  | undefined;
export type ClientHttpHeader = ClientHttpQuery;

export type HttpRequestBoundaryIssues<TRequest extends RequestDefinition> =
  TRequest extends RequestDefinition
    ? HttpRequestBoundaryIssuesFor<TRequest>
    : never;
export type HttpRequestBoundaryConstraint<TRequest extends RequestDefinition> =
  [HttpRequestBoundaryIssues<TRequest>] extends [never]
    ? unknown
    : {
        readonly __typeweaverHttpBoundaryError__: HttpRequestBoundaryIssues<TRequest>;
      };
