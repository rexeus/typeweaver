import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { createSpecimenOutput, createSpecimenResponseHeaders } from "../..";
import {
  PutSpecimenSuccessResponse,
  type SpecimenApiHandler,
  type IPutSpecimenRequest,
  type PutSpecimenResponse,
} from "../..";

export class SpecimenHandlers implements SpecimenApiHandler {
  public constructor(private readonly throwError?: Error | HttpResponse) {
    //
  }

  public async handlePutSpecimenRequest(
    request: IPutSpecimenRequest
  ): Promise<PutSpecimenResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const modifiedAt = new Date().toISOString();
    return new PutSpecimenSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: createSpecimenResponseHeaders(),
      body: createSpecimenOutput({
        ...request.body,
        modifiedAt,
      }),
    });
  }
}
