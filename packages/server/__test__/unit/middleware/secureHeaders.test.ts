import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { executeMiddlewarePipeline } from "../../../src/lib/Middleware.js";
import {
  secureHeaders,
  type SecureHeadersOptions,
} from "../../../src/lib/middleware/secureHeaders.js";
import { createServerContext } from "../../helpers.js";

type SecureHeadersScenario = {
  readonly options?: SecureHeadersOptions;
  readonly finalHandler?: () => Promise<IHttpResponse>;
};

const defaultSecurityHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "strict-transport-security": "max-age=15552000; includeSubDomains",
  "referrer-policy": "no-referrer",
  "x-xss-protection": "0",
  "x-download-options": "noopen",
  "x-dns-prefetch-control": "off",
  "x-permitted-cross-domain-policies": "none",
  "cross-origin-resource-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
  "origin-agent-cluster": "?1",
} as const;

const allSecurityHeadersDisabled = {
  contentTypeOptions: false,
  frameOptions: false,
  strictTransportSecurity: false,
  referrerPolicy: false,
  xssProtection: false,
  downloadOptions: false,
  dnsPrefetchControl: false,
  permittedCrossDomainPolicies: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  originAgentCluster: false,
} satisfies SecureHeadersOptions;

const securityHeaderOptions = [
  {
    optionKey: "contentTypeOptions",
    headerName: "x-content-type-options",
    value: "custom-content-type-options",
    unrelatedHeaderName: "x-frame-options",
    unrelatedValue: "SAMEORIGIN",
  },
  {
    optionKey: "frameOptions",
    headerName: "x-frame-options",
    value: "CUSTOM-FRAME-OPTIONS",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
  {
    optionKey: "strictTransportSecurity",
    headerName: "strict-transport-security",
    value: "max-age=31536000",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
  {
    optionKey: "referrerPolicy",
    headerName: "referrer-policy",
    value: "strict-origin-when-cross-origin",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
  {
    optionKey: "xssProtection",
    headerName: "x-xss-protection",
    value: "1; mode=block",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
  {
    optionKey: "downloadOptions",
    headerName: "x-download-options",
    value: "custom-download-options",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
  {
    optionKey: "dnsPrefetchControl",
    headerName: "x-dns-prefetch-control",
    value: "on",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
  {
    optionKey: "permittedCrossDomainPolicies",
    headerName: "x-permitted-cross-domain-policies",
    value: "master-only",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
  {
    optionKey: "crossOriginResourcePolicy",
    headerName: "cross-origin-resource-policy",
    value: "cross-origin",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
  {
    optionKey: "crossOriginOpenerPolicy",
    headerName: "cross-origin-opener-policy",
    value: "same-origin-allow-popups",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
  {
    optionKey: "crossOriginEmbedderPolicy",
    headerName: "cross-origin-embedder-policy",
    value: "credentialless",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
  {
    optionKey: "originAgentCluster",
    headerName: "origin-agent-cluster",
    value: "?0",
    unrelatedHeaderName: "x-content-type-options",
    unrelatedValue: "nosniff",
  },
] as const satisfies ReadonlyArray<{
  readonly optionKey: keyof SecureHeadersOptions;
  readonly headerName: keyof typeof defaultSecurityHeaders;
  readonly value: string;
  readonly unrelatedHeaderName: keyof typeof defaultSecurityHeaders;
  readonly unrelatedValue: string;
}>;

const defaultHandler = async (): Promise<IHttpResponse> => ({ statusCode: 200 });

const executeSecureHeaders = ({
  options,
  finalHandler = defaultHandler,
}: SecureHeadersScenario = {}): Promise<IHttpResponse> => {
  const mw = secureHeaders(options);
  const ctx = createServerContext();

  return executeMiddlewarePipeline([mw.handler], ctx, finalHandler);
};

const configuredSecurityHeader = (
  optionKey: keyof SecureHeadersOptions,
  value: string
): SecureHeadersOptions => {
  const options: Partial<Record<keyof SecureHeadersOptions, string>> = {
    [optionKey]: value,
  };

  return options;
};

const expectDefaultSecurityHeaders = (response: IHttpResponse): void => {
  for (const [headerName, headerValue] of Object.entries(
    defaultSecurityHeaders
  )) {
    expect(response.header?.[headerName]).toBe(headerValue);
  }
};

describe("secureHeaders", () => {
  test("sets the default security headers", async () => {
    const response = await executeSecureHeaders();

    expectDefaultSecurityHeaders(response);
  });

  test("omits disabled security headers while keeping enabled defaults", async () => {
    const response = await executeSecureHeaders({
      options: {
        frameOptions: false,
        strictTransportSecurity: false,
      },
    });

    expect(response.header?.["x-frame-options"]).toBeUndefined();
    expect(response.header?.["strict-transport-security"]).toBeUndefined();
    expect(response.header?.["x-content-type-options"]).toBe("nosniff");
  });

  test("omits every security header when every option is disabled", async () => {
    const response = await executeSecureHeaders({
      options: allSecurityHeadersDisabled,
    });

    for (const headerName of Object.keys(defaultSecurityHeaders)) {
      expect(response.header?.[headerName]).toBeUndefined();
    }
  });

  test("applies configured security header values", async () => {
    const response = await executeSecureHeaders({
      options: {
        referrerPolicy: "strict-origin-when-cross-origin",
        strictTransportSecurity: "max-age=31536000",
      },
    });

    expect(response.header?.["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.header?.["strict-transport-security"]).toBe(
      "max-age=31536000"
    );
  });

  test.each(securityHeaderOptions)(
    "applies configured $optionKey values without dropping unrelated defaults",
    async ({
      optionKey,
      headerName,
      value,
      unrelatedHeaderName,
      unrelatedValue,
    }) => {
      const response = await executeSecureHeaders({
        options: configuredSecurityHeader(optionKey, value),
      });

      expect(response.header?.[headerName]).toBe(value);
      expect(response.header?.[unrelatedHeaderName]).toBe(unrelatedValue);
    }
  );

  test("configured security headers override conflicting downstream values case-insensitively", async () => {
    const response = await executeSecureHeaders({
      options: { frameOptions: "DENY" },
      finalHandler: async () => ({
        statusCode: 200,
        header: { "X-Frame-Options": "SAMEORIGIN" },
      }),
    });

    expect(response.header?.["x-frame-options"]).toBe("DENY");
    expect(response.header?.["X-Frame-Options"]).toBeUndefined();
  });

  test("replaces array-valued downstream security headers", async () => {
    const response = await executeSecureHeaders({
      options: { frameOptions: "DENY" },
      finalHandler: async () => ({
        statusCode: 200,
        header: {
          "X-Frame-Options": ["DENY", "SAMEORIGIN"],
          "x-custom": "value",
        },
      }),
    });

    expect(response.header?.["x-frame-options"]).toBe("DENY");
    expect(response.header?.["X-Frame-Options"]).toBeUndefined();
    expect(response.header?.["x-custom"]).toBe("value");
  });

  test("overrides conflicting downstream security headers", async () => {
    const response = await executeSecureHeaders({
      finalHandler: async () => ({
        statusCode: 200,
        header: { "x-frame-options": "DENY" },
      }),
    });

    expect(response.header?.["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.header?.["x-content-type-options"]).toBe("nosniff");
  });

  test("removes differently cased duplicate downstream security headers", async () => {
    const response = await executeSecureHeaders({
      finalHandler: async () => ({
        statusCode: 200,
        header: {
          "X-Frame-Options": "DENY",
          "x-custom": "value",
        },
      }),
    });

    expect(response.header?.["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.header?.["X-Frame-Options"]).toBeUndefined();
    expect(response.header?.["x-custom"]).toBe("value");
  });

  test("lets disabled security headers pass through from downstream", async () => {
    const response = await executeSecureHeaders({
      options: { frameOptions: false },
      finalHandler: async () => ({
        statusCode: 200,
        header: { "x-frame-options": "DENY" },
      }),
    });

    expect(response.header?.["x-frame-options"]).toBe("DENY");
  });

  test("disabled security headers preserve differently cased downstream headers", async () => {
    const response = await executeSecureHeaders({
      options: { frameOptions: false },
      finalHandler: async () => ({
        statusCode: 200,
        header: { "X-Frame-Options": "DENY" },
      }),
    });

    expect(response.header?.["X-Frame-Options"]).toBe("DENY");
    expect(response.header?.["x-frame-options"]).toBeUndefined();
  });

  test("all disabled security headers preserve downstream headers without adding defaults", async () => {
    const response = await executeSecureHeaders({
      options: allSecurityHeadersDisabled,
      finalHandler: async () => ({
        statusCode: 200,
        header: {
          "X-Frame-Options": "DENY",
          "content-type": "application/json",
        },
      }),
    });

    for (const headerName of Object.keys(defaultSecurityHeaders)) {
      expect(response.header?.[headerName]).toBeUndefined();
    }
    expect(response.header?.["X-Frame-Options"]).toBe("DENY");
    expect(response.header?.["content-type"]).toBe("application/json");
  });

  test("preserves unrelated downstream headers, status, and body", async () => {
    const response = await executeSecureHeaders({
      finalHandler: async () => ({
        statusCode: 201,
        body: { id: "1" },
        header: { "content-type": "application/json" },
      }),
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ id: "1" });
    expect(response.header?.["content-type"]).toBe("application/json");
  });
});
