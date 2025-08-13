import type { z } from "zod/v4";
import type { HttpStatusCode } from "./HttpStatusCode";

export type InvalidResponseIssue = {
  readonly type: "INVALID_RESPONSE";
  readonly responseName: string;
  readonly headerIssues: z.core.$ZodRawIssue[];
  readonly bodyIssues: z.core.$ZodRawIssue[];
};

export type InvalidStatusCodeIssue = {
  readonly type: "INVALID_STATUS_CODE";
  readonly invalidStatusCode: HttpStatusCode;
  readonly expectedStatusCodes: HttpStatusCode[];
};

export type ValidationIssue = InvalidResponseIssue | InvalidStatusCodeIssue;

export type ResponseValidationErrorInput = {
  readonly issues?: ValidationIssue[];
};

export class ResponseValidationError extends Error {
  public override readonly message: string;
  public readonly issues: ValidationIssue[];

  public constructor(
    public readonly statusCode: HttpStatusCode,
    input?: ResponseValidationErrorInput
  ) {
    const message = `Invalid response for status code '${statusCode}'`;
    super(message);

    this.message = message;
    this.issues = input?.issues ?? [];
  }

  public addHeaderIssues(name: string, issues: z.core.$ZodRawIssue[]) {
    this.addResponseIssues(name, issues);
  }

  public addBodyIssues(name: string, issues: z.core.$ZodRawIssue[]) {
    this.addResponseIssues(name, [], issues);
  }

  public addResponseIssues(
    name: string,
    headerIssues: z.core.$ZodRawIssue[] = [],
    bodyIssues: z.core.$ZodRawIssue[] = []
  ) {
    if (headerIssues.length === 0 && bodyIssues.length === 0) {
      return;
    }

    const issue = this.issues.find(
      i => i.type === "INVALID_RESPONSE" && i.responseName === name
    ) as InvalidResponseIssue;
    if (!issue) {
      this.issues.push({
        type: "INVALID_RESPONSE",
        responseName: name,
        headerIssues,
        bodyIssues,
      });
      return;
    }

    if (headerIssues.length > 0) {
      issue.headerIssues.push(...headerIssues);
    }
    if (bodyIssues.length > 0) {
      issue.bodyIssues.push(...bodyIssues);
    }
  }

  public addStatusCodeIssue(expectedStatusCodes: HttpStatusCode[]) {
    const statusCodeIssue = this.issues.find(
      i => i.type === "INVALID_STATUS_CODE"
    );

    if (statusCodeIssue) {
      statusCodeIssue.expectedStatusCodes.push(...expectedStatusCodes);
    } else {
      this.issues.push({
        type: "INVALID_STATUS_CODE",
        invalidStatusCode: this.statusCode,
        expectedStatusCodes,
      });
    }
  }

  public getResponseHeaderIssues(name: string): z.core.$ZodRawIssue[] {
    const issue = this.issues.find(
      i => i.type === "INVALID_RESPONSE" && i.responseName === name
    ) as InvalidResponseIssue;
    return issue ? issue.headerIssues : [];
  }

  public getResponseBodyIssues(name: string): z.core.$ZodRawIssue[] {
    const issue = this.issues.find(
      i => i.type === "INVALID_RESPONSE" && i.responseName === name
    ) as InvalidResponseIssue;
    return issue ? issue.bodyIssues : [];
  }

  public hasResponseIssues(name?: string | undefined): boolean {
    if (name) {
      return this.issues.some(
        issue =>
          issue.type === "INVALID_RESPONSE" && issue.responseName === name
      );
    }
    return this.issues.some(issue => issue.type === "INVALID_RESPONSE");
  }

  public hasStatusCodeIssues(): boolean {
    return this.issues.some(issue => issue.type === "INVALID_STATUS_CODE");
  }

  public hasIssues(): boolean {
    return this.issues.length > 0;
  }
}
