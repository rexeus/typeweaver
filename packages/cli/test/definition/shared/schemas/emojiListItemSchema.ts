import { z } from "zod/v4";

export const emojiListItemSchema = z.object({
  emoji: z.string().min(1),
  // TODO: max of 1 is not working for emojis.. check if an emoji has more than 1 character?
  // .max(1)
  text: z.string().min(1).max(256),
});
