import request from "supertest";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import type { Express } from "express";

export type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "options"
  | "head";

export async function makeRequest(
  app: Express,
  url: string,
  requestData: IHttpRequest
): Promise<request.Response> {
  const method = requestData.method.toLowerCase() as HttpMethod;
  const req = request(app)[method](url);

  for (const [key, value] of Object.entries(requestData.header ?? {})) {
    if (Array.isArray(value)) {
      req.set(key, value.join(", "));
    } else {
      req.set(key, value);
    }
  }

  if (requestData.body) {
    req.send(requestData.body);
  }

  return req;
}
