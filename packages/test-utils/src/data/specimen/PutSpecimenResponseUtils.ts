import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import { createPutSpecimenRequestBody } from "./PutSpecimenRequestUtils";
import type {
  IPutSpecimenSuccessResponseBody,
  IPutSpecimenSuccessResponseHeader,
  IPutSpecimenSuccessResponse,
} from "../..";

export function createPutSpecimenSuccessResponseHeaders(
  input: Partial<IPutSpecimenSuccessResponseHeader> = {}
): IPutSpecimenSuccessResponseHeader {
  const defaults: IPutSpecimenSuccessResponseHeader = {
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
  };

  return createData(defaults, input);
}

export function createPutSpecimenSuccessResponseBody(
  input: Partial<IPutSpecimenSuccessResponseBody> = {}
): IPutSpecimenSuccessResponseBody {
  const createdAt = faker.date.past().toISOString();
  const modifiedAt = faker.date.recent().toISOString();
  const createdBy = faker.internet.username();
  const modifiedBy = faker.internet.username();

  const baseSpecimen = createPutSpecimenRequestBody();

  const defaults: IPutSpecimenSuccessResponseBody = {
    ...baseSpecimen,
    createdAt,
    modifiedAt,
    createdBy,
    modifiedBy,
  };

  return createData(defaults, input);
}

type PutSpecimenSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IPutSpecimenSuccessResponseHeader>;
  body?: Partial<IPutSpecimenSuccessResponseBody>;
};

export function createPutSpecimenSuccessResponse(
  input: PutSpecimenSuccessResponseInput = {}
): IPutSpecimenSuccessResponse {
  const defaults: IPutSpecimenSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createPutSpecimenSuccessResponseHeaders(),
    body: createPutSpecimenSuccessResponseBody(),
  };

  const overrides: Partial<IPutSpecimenSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createPutSpecimenSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createPutSpecimenSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}
