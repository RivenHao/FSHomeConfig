import { supabase, TABLES } from './supabase';
import type {
  FunBuzzComment,
  FunBuzzEntry,
  FunBuzzFeaturedItem,
  FunBuzzModerationLog,
  FunBuzzRoom,
  FunBuzzRoomFilters,
  ModerationTargetType,
  Visibility,
} from '@/types/fun-buzz';
import type { PaginationParams } from '@/types/admin';

// =================================================================
// Fun Buzz 运营查询
// =================================================================
// 两点和 admin-queries.ts 里的既有写法不一样，是刻意的：
//
//   1. 关联数据用 PostgREST 嵌套查询，不是逐行再查一次。
//      getCommunityVideos 那种 Promise.all 里按行查 user_profiles 是 N+1，
//      一页 20 条就是 21 次往返。
//
//   2. 嵌套 user_profiles 必须写成 user_profiles!creator_id 这种带外键提示
//      的形式。skill_checks 和 user_profiles 之间不止一条可推导路径，不给
//      提示 PostgREST 会直接报 PGRST201（embedding ambiguous）。
//
// 所有写操作都走 rpc，因为库里对这几张表一个 INSERT/UPDATE/DELETE 权限都
// 没开（见 20261028_fun_buzz_moderation.sql §6 / §7.1）。好处是改状态和写
// 审计日志一定同时发生。
// =================================================================

const ROOM_SELECT = `
  *,
  user_profiles!creator_id(id, nickname, email),
  moves!move_id(id, move_name),
  fun_buzz_featured_rooms(id, skill_check_id, label, sort_order, is_active, created_at, updated_at, created_by)
`;

/** PostgREST 对反向关联一律返回数组，这里压成 0..1（表上有 unique 约束） */
function normalizeRoom(row: Record<string, unknown>): FunBuzzRoom {
  const { fun_buzz_featured_rooms: featured, ...rest } = row;
  const list = Array.isArray(featured) ? featured : featured ? [featured] : [];
  return {
    ...(rest as unknown as FunBuzzRoom),
    featured: list.length > 0 ? list[0] : null,
  };
}

/**
 * 房间列表。
 *
 * 能查到已下架的房间，靠的是 sc_select_visible 策略里的 `or is_admin()`
 * 分支。普通用户查同一张表看不到 hidden 的行。
 */
export async function getFunBuzzRooms(
  params: PaginationParams & FunBuzzRoomFilters
) {
  let query = supabase
    .from(TABLES.SKILL_CHECKS)
    .select(ROOM_SELECT, { count: 'exact' });

  if (params.visibility) {
    query = query.eq('visibility', params.visibility);
  }

  if (params.search) {
    const keyword = params.search.trim();
    // uuid 整串粘进来时按 id 精确查，方便从前台链接直接定位房间
    if (/^[0-9a-f-]{36}$/i.test(keyword)) {
      query = query.eq('id', keyword);
    } else {
      query = query.ilike('title', `%${keyword}%`);
    }
  }

  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  const { data, error, count } = await query
    .range(from, to)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { data: null, error, total: count || 0 };
  }

  return {
    data: (data as unknown as Record<string, unknown>[]).map(normalizeRoom),
    error: null,
    total: count || 0,
  };
}

/**
 * 房间内的投稿列表（需求里的「详情(具体视频列表)」）。
 *
 * 不分页：一个房间的视频数量级很小，而且运营要的是一眼看全。
 * 排序上发起视频永远排第一，其余按时间正序，和前台播放列表一致。
 */
export async function getRoomEntries(roomId: string) {
  const { data, error } = await supabase
    .from(TABLES.SKILL_CHECK_ENTRIES)
    .select('*, user_profiles!user_id(id, nickname, email)')
    .eq('skill_check_id', roomId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return { data: null, error };
  }

  const rows = data as unknown as FunBuzzEntry[];
  const sorted = [...rows].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'origin' ? -1 : 1;
    return a.created_at.localeCompare(b.created_at);
  });

  return { data: sorted, error: null };
}

/**
 * 投稿内的评论列表（需求里的「详情(评论区)」）。
 *
 * 两级结构摊平返回，靠 parent_id 自己分组。上限 500 条，超了先让运营用
 * 下架处理掉再看——真要翻几千条评论的话该做分页，但目前没有这种房间。
 */
export async function getEntryComments(entryId: string) {
  const { data, error } = await supabase
    .from(TABLES.SKILL_CHECK_COMMENTS)
    .select('*, user_profiles!user_id(id, nickname, email)')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error || !data) {
    return { data: null, error };
  }

  return { data: data as unknown as FunBuzzComment[], error: null };
}

/**
 * 下架 / 恢复。
 *
 * 走 sc_moderate()，它会在同一个事务里改 visibility 并写审计日志。
 * 返回受影响行数：下架根评论时会把它的回复一起藏起来，所以可能大于 1。
 *
 * 状态本来就是目标状态时返回 0，什么都不会发生，也不记日志。
 */
export async function moderateFunBuzzContent(
  targetType: Exclude<ModerationTargetType, 'featured'>,
  targetId: string,
  hidden: boolean,
  reason?: string
) {
  const { data, error } = await supabase.rpc('sc_moderate', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_hidden: hidden,
    p_reason: reason?.trim() || null,
  });

  if (error) {
    return { affected: 0, error: translateRpcError(error) };
  }

  return { affected: (data as number) ?? 0, error: null };
}

/** 推荐位列表。带上房间信息，房间已下架的会标出来提醒运营换掉 */
export async function getFeaturedRooms() {
  const { data, error } = await supabase
    .from(TABLES.FUN_BUZZ_FEATURED_ROOMS)
    .select(`
      *,
      skill_checks!skill_check_id(id, title, visibility, entries_count, views_count, created_at)
    `)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { data: null, error };
  }

  return { data: data as unknown as FunBuzzFeaturedItem[], error: null };
}

/**
 * 加入或更新推荐位。
 *
 * upsert 语义：同一个房间重复提交就是改它的推荐语和排序，不会撞唯一约束。
 */
export async function setFeaturedRoom(input: {
  skillCheckId: string;
  label?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const { data, error } = await supabase.rpc('sc_set_featured', {
    p_skill_check_id: input.skillCheckId,
    p_label: input.label?.trim() || null,
    p_sort_order: input.sortOrder ?? 0,
    p_is_active: input.isActive ?? true,
  });

  if (error) {
    return { data: null, error: translateRpcError(error) };
  }

  return { data: data as string, error: null };
}

/** 从推荐位移除。注意传的是房间 id，不是推荐位行的 id */
export async function removeFeaturedRoom(skillCheckId: string) {
  const { data, error } = await supabase.rpc('sc_remove_featured', {
    p_skill_check_id: skillCheckId,
  });

  if (error) {
    return { affected: 0, error: translateRpcError(error) };
  }

  return { affected: (data as number) ?? 0, error: null };
}

/**
 * 给推荐位弹窗用的房间搜索。
 *
 * 只返回未下架的房间——给一个用户看不到的房间配首页推荐位没有意义。
 */
export async function searchRoomsForFeature(keyword: string) {
  const word = keyword.trim();
  if (!word) return { data: [], error: null };

  let query = supabase
    .from(TABLES.SKILL_CHECKS)
    .select('id, title, visibility, entries_count, views_count, created_at')
    .eq('visibility', 'visible');

  if (/^[0-9a-f-]{36}$/i.test(word)) {
    query = query.eq('id', word);
  } else {
    query = query.ilike('title', `%${word}%`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) {
    return { data: null, error };
  }

  return { data, error: null };
}

/** 操作日志。只有管理员能读（scml_select_admin 策略） */
export async function getModerationLogs(
  params: PaginationParams & { targetType?: ModerationTargetType | '' }
) {
  let query = supabase
    .from(TABLES.SKILL_CHECK_MODERATION_LOG)
    .select('*', { count: 'exact' });

  if (params.targetType) {
    query = query.eq('target_type', params.targetType);
  }

  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  const { data, error, count } = await query
    .range(from, to)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { data: null, error, total: count || 0 };
  }

  return {
    data: data as unknown as FunBuzzModerationLog[],
    error: null,
    total: count || 0,
  };
}

/** 单个房间，用于详情抽屉直接刷新 */
export async function getFunBuzzRoom(roomId: string) {
  const { data, error } = await supabase
    .from(TABLES.SKILL_CHECKS)
    .select(ROOM_SELECT)
    .eq('id', roomId)
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return {
    data: normalizeRoom(data as unknown as Record<string, unknown>),
    error: null,
  };
}

// -----------------------------------------------------------------
// 内部
// -----------------------------------------------------------------

/**
 * 把 rpc 抛出的异常码换成能给人看的话。
 *
 * 这些字符串是 sc_moderate / sc_set_featured 里 raise exception 的值，
 * Supabase 会把它们塞进 error.message。
 */
function translateRpcError(error: { message?: string }): Error {
  const raw = error?.message ?? '';

  if (raw.includes('FORBIDDEN')) {
    return new Error('没有管理员权限，无法执行该操作');
  }
  if (raw.includes('AUTH_REQUIRED')) {
    return new Error('登录状态已失效，请重新登录');
  }
  if (raw.includes('ROOM_NOT_FOUND')) {
    return new Error('房间不存在，可能已被删除');
  }
  if (raw.includes('BAD_TARGET_TYPE')) {
    return new Error('操作目标类型不合法');
  }

  return new Error(raw || '操作失败');
}

/** 可见性的下一个目标状态。下架用 hidden，恢复用 visible */
export function nextVisibility(current: Visibility): Visibility {
  return current === 'hidden' ? 'visible' : 'hidden';
}
