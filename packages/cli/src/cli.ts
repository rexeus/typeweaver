import { Generator } from "./generators/Generator";
import { Command, type CommandOptions as CommanderOptions } from "commander";
import packageJson from "../package.json";
import path from "path";

type CommandOptions = CommanderOptions & {
  input?: string;
  output?: string;
};

const program = new Command();
const execDir = process.cwd();

program
  .name("@rexeus/api-definition")
  .description(
    "CLI to generate types, validators and clients from Api-Definitions"
  )
  .version(packageJson.version);

program
  .command("generate")
  .description("Generate the Client")
  .option("-i, --input <inputDir>", "path to definition dir")
  .option("-o, --output <outputDir>", "output dir for generated files")
  .action((options: CommandOptions) => {
    if (!options.input) {
      throw new Error("No argument for 'input' provided");
    }
    if (!options.output) {
      throw new Error("No argument for 'output' provided");
    }

    const inputDir = path.join(execDir, options.input);
    const outputDir = path.join(execDir, options.output);
    return Generator.generate(inputDir, outputDir);
  });

program.parse(process.argv);
