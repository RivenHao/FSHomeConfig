'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Tag, DatePicker, Avatar } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getSuggestions,
  processSuggestion,
  getSeasons,
  getChallenges,
} from '@/lib/weekly-challenge-queries';
import {
  UserSuggestion,
  Season,
  WeeklyChallenge,
  ProcessSuggestionRequest,
} from '@/types/weekly-challenge';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [challenges, setChallenges] = useState<WeeklyChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<UserSuggestion | null>(null);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({
    status: 'pending' as 'pending' | 'adopted' | 'rejected' | '',
    season_id: '',
    date_range: null as [string, string] | null,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 加载用户建议列表
  const loadSuggestions = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const filterParams = {
        status: filters.status === '' ? undefined : filters.status as 'pending' | 'adopted' | 'rejected',
        season_id: filters.season_id || undefined,
        date_range: filters.date_range || undefined,
      };

      const result = await getSuggestions(page, pageSize, filterParams);
      if (result.error) {
        message.error('加载用户建议失败');
        return;
      }
      
      if (result.data) {
        setSuggestions(result.data.data);
        setPagination({
          current: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
      }
    } catch (error) {
      console.error('加载用户建议失败:', error);
      message.error('加载用户建议失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载赛季列表
  const loadSeasons = async () => {
    try {
      const result = await getSeasons(1, 100); // 获取所有赛季
      if (result.data) {
        setSeasons(result.data.data);
      }
    } catch (error) {
      console.error('加载赛季数据失败:', error);
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
    loadSuggestions();
    loadSeasons();
    loadChallenges();
  }, []);

  useEffect(() => {
    loadSuggestions(1, pagination.pageSize);
  }, [filters]);

  const handleProcess = (suggestion: UserSuggestion) => {
    setSelectedSuggestion(suggestion);
    form.setFieldsValue({
      status: suggestion.status,
      admin_note: suggestion.admin_note,
      adopted_challenge_id: suggestion.adopted_challenge_id,
    });
    setProcessModalVisible(true);
  };

  const handleQuickProcess = async (suggestion: UserSuggestion, status: 'adopted' | 'rejected') => {
    try {
      const processData: ProcessSuggestionRequest = {
        status,
        admin_note: status === 'adopted' ? '建议已被采纳' : '建议暂不采纳',
      };

      const result = await processSuggestion(suggestion.id, processData);
      if (result.error) {
        message.error(`${status === 'adopted' ? '采纳' : '拒绝'}建议失败`);
        return;
      }

      message.success(`${status === 'adopted' ? '采纳' : '拒绝'}建议成功`);
      loadSuggestions(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('处理建议失败:', error);
      message.error('处理建议失败');
    }
  };

  const handleSubmitProcess = async (values: { status: 'adopted' | 'rejected'; admin_note?: string; adopted_challenge_id?: string }) => {
    if (!selectedSuggestion) return;

    try {
      const processData: ProcessSuggestionRequest = {
        status: values.status,
        admin_note: values.admin_note,
        adopted_challenge_id: values.adopted_challenge_id,
      };

      const result = await processSuggestion(selectedSuggestion.id, processData);
      if (result.error) {
        message.error('处理建议失败');
        return;
      }

      message.success('处理建议成功');
      setProcessModalVisible(false);
      form.resetFields();
      setSelectedSuggestion(null);
      loadSuggestions(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('处理建议失败:', error);
      message.error('处理建议失败');
    }
  };

  const handleTableChange = (paginationConfig: { current?: number; pageSize?: number }) => {
    loadSuggestions(paginationConfig.current || 1, paginationConfig.pageSize || 10);
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
      season_id: '',
      date_range: null,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'adopted': return 'green';
      case 'rejected': return 'red';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待处理';
      case 'adopted': return '已采纳';
      case 'rejected': return '已拒绝';
      default: return '未知';
    }
  };

  const columns = [
    {
      title: '用户信息',
      key: 'user_info',
      width: 150,
      render: (record: UserSuggestion) => (
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
      title: '所属赛季',
      key: 'season_info',
      render: (record: UserSuggestion) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>
            {record.season?.name}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.season?.year}年第{record.season?.quarter}季度
          </div>
        </div>
      ),
    },
    {
      title: '建议内容',
      dataIndex: 'suggestion_text',
      key: 'suggestion_text',
      width: 300,
      render: (text: string) => (
        <div style={{
          maxWidth: '280px',
          maxHeight: '60px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          lineHeight: '1.4',
        }}>
          {text}
        </div>
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
      title: '关联挑战',
      key: 'adopted_challenge',
      render: (record: UserSuggestion) => (
        record.adopted_challenge ? (
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {record.adopted_challenge.title}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              第{record.adopted_challenge.week_number}周
            </div>
          </div>
        ) : (
          <span style={{ color: '#999' }}>未关联</span>
        )
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => dayjs(text).format('MM-DD HH:mm'),
    },
    {
      title: '管理员备注',
      dataIndex: 'admin_note',
      key: 'admin_note',
      width: 150,
      render: (text: string) => (
        text ? (
          <div style={{
            maxWidth: '130px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {text}
          </div>
        ) : (
          <span style={{ color: '#999' }}>无备注</span>
        )
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (record: UserSuggestion) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleQuickProcess(record, 'adopted')}
              >
                采纳
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => handleQuickProcess(record, 'rejected')}
              >
                拒绝
              </Button>
            </>
          )}
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleProcess(record)}
            size="small"
          >
            详细处理
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="用户建议管理"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadSuggestions(pagination.current, pagination.pageSize)}
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
              <span style={{ marginRight: 8 }}>处理状态:</span>
              <Select
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value)}
                style={{ width: 120 }}
              >
                <Option value="">全部</Option>
                <Option value="pending">待处理</Option>
                <Option value="adopted">已采纳</Option>
                <Option value="rejected">已拒绝</Option>
              </Select>
            </div>

            <div>
              <span style={{ marginRight: 8 }}>赛季:</span>
              <Select
                value={filters.season_id}
                onChange={(value) => handleFilterChange('season_id', value)}
                style={{ width: 200 }}
                placeholder="选择赛季"
              >
                <Option value="">全部赛季</Option>
                {seasons.map(season => (
                  <Option key={season.id} value={season.id}>
                    {season.name}
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
          dataSource={suggestions}
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

      {/* 详细处理Modal */}
      <Modal
        title="处理用户建议"
        open={processModalVisible}
        onCancel={() => {
          setProcessModalVisible(false);
          form.resetFields();
          setSelectedSuggestion(null);
        }}
        footer={null}
        width={700}
      >
        {selectedSuggestion && (
          <div>
            {/* 建议信息展示 */}
            <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#fafafa', borderRadius: 6 }}>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <h4>用户信息</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Avatar src={selectedSuggestion.user_profile?.image_url}>
                      {selectedSuggestion.user_profile?.nickname?.[0] || 'U'}
                    </Avatar>
                    <span>{selectedSuggestion.user_profile?.nickname || '未知用户'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    用户ID: {selectedSuggestion.user_id}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <h4>所属赛季</h4>
                  <div>{selectedSuggestion.season?.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {selectedSuggestion.season?.year}年第{selectedSuggestion.season?.quarter}季度
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <h4>提交时间</h4>
                  <div>{dayjs(selectedSuggestion.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    当前状态: 
                    <Tag color={getStatusColor(selectedSuggestion.status)} style={{ marginLeft: 4 }}>
                      {getStatusText(selectedSuggestion.status)}
                    </Tag>
                  </div>
                </div>
              </div>

              <div>
                <h4>建议内容</h4>
                <div style={{ 
                  padding: 12, 
                  backgroundColor: 'white', 
                  borderRadius: 4, 
                  border: '1px solid #d9d9d9',
                  minHeight: 80,
                  lineHeight: '1.6'
                }}>
                  {selectedSuggestion.suggestion_text}
                </div>
              </div>

              {selectedSuggestion.adopted_challenge && (
                <div style={{ marginTop: 16 }}>
                  <h4>已关联挑战</h4>
                  <div style={{ padding: 8, backgroundColor: 'white', borderRadius: 4 }}>
                    {selectedSuggestion.adopted_challenge.title} (第{selectedSuggestion.adopted_challenge.week_number}周)
                  </div>
                </div>
              )}
            </div>

            {/* 处理表单 */}
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmitProcess}
            >
              <Form.Item
                name="status"
                label="处理结果"
                rules={[{ required: true, message: '请选择处理结果' }]}
              >
                <Select placeholder="请选择处理结果">
                  <Option value="adopted">采纳建议</Option>
                  <Option value="rejected">拒绝建议</Option>
                  <Option value="pending">待处理</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="adopted_challenge_id"
                label="关联挑战赛"
                tooltip="如果采纳建议，可以选择将其关联到具体的挑战赛"
              >
                <Select placeholder="选择关联的挑战赛（可选）" allowClear>
                  {challenges.map(challenge => (
                    <Option key={challenge.id} value={challenge.id}>
                      {challenge.title} (第{challenge.week_number}周)
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="admin_note"
                label="管理员备注"
              >
                <TextArea
                  rows={3}
                  placeholder="请输入处理备注，说明采纳或拒绝的原因"
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    提交处理
                  </Button>
                  <Button onClick={() => {
                    setProcessModalVisible(false);
                    form.resetFields();
                    setSelectedSuggestion(null);
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