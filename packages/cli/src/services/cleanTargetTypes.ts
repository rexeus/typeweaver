import fs from "node:fs";

export type CleanTargetFs = {
  readonly exists: (probePath: string) => boolean;
  readonly isSymbolicLink: (probePath: string) => boolean;
  readonly readFileString: (probePath: string) => string;
  readonly realPath: (probePath: string) => string;
};

export const defaultCleanTargetFs: CleanTargetFs = {
  exists: probePath => fs.existsSync(probePath),
  isSymbolicLink: probePath =>
    fs.lstatSync(probePath, { throwIfNoEntry: false })?.isSymbolicLink() ??
    false,
  readFileString: probePath => fs.readFileSync(probePath, "utf8"),
  realPath: probePath => fs.realpathSync.native(probePath),
};
