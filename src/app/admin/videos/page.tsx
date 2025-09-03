'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Input, Select, Button, Space, Tag, Typography, Row, Col, message, Modal, Form, Image } from 'antd';
import { ReloadOutlined, EyeOutlined, CheckCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { getVideoSubmissions, reviewVideoSubmission } from '@/lib/admin-queries';
import { UserMoveSubmission } from '@/types/admin';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

export default function VideosPage() {
  const [videos, setVideos] = useState<UserMoveSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<UserMoveSubmission | null>(null);
  const [reviewForm] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const loadVideos = async (page = 1, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      console.log('开始加载视频数据...', { searchValue, statusFilter, page, pageSize });
      const result = await getVideoSubmissions({
        page,
        pageSize,
        search: searchValue,
        status: statusFilter || undefined
      });
      
      console.log('API 返回结果:', result);
      
      if (result.error) {
        console.error('API 错误:', result.error);
        message.error('加载视频数据失败');
        return;
      }
      
      console.log('设置视频数据:', result.data);
      console.log('筛选条件:', { searchValue, statusFilter });
      setVideos(result.data || []);
      setPagination(prev => ({
        ...prev,
        current: page,
        total: result.total || 0,
      }));
    } catch (error) {
      console.error('加载视频数据失败:', error);
      message.error('加载视频数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadVideosWithStatus = async (status: string) => {
    setLoading(true);
    try {
      console.log('开始加载视频数据（带状态筛选）...', { searchValue, status });
      const result = await getVideoSubmissions({
        page: 1,
        pageSize: 1000, // 一次性加载所有视频
        search: searchValue,
        status: status || undefined
      });
      
      console.log('API 返回结果:', result);
      
      if (result.error) {
        console.error('API 错误:', result.error);
        message.error('加载视频数据失败');
        return;
      }
      
      console.log('设置视频数据:', result.data);
      console.log('筛选条件:', { searchValue, status });
      setVideos(result.data || []);
    } catch (error) {
      console.error('加载视频数据失败:', error);
      message.error('加载视频数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadVideosWithoutFilter = async () => {
    setLoading(true);
    try {
      console.log('开始加载所有视频数据（无筛选）...');
      const result = await getVideoSubmissions({
        page: 1,
        pageSize: 1000, // 一次性加载所有视频
        search: '',
        status: undefined
      });
      
      console.log('API 返回结果:', result);
      
      if (result.error) {
        console.error('API 错误:', result.error);
        message.error('加载视频数据失败');
        return;
      }
      
      console.log('设置视频数据:', result.data);
      console.log('筛选条件: 无筛选');
      setVideos(result.data || []);
    } catch (error) {
      console.error('加载视频数据失败:', error);
      message.error('加载视频数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时加载一次

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setTimeout(() => {
      loadVideos(1);
    }, 500);
  };

  const handleStatusFilter = (value: string) => {
    console.log('状态筛选值变化:', value);
    setStatusFilter(value);
    // 直接传递状态值，不依赖状态变量
    setTimeout(() => {
      loadVideos(1);
    }, 300);
  };

  const handleReset = () => {
    setSearchValue('');
    setStatusFilter('');
    // 重置后重新加载所有数据，不使用筛选条件
    loadVideosWithoutFilter();
  };

  const handleTableChange = (paginationInfo: { current?: number; pageSize?: number }) => {
    const { current, pageSize } = paginationInfo;
    if (current && pageSize) {
      loadVideos(current, pageSize);
    }
  };

  const handleReview = (video: UserMoveSubmission) => {
    setSelectedVideo(video);
    setReviewModalVisible(true);
    reviewForm.resetFields();
  };

  const handleReviewSubmit = async (values: { action: string; note?: string }) => {
    if (!selectedVideo) return;

    try {
      const result = await reviewVideoSubmission(
        selectedVideo.id,
        values.action as 'approved' | 'rejected',
        values.note
      );

      if (result.error) {
        message.error('审核操作失败');
        return;
      }

      message.success('审核操作成功');
      setReviewModalVisible(false);
      setSelectedVideo(null);
      loadVideos(1); // 重新加载数据
    } catch (error) {
      console.error('审核操作失败:', error);
      message.error('审核操作失败');
    }
  };

  const handlePlayVideo = (videoUrl: string) => {
    window.open(videoUrl, '_blank');
  };

  const getStatusTag = (status: string) => {
    const statusMap = {
      pending: { color: 'orange', text: '待审核' },
      approved: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已拒绝' },
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  const columns = [
    {
      title: '用户信息',
      key: 'user_info',
      render: (record: UserMoveSubmission) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {record.user_profiles?.nickname || record.user_profiles?.email || '未知用户'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.user_profiles?.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '招式信息',
      key: 'move_info',
      render: (record: UserMoveSubmission) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>
            {record.moves?.move_name || '未知招式'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.moves?.main_type} - {record.moves?.sub_type}
          </div>
        </div>
      ),
    },
    {
      title: '视频预览',
      key: 'video_preview',
      render: (record: UserMoveSubmission) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {record.thumbnail_url && (
            <Image
              src={record.thumbnail_url}
              alt="视频缩略图"
              width={60}
              height={40}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          )}
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handlePlayVideo(record.video_url)}
          >
            播放视频
          </Button>
        </div>
      ),
    },
    {
      title: '提交说明',
      dataIndex: 'submission_note',
      key: 'submission_note',
      render: (note: string) => note || '无说明',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: UserMoveSubmission) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handlePlayVideo(record.video_url)}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleReview(record)}
            >
              审核
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>视频审核</Title>
      
      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索招式名或用户昵称"
              allowClear
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="审核状态"
              allowClear
              value={statusFilter}
              onChange={handleStatusFilter}
              style={{ width: '100%' }}
            >
              <Option value="pending">待审核</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleReset}
              style={{ width: '100%' }}
            >
              重置
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 视频列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={videos}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 审核弹窗 */}
      <Modal
        title="视频审核"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedVideo && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>用户：</strong>{selectedVideo.user_profiles?.nickname || selectedVideo.user_profiles?.email || '未知用户'}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>招式：</strong>{selectedVideo.moves?.move_name}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>提交说明：</strong>{selectedVideo.submission_note || '无'}
            </div>
            
            <Form form={reviewForm} onFinish={handleReviewSubmit}>
              <Form.Item
                name="action"
                label="审核结果"
                rules={[{ required: true, message: '请选择审核结果' }]}
              >
                <Select placeholder="选择审核结果">
                  <Option value="approved">通过</Option>
                  <Option value="rejected">拒绝</Option>
                </Select>
              </Form.Item>
              
              <Form.Item
                name="note"
                label="审核备注"
              >
                <Input.TextArea rows={4} placeholder="请输入审核备注（可选）" />
              </Form.Item>
              
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setReviewModalVisible(false)}>
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit">
                    提交审核
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
