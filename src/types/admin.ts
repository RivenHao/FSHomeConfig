// 管理员用户类型
export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 用户信息类型
export interface UserProfile {
  id: string;
  nickname: string | null;
  image_url: string | null;
  age: number | null;
  total_score: number | null;
  rank_id: number | null;
  experience_years: number | null;
  location: string | null;
  email: string | null;
  created_at: string | null;
  updated_at: string | null;
  unlocked_moves_count: number | null;
}

// 招式类型
export interface Move {
  id: number;
  created_at: string;
  move_name: string | null;
  main_type: string | null;
  sub_type: string | null;
  move_diff: string | null;
  move_desc: string | null;
  move_url: string | null;
  move_creater: string | null;
  move_score: number | null;
}

// 用户招式提交类型
export interface UserMoveSubmission {
  id: string;
  user_id: string;
  move_id: number;
  video_url: string;
  thumbnail_url: string | null;
  submission_note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  // 关联数据
  user_profiles?: { nickname: string | null; email: string | null };
  moves?: Move;
}

// 招式心得类型
export interface MoveTip {
  id: string;
  move_id: number;
  user_id: string;
  tip_content: string;
  is_approved: boolean;
  created_at: string | null;
  updated_at: string | null;
  // 关联数据
  user_profiles?: { nickname: string | null; email: string | null };
  moves?: { move_name: string | null; main_type: string | null; sub_type: string | null };
}

// 分页参数类型
export interface PaginationParams {
  page: number;
  pageSize: number;
  total?: number;
}

// 筛选参数类型
export interface FilterParams {
  status?: string;
  move_type?: string;
  date_range?: [string, string];
  search?: string;
}

// 审核操作类型
export interface ReviewAction {
  id: string;
  action: 'approve' | 'reject';
  note?: string;
}
