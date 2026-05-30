import { z } from "zod";

export const ProspectProfileSchema = z.object({
  name: z.string(),
  headline: z.string(),
  role: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  background: z.string(),
  recentSignals: z.array(z.string()),
  technicalProfile: z.string().nullable(),
  interests: z.array(z.string()),
  likelyPainPoints: z.array(z.string()),
  personalizationHooks: z.array(z.string()),
});

export type ProspectProfile = z.infer<typeof ProspectProfileSchema>;
