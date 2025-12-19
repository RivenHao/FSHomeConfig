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
import { grantSeasonRankHonor } from './honor-utils';

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

// 结束赛季并最终确定排行榜
export async function endSeasonAndGenerateLeaderboard(seasonId: string): Promise<ApiResponse<{ message: string; leaderboardCount: number }>> {
  try {
    console.log('开始结束赛季，赛季ID:', seasonId);

    // 1. 获取该赛季现有的排行榜数据（已在审核通过时实时更新）
    const { data: existingLeaderboard, error: fetchError } = await supabase
      .from('season_leaderboards')
      .select('id, user_id, total_points')
      .eq('season_id', seasonId)
      .order('total_points', { ascending: false });

    if (fetchError) {
      console.error('获取排行榜数据失败:', fetchError);
      return { error: '获取排行榜数据失败: ' + fetchError.message };
    }

    console.log('现有排行榜用户数:', existingLeaderboard?.length || 0);

    // 获取赛季信息（用于荣誉名称）
    const { data: seasonInfo } = await supabase
      .from('seasons')
      .select('name')
      .eq('id', seasonId)
      .single();
    
    const seasonName = seasonInfo?.name || '未知赛季';

    // 2. 更新最终排名和获奖状态
    if (existingLeaderboard && existingLeaderboard.length > 0) {
      for (let i = 0; i < existingLeaderboard.length; i++) {
        const record = existingLeaderboard[i];
        const isWinner = i < 3; // 前3名为获奖者
        const rank = i + 1;
        
        const { error: updateError } = await supabase
          .from('season_leaderboards')
          .update({
            rank_position: rank,
            is_winner: isWinner,
            prize_status: isWinner ? 'pending' : 'none',
          })
          .eq('id', record.id);

        if (updateError) {
          console.error(`更新排名失败 (user: ${record.user_id}):`, updateError);
        }

        // 给前三名授予赛季荣誉
        if (isWinner) {
          await grantSeasonRankHonor(record.user_id, seasonId, seasonName, rank as 1 | 2 | 3);
        }
      }
      console.log('排名已更新，前三名荣誉已授予');
    }

    // 3. 更新赛季状态为 ended
    const { error: updateSeasonError } = await supabase
      .from('seasons')
      .update({ status: 'ended', updated_at: new Date().toISOString() })
      .eq('id', seasonId);

    if (updateSeasonError) {
      console.error('更新赛季状态失败:', updateSeasonError);
      return { error: '更新赛季状态失败: ' + updateSeasonError.message };
    }

    return {
      data: {
        message: '赛季已结束，排行榜已确定',
        leaderboardCount: existingLeaderboard?.length || 0,
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
        challenge_modes!mode_id(mode_type, title, points_reward)
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

    // 获取用户信息和实际得分
    let enrichedData = data || [];
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(item => item.user_id))];
      const participationIds = data.map(item => item.id);
      console.log('👥 需要查询的用户ID:', userIds);
      
      // 并行查询用户资料和积分记录
      const [profileResult, pointsResult] = await Promise.all([
        supabase
          .from(TABLES.USER_PROFILES)
          .select('id, nickname, image_url')
          .in('id', userIds),
        supabase
          .from('user_points')
          .select('participation_id, points')
          .in('participation_id', participationIds)
      ]);

      const userProfiles = profileResult.data;
      const pointsData = pointsResult.data;

      console.log('👤 查询到的用户资料:', userProfiles);
      console.log('❌ 用户资料查询错误:', profileResult.error);
      console.log('💰 查询到的积分记录:', pointsData);

      // 聚合每个参与记录的实际得分
      const pointsMap = new Map<string, number>();
      pointsData?.forEach(record => {
        if (record.participation_id) {
          const current = pointsMap.get(record.participation_id) || 0;
          pointsMap.set(record.participation_id, current + record.points);
        }
      });

      // 将用户信息和实际得分合并到参与记录中
      enrichedData = data.map(item => {
        const userProfile = userProfiles?.find(profile => profile.id === item.user_id);
        const earnedPoints = pointsMap.get(item.id) || 0;
        console.log(`🔗 用户 ${item.user_id} 匹配到的资料:`, userProfile, `实际得分: ${earnedPoints}`);
        return {
          ...item,
          user_profile: userProfile,
          earned_points: earnedPoints
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

// 更新赛季排行榜（审核通过后调用）
async function updateSeasonLeaderboard(userId: string, seasonId: string) {
  try {
    // 1. 计算该用户在该赛季的总积分和模式完成次数
    const { data: pointsData } = await supabase
      .from('user_points')
      .select('points, point_type')
      .eq('user_id', userId)
      .eq('season_id', seasonId);

    let totalPoints = 0;
    let simpleCompletions = 0;
    let hardCompletions = 0;

    (pointsData || []).forEach(p => {
      totalPoints += p.points || 0;
      if (p.point_type === 'simple_completion') {
        simpleCompletions += 1;
      } else if (p.point_type === 'hard_completion') {
        hardCompletions += 1;
      }
    });

    // 2. 计算该用户在该赛季的视频数量
    const { data: challenges } = await supabase
      .from('weekly_challenges')
      .select('id')
      .eq('season_id', seasonId);

    const challengeIds = (challenges || []).map(c => c.id);
    
    let videoCount = 0;
    if (challengeIds.length > 0) {
      const { count } = await supabase
        .from('user_participations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('challenge_id', challengeIds)
        .eq('status', 'approved');
      videoCount = count || 0;
    }

    // 3. 检查排行榜记录是否存在
    const { data: existingRecord } = await supabase
      .from('season_leaderboards')
      .select('id')
      .eq('season_id', seasonId)
      .eq('user_id', userId)
      .single();

    const leaderboardData = {
      total_points: totalPoints,
      video_count: videoCount,
      simple_completions: simpleCompletions,
      hard_completions: hardCompletions,
      participation_count: simpleCompletions + hardCompletions, // 兼容历史字段
    };

    if (existingRecord) {
      // 更新现有记录
      await supabase
        .from('season_leaderboards')
        .update(leaderboardData)
        .eq('id', existingRecord.id);
    } else {
      // 创建新记录（rank_position 暂时设为 0，后面统一更新）
      await supabase
        .from('season_leaderboards')
        .insert({
          season_id: seasonId,
          user_id: userId,
          ...leaderboardData,
          rank_position: 0,
        });
    }

    // 4. 重新计算该赛季所有用户的排名
    const { data: allRecords } = await supabase
      .from('season_leaderboards')
      .select('id, total_points')
      .eq('season_id', seasonId)
      .order('total_points', { ascending: false });

    if (allRecords && allRecords.length > 0) {
      // 批量更新排名
      for (let i = 0; i < allRecords.length; i++) {
        await supabase
          .from('season_leaderboards')
          .update({ rank_position: i + 1 })
          .eq('id', allRecords[i].id);
      }
    }

    console.log('排行榜已更新:', { userId, seasonId, totalPoints, videoCount, simpleCompletions, hardCompletions });
  } catch (error) {
    console.error('更新排行榜失败:', error);
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

    // 2. 更新参与记录状态（只更新 status 和 admin_note，不包含 bonus_points）
    const { data, error } = await supabase
      .from('user_participations')
      .update({
        status: reviewData.status,
        admin_note: reviewData.admin_note,
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
      const modeId = participation.mode_id;
      const challengeId = participation.challenge_id;
      const pointsReward = participation.challenge_modes?.points_reward || 0;

      if (seasonId && pointsReward > 0) {
        // 检查该用户在该挑战、该模式下是否已经获得过积分（每个模式只发放一次）
        // 需要查找该用户在同一挑战、同一模式下已审核通过的其他参与记录的积分
        const { data: existingModePoints, error: checkError } = await supabase
          .from('user_points')
          .select(`
            id,
            participation_id,
            user_participations!inner(
              user_id,
              challenge_id,
              mode_id
            )
          `)
          .eq('user_participations.user_id', participation.user_id)
          .eq('user_participations.challenge_id', challengeId)
          .eq('user_participations.mode_id', modeId);

        // 如果查询出错，尝试使用备用方案
        let hasExistingPoints = false;
        if (checkError) {
          console.log('联表查询失败，使用备用方案:', checkError.message);
          // 备用方案：先获取用户在该挑战、该模式下所有已通过的参与记录
          const { data: approvedParticipations } = await supabase
            .from('user_participations')
            .select('id')
            .eq('user_id', participation.user_id)
            .eq('challenge_id', challengeId)
            .eq('mode_id', modeId)
            .eq('status', 'approved')
            .neq('id', id); // 排除当前记录

          if (approvedParticipations && approvedParticipations.length > 0) {
            // 检查这些参与记录是否有对应的积分记录
            const participationIds = approvedParticipations.map(p => p.id);
            const { data: pointsRecords } = await supabase
              .from('user_points')
              .select('id')
              .in('participation_id', participationIds);

            hasExistingPoints = !!(pointsRecords && pointsRecords.length > 0);
          }
        } else {
          hasExistingPoints = !!(existingModePoints && existingModePoints.length > 0);
        }

        if (!hasExistingPoints) {
          // 确定积分类型
          const pointType = modeType === 'simple' ? 'simple_completion' : 'hard_completion';

          // 写入固定参与积分记录
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
            console.error('写入固定参与积分失败:', pointsError);
          } else {
            console.log('固定参与积分已写入:', {
              user_id: participation.user_id,
              season_id: seasonId,
              points: pointsReward,
              point_type: pointType,
            });
          }
        } else {
          console.log('该用户在此挑战的此模式下已获得过固定参与积分，跳过写入');
        }
      }

      // 写入额外积分（每次审核通过都可以发放）
      if (reviewData.bonus_points && reviewData.bonus_points > 0) {
        const seasonId = participation.weekly_challenges?.season_id;
        if (seasonId) {
          const { error: bonusError } = await supabase
            .from('user_points')
            .insert({
              user_id: participation.user_id,
              season_id: seasonId,
              participation_id: id,
              point_type: 'bonus',
              points: reviewData.bonus_points,
              description: `审核额外积分奖励 ${reviewData.bonus_points} 分${reviewData.admin_note ? `（${reviewData.admin_note}）` : ''}`,
            });

          if (bonusError) {
            console.error('写入额外积分失败:', bonusError);
          } else {
            console.log('额外积分已写入:', {
              user_id: participation.user_id,
              season_id: seasonId,
              bonus_points: reviewData.bonus_points,
            });
          }
        }
      }

      // 5. 更新 season_leaderboards 排行榜表（实时更新）
      await updateSeasonLeaderboard(participation.user_id, seasonId);
    }

    // 4. 如果从 approved 改为其他状态，删除积分记录并更新排行榜
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

      // 更新排行榜（减少视频数量和积分）
      const seasonId = participation.weekly_challenges?.season_id;
      if (seasonId) {
        await updateSeasonLeaderboard(participation.user_id, seasonId);
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