import { z } from "zod";

export const mediaTypeSchema = z.enum(["movie", "tv"]);

export const recommendationRequestSchema = z.object({
  tmdbId: z.number().int().positive({ message: "Please select a title from the search results." }),
  mediaType: mediaTypeSchema,
  title: z.string().trim().min(1, "Please select a title from the search results."),
  reasoning: z
    .string()
    .trim()
    .min(1, "Please describe what you liked about it.")
    .max(1000, "That's a bit long — please keep it under 1000 characters."),
});

export type RecommendationRequestInput = z.infer<typeof recommendationRequestSchema>;

export const ratingSchema = z.object({
  sourceTmdbId: z.number().int().positive(),
  sourceMediaType: mediaTypeSchema,
  candidateTmdbId: z.number().int().positive(),
  candidateMediaType: mediaTypeSchema,
  candidateTitle: z.string().trim().min(1),
  candidatePosterPath: z.string().nullable(),
  rating: z.union([z.literal(1), z.literal(-1)]),
});

export type RatingInput = z.infer<typeof ratingSchema>;

/** Parses raw FormData into the shape recommendationRequestSchema expects. */
export function parseRecommendationRequestForm(formData: FormData) {
  return recommendationRequestSchema.safeParse({
    tmdbId: Number(formData.get("tmdbId")),
    mediaType: formData.get("mediaType"),
    title: String(formData.get("title") ?? ""),
    reasoning: String(formData.get("reasoning") ?? ""),
  });
}

/** Returns the first validation error message, if any. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

export const loginCredentialsSchema = z.object({
  email: z.string().trim().min(1, "Email and password are required."),
  password: z.string().min(1, "Email and password are required."),
});

export const signupCredentialsSchema = z.object({
  email: z.string().trim().min(1, "Email and password are required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export function parseCredentialsForm(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}
