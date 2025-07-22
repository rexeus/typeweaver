import { faker } from "@faker-js/faker";
import { createData } from "./createData";
import type {
  ICreateTodoRequestHeader,
  ICreateTodoSuccessResponseHeader,
} from "..";

export function createTodoRequestHeaders(
  input: Partial<ICreateTodoRequestHeader> = {}
): ICreateTodoRequestHeader {
  const defaults: ICreateTodoRequestHeader = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${faker.string.alphanumeric(20)}`,
  };

  return createData(defaults, input);
}

export function createTodoResponseHeaders(
  input: Partial<ICreateTodoSuccessResponseHeader> = {}
): ICreateTodoSuccessResponseHeader {
  const defaults: ICreateTodoSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}