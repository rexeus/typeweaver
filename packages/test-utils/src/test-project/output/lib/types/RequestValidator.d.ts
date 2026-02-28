import type {
  IHttpRequest,
  IRequestValidator,
  SafeRequestValidationResult,
} from "@rexeus/typeweaver-core";
import { Validator } from "./Validator";

export declare abstract class RequestValidator extends Validator implements IRequestValidator {
  public constructor();
  public abstract safeValidate(request: IHttpRequest): SafeRequestValidationResult<IHttpRequest>;
  public abstract validate(request: IHttpRequest): IHttpRequest;
}
