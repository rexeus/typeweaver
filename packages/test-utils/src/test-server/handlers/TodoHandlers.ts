import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import {
  CreateTodoSuccessResponse,
  DeleteTodoSuccessResponse,
  UpdateTodoSuccessResponse,
  UpdateTodoStatusSuccessResponse,
  GetTodoSuccessResponse,
  ListTodosSuccessResponse,
  type TodoApiHandler,
  type ICreateTodoRequest,
  type CreateTodoResponse,
  type IDeleteTodoRequest,
  type DeleteTodoResponse,
  type IUpdateTodoRequest,
  type UpdateTodoResponse,
  type IUpdateTodoStatusRequest,
  type UpdateTodoStatusResponse,
  type IGetTodoRequest,
  type GetTodoResponse,
  type IListTodosRequest,
  type ListTodosResponse,
} from "../..";
import { faker } from "@faker-js/faker";
import { createTodoOutput } from "../..";

export class TodoHandlers implements TodoApiHandler {
  public constructor(private readonly throwError?: Error | HttpResponse) {
    //
  }

  public async handleCreateTodoRequest(
    request: ICreateTodoRequest
  ): Promise<CreateTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const id = faker.string.uuid();
    const accountId = faker.string.uuid();
    const createdBy = faker.internet.username();
    const isoDate = faker.date.recent().toISOString();

    return new CreateTodoSuccessResponse({
      statusCode: HttpStatusCode.CREATED,
      header: {
        "Content-Type": "application/json",
      },
      body: {
        id,
        accountId,
        title: request.body.title,
        description: request.body.description,
        status: "TODO",
        dueDate: request.body.dueDate,
        tags: request.body.tags,
        priority: request.body.priority,
        createdAt: isoDate,
        modifiedAt: isoDate,
        createdBy,
        modifiedBy: createdBy,
      },
    });
  }

  public async handleDeleteTodoRequest(
    request: IDeleteTodoRequest
  ): Promise<DeleteTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return new DeleteTodoSuccessResponse({
      statusCode: HttpStatusCode.NO_CONTENT,
      header: {
        "Content-Type": "application/json",
      },
    });
  }

  public async handleUpdateTodoRequest(
    request: IUpdateTodoRequest
  ): Promise<UpdateTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;
    const accountId = faker.string.uuid();
    const modifiedBy = faker.internet.username();
    const createdBy = faker.internet.username();
    const createdAt = faker.date.past().toISOString();
    const modifiedAt = new Date().toISOString();

    return new UpdateTodoSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: {
        id: todoId,
        accountId,
        title: request.body.title ?? faker.lorem.sentence(),
        description: request.body.description ?? faker.lorem.paragraph(),
        status: "TODO",
        dueDate: request.body.dueDate ?? faker.date.future().toISOString(),
        tags: request.body.tags ?? [faker.lorem.word(), faker.lorem.word()],
        priority:
          request.body.priority ??
          faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"]),
        createdAt,
        modifiedAt,
        createdBy,
        modifiedBy,
      },
    });
  }

  public async handleUpdateTodoStatusRequest(
    request: IUpdateTodoStatusRequest
  ): Promise<UpdateTodoStatusResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    return new UpdateTodoStatusSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: createTodoOutput({
        id: todoId,
        status: request.body.value,
        modifiedAt: new Date().toISOString(),
      }),
    });
  }

  public async handleGetTodoRequest(
    request: IGetTodoRequest
  ): Promise<GetTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    return new GetTodoSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: createTodoOutput({ id: todoId }),
    });
  }

  public async handleListTodosRequest(
    request: IListTodosRequest
  ): Promise<ListTodosResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const results = Array.from({ length: 10 }, () => createTodoOutput());

    return new ListTodosSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: {
        results,
        nextToken: faker.string.alphanumeric(20),
      },
    });
  }
}
