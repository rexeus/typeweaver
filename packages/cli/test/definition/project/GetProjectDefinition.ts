import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { projectSchema } from "./projectSchema";
import { sharedResponses } from "../shared/sharedResponses";
import ProjectNotFoundErrorDefinition from "../shared/ProjectNotFoundErrorDefinition";
import { z } from "zod/v4";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithoutPayload } from "../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "GetProject",
  request: {
    param: z.object({
      projectId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  method: HttpMethod.GET,
  summary: "Get project",
  path: "/projects/:projectId",
  responses: [
    {
      name: "GetProjectSuccess",
      body: projectSchema,
      description: "Project retrieved successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    ProjectNotFoundErrorDefinition,
    ...sharedResponses,
  ],
});
