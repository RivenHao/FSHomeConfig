'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, theme, Typography } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  VideoCameraOutlined,
  BookOutlined,
  DashboardOutlined,
  TeamOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  FireOutlined,
  TagsOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentAdmin, adminSignOut, hasSuperAdminAccess } from '@/lib/admin-auth';
import { AdminUser } from '@/types/admin';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();

  const checkAdminAuth = useCallback(async () => {
    try {
      const adminData = await getCurrentAdmin();
      if (!adminData) {
        // 如果不在登录页面，则跳转到登录页
        if (pathname !== '/admin/login') {
          router.push('/admin/login');
        }
        return;
      }
      setAdmin(adminData);
    } catch (error) {
      console.error('验证管理员身份失败:', error);
      // 如果不在登录页面，则跳转到登录页
      if (pathname !== '/admin/login') {
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router, pathname]);

  useEffect(() => {
    checkAdminAuth();
  }, [checkAdminAuth]);

  const handleLogout = async () => {
    try {
      await adminSignOut();
      router.push('/admin/login');
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  const menuItems = [
    {
      key: '/admin/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/admin/users',
      icon: <TeamOutlined />,
      label: '用户管理',
    },
    {
      key: '/admin/moves',
      icon: <FireOutlined />,
      label: '招式库管理',
    },
    {
      key: '/admin/categories',
      icon: <TagsOutlined />,
      label: '招式分类管理',
    },
    {
      key: '/admin/tags',
      icon: <TagsOutlined />,
      label: '标签库管理',
    },
    {
      key: '/admin/videos',
      icon: <VideoCameraOutlined />,
      label: '招式视频审核',
    },
    {
      key: '/admin/community-videos',
      icon: <VideoCameraOutlined />,
      label: '社区交流视频审核',
    },
    {
      key: '/admin/tips',
      icon: <BookOutlined />,
      label: '心得审核',
    },
    {
      key: '/admin/notifications',
      icon: <BellOutlined />,
      label: '系统通知推送',
    },
    {
      key: '/admin/achievements',
      icon: <TrophyOutlined />,
      label: '成就管理',
    },
    {
      key: 'weekly-challenge',
      icon: <FireOutlined />,
      label: '每周挑战赛',
      children: [
        {
          key: '/admin/weekly-challenge/seasons',
          label: '赛季管理',
        },
        {
          key: '/admin/weekly-challenge/challenges',
          label: '挑战赛管理',
        },
        {
          key: '/admin/weekly-challenge/participations',
          label: '参与审核',
        },
        {
          key: '/admin/weekly-challenge/suggestions',
          label: '用户建议',
        },
        {
          key: '/admin/weekly-challenge/leaderboard',
          label: '排行榜管理',
        },
      ],
    },
    ...(admin && hasSuperAdminAccess(admin) ? [{
      key: '/admin/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    }] : []),
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light">
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${token.colorBorder}`,
        }}>
          <Title level={4} style={{ margin: 0, color: token.colorPrimary }}>
            {collapsed ? 'FS' : 'FSHome'}
          </Title>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>
      
      <Layout>
        <Header style={{
          padding: '0 16px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={<BellOutlined />}
              style={{ fontSize: '16px' }}
            />
            
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
                transition: 'background-color 0.2s',
              }}>
                <Avatar icon={<UserOutlined />} />
                <span style={{ color: token.colorText }}>
                  {admin?.email}
                </span>
                <span style={{
                  fontSize: '12px',
                  background: token.colorPrimary,
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: 10,
                }}>
                  {admin?.role === 'super_admin' ? '超级管理员' : '管理员'}
                </span>
              </div>
            </Dropdown>
          </div>
        </Header>
        
        <Content style={{
          margin: '16px',
          padding: '24px',
          background: token.colorBgContainer,
          borderRadius: token.borderRadius,
          minHeight: 'calc(100vh - 120px)',
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
