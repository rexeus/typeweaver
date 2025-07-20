import { z } from "zod/v4";
import { metadataSchema } from "../shared/schemas/metadataSchema";

export const statusEnum = z.enum(["ACTIVE", "INACTIVE", "PENDING"]);

export const specimenSchema = z.object({
  // Basic types
  stringField: z.string(),
  numberField: z.number(),
  booleanField: z.boolean(),
  bigintField: z.bigint(),
  dateField: z.date(),
  undefinedField: z.undefined(),
  nullField: z.null(),
  voidField: z.void(),
  anyField: z.any(),
  unknownField: z.unknown(),
  symbolField: z.symbol(),
  nanField: z.nan(),

  // Special strings - Verified working formats
  emailField: z.email(),
  uuidv4Field: z.uuidv4(),
  uuidv7Field: z.uuidv7(),
  ipv4Field: z.ipv4(),
  ipv6Field: z.ipv6(),
  cidrv4Field: z.cidrv4(),
  cidrv6Field: z.cidrv6(),
  urlField: z.url(),
  e164Field: z.e164(),
  base64Field: z.base64(),
  base64urlField: z.base64url(),
  lowercaseField: z.lowercase(),
  isoDateField: z.iso.date(),
  isoDateTimeField: z.iso.datetime(),
  isoDurationField: z.iso.duration(),
  isoTimeField: z.iso.time(),
  
  // Additional formats (for broader compatibility)
  ulidField: z.ulid(),
  uuidField: z.uuid(),
  emojiField: z.emoji(),
  nanoidField: z.nanoid(),
  cuidField: z.cuid(),
  cuid2Field: z.cuid2(),
  jwtField: z.jwt(),

  // Literal & Enum types
  literalField: z.literal("test"),
  enumField: statusEnum,
  templateLiteralField: z.templateLiteral([
    "This is the current status",
    z.string(),
    z.literal(" is "),
    z.enum(["active", "inactive"]),
  ]),

  // Collection types
  arrayField: z.array(z.string()),
  tupleField: z.tuple([z.string(), z.number(), z.boolean()]),
  setField: z.set(z.string()),
  mapField: z.map(z.string(), z.number()),
  recordField: z.record(z.string(), z.number()),

  // Object & Nesting
  objectField: z.object({
    name: z.string(),
    value: z.number(),
  }),
  nestedObjectField: z.object({
    level1: z.object({
      level2: z.string(),
    }),
  }),

  // Modifier types
  optionalField: z.string().optional(),
  nullableField: z.string().nullable(),
  readonlyField: z.string().readonly(),
  nonOptionalField: z.string().optional().nonoptional(),

  // Advanced types
  unionField: z.union([z.string(), z.number()]),
  intersectionField: z.intersection(
    z.object({ a: z.string() }),
    z.object({ b: z.number() })
  ),
  transformField: z.string().transform(val => val.toLowerCase()),
  defaultField: z.string().default("defaultValue"),
  catchField: z.string().catch("catchValue"),
  pipeField: z.string().pipe(z.string().min(1)),
  lazyField: z.lazy(() => z.string()),
  promiseField: z.promise(z.string()),
  fileField: z.file(),
  customField: z.custom<string>(val => typeof val === "string"),

  // Metadata
  ...metadataSchema.shape,
});

export type Specimen = z.infer<typeof specimenSchema>;
export type SpecimenStatus = z.infer<typeof statusEnum>;
