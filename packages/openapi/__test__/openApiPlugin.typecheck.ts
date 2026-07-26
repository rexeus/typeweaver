import { openApiPlugin } from "../src/index.js";

openApiPlugin({
  target: "3.2.0",
  outputPath: "docs/openapi.json",
});

// @ts-expect-error Direct TypeScript consumers must pass an options object.
openApiPlugin("invalid");

// @ts-expect-error The output path is a string when present.
openApiPlugin({ outputPath: 42 });

// @ts-expect-error Only the documented OpenAPI profiles are accepted.
openApiPlugin({ target: "3.1.1" });
