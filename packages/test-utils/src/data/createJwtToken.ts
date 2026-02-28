import { faker } from "@faker-js/faker";

/**
 * Creates a fake JWT token string for testing purposes.
 *
 * Generates a token in the standard `header.payload.signature` format
 * using random alphanumeric strings. Not a valid JWT — intended only
 * for testing authorization header parsing and token forwarding.
 *
 * @returns A fake JWT token string in `xxx.xxx.xxx` format
 */
export function createJwtToken(): string {
  const header = faker.string.alphanumeric(20);
  const payload = faker.string.alphanumeric(20);
  const signature = faker.string.alphanumeric(20);
  return `${header}.${payload}.${signature}`;
}
