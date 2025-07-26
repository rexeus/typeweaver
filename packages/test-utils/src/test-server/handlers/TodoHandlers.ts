import { HttpResponse } from "@rexeus/typeweaver-core";
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
  HeadTodoSuccessResponse,
  OptionsTodoSuccessResponse,
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
  type IHeadTodoRequest,
  type HeadTodoResponse,
  type IOptionsTodoRequest,
  type OptionsTodoResponse,
  createCreateTodoSuccessResponse,
  createDeleteTodoSuccessResponse,
  createUpdateTodoSuccessResponse,
  createUpdateTodoStatusSuccessResponse,
  createGetTodoSuccessResponse,
  createListTodosSuccessResponse,
  createCreateSubTodoSuccessResponse,
  createDeleteSubTodoSuccessResponse,
  createUpdateSubTodoSuccessResponse,
  createListSubTodosSuccessResponse,
  createQuerySubTodoSuccessResponse,
  createHeadTodoSuccessResponse,
  createOptionsTodoSuccessResponse,
} from "../..";

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

    const response = createCreateTodoSuccessResponse({
      body: {
        ...request.body,
        status: "TODO",
      },
    });

    return new CreateTodoSuccessResponse(response);
  }

  public async handleDeleteTodoRequest(
    request: IDeleteTodoRequest
  ): Promise<DeleteTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createDeleteTodoSuccessResponse();
    return new DeleteTodoSuccessResponse(response);
  }

  public async handleUpdateTodoRequest(
    request: IUpdateTodoRequest
  ): Promise<UpdateTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    const response = createUpdateTodoSuccessResponse({
      body: {
        ...request.body,
        id: todoId,
      },
    });

    return new UpdateTodoSuccessResponse(response);
  }

  public async handleUpdateTodoStatusRequest(
    request: IUpdateTodoStatusRequest
  ): Promise<UpdateTodoStatusResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    const response = createUpdateTodoStatusSuccessResponse({
      body: {
        id: todoId,
        status: request.body.value,
      },
    });

    return new UpdateTodoStatusSuccessResponse(response);
  }

  public async handleGetTodoRequest(
    request: IGetTodoRequest
  ): Promise<GetTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    const response = createGetTodoSuccessResponse({
      body: { id: todoId },
    });

    return new GetTodoSuccessResponse(response);
  }

  public async handleListTodosRequest(
    request: IListTodosRequest
  ): Promise<ListTodosResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createListTodosSuccessResponse();
    return new ListTodosSuccessResponse(response);
  }

  public async handleCreateSubTodoRequest(
    request: ICreateSubTodoRequest
  ): Promise<CreateSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    const response = createCreateSubTodoSuccessResponse({
      body: {
        ...request.body,
        parentId: todoId,
      },
    });

    return new CreateSubTodoSuccessResponse(response);
  }

  public async handleDeleteSubTodoRequest(
    request: IDeleteSubTodoRequest
  ): Promise<DeleteSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createDeleteSubTodoSuccessResponse();

    return new DeleteSubTodoSuccessResponse(response);
  }

  public async handleUpdateSubTodoRequest(
    request: IUpdateSubTodoRequest
  ): Promise<UpdateSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId, subtodoId } = request.param;

    const response = createUpdateSubTodoSuccessResponse({
      body: {
        ...request.body,
        id: subtodoId,
        parentId: todoId,
      },
    });

    return new UpdateSubTodoSuccessResponse(response);
  }

  public async handleListSubTodosRequest(
    _request: IListSubTodosRequest
  ): Promise<ListSubTodosResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createListSubTodosSuccessResponse();
    return new ListSubTodosSuccessResponse(response);
  }

  public async handleQuerySubTodoRequest(
    _request: IQuerySubTodoRequest
  ): Promise<QuerySubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createQuerySubTodoSuccessResponse();
    return new QuerySubTodoSuccessResponse(response);
  }

  public async handleQueryTodoRequest(
    _request: IQueryTodoRequest
  ): Promise<QueryTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createListTodosSuccessResponse();
    return new QueryTodoSuccessResponse(response);
  }

  public async handleHeadTodoRequest(
    _request: IHeadTodoRequest
  ): Promise<HeadTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createHeadTodoSuccessResponse();
    return new HeadTodoSuccessResponse(response);
  }

  public async handleOptionsTodoRequest(
    _request: IOptionsTodoRequest
  ): Promise<OptionsTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createOptionsTodoSuccessResponse({
      header: {
        Allow: "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
      },
    });
    return new OptionsTodoSuccessResponse(response);
  }
}
