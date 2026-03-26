import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createOptionsTodoSuccessResponse as generatedCreateOptionsTodoSuccessResponse } from "../../test-project/output/todo/OptionsTodoResponse";
import type {
  IOptionsTodoSuccessResponse,
  IOptionsTodoSuccessResponseHeader,
} from "../..";

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
