import { Effect, Order, Ref, SortedSet } from "effect";

/**
 * Tracks every file path written during a generation run. Backed by a
 * `SortedSet<string>` so snapshots are deterministic by construction —
 * iteration order does not depend on insertion order, which is critical
 * once plugins write resources concurrently.
 *
 * Paths are stored as project-relative POSIX strings (the same form
 * `pluginContext.addGeneratedFile` already uses).
 */
export class GeneratedFiles extends Effect.Service<GeneratedFiles>()(
  "typeweaver/GeneratedFiles",
  {
    effect: Effect.gen(function* () {
      const empty = SortedSet.empty<string>(Order.string);
      const ref = yield* Ref.make(empty);

      return {
        add: (filePath: string): Effect.Effect<void> =>
          Ref.update(ref, (set) => SortedSet.add(set, filePath)),

        snapshot: Effect.map(Ref.get(ref), (set) =>
          Array.from(SortedSet.values(set))
        ),

        size: Effect.map(Ref.get(ref), SortedSet.size),

        clear: Ref.set(ref, empty),
      } as const;
    }),
    accessors: true,
  }
) {}
