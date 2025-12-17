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
    // 检查是否已有活跃赛季（新建赛季默认状态是 active）
    const { data: activeSeason, error: checkError } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('status', 'active')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('检查活跃赛季失败:', checkError);
      return { error: '检查活跃赛季失败: ' + checkError.message };
    }

    if (activeSeason) {
      return { error: `已存在活跃赛季「${activeSeason.name}」，请先结束该赛季后再创建新赛季` };
    }

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
    // 如果要将状态改为 active，需要检查是否已有其他活跃赛季
    if (seasonData.status === 'active') {
      const { data: activeSeason, error: checkError } = await supabase
        .from('seasons')
        .select('id, name')
        .eq('status', 'active')
        .neq('id', id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('检查活跃赛季失败:', checkError);
        return { error: '检查活跃赛季失败: ' + checkError.message };
      }

      if (activeSeason) {
        return { error: `已存在活跃赛季「${activeSeason.name}」，同时只能有一个活跃赛季` };
      }
    }

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

// 结束赛季并生成排行榜
export async function endSeasonAndGenerateLeaderboard(seasonId: string): Promise<ApiResponse<{ message: string; leaderboardCount: number }>> {
  try {
    console.log('开始结束赛季并生成排行榜，赛季ID:', seasonId);

    // 1. 从 user_points 表获取该赛季所有积分记录
    const { data: pointsData, error: pointsError } = await supabase
      .from('user_points')
      .select('user_id, points, point_type')
      .eq('season_id', seasonId);

    if (pointsError) {
      console.error('获取积分数据失败:', pointsError);
      return { error: '获取积分数据失败: ' + pointsError.message };
    }

    console.log('获取到的积分记录数:', pointsData?.length || 0);

    // 2. 按用户聚合积分
    const userPointsMap = new Map<string, {
      total_points: number;
      participation_count: number;
      simple_completions: number;
      hard_completions: number;
    }>();

    if (pointsData && pointsData.length > 0) {
      pointsData.forEach(record => {
        const existing = userPointsMap.get(record.user_id) || {
          total_points: 0,
          participation_count: 0,
          simple_completions: 0,
          hard_completions: 0,
        };

        existing.total_points += record.points || 0;
        
        if (record.point_type === 'participation') {
          existing.participation_count += 1;
        } else if (record.point_type === 'simple_completion') {
          existing.simple_completions += 1;
        } else if (record.point_type === 'hard_completion') {
          existing.hard_completions += 1;
        }

        userPointsMap.set(record.user_id, existing);
      });
    }

    console.log('聚合后的用户数:', userPointsMap.size);

    // 3. 转换为数组并按积分排序
    const sortedUsers = Array.from(userPointsMap.entries())
      .map(([user_id, stats]) => ({
        user_id,
        ...stats,
      }))
      .sort((a, b) => b.total_points - a.total_points);

    // 4. 删除该赛季现有的排行榜数据（如果有）
    const { error: deleteError } = await supabase
      .from('season_leaderboards')
      .delete()
      .eq('season_id', seasonId);

    if (deleteError) {
      console.error('删除旧排行榜数据失败:', deleteError);
      return { error: '删除旧排行榜数据失败: ' + deleteError.message };
    }

    // 5. 插入新的排行榜数据
    if (sortedUsers.length > 0) {
      const leaderboardEntries = sortedUsers.map((user, index) => ({
        season_id: seasonId,
        user_id: user.user_id,
        total_points: user.total_points,
        rank_position: index + 1,
        participation_count: user.participation_count,
        simple_completions: user.simple_completions,
        hard_completions: user.hard_completions,
        is_winner: index < 3, // 前3名标记为获奖
        prize_status: index < 3 ? 'pending' : 'none',
      }));

      const { error: insertError } = await supabase
        .from('season_leaderboards')
        .insert(leaderboardEntries);

      if (insertError) {
        console.error('插入排行榜数据失败:', insertError);
        return { error: '插入排行榜数据失败: ' + insertError.message };
      }

      console.log('成功插入排行榜数据，共', leaderboardEntries.length, '条');
    }

    // 6. 更新赛季状态为 ended
    const { error: updateError } = await supabase
      .from('seasons')
      .update({ status: 'ended', updated_at: new Date().toISOString() })
      .eq('id', seasonId);

    if (updateError) {
      console.error('更新赛季状态失败:', updateError);
      return { error: '更新赛季状态失败: ' + updateError.message };
    }

    return {
      data: {
        message: '赛季已结束，排行榜已生成',
        leaderboardCount: sortedUsers.length,
      }
    };
  } catch (error) {
    console.error('结束赛季异常:', error);
    return { error: '结束赛季失败' };
  }
}

// 重新打开赛季
export async function reopenSeason(seasonId: string): Promise<ApiResponse<Season>> {
  try {
    console.log('重新打开赛季，赛季ID:', seasonId);

    // 1. 检查是否有其他活跃赛季
    const { data: activeSeason, error: checkError } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('status', 'active')
      .neq('id', seasonId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('检查活跃赛季失败:', checkError);
      return { error: '检查活跃赛季失败: ' + checkError.message };
    }

    if (activeSeason) {
      return { error: `已存在活跃赛季「${activeSeason.name}」，请先结束该赛季` };
    }

    // 2. 更新赛季状态为 active
    const { data, error: updateError } = await supabase
      .from('seasons')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', seasonId)
      .select()
      .single();

    if (updateError) {
      console.error('更新赛季状态失败:', updateError);
      return { error: '更新赛季状态失败: ' + updateError.message };
    }

    // 3. 可选：删除该赛季的排行榜数据（因为赛季重新打开，排行榜需要重新生成）
    await supabase
      .from('season_leaderboards')
      .delete()
      .eq('season_id', seasonId);

    console.log('赛季已重新打开');

    return { data };
  } catch (error) {
    console.error('重新打开赛季异常:', error);
    return { error: '重新打开赛季失败' };
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
        challenge_modes(id)
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

    // 处理数据，添加模式数量和参与人数
    let enrichedData = data || [];
    if (data && data.length > 0) {
      // 获取每个挑战赛的参与人数
      const challengeIds = data.map(challenge => challenge.id);
      const { data: participationCounts } = await supabase
        .from('user_participations')
        .select('challenge_id')
        .in('challenge_id', challengeIds);

      // 计算每个挑战赛的参与人数
      const participationCountMap = new Map();
      if (participationCounts) {
        participationCounts.forEach(participation => {
          const challengeId = participation.challenge_id;
          participationCountMap.set(challengeId, (participationCountMap.get(challengeId) || 0) + 1);
        });
      }

      // 丰富数据
      enrichedData = data.map(challenge => ({
        ...challenge,
        season: challenge.seasons,
        modes: challenge.challenge_modes || [],
        participant_count: participationCountMap.get(challenge.id) || 0,
      }));
    }

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
    // 1. 首先获取参与记录的详细信息
    const { data: participation, error: fetchError } = await supabase
      .from('user_participations')
      .select(`
        *,
        weekly_challenges!challenge_id(season_id),
        challenge_modes!mode_id(mode_type, points_reward)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !participation) {
      console.error('获取参与记录失败:', fetchError);
      return { error: '获取参与记录失败' };
    }

    // 2. 更新参与记录状态
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

    // 3. 如果审核通过，写入积分记录
    if (reviewData.status === 'approved') {
      const seasonId = participation.weekly_challenges?.season_id;
      const modeType = participation.challenge_modes?.mode_type;
      const pointsReward = participation.challenge_modes?.points_reward || 0;

      if (seasonId && pointsReward > 0) {
        // 检查是否已经存在积分记录（防止重复写入）
        const { data: existingPoints } = await supabase
          .from('user_points')
          .select('id')
          .eq('participation_id', id)
          .single();

        if (!existingPoints) {
          // 确定积分类型
          const pointType = modeType === 'simple' ? 'simple_completion' : 'hard_completion';

          // 写入积分记录
          const { error: pointsError } = await supabase
            .from('user_points')
            .insert({
              user_id: participation.user_id,
              season_id: seasonId,
              participation_id: id,
              point_type: pointType,
              points: pointsReward,
              description: `完成${modeType === 'simple' ? '简单' : '困难'}模式挑战，获得 ${pointsReward} 积分`,
            });

          if (pointsError) {
            console.error('写入积分记录失败:', pointsError);
            // 积分写入失败不影响审核结果，但记录日志
          } else {
            console.log('积分记录已写入:', {
              user_id: participation.user_id,
              season_id: seasonId,
              points: pointsReward,
              point_type: pointType,
            });
          }
        } else {
          console.log('积分记录已存在，跳过写入');
        }
      }
    }

    // 4. 如果从 approved 改为其他状态，删除积分记录
    if (participation.status === 'approved' && reviewData.status !== 'approved') {
      const { error: deleteError } = await supabase
        .from('user_points')
        .delete()
        .eq('participation_id', id);

      if (deleteError) {
        console.error('删除积分记录失败:', deleteError);
      } else {
        console.log('已删除关联的积分记录');
      }
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
      .select('user_id, total_points, rank_position')
      .order('rank_position')
      .limit(5);

    // 分开获取用户信息
    let topUsersWithProfiles: { user_id: string; nickname: string; total_points: number; rank_position: number }[] = [];
    if (topUsers && topUsers.length > 0) {
      const userIds = topUsers.map(u => u.user_id);
      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, nickname')
        .in('id', userIds);

      topUsersWithProfiles = topUsers.map(user => {
        const profile = userProfiles?.find(p => p.id === user.user_id);
        return {
          user_id: user.user_id,
          nickname: profile?.nickname || '未知用户',
          total_points: user.total_points,
          rank_position: user.rank_position,
        };
      });
    }

    const stats: SeasonStats = {
      total_seasons: totalSeasonsResult.count || 0,
      active_season: activeSeasonResult.data || undefined,
      total_points_awarded: totalPointsResult.data?.sum || 0,
      top_users: topUsersWithProfiles,
    };

    return { data: stats };
  } catch (error) {
    console.error('获取赛季统计数据异常:', error);
    return { error: '获取统计数据失败' };
  }
}