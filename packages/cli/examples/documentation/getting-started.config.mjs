/** @type {import("@rexeus/typeweaver-gen").TypeweaverConfig} */
const config = {
  input: "./api/spec/index.ts",
  output: "./api/generated",
  plugins: [
    "clients",
    [
      "openapi",
      {
        target: "3.1.2",
        servers: [{ url: "https://api.example.com" }],
        outputPath: "openapi/openapi.json",
      },
    ],
  ],
  format: true,
  clean: true,
};

export default config;
