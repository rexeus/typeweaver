import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import {
  CreateTodoSuccessResponse,
  DeleteTodoSuccessResponse,
  UpdateTodoSuccessResponse,
  UpdateTodoStatusSuccessResponse,
  GetTodoSuccessResponse,
  ListTodosSuccessResponse,
  CreateSubTodoSuccessResponse,
  DeleteSubTodoSuccessResponse,
  UpdateSubTodoSuccessResponse,
  ListSubTodosSuccessResponse,
  QuerySubTodoSuccessResponse,
  QueryTodoSuccessResponse,
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
  type ICreateSubTodoRequest,
  type CreateSubTodoResponse,
  type IDeleteSubTodoRequest,
  type DeleteSubTodoResponse,
  type IUpdateSubTodoRequest,
  type UpdateSubTodoResponse,
  type IListSubTodosRequest,
  type ListSubTodosResponse,
  type IQuerySubTodoRequest,
  type QuerySubTodoResponse,
  type IQueryTodoRequest,
  type QueryTodoResponse,
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

    return new CreateTodoSuccessResponse({
      statusCode: HttpStatusCode.CREATED,
      header: {
        "Content-Type": "application/json",
      },
      body: createTodoOutput({
        title: request.body.title,
        description: request.body.description,
        status: "TODO",
        dueDate: request.body.dueDate,
        tags: request.body.tags,
        priority: request.body.priority,
      }),
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

    return new UpdateTodoSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: createTodoOutput({
        id: todoId,
        title: request.body.title,
        description: request.body.description,
        dueDate: request.body.dueDate,
        tags: request.body.tags,
        priority: request.body.priority,
      }),
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

  public async handleCreateSubTodoRequest(
    request: ICreateSubTodoRequest
  ): Promise<CreateSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    return new CreateSubTodoSuccessResponse({
      statusCode: HttpStatusCode.CREATED,
      header: {
        "Content-Type": "application/json",
      },
      body: createTodoOutput({
        parentId: todoId,
        title: request.body.title,
        description: request.body.description,
        status: "TODO",
        dueDate: request.body.dueDate,
        tags: request.body.tags,
        priority: request.body.priority,
      }),
    });
  }

  public async handleDeleteSubTodoRequest(
    request: IDeleteSubTodoRequest
  ): Promise<DeleteSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return new DeleteSubTodoSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: {
        message: "SubTodo deleted successfully",
      },
    });
  }

  public async handleUpdateSubTodoRequest(
    request: IUpdateSubTodoRequest
  ): Promise<UpdateSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId, subtodoId } = request.param;

    return new UpdateSubTodoSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: createTodoOutput({
        id: subtodoId,
        parentId: todoId,
        title: request.body.title,
        description: request.body.description,
        status: request.body.status,
        dueDate: request.body.dueDate,
        tags: request.body.tags,
        priority: request.body.priority,
      }),
    });
  }

  public async handleListSubTodosRequest(
    request: IListSubTodosRequest
  ): Promise<ListSubTodosResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;
    const items = Array.from({ length: 5 }, () =>
      createTodoOutput({ parentId: todoId })
    );

    return new ListSubTodosSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: {
        results: items,
        nextToken: faker.string.alphanumeric(20),
      },
    });
  }

  public async handleQuerySubTodoRequest(
    request: IQuerySubTodoRequest
  ): Promise<QuerySubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;
    const items = Array.from({ length: 3 }, () =>
      createTodoOutput({ parentId: todoId })
    );

    return new QuerySubTodoSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: {
        results: items,
        nextToken: faker.string.alphanumeric(20),
      },
    });
  }

  public async handleQueryTodoRequest(
    request: IQueryTodoRequest
  ): Promise<QueryTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const items = Array.from({ length: 8 }, () => createTodoOutput());

    return new QueryTodoSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: {
        results: items,
        nextToken: faker.string.alphanumeric(20),
      },
    });
  }
}
