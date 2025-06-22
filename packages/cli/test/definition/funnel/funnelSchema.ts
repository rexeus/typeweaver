import { z } from "zod/v4";
import { metadataSchema } from "../shared/schemas/metadataSchema";
import { emojiListItemSchema } from "../shared/schemas/emojiListItemSchema";

export const funnelSchema = z.object({
  // Technical identifiers
  id: z.ulid(),
  projectId: z.ulid(),

  // Basic information
  title: z.string().max(256),
  funnelHighlights: z.string().max(512),
  /**
   * @deprecated
   * Use funnelHighlights instead
   */
  description: z.string().max(512),

  // Job details
  jobTitle: z.string().max(256),
  isFullTime: z.boolean(),
  startAt: z.enum([
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
  ]),
  workplace: z.enum(["FULL_REMOTE", "HYBRID", "REMOTE_BY_CONSENT", "ON_SITE"]),
  requiredDegree: z.enum([
    "NO_REQUIREMENT",
    "LOWER_SECONDARY_SCHOOL",
    "INTERMEDIATE_SECONDARY_SCHOOL",
    "HIGHER_SECONDARY_SCHOOL",
    "VOCATIONAL_TRAINING",
    "BACHELOR",
    "MASTER",
  ]),

  // Company information
  companyDescription: z.string().max(512),
  aboutUs: z.array(emojiListItemSchema).max(8),
  benefits: z.array(emojiListItemSchema).max(8),

  // Candidate information
  applicantProfile: z.array(emojiListItemSchema).max(8),
  firstQualificationCheck: z.string().max(512),

  // Engagement content
  greeting: z.string().max(512),
  callToAction: z.string().max(512),

  // Media
  images: z
    .array(
      z.object({
        sequence: z.number().max(8),
        title: z.string().max(256),
        smallUrl: z.url(),
        mediumUrl: z.url(),
        largeUrl: z.url(),
        fallbackUrl: z.url(),
      })
    )
    .max(8),
  ...metadataSchema.shape,
});
