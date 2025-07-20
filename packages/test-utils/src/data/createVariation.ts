import { faker } from "@faker-js/faker";
import { createData } from "./createData";
import type {
  IPutNonsenseVariationRequestBody,
  IPutNonsenseVariationSuccessResponseBody,
} from "..";

export function createVariationInput(
  input: Partial<IPutNonsenseVariationRequestBody> = {}
): IPutNonsenseVariationRequestBody {
  const createdAt = faker.date.past().toISOString();
  const modifiedAt = faker.date.recent().toISOString();
  const createdBy = faker.internet.username();
  const modifiedBy = faker.internet.username();

  const defaults: IPutNonsenseVariationRequestBody = {
    // Basic types
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

    // Special strings
    emailField: faker.internet.email(),
    uuidv4Field: faker.string.uuid(),
    uuidv5Field: faker.string.uuid(),
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

    // Literal & Enum types
    literalField: "test",
    enumField: faker.helpers.arrayElement(["ACTIVE", "INACTIVE", "PENDING"]),
    templateLiteralField: `This is the current status ${faker.lorem.word()} is ${faker.helpers.arrayElement(["active", "inactive"])}`,

    // Collection types
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

    // Object & Nesting
    objectField: {
      name: faker.person.fullName(),
      value: faker.number.int(),
    },
    nestedObjectField: {
      level1: {
        level2: faker.lorem.sentence(),
      },
    },

    // Modifier types
    optionalField: faker.lorem.word(),
    nullableField: faker.datatype.boolean() ? faker.lorem.word() : null,
    readonlyField: faker.lorem.word(),
    nonOptionalField: faker.lorem.word(),

    // Advanced types
    unionField: faker.helpers.arrayElement([
      faker.lorem.word(),
      faker.number.int(),
    ]),
    intersectionField: {
      a: faker.lorem.word(),
      b: faker.number.int(),
    },
    transformField: faker.lorem.word().toUpperCase(), // Will be transformed to lowercase
    defaultField: faker.lorem.word(),
    catchField: faker.lorem.word(),
    pipeField: faker.lorem.word(),
    lazyField: faker.lorem.word(),
    promiseField: Promise.resolve(faker.lorem.word()),
    fileField: new File(["content"], "test.txt", { type: "text/plain" }),
    customField: faker.lorem.word(),

    // Metadata fields (required by generated type)
    createdAt,
    modifiedAt,
    createdBy,
    modifiedBy,
  };

  return createData(defaults, input);
}

export function createVariationOutput(
  input: Partial<IPutNonsenseVariationSuccessResponseBody> = {}
): IPutNonsenseVariationSuccessResponseBody {
  const createdAt = faker.date.past().toISOString();
  const modifiedAt = faker.date.recent().toISOString();
  const createdBy = faker.internet.username();
  const modifiedBy = faker.internet.username();

  const defaults: IPutNonsenseVariationSuccessResponseBody = {
    // Use the variation schema structure from the generated types
    ...createVariationInput(),

    // Metadata fields (if they exist in the generated schema)
    createdAt,
    modifiedAt,
    createdBy,
    modifiedBy,
  };

  return createData(defaults, input);
}
