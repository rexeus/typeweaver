import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { projectSchema } from "./projectSchema";
import { z } from "zod/v4";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { sharedResponses } from "../shared/sharedResponses";
import ProjectNotFoundErrorDefinition from "../shared/ProjectNotFoundErrorDefinition";
import ProjectPublishErrorDefinition from "../shared/ProjectPublishErrorDefinition";
import ProjectRequestGenerationErrorDefinition from "../shared/ProjectRequestGenerationErrorDefinition";
import { defaultRequestHeadersWithPayload } from "../shared/defaultRequestHeader";
import ProjectStatusTransitionErrorDefinition from "../shared/ProjectStatusTransitionErrorDefinition";

export default new HttpOperationDefinition({
  operationId: "SetProjectStatus",
  path: "/projects/:projectId/status",
  method: HttpMethod.PUT,
  summary: "Set project status",
  request: {
    param: z.object({
      projectId: projectSchema.shape.id,
    }),
    body: z.object({
      value: projectSchema.shape.status.extract([
        "REQUEST_GENERATION",
        // TODO: check if REQUEST_PUBLISH is needed.
        // this should be the case if an asynchronous workflow is used to publish the project.
        "PUBLISHED",
        // TODO: check if WITHDRAWN is needed.
        "WITHDRAWN",
      ]),
    }),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    {
      name: "SetProjectStatusSuccess",
      body: projectSchema,
      description: "Project status updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    ProjectNotFoundErrorDefinition,
    ProjectStatusTransitionErrorDefinition,
    ProjectPublishErrorDefinition,
    ProjectRequestGenerationErrorDefinition,
    ...sharedResponses,
  ],
});
