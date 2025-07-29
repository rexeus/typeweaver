import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type ISpecimenNotFoundErrorResponseHeader = {
  "X-Search-ID": string;
  "X-Email"?: string | undefined;
  "X-Available": string[];
  "X-Count": string;
  "X-Suggestions"?: string[] | undefined;
};

export type ISpecimenNotFoundErrorResponseBody = {
  message: "Specimen not found in the system";
  code: "SPECIMEN_NOT_FOUND_ERROR";
  searchCriteria: {
    requestedIds: string[];
    emails?: string[] | undefined;
    suggestions: string[];
    alternatives?:
      | {
          id: string;
          similarity: number;
          available: boolean;
        }[]
      | undefined;
  };
};

export type ISpecimenNotFoundErrorResponse = {
  statusCode: HttpStatusCode.NOT_FOUND;
  header: ISpecimenNotFoundErrorResponseHeader;
  body: ISpecimenNotFoundErrorResponseBody;
};

export class SpecimenNotFoundErrorResponse
  extends HttpResponse<
    ISpecimenNotFoundErrorResponseHeader,
    ISpecimenNotFoundErrorResponseBody
  >
  implements ISpecimenNotFoundErrorResponse
{
  public override readonly statusCode: HttpStatusCode.NOT_FOUND;

  public constructor(response: ISpecimenNotFoundErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.NOT_FOUND) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for SpecimenNotFoundErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
