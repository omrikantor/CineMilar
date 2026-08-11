import { describe, it, expect } from "vitest";
import {
  recommendationRequestSchema,
  parseRecommendationRequestForm,
  ratingSchema,
  loginCredentialsSchema,
  signupCredentialsSchema,
} from "@/lib/validation";

describe("recommendationRequestSchema", () => {
  const valid = {
    tmdbId: 603,
    mediaType: "movie" as const,
    title: "The Matrix",
    reasoning: "I loved the mind-bending premise.",
  };

  it("accepts valid input", () => {
    expect(recommendationRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing tmdbId", () => {
    const result = recommendationRequestSchema.safeParse({ ...valid, tmdbId: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid mediaType", () => {
    const result = recommendationRequestSchema.safeParse({
      ...valid,
      mediaType: "book",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty reasoning", () => {
    const result = recommendationRequestSchema.safeParse({ ...valid, reasoning: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects reasoning over 1000 characters", () => {
    const result = recommendationRequestSchema.safeParse({
      ...valid,
      reasoning: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe("parseRecommendationRequestForm", () => {
  it("extracts and validates fields from FormData", () => {
    const formData = new FormData();
    formData.set("tmdbId", "603");
    formData.set("mediaType", "movie");
    formData.set("title", "The Matrix");
    formData.set("reasoning", "Mind-bending premise.");

    const result = parseRecommendationRequestForm(formData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tmdbId).toBe(603);
    }
  });

  it("fails when no title was selected (tmdbId missing)", () => {
    const formData = new FormData();
    formData.set("mediaType", "movie");
    formData.set("title", "");
    formData.set("reasoning", "Something");

    expect(parseRecommendationRequestForm(formData).success).toBe(false);
  });
});

describe("ratingSchema", () => {
  const valid = {
    sourceTmdbId: 603,
    sourceMediaType: "movie" as const,
    candidateTmdbId: 604,
    candidateMediaType: "movie" as const,
    candidateTitle: "The Matrix Reloaded",
    candidatePosterPath: "/poster.jpg",
    rating: 1 as const,
  };

  it("accepts a valid like", () => {
    expect(ratingSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a valid dislike", () => {
    expect(ratingSchema.safeParse({ ...valid, rating: -1 }).success).toBe(true);
  });

  it("rejects a rating that isn't 1 or -1", () => {
    expect(ratingSchema.safeParse({ ...valid, rating: 0 }).success).toBe(false);
  });

  it("rejects a missing candidate title", () => {
    expect(ratingSchema.safeParse({ ...valid, candidateTitle: "" }).success).toBe(
      false
    );
  });
});

describe("loginCredentialsSchema", () => {
  it("rejects an empty password", () => {
    const result = loginCredentialsSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("signupCredentialsSchema", () => {
  it("rejects a password shorter than 6 characters", () => {
    const result = signupCredentialsSchema.safeParse({
      email: "user@example.com",
      password: "123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 6+ character password", () => {
    const result = signupCredentialsSchema.safeParse({
      email: "user@example.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });
});
