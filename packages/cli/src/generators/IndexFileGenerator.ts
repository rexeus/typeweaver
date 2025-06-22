import path from "path";
import { Generator } from "./Generator";
import fs from "fs";
import ejs from "ejs";
import type { GetResourcesResult } from "./ResourceReader";
import Case from "case";

export class IndexFileGenerator {
  public static generate(resources: GetResourcesResult): void {
    const templateFilePath = path.join(Generator.templateDir, "Index.ejs");
    const template = fs.readFileSync(templateFilePath, "utf8");

    const indexPaths: Set<string> = new Set();
    for (const [entityName, operationResources] of Object.entries(
      resources.entityResources
    )) {
      for (const operationResource of operationResources) {
        const pascalCaseEntityName = Case.pascal(entityName);
        const awsLambdaRouterPath = path.relative(
          Generator.outputDir,
          path.join(
            operationResource.outputDir,
            `${pascalCaseEntityName}AwsLambdaRouter`
          )
        );
        indexPaths.add(`./${awsLambdaRouterPath}`);
        const httpApiRouterPath = path.relative(
          Generator.outputDir,
          path.join(
            operationResource.outputDir,
            `${pascalCaseEntityName}HttpApiRouter`
          )
        );
        indexPaths.add(`./${httpApiRouterPath}`);
        const honoRouterPath = path.relative(
          Generator.outputDir,
          path.join(
            operationResource.outputDir,
            `${pascalCaseEntityName}HonoRouter`
          )
        );
        indexPaths.add(`./${honoRouterPath}`);
        const clientPath = path.relative(
          Generator.outputDir,
          path.join(
            operationResource.outputDir,
            `${pascalCaseEntityName}Client`
          )
        );
        indexPaths.add(`./${clientPath}`);
        const requestPath = path.relative(
          Generator.outputDir,
          operationResource.outputRequestFile
        );
        indexPaths.add(`./${requestPath.replace(".ts", "")}`);
        const requestValidationPath = path.relative(
          Generator.outputDir,
          operationResource.outputRequestValidationFile
        );
        indexPaths.add(`./${requestValidationPath.replace(".ts", "")}`);
        const responsePath = path.relative(
          Generator.outputDir,
          operationResource.outputResponseFile
        );
        indexPaths.add(`./${responsePath.replace(".ts", "")}`);
        const responseValidationPath = path.relative(
          Generator.outputDir,
          operationResource.outputResponseValidationFile
        );
        indexPaths.add(`./${responseValidationPath.replace(".ts", "")}`);
      }
    }

    for (const sharedResponseResource of resources.sharedResponseResources) {
      const sharedResponsePath = path.relative(
        Generator.outputDir,
        sharedResponseResource.outputFile
      );
      indexPaths.add(`./${sharedResponsePath.replace(".ts", "")}`);
    }

    const content = ejs.render(template, {
      indexPaths: Array.from(indexPaths),
    });

    fs.writeFileSync(path.join(Generator.outputDir, "index.ts"), content);
  }
}
