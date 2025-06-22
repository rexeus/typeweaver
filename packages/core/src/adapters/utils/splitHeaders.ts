import type { IHttpHeader } from "../../definition";

export interface SplitHeaders {
  headers?: Record<string, boolean | number | string>;
  multiValueHeaders?: Record<string, Array<boolean | number | string>>;
}

export const splitHeadersByMultiValue = (
  headers?: IHttpHeader
): SplitHeaders => {
  if (!headers) return {};

  const single: Record<string, boolean | number | string> = {};
  const multi: Record<string, Array<boolean | number | string>> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      multi[key] = value;
    } else {
      single[key] = value;
    }
  }

  return {
    headers: Object.keys(single).length > 0 ? single : undefined,
    multiValueHeaders: Object.keys(multi).length > 0 ? multi : undefined,
  };
};
