import { funnelSchema } from "./funnelSchema";

export const publicFunnelSchema = funnelSchema.pick({
  id: true,
  title: true,
  jobTitle: true,
  isFullTime: true,
  startAt: true,
  workplace: true,
  requiredDegree: true,
  companyDescription: true,
  aboutUs: true,
  benefits: true,
  applicantProfile: true,
  firstQualificationCheck: true,
  greeting: true,
  callToAction: true,
  images: true,
});
