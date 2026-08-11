import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecommendForm } from "../RecommendForm";
import { createRecommendationRequest } from "../actions";

vi.mock("../actions", () => ({
  createRecommendationRequest: vi.fn(),
}));

const mockedAction = vi.mocked(createRecommendationRequest);

describe("RecommendForm", () => {
  beforeEach(() => {
    mockedAction.mockReset();
    global.fetch = vi.fn();
  });

  it("disables the submit button until a title is selected", () => {
    render(<RecommendForm />);
    expect(
      screen.getByRole("button", { name: /get recommendations/i })
    ).toBeDisabled();
  });

  it("shows the AI's error message after a failed submission", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        results: [
          {
            tmdbId: 603,
            title: "The Matrix",
            mediaType: "movie",
            year: "1999",
            posterUrl: null,
          },
        ],
      }),
    });
    mockedAction.mockResolvedValue({
      error: "Something went wrong generating recommendations. Please try again.",
    });

    render(<RecommendForm />);

    await user.type(screen.getByLabelText(/title you liked/i), "Matrix");
    const option = await screen.findByText(/The Matrix \(1999\)/i);
    await user.click(option);

    await user.type(
      screen.getByLabelText(/what did you like/i),
      "Loved the premise"
    );

    const submitButton = screen.getByRole("button", {
      name: /get recommendations/i,
    });
    expect(submitButton).toBeEnabled();
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
    });
  });
});
