import type {
  IHttpRequest,
  IRawHttpRequest,
  IRequestValidator,
  IValidatedHttpRequest,
  SafeRequestValidationResult,
} from "@rexeus/typeweaver-core";
import { Validator } from "./Validator.js";

export declare abstract class RequestValidator<
  TValidatedRequest extends IValidatedHttpRequest = IHttpRequest,
>
  extends Validator
  implements IRequestValidator<TValidatedRequest>
{
  public constructor();
  public abstract safeValidate(
    request: IRawHttpRequest,
  ): SafeRequestValidationResult<TValidatedRequest>;
  public abstract validate(request: IRawHttpRequest): TValidatedRequest;
}
