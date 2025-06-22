import NotFoundErrorDefinition from "./NotFoundErrorDefinition";
import { z } from "zod/v4";

export default NotFoundErrorDefinition.extend({
  name: "AccountNotFoundError",
  description: "Account not found",
  body: z.object({
    message: z.literal("Account not found"),
    code: z.literal("ACCOUNT_NOT_FOUND_ERROR"),
    actualValues: z.object({
      accountId: z.ulid(),
    }),
  }),
});
