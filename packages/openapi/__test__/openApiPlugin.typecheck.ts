import { openApiPlugin } from "../src/index.js";

openApiPlugin({
  info: { title: "Typed API", version: "1.0.0" },
  outputPath: "docs/openapi.json",
});

// @ts-expect-error Direct TypeScript consumers must pass an options object.
openApiPlugin("invalid");

// @ts-expect-error The output path is a string when present.
openApiPlugin({ outputPath: 42 });
