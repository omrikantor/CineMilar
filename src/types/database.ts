export type MediaType = "movie" | "tv";

export type RecommendationRequest = {
  id: string;
  user_id: string;
  source_tmdb_id: number;
  source_media_type: MediaType;
  source_title: string;
  reasoning: string;
  created_at: string;
};

export type Recommendation = {
  id: string;
  request_id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  ai_explanation: string | null;
  rank_position: number | null;
  created_at: string;
};

export type RecommendationFeedback = {
  id: string;
  user_id: string;
  source_tmdb_id: number;
  source_media_type: MediaType;
  candidate_tmdb_id: number;
  candidate_media_type: MediaType;
  candidate_title: string;
  candidate_poster_path: string | null;
  rating: 1 | -1;
  created_at: string;
};

export type RecommendationFeedbackAggregate = {
  source_tmdb_id: number;
  candidate_tmdb_id: number;
  avg_rating: number;
  rating_count: number;
};
