function splitWords(input: string): string[] {
  return input
    .trim()
    .replace(/[_\-\s]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map(word => word.toLowerCase());
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function toPascalCase(input: string): string {
  return splitWords(input).map(capitalize).join("");
}

export function toCamelCase(input: string): string {
  const [firstWord = "", ...remainingWords] = splitWords(input);

  return firstWord + remainingWords.map(capitalize).join("");
}
