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
  move_diff: number | null;
  move_desc: string | null;
  move_url: string | null;
  move_gif: string | null;
  move_creater: string | null;
  move_score: number | null;
  move_cn: string | null;
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

// 招式大类类型
export interface MoveCategory {
  id: number;
  category_name: string;
  category_code: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 招式小类类型
export interface MoveSubCategory {
  id: number;
  category_id: number;
  sub_name: string;
  sub_code: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // 关联数据
  category?: MoveCategory;
}

// 招式分类组合类型
export interface MoveCategoryWithSub {
  category_id: number;
  category_name: string;
  category_code: string;
  category_description?: string;
  category_sort: number;
  category_active: boolean;
  sub_category_id?: number;
  sub_name?: string;
  sub_code?: string;
  sub_description?: string;
  sub_sort?: number;
  sub_active?: boolean;
}

// 社区交流视频类型
export interface CommunityVideo {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  file_size: number | null;
  tags: string[] | null;
  is_public: boolean | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  status: 'pending' | 'approved' | 'rejected';
  // 关联数据
  user_profiles?: { nickname: string | null; email: string | null };
}

// 成就类型
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon_url: string | null;
  difficulty: number; // 1-5
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // 关联数据
  move_ids?: number[]; // 关联的招式ID列表
  moves_count?: number; // 关联的招式数量
}
