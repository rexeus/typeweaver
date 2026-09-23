import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  ContradictorySecurityHeaderError,
  DuplicateTagNameError,
  InvalidApiMetadataError,
  UnknownTagError,
} from "../../src/index.js";
import { anOperation, aSpec, failureFrom, normalize } from "./fixtures.js";

describe("metadata and authorization validation", () => {
  test.each([
    {
      scenario: "an empty title",
      metadata: { title: " ", version: "1.0.0" },
    },
    {
      scenario: "an empty version",
      metadata: { title: "Metadata API", version: "" },
    },
    {
      scenario: "an empty tag name",
      metadata: {
        title: "Metadata API",
        version: "1.0.0",
        tags: [{ name: "" }],
      },
    },
  ])("rejects $scenario", ({ metadata }) => {
    expect(failureFrom(aSpec({ metadata }))).toBeInstanceOf(
      InvalidApiMetadataError
    );
  });

  test("rejects duplicate and unknown tags", () => {
    const duplicate = failureFrom(
      aSpec({
        metadata: {
          title: "Tags API",
          version: "1.0.0",
          tags: [{ name: "todos" }, { name: "todos" }],
        },
      })
    );
    const unknown = failureFrom(
      aSpec({
        resources: {
          todo: {
            tags: ["missing"],
            operations: [anOperation("listTaggedTodos")],
          },
        },
      })
    );

    expect(duplicate).toBeInstanceOf(DuplicateTagNameError);
    expect(unknown).toBeInstanceOf(UnknownTagError);
  });

  test("allows compatible Authorization validation and rejects contradictions", () => {
    const compatible = aSpec({
      resources: {
        todo: {
          operations: [
            anOperation("compatibleAuthorization", {
              authorization: z.string().startsWith("Bearer "),
            }),
          ],
        },
      },
    });
    const contradictory = aSpec({
      resources: {
        todo: {
          operations: [
            anOperation("contradictoryAuthorization", {
              authorization: z.literal("ApiKey only"),
            }),
          ],
        },
      },
    });

    expect(() => normalize(compatible)).not.toThrow();
    expect(failureFrom(contradictory)).toBeInstanceOf(
      ContradictorySecurityHeaderError
    );
  });
});
