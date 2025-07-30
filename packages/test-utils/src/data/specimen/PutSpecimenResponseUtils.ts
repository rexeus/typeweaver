import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createPutSpecimenRequestBody } from "./PutSpecimenRequestUtils";
import type {
  IPutSpecimenSuccessResponseBody,
  IPutSpecimenSuccessResponseHeader,
  IPutSpecimenSuccessResponse,
} from "../..";
import { PutSpecimenSuccessResponse } from "../..";

export const createPutSpecimenSuccessResponseHeaders =
  createDataFactory<IPutSpecimenSuccessResponseHeader>(() => ({
    "X-Foo": faker.lorem.word(),
    "X-Bar": faker.lorem.word(),
    "X-Baz": "baz",
    "X-Qux": faker.helpers.arrayElement(["qux1", "qux2"]),
    "X-Quux": [faker.lorem.word(), faker.lorem.word()],
    "X-UUID": faker.string.uuid(),
    "X-JWT": faker.string.alphanumeric(20),
    "X-URL": faker.internet.url(),
    "X-Email": faker.internet.email(),
    "X-Slugs": [faker.lorem.slug(), faker.lorem.slug()],
  }));

export const createPutSpecimenSuccessResponseBody =
  createDataFactory<IPutSpecimenSuccessResponseBody>(() => {
    const createdAt = faker.date.past().toISOString();
    const modifiedAt = faker.date.recent().toISOString();
    const createdBy = faker.internet.username();
    const modifiedBy = faker.internet.username();

    const baseSpecimen = createPutSpecimenRequestBody();

    return {
      ...baseSpecimen,
      createdAt,
      modifiedAt,
      createdBy,
      modifiedBy,
    };
  });

type PutSpecimenSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IPutSpecimenSuccessResponseHeader>;
  body?: Partial<IPutSpecimenSuccessResponseBody>;
};

export function createPutSpecimenSuccessResponse(
  input: PutSpecimenSuccessResponseInput = {}
): PutSpecimenSuccessResponse {
  const responseData = createResponse<
    IPutSpecimenSuccessResponse,
    IPutSpecimenSuccessResponseBody,
    IPutSpecimenSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createPutSpecimenSuccessResponseBody,
      header: createPutSpecimenSuccessResponseHeaders,
    },
    input
  );
  return new PutSpecimenSuccessResponse(responseData);
}
