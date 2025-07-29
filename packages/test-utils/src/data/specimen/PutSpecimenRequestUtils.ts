import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import type {
  IPutSpecimenRequestBody,
  IPutSpecimenRequestHeader,
  IPutSpecimenRequestParam,
  IPutSpecimenRequestQuery,
} from "../..";

export function createPutSpecimenRequestHeaders(
  input: Partial<IPutSpecimenRequestHeader> = {}
): IPutSpecimenRequestHeader {
  const defaults: IPutSpecimenRequestHeader = {
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

export function createPutSpecimenRequestBody(
  input: Partial<IPutSpecimenRequestBody> = {}
): IPutSpecimenRequestBody {
  const createdAt = faker.date.past().toISOString();
  const modifiedAt = faker.date.recent().toISOString();
  const createdBy = faker.internet.username();
  const modifiedBy = faker.internet.username();

  const defaults: IPutSpecimenRequestBody = {
    stringField: faker.lorem.word(),
    numberField: faker.number.int({ min: 1, max: 1000 }),
    booleanField: faker.datatype.boolean(),
    bigintField: BigInt(faker.number.bigInt()),
    dateField: faker.date.recent(),
    undefinedField: undefined,
    nullField: null,
    voidField: undefined,
    anyField: faker.lorem.word(),
    unknownField: faker.lorem.word(),
    symbolField: Symbol(faker.lorem.word()),
    nanField: NaN,

    emailField: faker.internet.email(),
    uuidv4Field: faker.string.uuid(),
    ulidField: faker.string.alphanumeric(26),
    uuidField: faker.string.uuid(),
    emojiField: "😄",
    nanoidField: faker.string.alphanumeric(21),
    cuidField: faker.string.alphanumeric(24),
    cuid2Field: faker.string.alphanumeric(24),
    uuidv7Field: faker.string.uuid(),
    ipv4Field: faker.internet.ipv4(),
    ipv6Field: faker.internet.ipv6(),
    cidrv4Field: faker.internet.ipv4() + "/24",
    cidrv6Field: faker.internet.ipv6() + "/64",
    urlField: faker.internet.url(),
    e164Field: "+1234567890",
    base64Field: faker.string.alphanumeric(16),
    base64urlField: faker.string.alphanumeric(16),
    jwtField:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    lowercaseField: faker.lorem.word().toLowerCase(),
    isoDateField: faker.date.recent().toISOString().split("T")[0] as string,
    isoDateTimeField: faker.date.recent().toISOString(),
    isoDurationField: "PT1H30M",
    isoTimeField: "14:30:00",

    literalField: "test",
    enumField: faker.helpers.arrayElement(["ACTIVE", "INACTIVE", "PENDING"]),
    templateLiteralField: `This is the current status ${faker.lorem.word()} is ${faker.helpers.arrayElement(["active", "inactive"])}`,

    arrayField: [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()],
    tupleField: [
      faker.lorem.word(),
      faker.number.int(),
      faker.datatype.boolean(),
    ],
    setField: new Set([faker.lorem.word(), faker.lorem.word()]),
    mapField: new Map([
      [faker.lorem.word(), faker.number.int()],
      [faker.lorem.word(), faker.number.int()],
    ]),
    recordField: {
      [faker.lorem.word()]: faker.number.int(),
      [faker.lorem.word()]: faker.number.int(),
    },

    objectField: {
      name: faker.person.fullName(),
      value: faker.number.int(),
    },
    nestedObjectField: {
      level1: {
        level2: faker.lorem.sentence(),
      },
    },

    optionalField: faker.lorem.word(),
    nullableField: faker.datatype.boolean() ? faker.lorem.word() : null,
    readonlyField: faker.lorem.word(),
    nonOptionalField: faker.lorem.word(),

    unionField: faker.helpers.arrayElement([
      faker.lorem.word(),
      faker.number.int(),
    ]),
    intersectionField: {
      a: faker.lorem.word(),
      b: faker.number.int(),
    },
    transformField: faker.lorem.word().toUpperCase(),
    defaultField: faker.lorem.word(),
    catchField: faker.lorem.word(),
    pipeField: faker.lorem.word(),
    lazyField: faker.lorem.word(),
    promiseField: Promise.resolve(faker.lorem.word()),
    fileField: new File(["content"], "test.txt", { type: "text/plain" }),
    customField: faker.lorem.word(),

    createdAt,
    modifiedAt,
    createdBy,
    modifiedBy,
  };

  return createData(defaults, input);
}

export function createPutSpecimenRequestParams(
  input: Partial<IPutSpecimenRequestParam> = {}
): IPutSpecimenRequestParam {
  const defaults: IPutSpecimenRequestParam = {
    specimenId: faker.string.fromCharacters(
      "0123456789ABCDEFGHJKMNPQRSTVWXYZ",
      26
    ),
    foo: faker.helpers.arrayElement(["foo1", "foo2"]),
    bar: "bar",
    uuid: faker.string.uuid(),
    slug: faker.lorem.slug(),
  };

  return createData(defaults, input);
}

export function createPutSpecimenRequestQuery(
  input: Partial<IPutSpecimenRequestQuery> = {}
): IPutSpecimenRequestQuery {
  const defaults: IPutSpecimenRequestQuery = {
    foo: faker.lorem.word(),
    bar: faker.lorem.word(),
    baz: "baz",
    qux: faker.helpers.arrayElement(["qux1", "qux2"]),
    quux: [faker.lorem.word(), faker.lorem.word()],
    email: faker.internet.email(),
    numbers: [faker.number.int().toString(), faker.number.int().toString()],
    ulid: faker.string.fromCharacters("0123456789ABCDEFGHJKMNPQRSTVWXYZ", 26),
    urls: [faker.internet.url(), faker.internet.url()],
  };

  return createData(defaults, input);
}

type PutSpecimenRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IPutSpecimenRequestHeader>;
  param?: Partial<IPutSpecimenRequestParam>;
  query?: Partial<IPutSpecimenRequestQuery>;
  body?: Partial<IPutSpecimenRequestBody>;
};

export function createPutSpecimenRequest(
  input: PutSpecimenRequestInput = {}
): IHttpRequest {
  const param = input.param
    ? createPutSpecimenRequestParams(input.param)
    : createPutSpecimenRequestParams();

  const defaults: IHttpRequest = {
    method: HttpMethod.PUT,
    path: `/specimens/${param.specimenId}`,
    header: createPutSpecimenRequestHeaders(),
    param,
    query: createPutSpecimenRequestQuery(),
    body: createPutSpecimenRequestBody(),
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createPutSpecimenRequestHeaders(input.header);
  if (input.param !== undefined)
    overrides.param = createPutSpecimenRequestParams(input.param);
  if (input.query !== undefined)
    overrides.query = createPutSpecimenRequestQuery(input.query);
  if (input.body !== undefined)
    overrides.body = createPutSpecimenRequestBody(input.body);

  return createData(defaults, overrides);
}
