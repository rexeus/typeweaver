import type { z } from "zod/v4";
import { HttpStatusCode } from "@rexeus/typeweaver-core";

export type ResponseValidationErrorInput = {
  headerIssues?: z.core.$ZodRawIssue[];
  bodyIssues?: z.core.$ZodRawIssue[];
};

export class ResponseValidationError extends Error {
  public override readonly message: string;
  public readonly headerIssues: z.core.$ZodRawIssue[] = [];
  public readonly bodyIssues: z.core.$ZodRawIssue[] = [];

  public constructor(
    public readonly statusCode: HttpStatusCode,
    input?: ResponseValidationErrorInput,
  ) {
    const message = `Invalid response for status code '${statusCode}'`;
    super(message);

    this.message = message;

    if (input?.headerIssues) {
      this.headerIssues = input.headerIssues;
    }
    if (input?.bodyIssues) {
      this.bodyIssues = input.bodyIssues;
    }
  }

  public addHeaderIssues(issues: z.core.$ZodRawIssue[]) {
    this.headerIssues.push(...issues);
  }

  public addBodyIssues(issues: z.core.$ZodRawIssue[]) {
    this.bodyIssues.push(...issues);
  }

  public hasIssues(): boolean {
    return this.headerIssues.length > 0 || this.bodyIssues.length > 0;
  }
}
