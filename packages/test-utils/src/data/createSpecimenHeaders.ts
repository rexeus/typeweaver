import { faker } from "@faker-js/faker";
import { createData } from "./createData";
import type {
  IPutSpecimenRequestHeader,
  IPutSpecimenSuccessResponseHeader,
} from "..";

export function createSpecimenRequestHeaders(
  input: Partial<IPutSpecimenRequestHeader> = {}
): IPutSpecimenRequestHeader {
  const defaults: IPutSpecimenRequestHeader = {
    "X-Foo": faker.lorem.word(),
    "X-Bar": faker.lorem.word(),
    "X-Baz": "baz",
    "X-Qux": faker.helpers.arrayElement(["qux1", "qux2"]),
    "X-Quux": [faker.lorem.word(), faker.lorem.word()],
    "X-UUID": faker.string.uuid(),
    "X-JWT": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    "X-URL": faker.internet.url(),
    "X-Email": faker.internet.email(),
    "X-Slugs": [faker.lorem.slug(), faker.lorem.slug()],
  };

  return createData(defaults, input);
}

export function createSpecimenResponseHeaders(
  input: Partial<IPutSpecimenSuccessResponseHeader> = {}
): IPutSpecimenSuccessResponseHeader {
  const defaults: IPutSpecimenSuccessResponseHeader = {
    "X-Foo": faker.lorem.word(),
    "X-Bar": faker.lorem.word(),
    "X-Baz": "baz",
    "X-Qux": faker.helpers.arrayElement(["qux1", "qux2"]),
    "X-Quux": [faker.lorem.word(), faker.lorem.word()],
    "X-UUID": faker.string.uuid(),
    "X-JWT": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    "X-URL": faker.internet.url(),
    "X-Email": faker.internet.email(),
    "X-Slugs": [faker.lorem.slug(), faker.lorem.slug()],
  };

  return createData(defaults, input);
}