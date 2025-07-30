import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ISpecimenUnprocessableEntityErrorResponse,
  ISpecimenUnprocessableEntityErrorResponseHeader,
  ISpecimenUnprocessableEntityErrorResponseBody,
} from "../..";
import { SpecimenUnprocessableEntityErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";

export const createSpecimenUnprocessableEntityErrorResponseHeaders =
  createDataFactory<ISpecimenUnprocessableEntityErrorResponseHeader>(() => ({
    "X-Validation-ID": faker.string.uuid(),
    "X-Field-Count": faker.number.int({ min: 1, max: 10 }).toString(),
    "X-Error-Types": [
      faker.helpers.arrayElement([
        "invalid_format",
        "required",
        "too_long",
        "too_short",
        "out_of_range",
      ]),
      faker.helpers.arrayElement([
        "invalid_format",
        "required",
        "too_long",
        "too_short",
        "out_of_range",
      ]),
    ],
    "X-Request-ID": faker.string.uuid(),
    "X-Timestamp": faker.date.recent().toISOString(),
  }));

export const createSpecimenUnprocessableEntityErrorResponseBody =
  createDataFactory<ISpecimenUnprocessableEntityErrorResponseBody>(() => {
    const validationErrorsLength = faker.number.int({ min: 1, max: 5 });
    const validationErrors = Array.from(
      { length: validationErrorsLength },
      () => ({
        field: faker.helpers.arrayElement([
          "name",
          "type",
          "category",
          "value",
          "metadata",
        ]),
        value: faker.helpers.arrayElement([
          faker.lorem.word(),
          faker.number.int(),
          faker.datatype.boolean(),
          null,
        ]),
        reason: faker.helpers.arrayElement([
          "invalid_format",
          "required",
          "too_long",
          "too_short",
          "out_of_range",
        ] as const),
        expected: faker.helpers.arrayElement([
          faker.helpers.arrayElement([
            faker.lorem.word(),
            [faker.lorem.word(), faker.lorem.word()] as string[],
          ]),
          undefined,
        ]),
        metadata: faker.helpers.arrayElement([
          {
            [faker.lorem.word()]: faker.helpers.arrayElement([
              faker.lorem.word(),
              faker.number.int(),
            ]),
            [faker.lorem.word()]: faker.helpers.arrayElement([
              faker.lorem.word(),
              faker.number.int(),
            ]),
          },
          undefined,
        ]),
      })
    );

    return {
      message: "Specimen data validation failed",
      code: "SPECIMEN_UNPROCESSABLE_ENTITY_ERROR",
      validationErrors,
      summary: {
        totalErrors: validationErrors.length,
        fieldCount: faker.number.int({ min: 1, max: 10 }),
        timestamp: faker.date.recent(),
        requestId: faker.string.uuid(),
      },
    };
  });

type SpecimenUnprocessableEntityErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISpecimenUnprocessableEntityErrorResponseHeader>;
  body?: Partial<ISpecimenUnprocessableEntityErrorResponseBody>;
};

export function createSpecimenUnprocessableEntityErrorResponse(
  input: SpecimenUnprocessableEntityErrorResponseInput = {}
): SpecimenUnprocessableEntityErrorResponse {
  const responseData = createResponse<
    ISpecimenUnprocessableEntityErrorResponse,
    ISpecimenUnprocessableEntityErrorResponseBody,
    ISpecimenUnprocessableEntityErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
    },
    {
      body: createSpecimenUnprocessableEntityErrorResponseBody,
      header: createSpecimenUnprocessableEntityErrorResponseHeaders,
    },
    input
  );
  return new SpecimenUnprocessableEntityErrorResponse(responseData);
}
