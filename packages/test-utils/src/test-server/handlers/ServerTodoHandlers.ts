import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateSubTodoSuccessResponse,
  createCreateTodoSuccessResponse,
  createDeleteSubTodoSuccessResponse,
  createDeleteTodoSuccessResponse,
  createGetTodoSuccessResponse,
  createListSubTodosSuccessResponse,
  createListTodosSuccessResponse,
  createOptionsTodoSuccessResponse,
  createPutTodoSuccessResponse,
  createQuerySubTodoSuccessResponse,
  CreateSubTodoSuccessResponse,
  CreateTodoSuccessResponse,
  createUpdateSubTodoSuccessResponse,
  createUpdateTodoStatusSuccessResponse,
  createUpdateTodoSuccessResponse,
  DeleteSubTodoSuccessResponse,
  DeleteTodoSuccessResponse,
  GetTodoSuccessResponse,
  ListSubTodosSuccessResponse,
  ListTodosSuccessResponse,
  OptionsTodoSuccessResponse,
  PutTodoSuccessResponse,
  QuerySubTodoSuccessResponse,
  QueryTodoSuccessResponse,
  UpdateSubTodoSuccessResponse,
  UpdateTodoStatusSuccessResponse,
  UpdateTodoSuccessResponse,
} from "../..";
import type {
  CreateSubTodoResponse,
  CreateTodoResponse,
  DeleteSubTodoResponse,
  DeleteTodoResponse,
  GetTodoResponse,
  ICreateSubTodoRequest,
  ICreateTodoRequest,
  IDeleteSubTodoRequest,
  IDeleteTodoRequest,
  IGetTodoRequest,
  IListSubTodosRequest,
  IListTodosRequest,
  IOptionsTodoRequest,
  IPutTodoRequest,
  IQuerySubTodoRequest,
  IQueryTodoRequest,
  IUpdateSubTodoRequest,
  IUpdateTodoRequest,
  IUpdateTodoStatusRequest,
  ListSubTodosResponse,
  ListTodosResponse,
  OptionsTodoResponse,
  PutTodoResponse,
  QuerySubTodoResponse,
  QueryTodoResponse,
  UpdateSubTodoResponse,
  UpdateTodoResponse,
  UpdateTodoStatusResponse,
} from "../..";
import type { ServerTodoApiHandler } from "../../test-project/output/todo/TodoRouter";

export class ServerTodoHandlers implements ServerTodoApiHandler {
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
    _request: IDeleteTodoRequest
  ): Promise<DeleteTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createDeleteTodoSuccessResponse();
    return new DeleteTodoSuccessResponse(response);
  }

  public async handlePutTodoRequest(
    request: IPutTodoRequest
  ): Promise<PutTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    const response = createPutTodoSuccessResponse({
      body: {
        ...request.body,
        id: todoId,
      },
    });

    return new PutTodoSuccessResponse(response);
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
    _request: IListTodosRequest
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
    _request: IDeleteSubTodoRequest
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

  public async handleOptionsTodoRequest(
    _request: IOptionsTodoRequest
  ): Promise<OptionsTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createOptionsTodoSuccessResponse();
    return new OptionsTodoSuccessResponse(response);
  }
}
