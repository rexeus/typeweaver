import { ResourceReader } from "./ResourceReader";
import path from "path";
import { RequestGenerator } from "./RequestGenerator";
import fs from "fs";
import { ResponseGenerator } from "./ResponseGenerator";
import { Prettier } from "./Prettier";
import { RequestValidationGenerator } from "./RequestValidationGenerator";
import { ResponseValidationGenerator } from "./ResponseValidationGenerator";
import { ClientGenerator } from "./ClientGenerator";
import { SharedResponseGenerator } from "./SharedResponseGenerator";
import { HttpApiRouterGenerator } from "./HttpApiRouterGenerator";
import { AwsLambdaRouterGenerator } from "./AwsLambdaRouterGenerator";
import { HonoRouterGenerator } from "./HonoRouterGenerator";
import { fileURLToPath } from "url";
import { IndexFileGenerator } from "./IndexFileGenerator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Generator {
  public static outputDir: string;
  public static sourceDir: string;
  public static sharedSourceDir: string;
  public static sharedOutputDir: string;

  public static readonly coreDir = "@rexeus/typeweaver-core";
  public static readonly templateDir = path.join(__dirname, "templates");

  public static async generate(definitionDir: string, outputDir: string) {
    console.log("templateDir", this.templateDir);

    console.info("Starting generation...");

    this.outputDir = outputDir;
    this.sourceDir = definitionDir;
    this.sharedSourceDir = path.join(definitionDir, "shared");
    this.sharedOutputDir = path.join(outputDir, "shared");

    console.info("Cleaning output directory...");
    fs.rmSync(this.outputDir, { recursive: true, force: true });
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(this.sharedOutputDir, { recursive: true });

    console.info("Reading definitions...");
    const resources = await ResourceReader.getResources();

    console.info("Generating types and validators...");
    SharedResponseGenerator.generate(resources.sharedResponseResources);
    RequestGenerator.generate(resources);
    RequestValidationGenerator.generate(resources.entityResources);
    ResponseGenerator.generate(resources);
    ResponseValidationGenerator.generate(resources);
    ClientGenerator.generate(resources);
    HttpApiRouterGenerator.generate(resources.entityResources);
    AwsLambdaRouterGenerator.generate(resources.entityResources);
    HonoRouterGenerator.generate(resources.entityResources);
    IndexFileGenerator.generate(resources);

    await Prettier.formatCode();

    console.info("Generation complete!");
  }
}
