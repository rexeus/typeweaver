import { z } from "zod/v4";

export const accountActionCauserSchema = z.object({
  type: z.literal("ACCOUNT"),
  accountId: z.string(),
  cause: z.string(),
});

export const userActionCauserSchema = z.object({
  type: z.literal("USER"),
  userId: z.string(),
  cause: z.string(),
});

export const serviceActionCauserSchema = z.object({
  type: z.literal("SERVICE"),
  serviceCode: z.string(),
  cause: z.string(),
});

export const unknownActionCauserSchema = z.object({
  type: z.literal("UNKNOWN"),
  cause: z.string(),
});

const systemActionCauserSchema = z.object({
  type: z.literal("SYSTEM"),
  componentCode: z.string(),
  cause: z.string(),
});

export const actionCauserSchema = z.union([
  accountActionCauserSchema,
  userActionCauserSchema,
  serviceActionCauserSchema,
  unknownActionCauserSchema,
  systemActionCauserSchema,
]);

export const metadataSchema = z.object({
  createdAt: z.string(),
  modifiedAt: z.string(),
  createdBy: actionCauserSchema,
  modifiedBy: actionCauserSchema,
});
