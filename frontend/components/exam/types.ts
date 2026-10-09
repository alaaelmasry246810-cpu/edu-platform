export interface Question {
  index: number;
  type: string;
  question: string;
  options?: string[];
  points: number;
  explanation?: string;
}

export interface QuestionResult {
  q_index: number;
  type: string;
  question?: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean | null;
  points_earned: number | null;
  max_points: number;
  needs_manual: boolean;
  explanation?: string;
  options?: string[];
  why_wrong?: string | null;
}

export interface ExamData {
  attempt_id: string;
  questions: Question[];
  time_limit_seconds: number;
  max_score: number;
  pass_threshold: number;
}

export interface CheckFeedback {
  is_correct: boolean | null;
  correct_answer: string;
  explanation?: string | null;
  why_wrong?: string | null;
  points_earned: number | null;
  max_points: number;
  pending_review?: boolean;
}

export interface ExamResult {
  attempt_id: string;
  status: string;
  auto_score: number;
  total_score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  needs_manual_grading: boolean;
  question_results: QuestionResult[];
}
