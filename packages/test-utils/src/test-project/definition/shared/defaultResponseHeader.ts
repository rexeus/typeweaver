import { z } from "zod/v4";

export const defaultResponseHeader = z.object({
  "Content-Type": z.literal("application/json"),
});
