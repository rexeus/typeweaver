import { createOptionsTodoSuccessResponse as generatedCreateOptionsTodoSuccessResponse } from "../../test-project/output/responses/OptionsTodoSuccessResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createResponse } from "../createResponse.js";
import type {
  IOptionsTodoSuccessResponse,
  IOptionsTodoSuccessResponseHeader,
} from "../../index.js";

export const createOptionsTodoSuccessResponseHeader =
  createDataFactory<IOptionsTodoSuccessResponseHeader>(() => ({
    Allow: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "Access-Control-Allow-Headers": ["Content-Type", "Authorization"],
    "Access-Control-Allow-Methods": [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    "Access-Control-Max-Age": "3600",
    "Access-Control-Allow-Origin": "*",
  }));

type CreateOptionsTodoSuccessResponseInput = {
  header?: Partial<IOptionsTodoSuccessResponseHeader>;
};

export function createOptionsTodoSuccessResponse(
  input: CreateOptionsTodoSuccessResponseInput = {}
): IOptionsTodoSuccessResponse {
  const responseData = createResponse<
    IOptionsTodoSuccessResponse,
    never,
    IOptionsTodoSuccessResponseHeader
  >(
    {
      statusCode: 200,
    },
    {
      header: createOptionsTodoSuccessResponseHeader,
    },
    input
  );
  return generatedCreateOptionsTodoSuccessResponse(responseData);
}
