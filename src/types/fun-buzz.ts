// Fun Buzz（skill check）后台类型
//
// 字段跟着 fshome-webapp/database/migrations/20261022_skill_check.sql 和
// 20261028_fun_buzz_moderation.sql 走。webapp 里有一份自己的类型
// （src/types/skill-check.ts），但那是前台视图模型（camelCase、已拼好
// videoUrl），这里是后台直接对着表的原始行，刻意保持 snake_case。

/** 三档可见性。代码里实际只用 visible 和 hidden，limited 是预留档 */
export type Visibility = 'visible' | 'limited' | 'hidden';

/** origin = 发起视频，answer = 跟拍的应答 */
export type EntryRole = 'origin' | 'answer';

/**
 * 档位。数据库值和前台 UI 文案是两套命名，别混：
 *   harder  → 加难
 *   replica → 复制
 *   simpler → 学习
 */
export type EntryTag = 'replica' | 'harder' | 'simpler';

export type ModerationTargetType = 'room' | 'entry' | 'comment' | 'featured';

export type ModerationAction =
  | 'hide'
  | 'unhide'
  | 'feature_add'
  | 'feature_remove'
  | 'feature_update';

/** 嵌套出来的作者信息。后台列表要能按邮箱找人，所以带上 email */
export interface FunBuzzUserBrief {
  id: string;
  nickname: string | null;
  email: string | null;
}

/** 房间（skill_checks 一行） */
export interface FunBuzzRoom {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  origin_type: 'move' | 'video';
  move_id: number | null;
  visibility: Visibility;
  /** 只数 role=answer，不含发起视频 */
  answers_count: number;
  entries_count: number;
  participants_count: number;
  views_count: number;
  last_answer_at: string | null;
  created_at: string;
  updated_at: string | null;
  // 关联数据
  user_profiles?: FunBuzzUserBrief | null;
  moves?: { id: number; move_name: string | null } | null;
  /** 该房间当前的推荐位配置，没配就是 null */
  featured?: FunBuzzFeaturedRow | null;
}

/** 投稿（skill_check_entries 一行） */
export interface FunBuzzEntry {
  id: string;
  skill_check_id: string;
  user_id: string;
  role: EntryRole;
  /** 发起视频没有档位 */
  tag: EntryTag | null;
  /** R2 object key，不是完整 URL。播放地址用 funBuzzVideoUrl() 拼 */
  video_key: string;
  thumbnail_url: string | null;
  note: string | null;
  visibility: Visibility;
  likes_count: number;
  comments_count: number;
  approve_count: number;
  reject_count: number;
  views_count: number;
  created_at: string;
  // 关联数据
  user_profiles?: FunBuzzUserBrief | null;
}

/** 评论（skill_check_comments 一行） */
export interface FunBuzzComment {
  id: string;
  entry_id: string;
  user_id: string;
  /** 非空表示这是一条回复 */
  parent_id: string | null;
  content: string;
  visibility: Visibility;
  likes_count: number;
  created_at: string;
  // 关联数据
  user_profiles?: FunBuzzUserBrief | null;
}

/** 首页推荐位（fun_buzz_featured_rooms 一行） */
export interface FunBuzzFeaturedRow {
  id: string;
  skill_check_id: string;
  /** 卡片上的推荐语，例：最热门buzz。只存一份，不做多语言 */
  label: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/** 推荐位列表项，带上房间信息 */
export interface FunBuzzFeaturedItem extends FunBuzzFeaturedRow {
  skill_checks?: Pick<
    FunBuzzRoom,
    'id' | 'title' | 'visibility' | 'entries_count' | 'views_count' | 'created_at'
  > | null;
}

/** 操作日志（skill_check_moderation_log 一行） */
export interface FunBuzzModerationLog {
  id: number;
  admin_id: string;
  admin_email: string | null;
  target_type: ModerationTargetType;
  target_id: string;
  action: ModerationAction;
  reason: string | null;
  /** 级联影响的行数，比如下架一条根评论连带藏了几条回复 */
  affected: number;
  created_at: string;
}

/** 房间列表的筛选条件 */
export interface FunBuzzRoomFilters {
  /** 房间名模糊匹配；粘一整串 uuid 进来则按 id 精确查 */
  search?: string;
  visibility?: Visibility | '';
}

// ---------------------------------------------------------------
// 展示用的小工具
// ---------------------------------------------------------------

/** 档位的中文名，和前台 UI 文案保持一致 */
export const ENTRY_TAG_LABEL: Record<EntryTag, string> = {
  harder: '加难',
  replica: '复制',
  simpler: '学习',
};

/** 档位色，取自设计稿 */
export const ENTRY_TAG_COLOR: Record<EntryTag, string> = {
  harder: '#FF6500',
  replica: '#00AEFF',
  simpler: '#8C8C8C',
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  visible: '正常',
  limited: '限流',
  hidden: '已下架',
};

/**
 * 把 R2 object key 拼成可播放地址。
 *
 * 库里存的是 key（videos/{userId}/xxx.mp4）而不是完整 URL，所以这里要拼。
 * NEXT_PUBLIC_R2_PUBLIC_URL 必须配（本地 .env 和 Vercel 都要），没配就返回
 * 空串，页面上会显示成「缺少 R2 配置」而不是一个坏链接。
 */
export function funBuzzVideoUrl(videoKey: string | null | undefined): string {
  if (!videoKey) return '';
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base) return '';
  return `${base.replace(/\/+$/, '')}/${videoKey.replace(/^\/+/, '')}`;
}

/**
 * 投稿的显示名。
 *
 * skill_check_entries 没有标题字段，所以用「作者 · 档位」当主标识，
 * note（备注）在列表里单独作副标题显示。
 */
export function funBuzzEntryName(entry: FunBuzzEntry): string {
  const who = entry.user_profiles?.nickname || entry.user_profiles?.email || '未知用户';
  const what = entry.role === 'origin' ? '发起视频' : ENTRY_TAG_LABEL[entry.tag ?? 'replica'];
  return `${who} · ${what}`;
}
