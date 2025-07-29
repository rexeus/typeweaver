import { createData } from "./createData";

export function createDataFactory<T>(getDefaults: () => T): (input?: Partial<T>) => T {
  return (input: Partial<T> = {}) => createData(getDefaults(), input);
}
