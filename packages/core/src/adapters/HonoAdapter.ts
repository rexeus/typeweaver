import type { Context as HonoContext } from "hono";
import type { IHttpRequest, IHttpResponse } from "../definition";
import { FetchApiAdapter } from "./FetchApiAdapter";
import { HttpAdapter } from "./HttpAdapter";

/**
 * Adapter for converting between Hono's Context and the core HTTP types.
 *
 * This adapter extends the FetchApiAdapter functionality by adding
 * Hono-specific features like path parameter extraction.
 */
export class HonoAdapter extends HttpAdapter<HonoContext, Response> {
  private fetchAdapter = new FetchApiAdapter();

  /**
   * Converts a Hono Context to an IHttpRequest.
   *
   * Leverages the FetchApiAdapter for standard Request processing
   * and adds Hono-specific path parameter extraction.
   *
   * @param c - The Hono context
   * @returns Promise resolving to an IHttpRequest
   */
  public async toRequest(c: HonoContext): Promise<IHttpRequest> {
    const pathParams = c.req.param();
    const request = await this.fetchAdapter.toRequest(c.req.raw, pathParams);

    // Override the path with Hono's path (which may differ from raw URL path)
    request.path = c.req.path;

    return request;
  }

  /**
   * Converts an IHttpResponse to a Hono Response.
   * Delegates to FetchApiAdapter since Hono uses standard Fetch API Response objects.
   *
   * @param response - The IHttpResponse to convert
   * @returns A Hono-compatible Response object
   */
  public toResponse(response: IHttpResponse): Response {
    return this.fetchAdapter.toResponse(response);
  }
}
