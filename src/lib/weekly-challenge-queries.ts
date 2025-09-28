// 每周挑战赛相关的数据查询函数

import { supabase, TABLES } from './supabase';
import {
  Season,
  WeeklyChallenge,
  ChallengeMode,
  UserParticipation,
  UserSuggestion,
  ApiResponse,
  PaginatedResponse,
  CreateSeasonRequest,
  UpdateSeasonRequest,
  CreateChallengeRequest,
  UpdateChallengeRequest,
  CreateChallengeModeRequest,
  UpdateChallengeModeRequest,
  ReviewParticipationRequest,
  ProcessSuggestionRequest,
  ChallengeStats,
  SeasonStats,
  ChallengeFilters,
  ParticipationFilters,
  SuggestionFilters,
} from '@/types/weekly-challenge';

// ==================== 赛季管理 ====================

// 获取赛季列表
export async function getSeasons(
  page = 1,
  pageSize = 10,
  filters: { status?: string; year?: number } = {}
): Promise<ApiResponse<PaginatedResponse<Season>>> {
  try {
    let query = supabase
      .from('seasons')
      .select('*', { count: 'exact' });

    // 应用筛选条件
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.year) {
      query = query.eq('year', filters.year);
    }

    // 分页和排序
    const { data, error, count } = await query
      .order('year', { ascending: false })
      .order('quarter', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error('获取赛季列表失败:', error);
      return { error: error.message };
    }

    return {
      data: {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  } catch (error) {
    console.error('获取赛季列表异常:', error);
    return { error: '获取赛季列表失败' };
  }
}

// 获取当前活跃赛季
export async function getCurrentSeason(): Promise<ApiResponse<Season>> {
  try {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .single();

    if (error) {
      console.error('获取当前赛季失败:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('获取当前赛季异常:', error);
    return { error: '获取当前赛季失败' };
  }
}

// 创建赛季
export async function createSeason(seasonData: CreateSeasonRequest): Promise<ApiResponse<Season>> {
  try {
    const { data, error } = await supabase
      .from('seasons')
      .insert([seasonData])
      .select()
      .single();

    if (error) {
      console.error('创建赛季失败:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('创建赛季异常:', error);
    return { error: '创建赛季失败' };
  }
}

// 更新赛季
export async function updateSeason(id: string, seasonData: UpdateSeasonRequest): Promise<ApiResponse<Season>> {
  try {
    const { data, error } = await supabase
      .from('seasons')
      .update(seasonData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新赛季失败:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('更新赛季异常:', error);
    return { error: '更新赛季失败' };
  }
}

// 删除赛季
export async function deleteSeason(id: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('seasons')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除赛季失败:', error);
      return { error: error.message };
    }

    return { data: undefined };
  } catch (error) {
    console.error('删除赛季异常:', error);
    return { error: '删除赛季失败' };
  }
}

// ==================== 挑战赛管理 ====================

// 获取挑战赛列表
export async function getChallenges(
  page = 1,
  pageSize = 10,
  filters: ChallengeFilters = {}
): Promise<ApiResponse<PaginatedResponse<WeeklyChallenge>>> {
  try {
    let query = supabase
      .from('weekly_challenges')
      .select(`
        *,
        seasons!inner(name, year, quarter),
        challenge_modes(count)
      `, { count: 'exact' });

    // 应用筛选条件
    if (filters.season_id) {
      query = query.eq('season_id', filters.season_id);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.week_number) {
      query = query.eq('week_number', filters.week_number);
    }
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    // 分页和排序
    const { data, error, count } = await query
      .order('start_date', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error('获取挑战赛列表失败:', error);
      return { error: error.message };
    }

    return {
      data: {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  } catch (error) {
    console.error('获取挑战赛列表异常:', error);
    return { error: '获取挑战赛列表失败' };
  }
}

// 获取挑战赛详情
export async function getChallengeById(id: string): Promise<ApiResponse<WeeklyChallenge>> {
  try {
    const { data, error } = await supabase
      .from('weekly_challenges')
      .select(`
        *,
        seasons(name, year, quarter),
        challenge_modes(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('获取挑战赛详情失败:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('获取挑战赛详情异常:', error);
    return { error: '获取挑战赛详情失败' };
  }
}

// 创建挑战赛
export async function createChallenge(challengeData: CreateChallengeRequest): Promise<ApiResponse<WeeklyChallenge>> {
  try {
    const { data, error } = await supabase
      .from('weekly_challenges')
      .insert([challengeData])
      .select()
      .single();

    if (error) {
      console.error('创建挑战赛失败:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('创建挑战赛异常:', error);
    return { error: '创建挑战赛失败' };
  }
}

// 更新挑战赛
export async function updateChallenge(id: string, challengeData: UpdateChallengeRequest): Promise<ApiResponse<WeeklyChallenge>> {
  try {
    const { data, error } = await supabase
      .from('weekly_challenges')
      .update(challengeData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新挑战赛失败:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('更新挑战赛异常:', error);
    return { error: '更新挑战赛失败' };
  }
}

// 删除挑战赛
export async function deleteChallenge(id: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('weekly_challenges')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除挑战赛失败:', error);
      return { error: error.message };
    }

    return { data: undefined };
  } catch (error) {
    console.error('删除挑战赛异常:', error);
    return { error: '删除挑战赛失败' };
  }
}

// ==================== 挑战模式管理 ====================

// 获取挑战模式列表
export async function getChallengeModes(challengeId: string): Promise<ApiResponse<ChallengeMode[]>> {
  try {
    const { data, error } = await supabase
      .from('challenge_modes')
      .select('*')
      .eq('challenge_id', challengeId)
      .order('mode_type');

    if (error) {
      console.error('获取挑战模式失败:', error);
      return { error: error.message };
    }

    return { data: data || [] };
  } catch (error) {
    console.error('获取挑战模式异常:', error);
    return { error: '获取挑战模式失败' };
  }
}

// 创建挑战模式
export async function createChallengeMode(modeData: CreateChallengeModeRequest): Promise<ApiResponse<ChallengeMode>> {
  try {
    const { data, error } = await supabase
      .from('challenge_modes')
      .insert([modeData])
      .select()
      .single();

    if (error) {
      console.error('创建挑战模式失败:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('创建挑战模式异常:', error);
    return { error: '创建挑战模式失败' };
  }
}

// 更新挑战模式
export async function updateChallengeMode(id: string, modeData: UpdateChallengeModeRequest): Promise<ApiResponse<ChallengeMode>> {
  try {
    const { data, error } = await supabase
      .from('challenge_modes')
      .update(modeData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新挑战模式失败:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('更新挑战模式异常:', error);
    return { error: '更新挑战模式失败' };
  }
}

// 删除挑战模式
export async function deleteChallengeMode(id: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('challenge_modes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除挑战模式失败:', error);
      return { error: error.message };
    }

    return { data: undefined };
  } catch (error) {
    console.error('删除挑战模式异常:', error);
    return { error: '删除挑战模式失败' };
  }
}

// ==================== 参与记录管理 ====================

// 获取参与记录列表
export async function getParticipations(
  page = 1,
  pageSize = 10,
  filters: ParticipationFilters = {}
): Promise<ApiResponse<PaginatedResponse<UserParticipation>>> {
  try {
    console.log('🔍 后台查询参与记录:', { page, pageSize, filters });
    let query = supabase
      .from('user_participations')
      .select(`
        *,
        weekly_challenges!challenge_id(title, week_number),
        challenge_modes!mode_id(mode_type, title)
      `, { count: 'exact' });

    // 应用筛选条件
    if (filters.challenge_id) {
      query = query.eq('challenge_id', filters.challenge_id);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters.date_range && filters.date_range.length === 2) {
      query = query
        .gte('submitted_at', filters.date_range[0])
        .lte('submitted_at', filters.date_range[1]);
    }

    // 分页和排序
    const { data, error, count } = await query
      .order('submitted_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error('获取参与记录失败:', error);
      return { error: error.message };
    }

    // 获取用户信息
    let enrichedData = data || [];
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(item => item.user_id))];
      console.log('👥 需要查询的用户ID:', userIds);
      
      const { data: userProfiles, error: profileError } = await supabase
        .from(TABLES.USER_PROFILES)
        .select('id, nickname, image_url')
        .in('id', userIds);

      console.log('👤 查询到的用户资料:', userProfiles);
      console.log('❌ 用户资料查询错误:', profileError);

      // 将用户信息合并到参与记录中
      enrichedData = data.map(item => {
        const userProfile = userProfiles?.find(profile => profile.id === item.user_id);
        console.log(`🔗 用户 ${item.user_id} 匹配到的资料:`, userProfile);
        return {
          ...item,
          user_profile: userProfile
        };
      });
    }

    console.log('📊 后台查询结果:', { count, dataLength: enrichedData?.length });

    return {
      data: {
        data: enrichedData,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  } catch (error) {
    console.error('获取参与记录异常:', error);
    return { error: '获取参与记录失败' };
  }
}

// 审核参与记录
export async function reviewParticipation(id: string, reviewData: ReviewParticipationRequest): Promise<ApiResponse<UserParticipation>> {
  try {
    const { data, error } = await supabase
      .from('user_participations')
      .update({
        ...reviewData,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('审核参与记录失败:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('审核参与记录异常:', error);
    return { error: '审核参与记录失败' };
  }
}

// ==================== 用户建议管理 ====================

// 获取用户建议列表
export async function getSuggestions(
  page = 1,
  pageSize = 10,
  filters: SuggestionFilters = {}
): Promise<ApiResponse<PaginatedResponse<UserSuggestion>>> {
  try {
    let query = supabase
      .from('user_suggestions')
      .select(`
        *,
        seasons(name, year, quarter),
        user_profiles(nickname, image_url),
        weekly_challenges(title)
      `, { count: 'exact' });

    // 应用筛选条件
    if (filters.season_id) {
      query = query.eq('season_id', filters.season_id);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters.date_range && filters.date_range.length === 2) {
      query = query
        .gte('created_at', filters.date_range[0])
        .lte('created_at', filters.date_range[1]);
    }

    // 分页和排序
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error('获取用户建议失败:', error);
      return { error: error.message };
    }

    return {
      data: {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  } catch (error) {
    console.error('获取用户建议异常:', error);
    return { error: '获取用户建议失败' };
  }
}

// 处理用户建议
export async function processSuggestion(id: string, processData: ProcessSuggestionRequest): Promise<ApiResponse<UserSuggestion>> {
  try {
    const { data, error } = await supabase
      .from('user_suggestions')
      .update(processData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('处理用户建议失败:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('处理用户建议异常:', error);
    return { error: '处理用户建议失败' };
  }
}

// ==================== 统计数据 ====================

// 获取挑战赛统计数据
export async function getChallengeStats(): Promise<ApiResponse<ChallengeStats>> {
  try {
    // 并行获取各种统计数据
    const [
      totalChallengesResult,
      activeChallengesResult,
      totalParticipantsResult,
      pendingReviewsResult,
    ] = await Promise.all([
      supabase.from('weekly_challenges').select('id', { count: 'exact', head: true }),
      supabase.from('weekly_challenges').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('user_participations').select('user_id', { count: 'exact', head: true }),
      supabase.from('user_participations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    const stats: ChallengeStats = {
      total_challenges: totalChallengesResult.count || 0,
      active_challenges: activeChallengesResult.count || 0,
      total_participants: totalParticipantsResult.count || 0,
      pending_reviews: pendingReviewsResult.count || 0,
    };

    return { data: stats };
  } catch (error) {
    console.error('获取挑战赛统计数据异常:', error);
    return { error: '获取统计数据失败' };
  }
}

// 获取赛季统计数据
export async function getSeasonStats(): Promise<ApiResponse<SeasonStats>> {
  try {
    // 获取基本统计
    const [totalSeasonsResult, activeSeasonResult, totalPointsResult] = await Promise.all([
      supabase.from('seasons').select('id', { count: 'exact', head: true }),
      supabase.from('seasons').select('*').eq('status', 'active').single(),
      supabase.from('user_points').select('points.sum()').single(),
    ]);

    // 获取排行榜前几名
    const { data: topUsers } = await supabase
      .from('season_leaderboards')
      .select(`
        user_id,
        total_points,
        rank_position,
        user_profiles(nickname)
      `)
      .order('rank_position')
      .limit(5);

    const stats: SeasonStats = {
      total_seasons: totalSeasonsResult.count || 0,
      active_season: activeSeasonResult.data || undefined,
      total_points_awarded: totalPointsResult.data?.sum || 0,
      top_users: (topUsers || []).map(user => ({
        user_id: user.user_id,
        nickname: (user.user_profiles as any)?.nickname || '未知用户',
        total_points: user.total_points,
        rank_position: user.rank_position,
      })),
    };

    return { data: stats };
  } catch (error) {
    console.error('获取赛季统计数据异常:', error);
    return { error: '获取统计数据失败' };
  }
}