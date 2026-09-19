import type {
  IRawHttpRequest,
  IRequestValidator,
  IValidatedHttpRequest,
  SafeRequestValidationResult,
} from "@rexeus/typeweaver-core";
import { Validator } from "./Validator.js";

export declare abstract class RequestValidator<
  TValidatedRequest extends IValidatedHttpRequest = IValidatedHttpRequest,
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
