/** @type {import("@rexeus/typeweaver-gen").TypeweaverConfig} */
const config = {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: [
    "clients",
    "command",
    "hono",
    "aws-cdk",
    [
      "openapi",
      {
        target: "3.2.0",
        outputPath: "openapi/openapi.json",
      },
    ],
  ],
  format: true,
  clean: true,
};

export default config;
