import {
  createGetMetricKeyedLabelsSuccessResponse,
  createGetMetricLabelsSuccessResponse,
  createGetMetricSamplesSuccessResponse,
  createGetMetricSuccessResponse,
} from "test-utils";
import { expect } from "vitest";
import { expectErrorResponse, expectRecord } from "../../../helpers.js";
import type {
  IGetMetricRequest,
  IValidationErrorResponseBody,
  ServerMetricApiHandler,
} from "test-utils";

export async function expectValidationIssue(
  response: Response,
  issueKey: keyof IValidationErrorResponseBody["issues"]
): Promise<void> {
  const data = await expectErrorResponse(response, 400, "VALIDATION_ERROR");
  const issues = data["issues"];
  expectRecord(issues, "the validation error issues");
  expect(issues[issueKey]).toHaveLength(1);
}

export function createMetricBoundaryHandlers(
  onRequest?: (request: IGetMetricRequest) => void
): ServerMetricApiHandler<Record<string, unknown>, true> {
  return {
    handleGetMetricRequest: async request => {
      onRequest?.(request);
      return createGetMetricSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          enabled: request.query.enabled ?? false,
        },
      });
    },
    handleGetMetricLabelsRequest: async request =>
      createGetMetricLabelsSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          labels: request.query ?? {},
          flags: request.header ?? {},
        },
      }),
    handleGetMetricSamplesRequest: async request =>
      createGetMetricSamplesSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          samples: request.query ?? {},
        },
      }),
    handleGetMetricKeyedLabelsRequest: async request =>
      createGetMetricKeyedLabelsSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          labels: request.query ?? {},
        },
      }),
  };
}

export async function expectNoBody(response: Response): Promise<void> {
  expect(await response.text()).toBe("");
}
