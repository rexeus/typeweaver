import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateSubTodoSuccessResponse,
  createCreateTodoSuccessResponse,
  createDeleteSubTodoSuccessResponse,
  createDeleteTodoSuccessResponse,
  createGetTodoSuccessResponse,
  createListSubTodosSuccessResponse,
  createListTodosSuccessResponse,
  createOptionsTodoSuccessResponse,
  createQueryTodoSuccessResponse,
  createPutTodoSuccessResponse,
  createQuerySubTodoSuccessResponse,
  createUpdateSubTodoSuccessResponse,
  createUpdateTodoStatusSuccessResponse,
  createUpdateTodoSuccessResponse,
} from "../../data";
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
  public constructor(private readonly throwError?: Error | ITypedHttpResponse) {
    //
  }

  public async handleCreateTodoRequest(
    request: ICreateTodoRequest
  ): Promise<CreateTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createCreateTodoSuccessResponse({
      body: {
        ...request.body,
        status: "TODO",
      },
    });
  }

  public async handleDeleteTodoRequest(
    _request: IDeleteTodoRequest
  ): Promise<DeleteTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createDeleteTodoSuccessResponse();
  }

  public async handlePutTodoRequest(
    request: IPutTodoRequest
  ): Promise<PutTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    return createPutTodoSuccessResponse({
      body: {
        ...request.body,
        id: todoId,
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

    return createUpdateTodoSuccessResponse({
      body: {
        ...request.body,
        id: todoId,
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

    return createUpdateTodoStatusSuccessResponse({
      body: {
        id: todoId,
        status: request.body.value,
      },
    });
  }

  public async handleGetTodoRequest(
    request: IGetTodoRequest
  ): Promise<GetTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    return createGetTodoSuccessResponse({
      body: { id: todoId },
    });
  }

  public async handleListTodosRequest(
    _request: IListTodosRequest
  ): Promise<ListTodosResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createListTodosSuccessResponse();
  }

  public async handleCreateSubTodoRequest(
    request: ICreateSubTodoRequest
  ): Promise<CreateSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;

    return createCreateSubTodoSuccessResponse({
      body: {
        ...request.body,
        parentId: todoId,
      },
    });
  }

  public async handleDeleteSubTodoRequest(
    _request: IDeleteSubTodoRequest
  ): Promise<DeleteSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createDeleteSubTodoSuccessResponse();
  }

  public async handleUpdateSubTodoRequest(
    request: IUpdateSubTodoRequest
  ): Promise<UpdateSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId, subtodoId } = request.param;

    return createUpdateSubTodoSuccessResponse({
      body: {
        ...request.body,
        id: subtodoId,
        parentId: todoId,
      },
    });
  }

  public async handleListSubTodosRequest(
    _request: IListSubTodosRequest
  ): Promise<ListSubTodosResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createListSubTodosSuccessResponse();
  }

  public async handleQuerySubTodoRequest(
    _request: IQuerySubTodoRequest
  ): Promise<QuerySubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createQuerySubTodoSuccessResponse();
  }

  public async handleQueryTodoRequest(
    _request: IQueryTodoRequest
  ): Promise<QueryTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createQueryTodoSuccessResponse();
  }

  public async handleOptionsTodoRequest(
    _request: IOptionsTodoRequest
  ): Promise<OptionsTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createOptionsTodoSuccessResponse();
  }
}
