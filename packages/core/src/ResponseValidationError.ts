import type { z } from "zod/v4";
import type { HttpStatusCode } from "./HttpStatusCode";

export type ResponseValidationIssue = {
  readonly name: string;
  readonly headerIssues: z.core.$ZodRawIssue[];
  readonly bodyIssues: z.core.$ZodRawIssue[];
};

export type ResponseValidationErrorInput = {
  readonly responses?: ResponseValidationIssue[];
};

export class ResponseValidationError extends Error {
  public override readonly message: string;
  public readonly issues: ResponseValidationIssue[];

  public constructor(
    public readonly statusCode: HttpStatusCode,
    input?: ResponseValidationErrorInput
  ) {
    const message = `Invalid response for status code '${statusCode}'`;
    super(message);

    this.message = message;
    this.issues = input?.responses ?? [];
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

    const issue = this.issues.find(i => i.name === name);
    if (!issue) {
      this.issues.push({
        name,
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

  public getHeaderIssues(name: string): z.core.$ZodRawIssue[] {
    const issue = this.issues.find(i => i.name === name);
    return issue ? issue.headerIssues : [];
  }

  public getBodyIssues(name: string): z.core.$ZodRawIssue[] {
    const issue = this.issues.find(i => i.name === name);
    return issue ? issue.bodyIssues : [];
  }


  public hasIssues(name?: string | undefined): boolean {
    if (name) {
      return this.issues.some(
        issue =>
          issue.name === name &&
          (issue.headerIssues.length > 0 || issue.bodyIssues.length > 0)
      );
    }
    return this.issues.some(
      issue => issue.headerIssues.length > 0 || issue.bodyIssues.length > 0
    );
  }
}
