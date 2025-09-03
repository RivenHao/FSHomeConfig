'use client';

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Typography, Layout } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { verifyAdminAccess } from '@/lib/admin-auth';

const { Title } = Typography;
const { Content } = Layout;

interface LoginForm {
  email: string;
  password: string;
}

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 检查是否已经登录，如果已登录则跳转到仪表盘
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await import('@supabase/supabase-js').then(({ createClient }) => {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );
          return supabase.auth.getUser();
        });
        
        if (user) {
          // 检查是否是管理员
          const { data: adminData } = await import('@supabase/supabase-js').then(({ createClient }) => {
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            return supabase
              .from('admin_users')
              .select('*')
              .eq('id', user.id)
              .eq('is_active', true)
              .single();
          });
          
          if (adminData) {
            router.push('/admin/dashboard');
          }
        }
              } catch {
          // 忽略错误，继续显示登录页
        }
    };
    
    checkAuth();
  }, [router]);

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      const result = await verifyAdminAccess(values.email, values.password);
      
      if (result.success) {
        message.success('登录成功！');
        router.push('/admin/dashboard');
      } else {
        message.error(result.error || '登录失败');
      }
    } catch (error) {
      console.error('登录错误:', error);
      message.error('登录过程中发生错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <Card 
          style={{ 
            width: '100%', 
            maxWidth: 400, 
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            borderRadius: '12px'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Title level={2} style={{ color: '#1890ff', marginBottom: 8 }}>
              FSHome后台管理系统
            </Title>
            <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
              请使用管理员账号登录
            </p>
          </div>
          
          <Form
            name="admin_login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
            layout="vertical"
          >
            <Form.Item
              name="email"
              label="管理员邮箱"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="请输入管理员邮箱"
                style={{ height: '48px' }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度至少6位' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="请输入密码"
                style={{ height: '48px' }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ 
                  width: '100%', 
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: '500',
                  borderRadius: '8px'
                }}
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </Form.Item>
          </Form>

          <div style={{ 
            marginTop: '24px', 
            textAlign: 'center',
            padding: '16px',
            background: '#f5f5f5',
            borderRadius: '8px'
          }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
              提示：请确保您拥有管理员权限
            </p>
          </div>
        </Card>
      </Content>
    </Layout>
  );
}
