import assert from "node:assert";
import {
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createGetTodoRequest,
  createHeadTodoRequest,
  createOptionsTodoRequest,
  createPutTodoRequest,
  CreateTodoRequestCommand,
  createUpdateTodoRequest,
  DeleteTodoRequestCommand,
  GetTodoRequestCommand,
  HeadTodoRequestCommand,
  OptionsTodoRequestCommand,
  PutTodoRequestCommand,
  UpdateTodoRequestCommand,
} from "test-utils";
import { afterEach, describe, expect, test } from "vitest";
import { runClientCleanup, setupClientTest } from "./clientSetup.js";

afterEach(async () => {
  await runClientCleanup();
});

describe("Generated Client HTTP methods", () => {
  test("routes generated GET commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createGetTodoRequest();
    const command = new GetTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("GetTodoSuccess");
    assert(response.type === "GetTodoSuccess");
    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(requestData.param.todoId);
  });

  test("routes generated POST commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createCreateTodoRequest();
    const command = new CreateTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("CreateTodoSuccess");
    assert(response.type === "CreateTodoSuccess");
    expect(response.statusCode).toBe(201);
    expect(response.body.title).toBe(requestData.body.title);
  });

  test("routes generated JSON commands when literal request headers are omitted", async () => {
    const { client } = await setupClientTest();
    const requestData = createCreateTodoRequest();
    const command = new CreateTodoRequestCommand({
      header: { Authorization: requestData.header.Authorization },
      body: requestData.body,
    });

    const response = await client.send(command);

    expect(response.type).toBe("CreateTodoSuccess");
    assert(response.type === "CreateTodoSuccess");
    expect(response.statusCode).toBe(201);
    expect(response.body.title).toBe(requestData.body.title);
  });

  test("routes generated PUT commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createPutTodoRequest();
    const command = new PutTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("PutTodoSuccess");
    assert(response.type === "PutTodoSuccess");
    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(requestData.param.todoId);
  });

  test("routes generated PATCH commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createUpdateTodoRequest();
    const command = new UpdateTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("UpdateTodoSuccess");
    assert(response.type === "UpdateTodoSuccess");
    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(requestData.param.todoId);
    expect(response.body.title).toBe(requestData.body.title);
  });
});

describe("Generated Client additional HTTP methods", () => {
  test("routes generated DELETE commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createDeleteTodoRequest();
    const command = new DeleteTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("DeleteTodoSuccess");
    expect(response.statusCode).toBe(204);
    expect(response.body).toBeUndefined();
  });

  test("routes generated HEAD commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createHeadTodoRequest();
    const command = new HeadTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("HeadTodoSuccess");
    expect(response.statusCode).toBe(200);
    expect(response.header["Content-Type"]).toBe("application/json");
    expect(response.body).toBeUndefined();
  });

  test("routes generated OPTIONS commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createOptionsTodoRequest();
    const command = new OptionsTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("OptionsTodoSuccess");
    assert(response.type === "OptionsTodoSuccess");
    expect(response.statusCode).toBe(200);
    expect(response.header.Allow).toContain("PATCH");
  });
});
