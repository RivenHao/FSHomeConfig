'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Input, Select, Button, Space, Tag, Typography, Row, Col, message, Modal, Form, Switch } from 'antd';
import { ReloadOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { getMoveTips, reviewMoveTip } from '@/lib/admin-queries';
import { MoveTip } from '@/types/admin';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

export default function TipsPage() {
  const [tips, setTips] = useState<MoveTip[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedTip, setSelectedTip] = useState<MoveTip | null>(null);
  const [reviewForm] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const loadTips = async (page = 1, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const result = await getMoveTips({
        page,
        pageSize,
        search: searchValue,
        status: statusFilter || undefined
      });
      
      if (result.error) {
        message.error('加载心得数据失败');
        return;
      }
      
      setTips(result.data || []);
      setPagination(prev => ({
        ...prev,
        current: page,
        total: result.total || 0,
      }));
    } catch (error) {
      console.error('加载心得数据失败:', error);
      message.error('加载心得数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时加载一次

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setTimeout(() => {
      loadTips(1);
    }, 500);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setTimeout(() => {
      loadTips(1);
    }, 300);
  };

  const handleReset = () => {
    setSearchValue('');
    setStatusFilter('');
    loadTips(1);
  };

  const handleTableChange = (paginationInfo: { current?: number; pageSize?: number }) => {
    const { current, pageSize } = paginationInfo;
    if (current && pageSize) {
      loadTips(current, pageSize);
    }
  };

  const handleReview = (tip: MoveTip) => {
    setSelectedTip(tip);
    setReviewModalVisible(true);
    reviewForm.resetFields();
  };

  const handleReviewSubmit = async (values: { isApproved: boolean }) => {
    if (!selectedTip) return;

    try {
      const result = await reviewMoveTip(
        selectedTip.id,
        values.isApproved
      );

      if (result.error) {
        message.error('审核操作失败');
        return;
      }

      message.success('审核操作成功');
      setReviewModalVisible(false);
      setSelectedTip(null);
      loadTips(); // 重新加载数据
    } catch (error) {
      console.error('审核操作失败:', error);
      message.error('审核操作失败');
    }
  };

  const getStatusTag = (isApproved: boolean) => {
    return isApproved ? 
      <Tag color="green">已通过</Tag> : 
      <Tag color="orange">待审核</Tag>;
  };

  const columns = [
    {
      title: '用户信息',
      key: 'user_info',
      fixed: 'left' as const,
      width: 200,
      render: (record: MoveTip) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {record.user_profiles?.nickname || '未设置昵称'}
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
      render: (record: MoveTip) => (
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
      title: '心得内容',
      dataIndex: 'tip_content',
      key: 'tip_content',
      render: (content: string) => (
        <div style={{ maxWidth: 300 }}>
          <div style={{ 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            cursor: 'pointer'
          }}>
            {content}
          </div>
        </div>
      ),
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'is_approved',
      key: 'is_approved',
      render: (isApproved: boolean) => getStatusTag(isApproved),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      width: 200,
      render: (record: MoveTip) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewTip(record)}
          >
            查看
          </Button>
          {!record.is_approved && (
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

  const handleViewTip = (tip: MoveTip) => {
    Modal.info({
      title: '心得详情',
      width: 600,
      content: (
        <div>
          <div style={{ marginBottom: 16 }}>
            <strong>用户：</strong>{tip.user_profiles?.nickname || tip.user_profiles?.email}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>招式：</strong>{tip.moves?.move_name}
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>心得内容：</strong>
            <div style={{ 
              marginTop: 8, 
              padding: 12, 
              background: '#f5f5f5', 
              borderRadius: 4,
              whiteSpace: 'pre-wrap'
            }}>
              {tip.tip_content}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>提交时间：</strong>
            {tip.created_at ? dayjs(tip.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </div>
        </div>
      ),
    });
  };

  return (
    <div>
      <Title level={2}>心得审核</Title>
      
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

      {/* 心得列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={tips}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* 审核弹窗 */}
      <Modal
        title="心得审核"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedTip && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>用户：</strong>{selectedTip.user_profiles?.nickname || selectedTip.user_profiles?.email}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>招式：</strong>{selectedTip.moves?.move_name}
            </div>
            <div style={{ marginBottom: 16 }}>
                          <strong>当前状态：</strong>
            {getStatusTag(selectedTip.is_approved || false)}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>心得内容：</strong>
              <div style={{ 
                marginTop: 8, 
                padding: 12, 
                background: '#f5f5f5', 
                borderRadius: 4,
                whiteSpace: 'pre-wrap'
              }}>
                {selectedTip.tip_content}
              </div>
            </div>
            
            <Form form={reviewForm} onFinish={handleReviewSubmit}>
              <Form.Item
                name="isApproved"
                label="审核结果"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch
                  checkedChildren="通过"
                  unCheckedChildren="拒绝"
                />
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
