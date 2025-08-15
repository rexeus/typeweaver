# @rexeus/typeweaver-hono

typeweaver plugin for generating type-safe Hono routers from HTTP operation definitions.

## Overview

This plugin generates Hono router classes that automatically handle request validation, type-safe
routing, and error responses. Each entity gets its own router class extending `TypeweaverHono` with
full TypeScript type inference.

## Installation

```bash
npm install @rexeus/typeweaver-hono
```

## Usage

```bash
# Via CLI
npx typeweaver generate --plugins hono --input ./definitions --output ./generated

# Via config file
npx typeweaver generate --config ./typeweaver.config.js
```

```javascript
// typeweaver.config.js
export default {
  input: "./api/definitions",
  output: "./api/generated",
  plugins: ["hono"],
};
```

## Example

## Features

- **Type-safe route handlers** - Full TypeScript inference for requests and responses
- **Automatic request validation** - Built-in validation using generated validators
- **Configurable error handling** - Customize validation and error responses
- **Pure Hono compatibility** - Works with all Hono middleware and features

## Configuration Options

```typescript
new ProjectHono({
  requestHandlers: handlers,

  // Optional configurations, for example:
  validateRequests: false, // Disable automatic validation
  handleValidationErrors: false, // Let validation errors bubble up
  handleHttpResponseErrors: true, // Handle thrown HttpResponse errors
  handleUnknownErrors: customHandler, // Custom error handler function
});
```

## License

Apache 2.0 © Dennis Wentzien 2025
