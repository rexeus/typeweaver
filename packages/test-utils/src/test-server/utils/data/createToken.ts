import { faker } from "@faker-js/faker";

export function createToken(): string {
  const header = faker.string.alphanumeric(20);
  const payload = faker.string.alphanumeric(20);
  const signature = faker.string.alphanumeric(20);
  return `${header}.${payload}.${signature}`;
}
