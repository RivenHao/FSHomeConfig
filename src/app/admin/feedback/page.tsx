'use client';

import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Input, message, Space, Select, Card, Statistic, Row, Col, Typography, Tooltip } from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, MessageOutlined, BugOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { supabase } from '@/lib/supabase';

const { TextArea } = Input;
const { Text } = Typography;

interface UserFeedback {
  id: string;
  user_id: string | null;
  feedback_type: 'suggestion' | 'bug' | 'other';
  content: string;
  contact: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'closed';
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    nickname: string;
    email: string;
  } | null;
}

interface FeedbackStats {
  total: number;
  pending: number;
  reviewed: number;
  resolved: number;
}

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FeedbackStats>({ total: 0, pending: 0, reviewed: 0, resolved: 0 });
  const [selectedFeedback, setSelectedFeedback] = useState<UserFeedback | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [adminNote, setAdminNote] = useState('');
  const [updating, setUpdating] = useState(false);

  // 加载反馈数据
  const loadFeedbacks = async () => {
    try {
      setLoading(true);

      // 第一步：获取反馈数据
      let query = supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        query = query.eq('feedback_type', typeFilter);
      }

      const { data: feedbackData, error } = await query;

      if (error) {
        console.error('获取反馈列表失败:', error);
        message.error('获取反馈列表失败');
        return;
      }

      // 第二步：获取用户信息
      const userIds = (feedbackData || [])
        .map(f => f.user_id)
        .filter((id): id is string => id !== null);
      
      const userMap = new Map<string, { nickname: string; email: string }>();
      
      if (userIds.length > 0) {
        const { data: userProfiles } = await supabase
          .from('user_profiles')
          .select('id, nickname, email')
          .in('id', userIds);
        
        (userProfiles || []).forEach(profile => {
          userMap.set(profile.id, {
            nickname: profile.nickname || '未设置昵称',
            email: profile.email || '',
          });
        });
      }

      // 合并数据
      const feedbacksWithUser = (feedbackData || []).map(feedback => ({
        ...feedback,
        user_profiles: feedback.user_id ? userMap.get(feedback.user_id) || null : null,
      }));

      setFeedbacks(feedbacksWithUser);

      // 获取统计数据
      const { count: total } = await supabase
        .from('user_feedback')
        .select('*', { count: 'exact', head: true });

      const { count: pending } = await supabase
        .from('user_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: reviewed } = await supabase
        .from('user_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'reviewed');

      const { count: resolved } = await supabase
        .from('user_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved');

      setStats({
        total: total || 0,
        pending: pending || 0,
        reviewed: reviewed || 0,
        resolved: resolved || 0,
      });
    } catch (error) {
      console.error('加载反馈数据失败:', error);
      message.error('加载反馈数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter]);

  // 更新反馈状态
  const updateFeedbackStatus = async (id: string, status: string, note?: string) => {
    try {
      setUpdating(true);

      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (note !== undefined) {
        updateData.admin_note = note;
      }

      const { error } = await supabase
        .from('user_feedback')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('更新反馈状态失败:', error);
        message.error('更新失败');
        return;
      }

      message.success('更新成功');
      loadFeedbacks();
      setDetailModalVisible(false);
    } catch (error) {
      console.error('更新反馈状态失败:', error);
      message.error('更新失败');
    } finally {
      setUpdating(false);
    }
  };

  // 查看详情
  const handleViewDetail = (feedback: UserFeedback) => {
    setSelectedFeedback(feedback);
    setAdminNote(feedback.admin_note || '');
    setDetailModalVisible(true);
  };

  // 获取反馈类型标签
  const getFeedbackTypeTag = (type: string) => {
    switch (type) {
      case 'suggestion':
        return <Tag icon={<MessageOutlined />} color="blue">功能建议</Tag>;
      case 'bug':
        return <Tag icon={<BugOutlined />} color="red">问题反馈</Tag>;
      case 'other':
        return <Tag icon={<QuestionCircleOutlined />} color="default">其他</Tag>;
      default:
        return <Tag>{type}</Tag>;
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'pending':
        return <Tag color="orange">待处理</Tag>;
      case 'reviewed':
        return <Tag color="blue">已查看</Tag>;
      case 'resolved':
        return <Tag color="green">已解决</Tag>;
      case 'closed':
        return <Tag color="default">已关闭</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: '反馈类型',
      dataIndex: 'feedback_type',
      key: 'feedback_type',
      width: 120,
      fixed: 'left' as const,
      render: (type: string) => getFeedbackTypeTag(type),
    },
    {
      title: '反馈内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string) => (
        <Tooltip title={content}>
          <Text style={{ maxWidth: 300 }} ellipsis>
            {content}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '用户',
      key: 'user',
      width: 150,
      render: (_: unknown, record: UserFeedback) => (
        <div>
          <div>{record.user_profiles?.nickname || '匿名用户'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.contact || record.user_profiles?.email || '-'}
          </Text>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: UserFeedback) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              icon={<CheckOutlined />}
              onClick={() => updateFeedbackStatus(record.id, 'reviewed')}
            >
              已读
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>意见反馈管理</h2>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总反馈数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待处理" value={stats.pending} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已查看" value={stats.reviewed} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已解决" value={stats.resolved} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      {/* 筛选和操作 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 150 }}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'pending', label: '待处理' },
            { value: 'reviewed', label: '已查看' },
            { value: 'resolved', label: '已解决' },
            { value: 'closed', label: '已关闭' },
          ]}
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ width: 150 }}
          options={[
            { value: 'all', label: '全部类型' },
            { value: 'suggestion', label: '功能建议' },
            { value: 'bug', label: '问题反馈' },
            { value: 'other', label: '其他' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={loadFeedbacks}>
          刷新
        </Button>
      </div>

      {/* 反馈列表 */}
      <Table
        columns={columns}
        dataSource={feedbacks}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* 详情弹窗 */}
      <Modal
        title="反馈详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedFeedback && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">反馈类型：</Text>
              {getFeedbackTypeTag(selectedFeedback.feedback_type)}
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">状态：</Text>
              {getStatusTag(selectedFeedback.status)}
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">用户：</Text>
              <Text>{selectedFeedback.user_profiles?.nickname || '匿名用户'}</Text>
            </div>

            {(selectedFeedback.contact || selectedFeedback.user_profiles?.email) && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">联系方式：</Text>
                <Text>{selectedFeedback.contact || selectedFeedback.user_profiles?.email}</Text>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">提交时间：</Text>
              <Text>{new Date(selectedFeedback.created_at).toLocaleString('zh-CN')}</Text>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">反馈内容：</Text>
              <div style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 6,
                marginTop: 8,
                whiteSpace: 'pre-wrap',
              }}>
                {selectedFeedback.content}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">管理员备注：</Text>
              <TextArea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                placeholder="添加处理备注..."
                style={{ marginTop: 8 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button onClick={() => setDetailModalVisible(false)}>
                取消
              </Button>
              {selectedFeedback.status !== 'resolved' && (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={updating}
                  onClick={() => updateFeedbackStatus(selectedFeedback.id, 'resolved', adminNote)}
                >
                  标记已解决
                </Button>
              )}
              {selectedFeedback.status !== 'closed' && (
                <Button
                  icon={<CloseOutlined />}
                  loading={updating}
                  onClick={() => updateFeedbackStatus(selectedFeedback.id, 'closed', adminNote)}
                >
                  关闭
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

