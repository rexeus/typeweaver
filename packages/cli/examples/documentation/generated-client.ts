import {
  CreateTodoRequestCommand,
  TodoClient,
} from "../../../test-utils/src/test-project/output/todo/index.js";

export const todoClient = new TodoClient({
  baseUrl: "https://api.example.com",
});

export const createTodoCommand = new CreateTodoRequestCommand({
  header: { Authorization: "Bearer token" },
  body: { title: "Executable documentation" },
});

export const createTodo = async (): Promise<string> => {
  const response = await todoClient.send(createTodoCommand);

  if (response.type === "CreateTodoSuccess") {
    return response.body.id;
  }
  if (response.type === "ValidationError") {
    return response.body.message;
  }
  return response.type;
};
