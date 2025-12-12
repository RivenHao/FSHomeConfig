import { supabase, TABLES } from './supabase';
import { PaginationParams, FilterParams, Move, MoveCategory, MoveSubCategory } from '@/types/admin';
import { getCurrentAdmin } from './admin-auth';

// 获取用户列表
export async function getUsersList(params: PaginationParams & FilterParams) {
  let query = supabase
    .from(TABLES.USER_PROFILES)
    .select('*', { count: 'exact' });

  // 应用筛选条件
  if (params.search) {
    query = query.or(`nickname.ilike.%${params.search}%,email.ilike.%${params.search}%`);
  }
  if ('location' in params && params.location) {
    query = query.eq('location', params.location);
  }

  // 应用分页
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  
  const { data, error, count } = await query
    .range(from, to)
    .order('created_at', { ascending: false });

  return { data, error, total: count || 0 };
}

// 获取视频提交列表（包含关联数据）
export async function getVideoSubmissions(params: PaginationParams & FilterParams) {
  let query = supabase
    .from(TABLES.USER_MOVE_SUBMISSIONS)
    .select('*', { count: 'exact' });

  // 应用筛选条件
  if (params.status) {
    query = query.eq('status', params.status);
  }
  if (params.move_type) {
    query = query.eq('moves.main_type', params.move_type);
  }
  if (params.date_range && params.date_range.length === 2) {
    query = query.gte('submitted_at', params.date_range[0])
                 .lte('submitted_at', params.date_range[1]);
  }
  if (params.search) {
    query = query.or(`moves.move_name.ilike.%${params.search}%,user_profiles.nickname.ilike.%${params.search}%`);
  }

  // 应用分页
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  
  const { data, error, count } = await query
    .range(from, to)
    .order('submitted_at', { ascending: false });

  if (error || !data) {
    return { data: null, error, total: count || 0 };
  }

  // 分别查询用户信息和招式信息
  const enrichedData = await Promise.all(
    data.map(async (submission) => {
      const [userResult, moveResult] = await Promise.all([
        supabase
          .from(TABLES.USER_PROFILES)
          .select('nickname, email')
          .eq('id', submission.user_id)
          .single(),
        supabase
          .from(TABLES.MOVES)
          .select('move_name, main_type, sub_type')
          .eq('id', submission.move_id)
          .single()
      ]);

      return {
        ...submission,
        user_profiles: userResult.data,
        moves: moveResult.data
      };
    })
  );

  return { data: enrichedData, error: null, total: count || 0 };
}

// 获取心得列表（包含关联数据）
export async function getMoveTips(params: PaginationParams & FilterParams) {
  // 先查询心得数据
  let query = supabase
    .from(TABLES.MOVE_TIPS)
    .select('*', { count: 'exact' });

  // 应用筛选条件
  if (params.status) {
    if (params.status === 'approved') {
      query = query.eq('is_approved', true);
    } else if (params.status === 'pending') {
      // 待审核：is_approved = false
      query = query.eq('is_approved', false);
    }
  }

  // 应用分页
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  
  const { data: tips, error, count } = await query
    .range(from, to)
    .order('created_at', { ascending: false });

  if (error || !tips) {
    return { data: null, error, total: count || 0 };
  }

  // 分别查询用户信息和招式信息
  const enrichedData = await Promise.all(
    tips.map(async (tip) => {
      const [userResult, moveResult] = await Promise.all([
        supabase
          .from(TABLES.USER_PROFILES)
          .select('nickname, email')
          .eq('id', tip.user_id)
          .single(),
        supabase
          .from(TABLES.MOVES)
          .select('move_name, main_type, sub_type')
          .eq('id', tip.move_id)
          .single()
      ]);

      return {
        ...tip,
        user_profiles: userResult.data || { nickname: '未知用户', email: '未知邮箱' },
        moves: moveResult.data || { move_name: '未知招式', main_type: '未知', sub_type: '未知' }
      };
    })
  );

  return { data: enrichedData, error: null, total: count || 0 };
}

// 获取招式列表
export async function getMoves() {
  try {
    const { data, error } = await supabase
      .from(TABLES.MOVES)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 创建招式
export async function createMove(moveData: Partial<Move>) {
  try {
    const { data, error } = await supabase
      .from(TABLES.MOVES)
      .insert([moveData])
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 更新招式
export async function updateMove(id: number, moveData: Partial<Move>) {
  try {
    const { data, error } = await supabase
      .from(TABLES.MOVES)
      .update(moveData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 删除招式
export async function deleteMove(id: number) {
  try {
    const { error } = await supabase
      .from(TABLES.MOVES)
      .delete()
      .eq('id', id);

    if (error) {
      return { data: null, error };
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 审核视频提交
export async function reviewVideoSubmission(id: string, status: 'approved' | 'rejected', adminNote?: string) {
  try {
    // 开始事务
    console.log('查询视频提交记录，ID:', id);
    
    const { data: submission, error: submissionError } = await supabase
      .from(TABLES.USER_MOVE_SUBMISSIONS)
      .select('*')
      .eq('id', id)
      .single();

    console.log('查询结果:', { submission, submissionError });

    if (submissionError || !submission) {
      return { data: null, error: submissionError || new Error('找不到视频提交记录') };
    }

    console.log('找到记录:', submission);

    // 检查是否已经审核过
    if (submission.status !== 'pending') {
      return { data: null, error: new Error(`该视频已经审核过，当前状态: ${submission.status}`) };
    }

    // 更新视频提交状态
    console.log('开始更新视频提交状态:', { id, status, adminNote });
    
    // 获取当前管理员信息
    const currentAdmin = await getCurrentAdmin();
    if (!currentAdmin) {
      return { data: null, error: new Error('无法获取当前管理员信息') };
    }

    console.log('当前管理员:', currentAdmin.id);
    
    // 尝试直接更新，不使用 select
    console.log('尝试更新记录...');
    
    const { error: updateError } = await supabase
      .from(TABLES.USER_MOVE_SUBMISSIONS)
      .update({
        status,
        admin_note: adminNote,
        reviewed_at: new Date().toISOString(),
        reviewed_by: currentAdmin.id
      })
      .eq('id', id);

    console.log('更新错误:', updateError);

    if (updateError) {
      console.error('更新状态失败:', updateError);
      return { data: null, error: updateError };
    }

    console.log('状态更新成功');

    // 如果审核通过，需要解锁招式并更新用户统计
    if (status === 'approved') {
      console.log('开始处理审核通过逻辑...');
      
      // 获取招式信息
      const { data: move, error: moveError } = await supabase
        .from(TABLES.MOVES)
        .select('move_score')
        .eq('id', submission.move_id)
        .single();

      if (moveError || !move) {
        return { data: null, error: moveError || new Error('找不到招式信息') };
      }

      console.log('招式信息:', move);

      // 检查是否已经解锁过
      const { data: existingUnlock, error: unlockCheckError } = await supabase
        .from(TABLES.USER_MOVES_UNLOCK)
        .select('id')
        .eq('user_id', submission.user_id)
        .eq('move_id', submission.move_id);

      console.log('解锁记录查询结果:', { existingUnlock, unlockCheckError });
      
      // 如果没有记录，existingUnlock 会是空数组
      const hasExistingUnlock = existingUnlock && existingUnlock.length > 0;

      console.log('检查现有解锁记录:', existingUnlock);

      if (!hasExistingUnlock) {
        console.log('没有现有解锁记录，开始添加...');
        
        // 添加解锁记录
        const { error: unlockError } = await supabase
          .from(TABLES.USER_MOVES_UNLOCK)
          .insert({
            user_id: submission.user_id,
            move_id: submission.move_id,
            score_earned: move.move_score || 0,
            unlocked_at: new Date().toISOString()
          });

        if (unlockError) {
          console.error('添加解锁记录失败:', unlockError);
          return { data: null, error: unlockError };
        }

        console.log('解锁记录添加成功');

        // 获取当前用户统计
        const { data: currentProfile, error: profileSelectError } = await supabase
          .from(TABLES.USER_PROFILES)
          .select('total_score, unlocked_moves_count')
          .eq('id', submission.user_id)
          .single();

        if (profileSelectError || !currentProfile) {
          return { data: null, error: profileSelectError || new Error('找不到用户统计信息') };
        }

        console.log('当前用户统计:', currentProfile);

        // 注释掉手动更新用户统计的代码，使用触发器自动处理
        /*
        // 更新用户统计
        const { error: profileError } = await supabase
          .from(TABLES.USER_PROFILES)
          .update({
            total_score: (currentProfile.total_score || 0) + (move.move_score || 0),
            unlocked_moves_count: (currentProfile.unlocked_moves_count || 0) + 1
          })
          .eq('id', submission.user_id);

        if (profileError) {
          console.error('更新用户统计失败:', profileError);
          return { data: null, error: profileError };
        }

        console.log('用户统计更新成功');
        */
        
        console.log('用户统计更新已交给触发器处理');
      } else {
        console.log('该招式已经解锁过，跳过解锁逻辑');
      }
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 审核心得
export async function reviewMoveTip(id: string, isApproved: boolean) {
  try {
    // 最简单的更新，只更新 is_approved 字段，不使用 select
    const { error } = await supabase
      .from(TABLES.MOVE_TIPS)
      .update({
        is_approved: isApproved
      })
      .eq('id', id);

    if (error) {
      console.error('更新心得状态失败:', error);
      return { data: null, error };
    }

    // 更新成功，返回成功状态
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error('审核心得异常:', error);
    return { data: null, error: error as Error };
  }
}

// 获取统计数据
export async function getDashboardStats() {
  const [
    { count: totalUsers },
    { count: pendingVideos },
    { count: pendingCommunityVideos },
    { count: pendingTips },
    { count: totalMoves }
  ] = await Promise.all([
    supabase.from(TABLES.USER_PROFILES).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.USER_MOVE_SUBMISSIONS).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from(TABLES.COMMUNITY_VIDEOS).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from(TABLES.MOVE_TIPS).select('*', { count: 'exact', head: true }).eq('is_approved', false),
    supabase.from(TABLES.MOVES).select('*', { count: 'exact', head: true })
  ]);

  return {
    totalUsers: totalUsers || 0,
    pendingVideos: pendingVideos || 0,
    pendingCommunityVideos: pendingCommunityVideos || 0,
    pendingTips: pendingTips || 0,
    totalMoves: totalMoves || 0
  };
}

// ========================================
// 招式分类管理函数
// ========================================

// 获取招式大类列表
export async function getMoveCategories(params: PaginationParams) {
  try {
    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    
    const { data, error, count } = await supabase
      .from('move_categories')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    return { data, error, total: count || 0 };
  } catch (error) {
    return { data: null, error: error as Error, total: 0 };
  }
}

// 创建招式大类
export async function createMoveCategory(categoryData: Partial<MoveCategory>) {
  try {
    const { data, error } = await supabase
      .from('move_categories')
      .insert([categoryData])
      .select()
      .single();

    if (error) {
      return { data: null, error: error as Error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 更新招式大类
export async function updateMoveCategory(id: number, categoryData: Partial<MoveCategory>) {
  try {
    const { data, error } = await supabase
      .from('move_categories')
      .update(categoryData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error as Error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 删除招式大类
export async function deleteMoveCategory(id: number) {
  try {
    const { error } = await supabase
      .from('move_categories')
      .delete()
      .eq('id', id);

    if (error) {
      return { data: null, error: error as Error };
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 获取招式小类列表
export async function getMoveSubCategories(params: PaginationParams & { category_id?: number }) {
  try {
    let query = supabase
      .from('move_sub_categories')
      .select('*, move_categories(*)', { count: 'exact' });

    if (params.category_id) {
      query = query.eq('category_id', params.category_id);
    }

    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    
    const { data, error, count } = await query
      .range(from, to)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    return { data, error, total: count || 0 };
  } catch (error) {
    return { data: null, error: error as Error, total: 0 };
  }
}

// 创建招式小类
export async function createMoveSubCategory(subCategoryData: Partial<MoveSubCategory>) {
  try {
    const { data, error } = await supabase
      .from('move_sub_categories')
      .insert([subCategoryData])
      .select()
      .single();

    if (error) {
      return { data: null, error: error as Error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 更新招式小类
export async function updateMoveSubCategory(id: number, subCategoryData: Partial<MoveSubCategory>) {
  try {
    const { data, error } = await supabase
      .from('move_sub_categories')
      .update(subCategoryData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error as Error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 删除招式小类
export async function deleteMoveSubCategory(id: number) {
  try {
    const { error } = await supabase
      .from('move_sub_categories')
      .delete()
      .eq('id', id);

    if (error) {
      return { data: null, error: error as Error };
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 获取所有招式大类（不分页，用于下拉选择）
export async function getAllMoveCategories() {
  try {
    const { data, error } = await supabase
      .from('move_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return { data: null, error: error as Error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// ========================================
// 社区交流视频管理函数
// ========================================

// 获取社区交流视频列表
export async function getCommunityVideos(params: PaginationParams & FilterParams) {
  let query = supabase
    .from(TABLES.COMMUNITY_VIDEOS)
    .select('*', { count: 'exact' });

  // 应用筛选条件
  if (params.status) {
    query = query.eq('status', params.status);
  }
  if (params.search) {
    query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`);
  }
  if (params.date_range && params.date_range.length === 2) {
    query = query.gte('created_at', params.date_range[0])
                 .lte('created_at', params.date_range[1]);
  }

  // 应用分页
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  
  const { data, error, count } = await query
    .range(from, to)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { data: null, error, total: count || 0 };
  }

  // 查询用户信息
  const enrichedData = await Promise.all(
    data.map(async (video) => {
      const userResult = await supabase
        .from(TABLES.USER_PROFILES)
        .select('nickname, email')
        .eq('id', video.user_id)
        .single();

      return {
        ...video,
        user_profiles: userResult.data || { nickname: '未知用户', email: '未知邮箱' }
      };
    })
  );

  return { data: enrichedData, error: null, total: count || 0 };
}

// 审核社区交流视频
export async function reviewCommunityVideo(id: string, status: 'approved' | 'rejected', adminNote?: string) {
  try {
    console.log('审核社区交流视频，ID:', id, '状态:', status);
    
    // 查询视频记录
    const { data: video, error: videoError } = await supabase
      .from(TABLES.COMMUNITY_VIDEOS)
      .select('*')
      .eq('id', id)
      .single();

    if (videoError || !video) {
      console.error('查询视频记录失败:', videoError);
      return { data: null, error: videoError || new Error('找不到视频记录') };
    }

    console.log('找到视频记录:', video);

    // 检查是否已经审核过
    if (video.status !== 'pending') {
      return { data: null, error: new Error(`该视频已经审核过，当前状态: ${video.status}`) };
    }

    // 更新视频状态
    console.log('开始更新视频状态...');
    const { error: updateError } = await supabase
      .from(TABLES.COMMUNITY_VIDEOS)
      .update({
        status,
        admin_note: adminNote,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('更新视频状态失败:', updateError);
      return { data: null, error: updateError };
    }

    console.log('社区交流视频审核成功');
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error('审核社区交流视频异常:', error);
    return { data: null, error: error as Error };
  }
}

// ==================== 成就分类管理 ====================

// 获取所有成就分类
export async function getAchievementCategories() {
  try {
    const { data, error } = await supabase
      .from(TABLES.ACHIEVEMENT_CATEGORIES)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取成就分类列表失败:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('获取成就分类列表异常:', error);
    return { data: null, error: error as Error };
  }
}

// 创建成就分类
export async function createAchievementCategory(name: string) {
  try {
    const { data, error } = await supabase
      .from(TABLES.ACHIEVEMENT_CATEGORIES)
      .insert([{ name }])
      .select()
      .single();

    if (error) {
      console.error('创建成就分类失败:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('创建成就分类异常:', error);
    return { data: null, error: error as Error };
  }
}

// 更新成就分类
export async function updateAchievementCategory(id: number, name: string) {
  try {
    const { data, error } = await supabase
      .from(TABLES.ACHIEVEMENT_CATEGORIES)
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新成就分类失败:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('更新成就分类异常:', error);
    return { data: null, error: error as Error };
  }
}

// 删除成就分类
export async function deleteAchievementCategory(id: number) {
  try {
    const { error } = await supabase
      .from(TABLES.ACHIEVEMENT_CATEGORIES)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除成就分类失败:', error);
      return { data: null, error };
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error('删除成就分类异常:', error);
    return { data: null, error: error as Error };
  }
}

// ==================== 成就管理 ====================

// 获取所有成就
export async function getAchievements() {
  try {
    const { data: achievements, error } = await supabase
      .from(TABLES.ACHIEVEMENTS)
      .select('*, achievement_categories(name)') // 关联查询分类名称
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取成就列表失败:', error);
      return { data: null, error };
    }

    // 为每个成就获取关联的招式数量和ID列表
    const achievementsWithDetails = await Promise.all(
      (achievements || []).map(async (achievement) => {
        const { data: achievementMoves, count } = await supabase
          .from('achievement_moves')
          .select('move_id', { count: 'exact' })
          .eq('achievement_id', achievement.id);

        return {
          ...achievement,
          category: achievement.achievement_categories ? { name: achievement.achievement_categories.name } : null,
          moves_count: count || 0,
          move_ids: (achievementMoves || []).map(am => am.move_id)
        };
      })
    );

    return { data: achievementsWithDetails, error: null };
  } catch (error) {
    console.error('获取成就列表异常:', error);
    return { data: null, error: error as Error };
  }
}

// 创建成就
export async function createAchievement(achievement: {
  name: string;
  description: string;
  difficulty: number;
  points: number;
  is_active: boolean;
  icon_url?: string;
  move_ids: number[];
  category_id?: number;
}) {
  try {
    // 1. 创建成就
    const { data: newAchievement, error: createError } = await supabase
      .from(TABLES.ACHIEVEMENTS)
      .insert({
        name: achievement.name,
        description: achievement.description,
        difficulty: achievement.difficulty,
        points: achievement.points,
        is_active: achievement.is_active,
        icon_url: achievement.icon_url || null,
        category_id: achievement.category_id || null
      })
      .select()
      .single();

    if (createError || !newAchievement) {
      console.error('创建成就失败:', createError);
      return { data: null, error: createError };
    }

    // 2. 关联招式
    if (achievement.move_ids && achievement.move_ids.length > 0) {
      const achievementMoves = achievement.move_ids.map(moveId => ({
        achievement_id: newAchievement.id,
        move_id: moveId
      }));

      const { error: movesError } = await supabase
        .from('achievement_moves')
        .insert(achievementMoves);

      if (movesError) {
        console.error('关联招式失败:', movesError);
        // 如果关联失败，删除已创建的成就
        await supabase.from(TABLES.ACHIEVEMENTS).delete().eq('id', newAchievement.id);
        return { data: null, error: movesError };
      }
    }

    return { data: newAchievement, error: null };
  } catch (error) {
    console.error('创建成就异常:', error);
    return { data: null, error: error as Error };
  }
}

// 更新成就
export async function updateAchievement(id: string, achievement: {
  name: string;
  description: string;
  difficulty: number;
  points: number;
  is_active: boolean;
  icon_url?: string;
  move_ids: number[];
  category_id?: number;
}) {
  try {
    // 1. 更新成就基本信息
    const { data: updatedAchievement, error: updateError } = await supabase
      .from(TABLES.ACHIEVEMENTS)
      .update({
        name: achievement.name,
        description: achievement.description,
        difficulty: achievement.difficulty,
        points: achievement.points,
        is_active: achievement.is_active,
        icon_url: achievement.icon_url || null,
        category_id: achievement.category_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('更新成就失败:', updateError);
      return { data: null, error: updateError };
    }

    // 2. 更新关联招式：先删除旧的，再插入新的
    const { error: deleteError } = await supabase
      .from('achievement_moves')
      .delete()
      .eq('achievement_id', id);

    if (deleteError) {
      console.error('删除旧的招式关联失败:', deleteError);
      return { data: null, error: deleteError };
    }

    if (achievement.move_ids && achievement.move_ids.length > 0) {
      const achievementMoves = achievement.move_ids.map(moveId => ({
        achievement_id: id,
        move_id: moveId
      }));

      const { error: insertError } = await supabase
        .from('achievement_moves')
        .insert(achievementMoves);

      if (insertError) {
        console.error('插入新的招式关联失败:', insertError);
        return { data: null, error: insertError };
      }
    }

    return { data: updatedAchievement, error: null };
  } catch (error) {
    console.error('更新成就异常:', error);
    return { data: null, error: error as Error };
  }
}

// 删除成就
export async function deleteAchievement(id: string) {
  try {
    // Supabase 会通过 CASCADE 自动删除关联的 achievement_moves 和 user_achievements
    const { error } = await supabase
      .from(TABLES.ACHIEVEMENTS)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除成就失败:', error);
      return { data: null, error };
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error('删除成就异常:', error);
    return { data: null, error: error as Error };
  }
}

// ========================================
// 标签库管理函数
// ========================================

// 获取所有标签
export async function getTags() {
  try {
    const { data, error } = await supabase
      .from('move_tags')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 创建标签
export async function createTag(tagName: string) {
  try {
    const { data, error } = await supabase
      .from('move_tags')
      .insert([{ tag_name: tagName }])
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// 删除标签
export async function deleteTag(id: number) {
  try {
    const { error } = await supabase
      .from('move_tags')
      .delete()
      .eq('id', id);

    if (error) {
      return { data: null, error };
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}
