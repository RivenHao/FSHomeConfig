import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 数据库表名常量
export const TABLES = {
  ADMIN_USERS: 'admin_users',
  USER_PROFILES: 'user_profiles',
  MOVES: 'moves',
  USER_MOVE_SUBMISSIONS: 'user_move_submissions',
  MOVE_TIPS: 'move_tips',
  USER_MOVES_UNLOCK: 'user_moves_unlock',
  COMMUNITY_VIDEOS: 'community_videos',
  ACHIEVEMENT_CATEGORIES: 'achievement_categories',
  ACHIEVEMENTS: 'achievements',
} as const;
