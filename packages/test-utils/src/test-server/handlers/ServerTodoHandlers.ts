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
} from "../../data/index.js";
import {
  CreateSubTodoDefinition,
  CreateTodoDefinition,
  PutTodoDefinition,
  UpdateSubTodoDefinition,
  UpdateTodoDefinition,
  UpdateTodoStatusDefinition,
} from "../../test-project/spec/todo/index.js";
import type {
  CreateSubTodoResponse,
  CreateTodoResponse,
  DeleteSubTodoResponse,
  DeleteTodoResponse,
  GetTodoResponse,
  IRawCreateSubTodoRequest,
  IRawCreateTodoRequest,
  IRawDeleteSubTodoRequest,
  IRawDeleteTodoRequest,
  IRawGetTodoRequest,
  IRawListSubTodosRequest,
  IRawListTodosRequest,
  IRawOptionsTodoRequest,
  IRawPutTodoRequest,
  IRawQuerySubTodoRequest,
  IRawQueryTodoRequest,
  IRawUpdateSubTodoRequest,
  IRawUpdateTodoRequest,
  IRawUpdateTodoStatusRequest,
  ListSubTodosResponse,
  ListTodosResponse,
  OptionsTodoResponse,
  PutTodoResponse,
  QuerySubTodoResponse,
  QueryTodoResponse,
  UpdateSubTodoResponse,
  UpdateTodoResponse,
  UpdateTodoStatusResponse,
} from "../../index.js";
import type { ServerTodoApiHandler } from "../../test-project/output/todo/TodoRouter.js";

export class ServerTodoHandlers implements ServerTodoApiHandler<
  Record<string, unknown>,
  boolean
> {
  public constructor(private readonly throwError?: Error | ITypedHttpResponse) {
    //
  }

  public async handleCreateTodoRequest(
    request: IRawCreateTodoRequest
  ): Promise<CreateTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }
    const body = CreateTodoDefinition.request.body.parse(request.body);

    return createCreateTodoSuccessResponse({
      body: {
        ...body,
        status: "TODO",
      },
    });
  }

  public async handleDeleteTodoRequest(
    _request: IRawDeleteTodoRequest
  ): Promise<DeleteTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createDeleteTodoSuccessResponse();
  }

  public async handlePutTodoRequest(
    request: IRawPutTodoRequest
  ): Promise<PutTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;
    const body = PutTodoDefinition.request.body.parse(request.body);

    return createPutTodoSuccessResponse({
      body: {
        ...body,
        id: todoId,
      },
    });
  }

  public async handleUpdateTodoRequest(
    request: IRawUpdateTodoRequest
  ): Promise<UpdateTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;
    const body = UpdateTodoDefinition.request.body.parse(request.body);

    return createUpdateTodoSuccessResponse({
      body: {
        ...body,
        id: todoId,
      },
    });
  }

  public async handleUpdateTodoStatusRequest(
    request: IRawUpdateTodoStatusRequest
  ): Promise<UpdateTodoStatusResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;
    const body = UpdateTodoStatusDefinition.request.body.parse(request.body);

    return createUpdateTodoStatusSuccessResponse({
      body: {
        id: todoId,
        status: body.value,
      },
    });
  }

  public async handleGetTodoRequest(
    request: IRawGetTodoRequest
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
    _request: IRawListTodosRequest
  ): Promise<ListTodosResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createListTodosSuccessResponse();
  }

  public async handleCreateSubTodoRequest(
    request: IRawCreateSubTodoRequest
  ): Promise<CreateSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId } = request.param;
    const body = CreateSubTodoDefinition.request.body.parse(request.body);

    return createCreateSubTodoSuccessResponse({
      body: {
        ...body,
        parentId: todoId,
      },
    });
  }

  public async handleDeleteSubTodoRequest(
    _request: IRawDeleteSubTodoRequest
  ): Promise<DeleteSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createDeleteSubTodoSuccessResponse();
  }

  public async handleUpdateSubTodoRequest(
    request: IRawUpdateSubTodoRequest
  ): Promise<UpdateSubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const { todoId, subtodoId } = request.param;
    const body = UpdateSubTodoDefinition.request.body.parse(request.body);

    return createUpdateSubTodoSuccessResponse({
      body: {
        ...body,
        id: subtodoId,
        parentId: todoId,
      },
    });
  }

  public async handleListSubTodosRequest(
    _request: IRawListSubTodosRequest
  ): Promise<ListSubTodosResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createListSubTodosSuccessResponse();
  }

  public async handleQuerySubTodoRequest(
    _request: IRawQuerySubTodoRequest
  ): Promise<QuerySubTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createQuerySubTodoSuccessResponse();
  }

  public async handleQueryTodoRequest(
    request: IRawQueryTodoRequest
  ): Promise<QueryTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const nextToken = request.query?.nextToken;

    if (nextToken === undefined) {
      return createQueryTodoSuccessResponse();
    }

    return createQueryTodoSuccessResponse({
      body: { nextToken },
    });
  }

  public async handleOptionsTodoRequest(
    _request: IRawOptionsTodoRequest
  ): Promise<OptionsTodoResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createOptionsTodoSuccessResponse();
  }
}
