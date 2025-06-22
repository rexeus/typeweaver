import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IAccountNotFoundErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type IAccountNotFoundErrorResponseBody = {
  message: "Account not found";
  code: "ACCOUNT_NOT_FOUND_ERROR";
  actualValues: {
    accountId: string;
  };
};

export type IAccountNotFoundErrorResponse = {
  statusCode: HttpStatusCode.NOT_FOUND;
  header: IAccountNotFoundErrorResponseHeader;
  body: IAccountNotFoundErrorResponseBody;
};

export class AccountNotFoundErrorResponse
  extends HttpResponse<
    IAccountNotFoundErrorResponseHeader,
    IAccountNotFoundErrorResponseBody
  >
  implements IAccountNotFoundErrorResponse
{
  public override readonly statusCode: HttpStatusCode.NOT_FOUND;

  public constructor(response: IAccountNotFoundErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.NOT_FOUND) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for AccountNotFoundErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
