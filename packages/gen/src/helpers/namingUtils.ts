const CAMEL_CASE_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const PASCAL_CASE_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

export const isCamelCase = (value: string): boolean => {
  return CAMEL_CASE_PATTERN.test(value);
};

export const isPascalCase = (value: string): boolean => {
  return PASCAL_CASE_PATTERN.test(value);
};

const isSupportedIdentifierName = (value: string): boolean => {
  return isCamelCase(value) || isPascalCase(value);
};

export const isSupportedOperationId = (value: string): boolean => {
  return isSupportedIdentifierName(value);
};

export const isSupportedResourceName = (value: string): boolean => {
  return isSupportedIdentifierName(value);
};
