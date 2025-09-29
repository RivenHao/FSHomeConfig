'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Tag, DatePicker, Avatar, Image } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getParticipations,
  reviewParticipation,
  getChallenges,
} from '@/lib/weekly-challenge-queries';
import {
  UserParticipation,
  WeeklyChallenge,
  ReviewParticipationRequest,
} from '@/types/weekly-challenge';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

export default function ParticipationsPage() {
  const [participations, setParticipations] = useState<UserParticipation[]>([]);
  const [challenges, setChallenges] = useState<WeeklyChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedParticipation, setSelectedParticipation] = useState<UserParticipation | null>(null);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({
    status: 'pending',
    challenge_id: '',
    date_range: null as [string, string] | null,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 加载参与记录列表
  const loadParticipations = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const filterParams = {
        status: (filters.status || undefined) as 'pending' | 'approved' | 'rejected' | undefined,
        challenge_id: filters.challenge_id || undefined,
        date_range: filters.date_range || undefined,
      };

      console.log('🔍 查询参与记录:', filterParams);

      const result = await getParticipations(page, pageSize, filterParams);
      if (result.error) {
        message.error('加载参与记录失败');
        return;
      }
      
      if (result.data) {
        console.log('📊 获取到参与记录:', result.data.data.length, '条');
        setParticipations(result.data.data);
        setPagination({
          current: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
      }
    } catch (error) {
      console.error('加载参与记录失败:', error);
      message.error('加载参与记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载挑战赛列表
  const loadChallenges = async () => {
    try {
      const result = await getChallenges(1, 100); // 获取所有挑战赛
      if (result.data) {
        setChallenges(result.data.data);
      }
    } catch (error) {
      console.error('加载挑战赛数据失败:', error);
    }
  };

  useEffect(() => {
    loadParticipations();
    loadChallenges();
  }, []);

  useEffect(() => {
    loadParticipations(1, pagination.pageSize);
  }, [filters]);

  const handleReview = (participation: UserParticipation) => {
    setSelectedParticipation(participation);
    form.resetFields();
    setReviewModalVisible(true);
  };

  const handleQuickReview = async (participation: UserParticipation, status: 'approved' | 'rejected') => {
    try {
      const reviewData: ReviewParticipationRequest = {
        status,
        admin_note: status === 'approved' ? '快速通过审核' : '快速拒绝',
      };

      const result = await reviewParticipation(participation.id, reviewData);
      if (result.error) {
        message.error(`${status === 'approved' ? '通过' : '拒绝'}审核失败`);
        return;
      }

      message.success(`${status === 'approved' ? '通过' : '拒绝'}审核成功`);
      loadParticipations(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('审核失败:', error);
      message.error('审核失败');
    }
  };

  const handleSubmitReview = async (values: { status: 'approved' | 'rejected'; admin_note?: string }) => {
    if (!selectedParticipation) return;

    try {
      const reviewData: ReviewParticipationRequest = {
        status: values.status,
        admin_note: values.admin_note,
      };

      const result = await reviewParticipation(selectedParticipation.id, reviewData);
      if (result.error) {
        message.error('提交审核失败');
        return;
      }

      message.success('审核完成');
      setReviewModalVisible(false);
      form.resetFields();
      setSelectedParticipation(null);
      loadParticipations(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('提交审核失败:', error);
      message.error('提交审核失败');
    }
  };

  const handleTableChange = (paginationConfig: { current?: number; pageSize?: number }) => {
    loadParticipations(paginationConfig.current || 1, paginationConfig.pageSize || 10);
  };

  const handleFilterChange = (key: string, value: string | [string, string] | null) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetFilters = () => {
    setFilters({
      status: 'pending',
      challenge_id: '',
      date_range: null,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'approved': return 'green';
      case 'rejected': return 'red';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待审核';
      case 'approved': return '已通过';
      case 'rejected': return '已拒绝';
      default: return '未知';
    }
  };

  const getModeTypeText = (type: string) => {
    return type === 'simple' ? '简单模式' : '困难模式';
  };

  const getModeTypeColor = (type: string) => {
    return type === 'simple' ? 'green' : 'red';
  };

  const columns = [
    {
      title: '用户信息',
      key: 'user_info',
      width: 150,
      render: (record: UserParticipation) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size="small" src={record.user_profile?.image_url}>
            {record.user_profile?.nickname?.[0] || 'U'}
          </Avatar>
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {record.user_profile?.nickname || '未知用户'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              ID: {record.user_id.slice(-8)}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '挑战信息',
      key: 'challenge_info',
      render: (record: UserParticipation) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>
            {record.weekly_challenges?.title}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            第{record.weekly_challenges?.week_number}周
          </div>
          <Tag 
            color={getModeTypeColor(record.challenge_modes?.mode_type || '')} 
            style={{ marginTop: 4, fontSize: '12px' }}
          >
            {getModeTypeText(record.challenge_modes?.mode_type || '')}
          </Tag>
        </div>
      ),
    },
    {
      title: '提交视频',
      key: 'video',
      width: 120,
      render: (record: UserParticipation) => (
        <div style={{ textAlign: 'center' }}>
          {record.thumbnail_url && (
            <Image
              src={record.thumbnail_url}
              alt="视频缩略图"
              width={80}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4, marginBottom: 4 }}
              preview={false}
            />
          )}
          <div>
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => window.open(record.video_url, '_blank')}
              size="small"
            >
              观看视频
            </Button>
          </div>
        </div>
      ),
    },
    {
      title: '提交说明',
      dataIndex: 'submission_note',
      key: 'submission_note',
      width: 200,
      render: (text: string) => (
        text ? (
          <div style={{
            maxWidth: '180px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {text}
          </div>
        ) : (
          <span style={{ color: '#999' }}>无说明</span>
        )
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (text: string) => dayjs(text).format('MM-DD HH:mm'),
    },
    {
      title: '审核时间',
      dataIndex: 'reviewed_at',
      key: 'reviewed_at',
      render: (text: string) => (
        text ? dayjs(text).format('MM-DD HH:mm') : '-'
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (record: UserParticipation) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleQuickReview(record, 'approved')}
              >
                通过
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => handleQuickReview(record, 'rejected')}
              >
                拒绝
              </Button>
            </>
          )}
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleReview(record)}
            size="small"
          >
            详细审核
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="参与审核管理"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadParticipations(pagination.current, pagination.pageSize)}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {/* 筛选条件 */}
        <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#fafafa', borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <span style={{ marginRight: 8 }}>审核状态:</span>
              <Select
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value)}
                style={{ width: 120 }}
              >
                <Option value="">全部</Option>
                <Option value="pending">待审核</Option>
                <Option value="approved">已通过</Option>
                <Option value="rejected">已拒绝</Option>
              </Select>
            </div>

            <div>
              <span style={{ marginRight: 8 }}>挑战赛:</span>
              <Select
                value={filters.challenge_id}
                onChange={(value) => handleFilterChange('challenge_id', value)}
                style={{ width: 200 }}
                placeholder="选择挑战赛"
              >
                <Option value="">全部挑战赛</Option>
                {challenges.map(challenge => (
                  <Option key={challenge.id} value={challenge.id}>
                    {challenge.title} (第{challenge.week_number}周)
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <span style={{ marginRight: 8 }}>提交时间:</span>
              <RangePicker
                value={filters.date_range ? [dayjs(filters.date_range[0]), dayjs(filters.date_range[1])] : null}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    handleFilterChange('date_range', [
                      dates[0].format('YYYY-MM-DD'),
                      dates[1].format('YYYY-MM-DD')
                    ]);
                  } else {
                    handleFilterChange('date_range', null);
                  }
                }}
                style={{ width: 240 }}
              />
            </div>

            <Button onClick={resetFilters}>重置筛选</Button>
          </div>

          <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
            共找到 {pagination.total} 条记录
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={participations}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 详细审核Modal */}
      <Modal
        title="详细审核"
        open={reviewModalVisible}
        onCancel={() => {
          setReviewModalVisible(false);
          form.resetFields();
          setSelectedParticipation(null);
        }}
        footer={null}
        width={800}
      >
        {selectedParticipation && (
          <div>
            {/* 参与信息展示 */}
            <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#fafafa', borderRadius: 6 }}>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ flex: 1 }}>
                  <h4>用户信息</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Avatar src={selectedParticipation.user_profile?.image_url}>
                      {selectedParticipation.user_profile?.nickname?.[0] || 'U'}
                    </Avatar>
                    <span>{selectedParticipation.user_profile?.nickname || '未知用户'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    用户ID: {selectedParticipation.user_id}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <h4>挑战信息</h4>
                  <div>{selectedParticipation.weekly_challenges?.title}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    第{selectedParticipation.weekly_challenges?.week_number}周 | 
                    <Tag 
                      color={getModeTypeColor(selectedParticipation.challenge_modes?.mode_type || '')} 
                      style={{ marginLeft: 4, fontSize: '12px' }}
                    >
                      {getModeTypeText(selectedParticipation.challenge_modes?.mode_type || '')}
                    </Tag>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <h4>提交时间</h4>
                  <div>{dayjs(selectedParticipation.submitted_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    当前状态: 
                    <Tag color={getStatusColor(selectedParticipation.status)} style={{ marginLeft: 4 }}>
                      {getStatusText(selectedParticipation.status)}
                    </Tag>
                  </div>
                </div>
              </div>

              {selectedParticipation.submission_note && (
                <div style={{ marginTop: 16 }}>
                  <h4>用户提交说明</h4>
                  <div style={{ padding: 8, backgroundColor: 'white', borderRadius: 4 }}>
                    {selectedParticipation.submission_note}
                  </div>
                </div>
              )}
            </div>

            {/* 视频预览 */}
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <h4>提交视频</h4>
              {selectedParticipation.thumbnail_url && (
                <div style={{ marginBottom: 8 }}>
                  <Image
                    src={selectedParticipation.thumbnail_url}
                    alt="视频缩略图"
                    width={200}
                    height={150}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                  />
                </div>
              )}
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => window.open(selectedParticipation.video_url, '_blank')}
              >
                观看完整视频
              </Button>
            </div>

            {/* 审核表单 */}
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmitReview}
              initialValues={{
                status: selectedParticipation.status,
                admin_note: selectedParticipation.admin_note,
              }}
            >
              <Form.Item
                name="status"
                label="审核结果"
                rules={[{ required: true, message: '请选择审核结果' }]}
              >
                <Select placeholder="请选择审核结果">
                  <Option value="approved">通过</Option>
                  <Option value="rejected">拒绝</Option>
                  <Option value="pending">待审核</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="admin_note"
                label="审核备注"
              >
                <TextArea
                  rows={3}
                  placeholder="请输入审核备注，说明通过或拒绝的原因"
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    提交审核
                  </Button>
                  <Button onClick={() => {
                    setReviewModalVisible(false);
                    form.resetFields();
                    setSelectedParticipation(null);
                  }}>
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}