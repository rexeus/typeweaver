import fs from "node:fs";
import { transformSync } from "oxc-transform";

const files = ["Validator", "RequestValidator", "ResponseValidator", "assert"];

for (const file of files) {
  const source = fs.readFileSync(`src/lib/${file}.ts`, "utf-8");
  const { code } = transformSync(`${file}.ts`, source, {
    lang: "ts",
    sourceType: "module",
  });
  fs.writeFileSync(`dist/lib/${file}.js`, code);
}
