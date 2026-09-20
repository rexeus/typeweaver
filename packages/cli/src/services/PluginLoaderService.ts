import { Context, Layer } from "effect";
import { makePluginLoader } from "./PluginLoader.js";
import { PluginModuleLoader } from "./PluginModuleLoader.js";
import type { LoadParams, PluginLoaderShape } from "./PluginLoader.js";

export class PluginLoader extends Context.Service<
  PluginLoader,
  PluginLoaderShape
>()("typeweaver/PluginLoader") {
  static readonly make = (service: PluginLoaderShape) => service;

  static readonly DefaultWithoutDependencies: Layer.Layer<
    PluginLoader,
    never,
    PluginModuleLoader
  > = Layer.effect(PluginLoader, makePluginLoader);

  static readonly Default: Layer.Layer<PluginLoader> = Layer.effect(
    PluginLoader,
    makePluginLoader
  ).pipe(Layer.provide(PluginModuleLoader.Default));

  static readonly loadAll = (params: LoadParams) =>
    PluginLoader.use(service => service.loadAll(params));
}

export type { PluginLoaderShape } from "./PluginLoader.js";
