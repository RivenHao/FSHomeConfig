'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, List, Typography, Spin } from 'antd';
import {
  UserOutlined,
  VideoCameraOutlined,
  BookOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { getDashboardStats } from '@/lib/admin-queries';

const { Title, Text } = Typography;

interface DashboardStats {
  totalUsers: number;
  pendingVideos: number;
  pendingTips: number;
  totalMoves: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: '审核视频',
      description: '处理待审核的用户视频提交',
      icon: <VideoCameraOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      action: () => router.push('/admin/videos'),
      count: stats?.pendingVideos || 0,
      color: '#1890ff',
    },
    {
      title: '审核心得',
      description: '处理待审核的用户心得',
      icon: <BookOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      action: () => router.push('/admin/tips'),
      count: stats?.pendingTips || 0,
      color: '#52c41a',
    },
    {
      title: '用户管理',
      description: '查看和管理注册用户',
      icon: <UserOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
      action: () => router.push('/admin/users'),
      count: stats?.totalUsers || 0,
      color: '#722ed1',
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>仪表盘</Title>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={stats?.totalUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待审核视频"
              value={stats?.pendingVideos || 0}
              prefix={<VideoCameraOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待审核心得"
              value={stats?.pendingTips || 0}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总招式数"
              value={stats?.totalMoves || 0}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="快速操作" extra={<Button type="link">查看全部</Button>}>
            <Row gutter={[16, 16]}>
              {quickActions.map((action, index) => (
                <Col xs={24} sm={12} lg={8} key={index}>
                  <Card
                    hoverable
                    onClick={action.action}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {action.icon}
                      <div style={{ flex: 1 }}>
                        <Title level={5} style={{ margin: 0 }}>
                          {action.title}
                        </Title>
                        <Text type="secondary">{action.description}</Text>
                      </div>
                      <div style={{
                        background: action.color,
                        color: 'white',
                        borderRadius: '50%',
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 'bold',
                      }}>
                        {action.count}
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 最近活动 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="系统状态" extra={<Button type="link">刷新</Button>}>
            <List
              size="small"
              dataSource={[
                { status: '正常', service: '用户认证服务', time: '刚刚' },
                { status: '正常', service: '数据库服务', time: '2分钟前' },
                { status: '正常', service: '文件存储服务', time: '5分钟前' },
                { status: '正常', service: 'API服务', time: '10分钟前' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <span>{item.service}</span>
                    <span style={{ color: '#999', fontSize: '12px' }}>
                      {item.time}
                    </span>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="待处理事项" extra={<Button type="link">查看全部</Button>}>
            <List
              size="small"
              dataSource={[
                { type: '视频审核', count: stats?.pendingVideos || 0, priority: '高' },
                { type: '心得审核', count: stats?.pendingTips || 0, priority: '中' },
                { type: '用户反馈', count: 3, priority: '低' },
                { type: '系统维护', count: 1, priority: '中' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>{item.type}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ color: '#1890ff' }}>{item.count} 项</span>
                      <span style={{
                        color: item.priority === '高' ? '#ff4d4f' : 
                               item.priority === '中' ? '#faad14' : '#52c41a',
                        fontSize: '12px',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: item.priority === '高' ? '#fff1f0' : 
                                   item.priority === '中' ? '#fffbe6' : '#f6ffed',
                      }}>
                        {item.priority}
                      </span>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
