import { supabase, TABLES } from './supabase';
import { AdminUser } from '@/types/admin';

// 验证管理员身份
export async function verifyAdminAccess(email: string, password: string): Promise<{ success: boolean; admin?: AdminUser; error?: string }> {
  try {
    // 1. 验证用户登录
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return { success: false, error: '邮箱或密码错误' };
    }

    // 2. 检查用户是否在admin_users表中
    const { data: adminData, error: adminError } = await supabase
      .from(TABLES.ADMIN_USERS)
      .select('*')
      .eq('id', authData.user.id)
      .eq('is_active', true)
      .single();

    if (adminError || !adminData) {
      // 登录成功但不在管理员表中，需要登出
      await supabase.auth.signOut();
      return { success: false, error: '您没有管理员权限' };
    }

    return { success: true, admin: adminData };
  } catch (error) {
    console.error('管理员验证错误:', error);
    return { success: false, error: '验证过程中发生错误' };
  }
}

// 获取当前管理员信息
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: adminData } = await supabase
      .from(TABLES.ADMIN_USERS)
      .select('*')
      .eq('id', user.id)
      .eq('is_active', true)
      .single();

    return adminData;
  } catch (error) {
    console.error('获取当前管理员信息错误:', error);
    return null;
  }
}

// 检查是否有超级管理员权限
export function hasSuperAdminAccess(admin: AdminUser): boolean {
  return admin.role === 'super_admin';
}

// 登出
export async function adminSignOut(): Promise<void> {
  await supabase.auth.signOut();
}
