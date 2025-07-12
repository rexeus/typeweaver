import type { z } from "zod/v4";

/**
 * Input configuration for RequestValidationError.
 */
export type RequestValidationErrorInput = {
  /** Validation issues found in HTTP headers */
  headerIssues?: z.core.$ZodRawIssue[];
  /** Validation issues found in request body */
  bodyIssues?: z.core.$ZodRawIssue[];
  /** Validation issues found in query parameters */
  queryIssues?: z.core.$ZodRawIssue[];
  /** Validation issues found in path parameters */
  pathParamIssues?: z.core.$ZodRawIssue[];
};

/**
 * Error thrown when HTTP request validation fails.
 *
 * This error provides detailed information about validation failures across
 * different parts of an HTTP request. Each category of issues is stored
 * separately for precise error reporting and debugging.
 *
 * The error integrates with Zod's issue format, making it compatible with
 * Zod schema validation while maintaining flexibility for custom validators.
 */
export class RequestValidationError extends Error {
  public override readonly message: string;
  /** Validation issues found in HTTP headers */
  public readonly headerIssues: z.core.$ZodRawIssue[] = [];
  /** Validation issues found in request body */
  public readonly bodyIssues: z.core.$ZodRawIssue[] = [];
  /** Validation issues found in query parameters */
  public readonly queryIssues: z.core.$ZodRawIssue[] = [];
  /** Validation issues found in path parameters */
  public readonly pathParamIssues: z.core.$ZodRawIssue[] = [];

  public constructor(input?: RequestValidationErrorInput) {
    const message = "Invalid request";
    super(message);

    this.message = message;

    if (input?.headerIssues) {
      this.headerIssues = input.headerIssues;
    }
    if (input?.bodyIssues) {
      this.bodyIssues = input.bodyIssues;
    }
    if (input?.queryIssues) {
      this.queryIssues = input.queryIssues;
    }
    if (input?.pathParamIssues) {
      this.pathParamIssues = input.pathParamIssues;
    }
  }

  /**
   * Adds header validation issues to the error.
   * @param issues - Array of Zod validation issues
   */
  public addHeaderIssues(issues: z.core.$ZodRawIssue[]) {
    this.headerIssues.push(...issues);
  }

  /**
   * Adds body validation issues to the error.
   * @param issues - Array of Zod validation issues
   */
  public addBodyIssues(issues: z.core.$ZodRawIssue[]) {
    this.bodyIssues.push(...issues);
  }

  /**
   * Adds query parameter validation issues to the error.
   * @param issues - Array of Zod validation issues
   */
  public addQueryIssues(issues: z.core.$ZodRawIssue[]) {
    this.queryIssues.push(...issues);
  }

  /**
   * Adds path parameter validation issues to the error.
   * @param issues - Array of Zod validation issues
   */
  public addPathParamIssues(issues: z.core.$ZodRawIssue[]) {
    this.pathParamIssues.push(...issues);
  }

  /**
   * Checks if this error contains any validation issues.
   * @returns true if any category has issues, false otherwise
   */
  public hasIssues(): boolean {
    return (
      this.headerIssues.length > 0 ||
      this.bodyIssues.length > 0 ||
      this.queryIssues.length > 0 ||
      this.pathParamIssues.length > 0
    );
  }
}
