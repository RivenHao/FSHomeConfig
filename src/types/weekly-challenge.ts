// 每周挑战赛相关类型定义

// 赛季类型
export interface Season {
  id: string;
  name: string;
  year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'ended' | 'settled';
  prize_description?: string;
  created_at: string;
  updated_at: string;
}

// 每周挑战赛类型
export interface WeeklyChallenge {
  id: string;
  season_id: string;
  title: string;
  description?: string;
  week_number: number;
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'ended';
  official_video_url?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // 关联数据
  season?: Season;
  modes?: ChallengeMode[];
  participant_count?: number;
}

// 挑战模式类型
export interface ChallengeMode {
  id: string;
  challenge_id: string;
  mode_type: 'simple' | 'hard';
  title: string;
  description: string;
  moves_required: string[];
  difficulty_level?: number;
  points_reward: number;
  demo_video_url?: string;
  created_at: string;
  // 关联数据
  challenge?: WeeklyChallenge;
}

// 用户参与记录类型
export interface UserParticipation {
  id: string;
  user_id: string;
  challenge_id: string;
  mode_id: string;
  video_url: string;
  thumbnail_url?: string;
  submission_note?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note?: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  // 关联数据
  weekly_challenges?: {
    title: string;
    week_number: number;
  };
  challenge_modes?: {
    mode_type: 'simple' | 'hard';
    title: string;
  };
  user_profile?: {
    nickname: string;
    image_url?: string;
  };
}

// 用户积分记录类型
export interface UserPoints {
  id: string;
  user_id: string;
  season_id: string;
  participation_id?: string;
  suggestion_id?: string;
  point_type: 'participation' | 'simple_completion' | 'hard_completion' | 'suggestion_adopted';
  points: number;
  description: string;
  earned_at: string;
  // 关联数据
  season?: Season;
  participation?: UserParticipation;
  suggestion?: UserSuggestion;
}

// 赛季排行榜类型
export interface SeasonLeaderboard {
  id: string;
  season_id: string;
  user_id: string;
  total_points: number;
  rank_position: number;
  participation_count: number;
  simple_completions: number;
  hard_completions: number;
  is_winner: boolean;
  prize_status: 'none' | 'pending' | 'shipped' | 'delivered';
  created_at: string;
  // 关联数据
  season?: Season;
  user_profile?: {
    nickname: string;
    image_url?: string;
  };
}

// 用户建议类型
export interface UserSuggestion {
  id: string;
  user_id: string;
  season_id: string;
  suggestion_text: string;
  status: 'pending' | 'adopted' | 'rejected';
  adopted_challenge_id?: string;
  admin_note?: string;
  created_at: string;
  updated_at: string;
  // 关联数据
  season?: Season;
  adopted_challenge?: WeeklyChallenge;
  user_profile?: {
    nickname: string;
    image_url?: string;
  };
}

// 通知类型
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content: string;
  related_id?: string;
  is_read: boolean;
  created_at: string;
}

// API 响应类型
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// 分页响应类型
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 创建/更新请求类型
export interface CreateSeasonRequest {
  name: string;
  year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  prize_description?: string;
}

export interface UpdateSeasonRequest extends Partial<CreateSeasonRequest> {
  status?: 'active' | 'ended' | 'settled';
}

export interface CreateChallengeRequest {
  season_id: string;
  title: string;
  description?: string;
  week_number: number;
  start_date: string;
  end_date: string;
  official_video_url?: string;
}

export interface UpdateChallengeRequest extends Partial<CreateChallengeRequest> {
  status?: 'draft' | 'active' | 'ended';
}

export interface CreateChallengeModeRequest {
  challenge_id: string;
  mode_type: 'simple' | 'hard';
  title: string;
  description: string;
  moves_required: string[];
  difficulty_level?: number;
  points_reward: number;
  demo_video_url?: string;
}

export type UpdateChallengeModeRequest = Partial<CreateChallengeModeRequest>;

export interface ReviewParticipationRequest {
  status: 'approved' | 'rejected';
  admin_note?: string;
}

export interface ProcessSuggestionRequest {
  status: 'adopted' | 'rejected';
  admin_note?: string;
  adopted_challenge_id?: string;
}

// 统计数据类型
export interface ChallengeStats {
  total_challenges: number;
  active_challenges: number;
  total_participants: number;
  pending_reviews: number;
}

export interface SeasonStats {
  total_seasons: number;
  active_season?: Season;
  total_points_awarded: number;
  top_users: Array<{
    user_id: string;
    nickname: string;
    total_points: number;
    rank_position: number;
  }>;
}

// 筛选参数类型
export interface ChallengeFilters {
  season_id?: string;
  status?: 'draft' | 'active' | 'ended';
  week_number?: number;
  search?: string;
}

export interface ParticipationFilters {
  challenge_id?: string;
  status?: 'pending' | 'approved' | 'rejected';
  user_id?: string;
  date_range?: [string, string];
}

export interface SuggestionFilters {
  season_id?: string;
  status?: 'pending' | 'adopted' | 'rejected';
  user_id?: string;
  date_range?: [string, string];
}