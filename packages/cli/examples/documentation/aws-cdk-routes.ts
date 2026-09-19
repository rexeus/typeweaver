import { HttpMethod } from "@rexeus/typeweaver-core";
import { TodoHttpApiRoutes } from "../../../test-utils/src/test-project/output/todo/TodoHttpApiRoutes.js";

export const routes = new TodoHttpApiRoutes().getRoutes();

export const methodsByPath = routes.map(route => ({
  path: route.path,
  methods: route.methods,
}));

export const routeMethods = routes.flatMap(route => route.methods);

export const isGetRoute = (methods: HttpMethod[]) =>
  methods.includes(HttpMethod.GET);
