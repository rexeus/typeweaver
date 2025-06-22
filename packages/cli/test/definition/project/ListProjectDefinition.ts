import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { listResponseSchema } from "../shared/schemas/listResponseSchema";
import { projectSchema } from "./projectSchema";
import { sharedResponses } from "../shared/sharedResponses";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "ListProject",
  summary: "List projects",
  method: HttpMethod.GET,
  path: "/projects",
  request: {
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    {
      name: "ListProjectSuccess",
      description: "List projects successfully",
      statusCode: HttpStatusCode.OK,
      body: listResponseSchema(projectSchema),
      header: defaultResponseHeader,
    },
    ...sharedResponses,
  ],
});
