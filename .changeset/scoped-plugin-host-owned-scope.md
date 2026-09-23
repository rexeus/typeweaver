---
"@rexeus/typeweaver-gen": minor
"@rexeus/typeweaver": minor
---

Let hosts own the lifetime of scoped plugins. A `Plugin` now declares its lifecycle hooks either
directly or through `acquire`, a scoped constructor that returns the hooks closed over the resources
it acquired. `defineScopedPlugin` keeps its authoring API and returns this form. The generator and
`createPluginTestKit` run each generation in a Scope they own, acquire scoped plugins at the
`initialize` stage in registration order, and release their resources in reverse order after
`finalize`, on success, typed failure, defect, and interruption. Hooks no longer depend on running
on the fiber that initialized them, so a host may run them under `Effect.timeout` or
`Effect.race`. The new `acquirePluginLifecycle` helper and the `PluginLifecycleHooks` and
`PluginAcquisition` types let other hosts, such as wrapper plugins, do the same. The plugin loader
accepts `acquire` and rejects a record that declares lifecycle hooks beside it.
