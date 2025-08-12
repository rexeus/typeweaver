import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IUnsupportedMediaTypeErrorResponseHeader = {
  "Content-Type": "application/json";
  "X-Single-Value"?: string | undefined;
  "X-Multi-Value"?: string[] | undefined;
};

export type IUnsupportedMediaTypeErrorResponseBody = {
  message: "Unsupported media type";
  code: "UNSUPPORTED_MEDIA_TYPE_ERROR";
  context: {
    contentType: string;
  };
  expectedValues: {
    contentTypes: ["application/json"];
  };
};

export type IUnsupportedMediaTypeErrorResponse = {
  statusCode: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE;
  header: IUnsupportedMediaTypeErrorResponseHeader;
  body: IUnsupportedMediaTypeErrorResponseBody;
};

export class UnsupportedMediaTypeErrorResponse
  extends HttpResponse<
    IUnsupportedMediaTypeErrorResponseHeader,
    IUnsupportedMediaTypeErrorResponseBody
  >
  implements IUnsupportedMediaTypeErrorResponse
{
  public override readonly statusCode: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE;

  public constructor(response: IUnsupportedMediaTypeErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.UNSUPPORTED_MEDIA_TYPE) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for UnsupportedMediaTypeErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
