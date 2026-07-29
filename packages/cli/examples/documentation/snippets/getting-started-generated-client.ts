import { GetTodoRequestCommand, TodoClient } from "./api/generated/index.js";

const client = new TodoClient({
  baseUrl: "https://api.example.com",
  timeoutMs: 10_000,
});

const response = await client.send(
  new GetTodoRequestCommand({
    param: {
      todoId: "846a8c8d-28dc-4b66-ae6c-8d1c551430b2",
    },
  })
);

switch (response.type) {
  case "GetTodoSuccess":
    console.log(response.body.title);
    break;

  case "TodoNotFound":
    console.error(response.body.message, response.body.todoId);
    break;
}
