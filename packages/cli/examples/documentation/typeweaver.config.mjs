/** @type {import("@rexeus/typeweaver-gen").TypeweaverConfig} */
const config = {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: [
    "clients",
    "hono",
    "aws-cdk",
    [
      "openapi",
      {
        info: { title: "Todo API", version: "1.0.0" },
        outputPath: "openapi/openapi.json",
      },
    ],
  ],
  format: true,
  clean: true,
};

export default config;
