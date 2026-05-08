import type {
  HttpBodySchema,
  HttpHeaderSchema,
  IHttpResponse,
  IResponseValidator,
  ITypedHttpResponse,
  ResponseValidationError,
  SafeResponseValidationResult,
} from "@rexeus/typeweaver-core";
import { Validator } from "./Validator.js";

export type ResponseEntry = {
  readonly name: string;
  readonly statusCode: number;
  readonly headerSchema: HttpHeaderSchema | undefined;
  readonly bodySchema: HttpBodySchema | undefined;
};

export declare abstract class ResponseValidator<
  TResponse extends ITypedHttpResponse = ITypedHttpResponse,
>
  extends Validator
  implements IResponseValidator<TResponse>
{
  protected abstract readonly responseEntries: readonly ResponseEntry[];
  protected abstract readonly expectedStatusCodes: readonly number[];
  public safeValidate(
    response: IHttpResponse
  ): SafeResponseValidationResult<TResponse>;
  public validate(response: IHttpResponse): TResponse;
  protected validateResponseType<Response extends ITypedHttpResponse>(
    responseName: string,
    headerSchema: HttpHeaderSchema | undefined,
    bodySchema: HttpBodySchema | undefined
  ): (
    response: IHttpResponse,
    error: ResponseValidationError
  ) => SafeResponseValidationResult<Response>;
}
