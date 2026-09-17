import type {
  HttpQuerySchema,
  HttpRequestHeaderSchema,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { Validator } from "../../src/lib/Validator.js";

class ProbeValidator extends Validator {
  public coerceQuery(query: unknown, schema: HttpQuerySchema): unknown {
    return this.coerceQueryToSchema(query, schema);
  }

  public coerceHeader(
    header: unknown,
    schema: HttpRequestHeaderSchema
  ): unknown {
    return this.coerceHeaderToSchema(header, schema);
  }
}

describe("Validator wire value normalization", () => {
  const validator = new ProbeValidator();

  test("maps an empty header value to an empty array for an array schema", () => {
    const schema = z.object({ "X-Tags": z.array(z.string()) });

    const coerced = validator.coerceHeader({ "X-Tags": "" }, schema);

    expect(schema.parse(coerced)).toEqual({ "X-Tags": [] });
  });

  test("maps a comma-only header value to an empty array for an array schema", () => {
    const schema = z.object({ "X-Tags": z.array(z.string()) });

    const coerced = validator.coerceHeader({ "X-Tags": "," }, schema);

    expect(schema.parse(coerced)).toEqual({ "X-Tags": [] });
  });

  test("keeps an empty scalar header value scalar", () => {
    const schema = z.object({ "X-Note": z.string() });

    const coerced = validator.coerceHeader({ "X-Note": "" }, schema);

    expect(schema.parse(coerced)).toEqual({ "X-Note": "" });
  });

  test("keeps a comma-only scalar header value scalar", () => {
    const schema = z.object({ "X-Note": z.string() });

    const coerced = validator.coerceHeader({ "X-Note": "," }, schema);

    expect(schema.parse(coerced)).toEqual({ "X-Note": "," });
  });

  test("wraps an empty query value for an array schema and lets Zod own its meaning", () => {
    const schema = z.object({ samples: z.array(z.coerce.number()) });

    const coerced = validator.coerceQuery({ samples: "" }, schema);

    expect(schema.parse(coerced)).toEqual({ samples: [0] });
  });

  test("does not split a comma-only query value for an array schema", () => {
    const schema = z.object({ samples: z.array(z.string()) });

    const coerced = validator.coerceQuery({ samples: "," }, schema);

    expect(schema.parse(coerced)).toEqual({ samples: [","] });
  });
});
