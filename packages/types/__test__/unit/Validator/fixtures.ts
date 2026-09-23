import type {
  HttpQuerySchema,
  HttpRequestHeaderSchema,
} from "@rexeus/typeweaver-core";
import { Validator } from "../../../src/lib/Validator.js";

export class ProbeValidator extends Validator {
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
