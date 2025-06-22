import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { projectSchema } from "./projectSchema";
import { sharedResponses } from "../shared/sharedResponses";
import ProjectNotFoundErrorDefinition from "../shared/ProjectNotFoundErrorDefinition";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithPayload } from "../shared/defaultRequestHeader";
import NonExistingFunnelErrorDefinition from "../shared/NonExistingFunnelErrorDefinition";
import NonExistingAdErrorDefinition from "../shared/NonExistingAdErrorDefinition";
import NotUpdateableProjectStatusErrorDefinition from "../shared/NotUpdateableProjectStatusErrorDefinition";

export default new HttpOperationDefinition({
  operationId: "UpdateProject",
  path: "/projects/:projectId",
  request: {
    param: z.object({
      projectId: z.ulid(),
    }),
    body: projectSchema
      .omit({
        id: true,
        createdBy: true,
        createdAt: true,
        modifiedBy: true,
        modifiedAt: true,
        accountId: true,
        status: true,
        isReadyForGeneration: true,
      })
      .partial(),
    header: defaultRequestHeadersWithPayload,
  },
  method: HttpMethod.PATCH,
  summary: "Update project",
  responses: [
    {
      name: "UpdateProjectSuccess",
      body: projectSchema,
      description: "Project updated successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    ProjectNotFoundErrorDefinition,
    NotUpdateableProjectStatusErrorDefinition,
    NonExistingFunnelErrorDefinition,
    NonExistingAdErrorDefinition,
    ...sharedResponses,
  ],
});
