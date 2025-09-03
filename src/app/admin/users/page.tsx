'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Input, Button, Space, Tag, Avatar, Typography, Row, Col, message } from 'antd';
import { ReloadOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { getUsersList } from '@/lib/admin-queries';
import { UserProfile } from '@/types/admin';

const { Title } = Typography;
const { Search } = Input;

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await getUsersList({
        page: 1,
        pageSize: 1000, // 一次性加载所有用户
        search: searchValue
      });
      
      if (result.error) {
        message.error('加载用户数据失败');
        return;
      }
      
      setUsers(result.data || []);
    } catch (error) {
      console.error('加载用户数据失败:', error);
      message.error('加载用户数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时加载一次

  const handleSearch = (value: string) => {
    setSearchValue(value);
    // 延迟搜索，避免频繁请求
    setTimeout(() => {
      loadUsers();
    }, 500);
  };

  const handleReset = () => {
    setSearchValue('');
    loadUsers();
  };

  const columns = [
    {
      title: '用户信息',
      key: 'user_info',
      render: (record: UserProfile) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar 
            src={record.image_url} 
            icon={<span style={{ fontSize: '16px' }}>{record.nickname?.[0] || 'U'}</span>}
            size={40}
          />
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {record.nickname || '未设置昵称'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
      render: (age: number) => age ? `${age}岁` : '未设置',
    },
    {
      title: '经验',
      dataIndex: 'experience_years',
      key: 'experience_years',
      render: (years: number) => years ? `${years}年` : '未设置',
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      render: (location: string) => location || '未设置',
    },
    {
      title: '总积分',
      dataIndex: 'total_score',
      key: 'total_score',
      render: (score: number) => (
        <Tag color="blue">{score || 0}</Tag>
      ),
    },
    {
      title: '已解锁招式',
      dataIndex: 'unlocked_moves_count',
      key: 'unlocked_moves_count',
      render: (count: number) => (
        <Tag color="green">{count || 0}</Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => date ? new Date(date).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: UserProfile) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => handleViewUser(record)}
          >
            查看
          </Button>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  const handleViewUser = (user: UserProfile) => {
    message.info(`查看用户: ${user.nickname || user.email}`);
  };

  const handleEditUser = (user: UserProfile) => {
    message.info(`编辑用户: ${user.nickname || user.email}`);
  };

  return (
    <div>
      <Title level={2}>用户管理</Title>
      
      {/* 搜索区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索昵称或邮箱"
              allowClear
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
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

      {/* 用户列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={false} // 禁用分页
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}
