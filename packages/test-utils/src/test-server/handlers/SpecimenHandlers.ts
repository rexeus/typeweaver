import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  PutSpecimenSuccessResponse,
  type SpecimenApiHandler,
  type IPutSpecimenRequest,
  type PutSpecimenResponse,
  createPutSpecimenSuccessResponse,
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

    const response = createPutSpecimenSuccessResponse({
      body: request.body,
    });

    return new PutSpecimenSuccessResponse(response);
  }
}
