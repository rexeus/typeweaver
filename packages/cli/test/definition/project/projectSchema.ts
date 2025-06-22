import { z } from "zod/v4";
import { metadataSchema } from "../shared/schemas/metadataSchema";
import { adSchema } from "../ad/adSchema";

export const projectSchema = z.object({
  // Technical identifiers
  id: z.ulid(),
  accountId: z.ulid(),

  // Basic information
  title: z.string().min(3).max(256),
  status: z.enum([
    "INITIAL",
    "DRAFT",
    "REQUEST_GENERATION",
    "IN_GENERATION",
    "IN_REVIEW",
    "PUBLISHED",
    "WITHDRAWN",
  ]),
  isReadyForGeneration: z.boolean(),

  // Job details
  jobTitle: z.string().min(3).max(256).optional(),
  isFullTime: z.boolean().optional(),
  startAt: z
    .enum([
      "IMMEDIATE",
      "SPRING",
      "SUMMER",
      "AUTUMN",
      "WINTER",
      "JANUARY",
      "FEBRUARY",
      "MARCH",
      "APRIL",
      "MAY",
      "JUNE",
      "JULY",
      "AUGUST",
      "SEPTEMBER",
      "OCTOBER",
      "NOVEMBER",
      "DECEMBER",
    ])
    .optional(),
  workplace: z
    .enum(["FULL_REMOTE", "HYBRID", "REMOTE_BY_CONSENT", "ON_SITE"])
    .optional(),
  requiredDegree: z
    .enum([
      "NO_REQUIREMENT",
      "LOWER_SECONDARY_SCHOOL",
      "INTERMEDIATE_SECONDARY_SCHOOL",
      "HIGHER_SECONDARY_SCHOOL",
      "VOCATIONAL_TRAINING",
      "BACHELOR",
      "MASTER",
    ])
    .optional(),
  degreeTitle: z.string().min(3).max(256).optional(),

  // Company information
  companyName: z.string().min(3).max(256).optional(),
  aboutUs: z.string().min(32).max(1024).optional(),
  benefits: z.string().min(32).max(1024).optional(),

  // Candidate information
  applicantProfile: z.string().min(32).max(1024).optional(),

  // Selected content to publish
  selectedAdId: adSchema.shape.id.nullable().optional(),
  selectedFunnelId: adSchema.shape.id.nullable().optional(),
  ...metadataSchema.shape,
});
