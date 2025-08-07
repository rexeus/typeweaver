import type {
  HttpMethod,
  IHttpRequest,
  IHttpResponse,
  IHttpHeader,
  IHttpQuery,
  IHttpBody,
} from "@rexeus/typeweaver-core";
import { HttpAdapter } from "./HttpAdapter";
import { normalizeHeaders } from "./normalizeHeaders";

/**
 * Adapter for converting between Fetch API Request/Response objects
 * and the framework-agnostic HTTP types.
 *
 * This adapter works with the Request and Response objects from the Fetch API
 * specification, which are available in modern JavaScript runtimes (browsers,
 * Node.js 18+, Deno, Bun, Cloudflare Workers, etc.).
 */
export class FetchApiAdapter extends HttpAdapter<Request, Response> {
  /**
   * Converts a Fetch API Request to an IHttpRequest.
   * Extracts headers, query parameters, and body from the Request object.
   *
   * @param request - The Fetch API Request object
   * @param pathParams - Optional path parameters (not available in Fetch API Request)
   * @returns Promise resolving to an IHttpRequest
   */
  public async toRequest(
    request: Request,
    pathParams?: Record<string, string>
  ): Promise<IHttpRequest> {
    const url = new URL(request.url);

    return {
      method: request.method.toUpperCase() as HttpMethod,
      path: url.pathname,
      header: this.extractHeaders(request.headers),
      query: this.extractQueryParams(url),
      param:
        pathParams && Object.keys(pathParams).length > 0
          ? pathParams
          : undefined,
      body: await this.parseRequestBody(request),
    };
  }

  /**
   * Converts an IHttpResponse to a Fetch API Response.
   * Creates a Response object with the appropriate status, headers, and body.
   *
   * @param response - The IHttpResponse to convert
   * @returns A Fetch API Response object
   */
  public toResponse(response: IHttpResponse): Response {
    const { statusCode, body, header } = response;

    return new Response(this.buildResponseBody(body), {
      status: statusCode,
      headers: this.buildResponseHeaders(header),
    });
  }

  private addMultiValue(
    record: Record<string, string | string[]>,
    key: string,
    value: string
  ): void {
    const existing = record[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        record[key] = [existing, value];
      }
    } else {
      record[key] = value;
    }
  }

  private extractHeaders(headers: Headers): IHttpHeader {
    return normalizeHeaders(headers);
  }

  private extractQueryParams(url: URL): IHttpQuery {
    const result: Record<string, string | string[]> = {};
    url.searchParams.forEach((value, key) => {
      this.addMultiValue(result, key, value);
    });
    return Object.keys(result).length > 0 ? result : undefined;
  }

  private async parseRequestBody(request: Request): Promise<IHttpBody> {
    if (!request.body) return undefined;

    const contentType = request.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      try {
        return await request.json();
      } catch {
        return undefined;
      }
    }

    if (contentType?.includes("text/")) {
      return await request.text();
    }

    if (contentType?.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const formData = new URLSearchParams(text);
      const formObject: Record<string, string | string[]> = {};
      formData.forEach((value, key) => {
        this.addMultiValue(formObject, key, value);
      });
      return formObject;
    }

    const rawBody = await request.text();
    return rawBody || undefined;
  }

  private buildResponseBody(body: any): string | ArrayBuffer | Blob | null {
    if (body === undefined) {
      return null;
    }

    if (
      typeof body === "string" ||
      body instanceof Blob ||
      body instanceof ArrayBuffer
    ) {
      return body;
    }

    return JSON.stringify(body);
  }

  private buildResponseHeaders(header?: IHttpHeader): Headers {
    const headers = new Headers();

    if (header) {
      Object.entries(header).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => headers.append(key, v));
          } else {
            headers.set(key, String(value));
          }
        }
      });
    }

    return headers;
  }
}
