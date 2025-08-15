# @rexeus/typeweaver-core

A TypeScript library for defining type-safe HTTP APIs with runtime validation and code generation
support.

## Features

- **Type-Safe API Definitions** - Define HTTP operations with complete TypeScript type inference
- **Runtime Validation** - Zod schema integration for request/response validation
- **Framework Adapters** - Support for AWS Lambda, Hono, and other execution contexts
- **Client Generation Ready** - Abstract base classes designed for code generation
- **Route Matching** - Optimized route resolution with parameter support
- **Error Handling** - Structured validation errors with detailed issue reporting

## Installation

```bash
npm install @rexeus/typeweaver-core
```

**Peer Dependencies:**

```bash
npm install zod@^3.25.0 axios@^1.9.0 hono@^4.8.0
```

> **Important:** This library requires Zod v4 features and imports from `"zod/v4"`. Make sure you
> have a compatible Zod version installed.

## Quick Start

### Define API Operations

```typescript
import { z } from "zod/v4";
import { HttpOperationDefinition, HttpStatusCode, HttpMethod } from "@rexeus/typeweaver-core";
import { accountSchema } from "./accountSchema";
import { sharedResponses } from "../shared/sharedResponses";
import { defaultResponseHeader } from "../shared/defaultResponseHeader";
import { defaultRequestHeadersWithPayload } from "../shared/defaultRequestHeader";

export default new HttpOperationDefinition({
  operationId: "RegisterAccount",
  path: "/accounts",
  summary: "Register new account",
  method: HttpMethod.POST,
  request: {
    body: z.object({
      email: z.email().max(256),
      password: z.string().max(256),
    }),
    header: defaultRequestHeadersWithPayload.omit({
      Authorization: true,
    }),
  },
  responses: [
    {
      statusCode: HttpStatusCode.OK,
      description: "Account created successfully",
      body: accountSchema,
      name: "RegisterAccountSuccess",
      header: defaultResponseHeader,
    },
    ...sharedResponses,
  ],
});
```

### Framework Integration

```typescript
// AWS Lambda
import { AwsLambdaHandler, AwsLambdaRoute } from "@rexeus/typeweaver-core";

// Hono
import { HonoHttpRequestHandler, HonoHttpRoute } from "@rexeus/typeweaver-core";
```

## Architecture

This library provides a foundation for building type-safe APIs with:

- **Definition Layer** - OpenAPI-style operation definitions with Zod schemas
- **Validation Layer** - Request/response validation with detailed error reporting
- **Router Layer** - Efficient route matching with framework adapters
- **Client Layer** - Abstract base for generating type-safe API clients

## Key Benefits

### Type Safety

Complete end-to-end type safety from API definition to runtime execution.

### Runtime Validation

Zod schemas provide both TypeScript types and runtime validation.

### Code Generation Ready

Abstract patterns designed for generating API clients and servers.

### Performance Optimized

Route matching uses preprocessing and caching for O(n) performance.

### Framework Agnostic

Core definitions work with any execution context via adapter pattern.

## Framework Adapters

typeweaver Core includes adapters for various runtime environments:

### AWS Lambda Adapters

```typescript
import {
  createAwsLambdaHandler,
  createAwsApiGatewayV1Handler,
  createAwsApiGatewayV2Handler,
  createAwsLambdaFunctionUrlHandler,
  createAwsAlbHandler,
} from "@rexeus/typeweaver-core";
```

### Hono Integration

```typescript
import { createHonoHttpApiHandler, HonoHttpRouter } from "@rexeus/typeweaver-core";
```

### Generic HTTP Adapters

```typescript
import { HttpAdapter, FetchApiAdapter } from "@rexeus/typeweaver-core";
```

## Validation System

Comprehensive request and response validation with structured error handling:

```typescript
import {
  RequestValidator,
  ResponseValidator,
  RequestValidationError,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";

const validator = new RequestValidator(operationDefinition);
const result = validator.safeValidate(request);

if (!result.isValid) {
  console.error(result.error.issues);
}
```
