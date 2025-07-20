import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createVariationOutput } from "../..";
import {
  PutNonsenseVariationSuccessResponse,
  type VariationApiHandler,
  type IPutNonsenseVariationRequest,
  type PutNonsenseVariationResponse,
} from "../..";

export class VariationHandlers implements VariationApiHandler {
  public constructor(private readonly throwError?: Error | HttpResponse) {
    //
  }

  public async handlePutNonsenseVariationRequest(
    request: IPutNonsenseVariationRequest
  ): Promise<PutNonsenseVariationResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const modifiedAt = new Date().toISOString();
    return new PutNonsenseVariationSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "X-Foo": faker.lorem.word(),
        "X-Bar": faker.lorem.word(),
        "X-Baz": "baz",
        "X-Qux": faker.helpers.arrayElement(["qux1", "qux2"]),
        "X-Quux": [faker.lorem.word(), faker.lorem.word()],
      },
      body: createVariationOutput({
        ...request.body,
        modifiedAt,
      }),
    });
  }
}
