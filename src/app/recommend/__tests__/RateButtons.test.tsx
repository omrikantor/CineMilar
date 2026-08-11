import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RateButtons } from "../RateButtons";
import { rateRecommendation } from "../actions";

vi.mock("../actions", () => ({
  rateRecommendation: vi.fn(),
}));

const mockedRate = vi.mocked(rateRecommendation);

const baseProps = {
  sourceTmdbId: 603,
  sourceMediaType: "movie" as const,
  candidateTmdbId: 604,
  candidateMediaType: "movie" as const,
  candidateTitle: "The Matrix Reloaded",
  candidatePosterPath: null,
};

describe("RateButtons", () => {
  beforeEach(() => {
    mockedRate.mockReset();
  });

  it("marks Like as pressed after a successful rating", async () => {
    const user = userEvent.setup();
    mockedRate.mockResolvedValue({});

    render(<RateButtons {...baseProps} initialRating={null} />);

    const likeButton = screen.getByRole("button", { name: /like/i });
    await user.click(likeButton);

    await waitFor(() => {
      expect(likeButton).toHaveAttribute("aria-pressed", "true");
    });
    expect(mockedRate).toHaveBeenCalledWith(
      expect.objectContaining({ candidateTmdbId: 604, rating: 1 })
    );
  });

  it("reverts the rating if saving fails", async () => {
    const user = userEvent.setup();
    mockedRate.mockResolvedValue({ error: "failed" });

    render(<RateButtons {...baseProps} initialRating={null} />);

    const likeButton = screen.getByRole("button", { name: /like/i });
    await user.click(likeButton);

    await waitFor(() => {
      expect(likeButton).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("reflects an existing rating on mount", () => {
    render(<RateButtons {...baseProps} initialRating={-1} />);
    expect(
      screen.getByRole("button", { name: /not for me/i })
    ).toHaveAttribute("aria-pressed", "true");
  });
});
