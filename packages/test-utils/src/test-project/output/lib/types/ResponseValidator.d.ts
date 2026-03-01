import type {
  IHttpResponse,
  IResponseValidator,
  ResponseValidationError,
  SafeResponseValidationResult,
} from "@rexeus/typeweaver-core";
import { Validator } from "./Validator";

export declare abstract class ResponseValidator extends Validator implements IResponseValidator {
  public abstract safeValidate(
    response: IHttpResponse,
  ): SafeResponseValidationResult<IHttpResponse>;
  public abstract validate(response: IHttpResponse): IHttpResponse;
  protected validateResponseType<Response extends IHttpResponse>(
    responseName: string,
    headerSchema: unknown,
    bodySchema: unknown,
  ): (
    response: IHttpResponse,
    error: ResponseValidationError,
  ) => SafeResponseValidationResult<Response>;
}
