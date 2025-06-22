import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { projectSchema } from "./projectSchema";
import { sharedResponses } from "../shared/sharedResponses";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithPayload } from "../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "CreateProject",
  summary: "Create new project",
  method: HttpMethod.POST,
  path: "/projects",
  request: {
    body: projectSchema.omit({
      id: true,
      accountId: true,
      createdAt: true,
      createdBy: true,
      modifiedBy: true,
      modifiedAt: true,
      status: true,
      selectedAdId: true,
      selectedFunnelId: true,
      isReadyForGeneration: true,
    }),
    header: defaultRequestHeadersWithPayload,
  },
  responses: [
    {
      name: "CreateProjectSuccess",
      body: projectSchema,
      description: "Project created successfully",
      statusCode: HttpStatusCode.OK,
      header: defaultResponseHeader,
    },
    ...sharedResponses,
  ],
});
