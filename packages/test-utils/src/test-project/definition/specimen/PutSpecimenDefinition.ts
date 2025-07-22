import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { sharedResponses } from "../shared";
import { specimenSchema } from "./specimenSchema";
import SpecimenNotFoundErrorDefinition from "./errors/SpecimenNotFoundErrorDefinition";
import SpecimenConflictErrorDefinition from "./errors/SpecimenConflictErrorDefinition";
import SpecimenUnprocessableEntityErrorDefinition from "./errors/SpecimenUnprocessableEntityErrorDefinition"; 
import { z } from "zod/v4"; 

export default new HttpOperationDefinition({
  operationId: "PutSpecimen",
  summary: "Comprehensive specimen update with all type variations",
  method: HttpMethod.PUT,
  path: "/specimens/:specimenId/foo/:foo/bar/:bar/uuid/:uuid/slug/:slug",
  request: {
    param: z.object({
      specimenId: z.uuid(),
      foo: z.enum(["foo1", "foo2"]),
      bar: z.literal("bar"),
      uuid: z.uuid(),
      slug: z.string(),
    }),
    header: z.object({
      "X-Foo": z.string(),
      "X-Bar": z.string().optional(),
      "X-Baz": z.literal("baz"),
      "X-Qux": z.enum(["qux1", "qux2"]).optional(),
      "X-Quux": z.array(z.string()),
      "X-UUID": z.uuid(),
      "X-JWT": z.jwt().optional(),
      "X-URL": z.url(),
      "X-Email": z.email().optional(),
      "X-Slugs": z.array(z.string()),
    }),
    body: specimenSchema,
    query: z.object({
      foo: z.string(),
      bar: z.string().optional(),
      baz: z.literal("baz"),
      qux: z.enum(["qux1", "qux2"]).optional(),
      quux: z.array(z.string()),
      email: z.email(),
      numbers: z.array(z.string()).optional(),
      ulid: z.ulid().optional(),
      urls: z.array(z.url()),
    }),
  },
  responses: [
    {
      name: "PutSpecimenSuccess",
      body: specimenSchema,
      description:
        "Comprehensive specimen successfully updated with all type variations",
      statusCode: HttpStatusCode.OK,
      header: z.object({
        "X-Foo": z.string(),
        "X-Bar": z.string().optional(),
        "X-Baz": z.literal("baz"),
        "X-Qux": z.enum(["qux1", "qux2"]).optional(),
        "X-Quux": z.array(z.string()),
        "X-UUID": z.uuid(),
        "X-JWT": z.jwt().optional(),
        "X-URL": z.url(),
        "X-Email": z.email().optional(),
        "X-Slugs": z.array(z.string()),
      }),
    },
    SpecimenConflictErrorDefinition,
    SpecimenNotFoundErrorDefinition,
    SpecimenUnprocessableEntityErrorDefinition,
    ...sharedResponses,
  ],
});
