'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Tag, Avatar, Typography, message } from 'antd';
import { EyeOutlined, EditOutlined } from '@ant-design/icons';
import { getUsersList } from '@/lib/admin-queries';
import { UserProfile } from '@/types/admin';
import FilterPanel, { FilterOption } from '@/components/common/FilterPanel';

const { Title } = Typography;

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    experience: '',
    age_range: '',
    location: ''
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const loadUsers = async (page = 1, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const result = await getUsersList({
        page,
        pageSize,
        search: filters.search
      });
      
      if (result.error) {
        message.error('加载用户数据失败');
        return;
      }
      
      setUsers(result.data || []);
      setFilteredUsers(result.data || []);
      setPagination(prev => ({
        ...prev,
        current: page,
        total: result.total || 0,
      }));
    } catch (error) {
      console.error('加载用户数据失败:', error);
      message.error('加载用户数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 筛选函数
  const applyFilters = useCallback(() => {
    let filtered = [...users];

    // 按搜索条件筛选
    if (filters.search) {
      filtered = filtered.filter(user => 
        user.nickname?.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.email?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // 按经验筛选
    if (filters.experience) {
      const experience = parseInt(filters.experience);
      filtered = filtered.filter(user => user.experience_years === experience);
    }

    // 按年龄范围筛选
    if (filters.age_range) {
      const [min, max] = filters.age_range.split('-').map(Number);
      filtered = filtered.filter(user => {
        const age = user.age;
        if (!age) return false;
        return age >= min && age <= max;
      });
    }

    // 按地区筛选
    if (filters.location) {
      filtered = filtered.filter(user => 
        user.location?.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  }, [users, filters]);

  // 当筛选条件或数据变化时重新筛选
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // 处理筛选条件变化
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      search: '',
      experience: '',
      age_range: '',
      location: ''
    });
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时加载一次

  // 筛选配置
  const filterOptions: FilterOption[] = [
    {
      key: 'search',
      label: '用户搜索',
      type: 'input',
      placeholder: '搜索昵称或邮箱',
      style: { width: 200 }
    },
    {
      key: 'experience',
      label: '经验年限',
      type: 'select',
      placeholder: '选择经验年限',
      style: { width: 150 },
      options: [
        { value: '1', label: '1年' },
        { value: '2', label: '2年' },
        { value: '3', label: '3年' },
        { value: '4', label: '4年' },
        { value: '5', label: '5年' },
        { value: '6', label: '6年' },
        { value: '7', label: '7年' },
        { value: '8', label: '8年' },
        { value: '9', label: '9年' },
        { value: '10', label: '10年以上' }
      ]
    },
    {
      key: 'location',
      label: '地区筛选',
      type: 'input',
      placeholder: '搜索地区',
      style: { width: 150 }
    }
  ];

  const handleTableChange = (paginationInfo: { current?: number; pageSize?: number }) => {
    const { current, pageSize } = paginationInfo;
    if (current && pageSize) {
      loadUsers(current, pageSize);
    }
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
      
      {/* 筛选组件 */}
      <FilterPanel
        title="筛选条件"
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        showRefreshButton={true}
        onRefresh={() => loadUsers()}
        resultCount={filteredUsers.length}
      />

      {/* 用户列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredUsers}
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
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}
