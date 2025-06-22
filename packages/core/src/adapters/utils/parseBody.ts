import type { IHttpBody } from "../../definition";

export const parseJsonBody = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

export const parseBody = (
  body: string | null,
  isBase64?: boolean
): IHttpBody => {
  if (!body) return undefined;

  const decodedBody = isBase64
    ? Buffer.from(body, "base64").toString("utf-8")
    : body;

  return parseJsonBody(decodedBody);
};
