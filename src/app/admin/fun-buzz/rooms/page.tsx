'use client';

import React, { useEffect, useState } from 'react';
import { Card, Button, Space, Table, Tag, Typography, message } from 'antd';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  StarFilled,
  UnorderedListOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getFunBuzzRooms } from '@/lib/fun-buzz-queries';
import { VISIBILITY_LABEL, type FunBuzzRoom, type Visibility } from '@/types/fun-buzz';
import FilterPanel, { type FilterOption } from '@/components/common/FilterPanel';
import ModerateModal, { type ModerateTarget } from '@/components/admin/fun-buzz/ModerateModal';
import RoomEntriesDrawer from '@/components/admin/fun-buzz/RoomEntriesDrawer';

const { Title, Text } = Typography;

/**
 * 房间管理。
 *
 * 房间只有下架、没有删除（已确认）：下架即「用户不可见」，而删除会级联清掉
 * 房间里所有人的投稿和评论，不可逆，不值得给后台开这个口子。
 *
 * 能看到已下架的房间，靠的是 sc_select_visible 策略里的 `or is_admin()`。
 * 用户查同一张表看不到 hidden 的行。
 */
export default function FunBuzzRoomsPage() {
  const [rooms, setRooms] = useState<FunBuzzRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: '',
    visibility: '',
  });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [target, setTarget] = useState<ModerateTarget | null>(null);
  const [detailRoom, setDetailRoom] = useState<FunBuzzRoom | null>(null);

  const load = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const { data, error, total } = await getFunBuzzRooms({
        page,
        pageSize,
        search: filters.search || undefined,
        visibility: (filters.visibility as Visibility) || '',
      });

      if (error || !data) {
        message.error('加载房间列表失败');
        return;
      }

      setRooms(data);
      setPagination({ current: page, pageSize, total });

      // 详情抽屉开着的时候，用刷新后的那一行替换掉，否则里面的统计是旧的
      setDetailRoom((previous) =>
        previous ? data.find((room) => room.id === previous.id) ?? previous : previous
      );
    } finally {
      setLoading(false);
    }
  };

  // 搜索框是边打字边查，防抖 400ms。筛选项变化也走这里
  useEffect(() => {
    const timer = setTimeout(() => {
      void load(1, pagination.pageSize);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.visibility]);

  const filterOptions: FilterOption[] = [
    {
      key: 'search',
      label: '搜索房间',
      type: 'input',
      placeholder: '房间名，或粘贴房间 ID',
      style: { width: 260 },
    },
    {
      key: 'visibility',
      label: '状态',
      type: 'select',
      placeholder: '全部状态',
      style: { width: 140 },
      options: [
        { value: 'visible', label: '正常' },
        { value: 'hidden', label: '已下架' },
      ],
    },
  ];

  const columns = [
    {
      title: '房间',
      key: 'title',
      fixed: 'left' as const,
      width: 260,
      render: (record: FunBuzzRoom) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.title}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description || '无简介'}
          </Text>
        </div>
      ),
    },
    {
      title: '房主',
      key: 'creator',
      width: 170,
      render: (record: FunBuzzRoom) => (
        <div>
          <div>{record.user_profiles?.nickname || '未设昵称'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.user_profiles?.email || '-'}
          </Text>
        </div>
      ),
    },
    {
      title: '发起方式',
      key: 'origin',
      width: 130,
      render: (record: FunBuzzRoom) =>
        record.origin_type === 'move' ? (
          <Space direction="vertical" size={0}>
            <Tag color="blue">招式发起</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.moves?.move_name || '招式已删除'}
            </Text>
          </Space>
        ) : (
          <Tag color="geekblue">视频发起</Tag>
        ),
    },
    {
      title: '数据',
      key: 'stats',
      width: 140,
      render: (record: FunBuzzRoom) => (
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>
          <div>
            视频 {record.entries_count} · 跟拍 {record.answers_count}
          </div>
          <div>参与 {record.participants_count} 人</div>
          <div>播放 {record.views_count}</div>
        </div>
      ),
    },
    {
      title: '首页推荐',
      key: 'featured',
      width: 130,
      render: (record: FunBuzzRoom) => {
        if (!record.featured) return <Text type="secondary">未推荐</Text>;
        return (
          <Space direction="vertical" size={2}>
            <Tag color={record.featured.is_active ? 'gold' : 'default'} icon={<StarFilled />}>
              {record.featured.is_active ? '已推荐' : '已停用'}
            </Tag>
            {record.featured.label && (
              <Text style={{ fontSize: 12 }}>{record.featured.label}</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 90,
      render: (value: Visibility) => (
        <Tag color={value === 'hidden' ? 'red' : 'green'}>{VISIBILITY_LABEL[value]}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      width: 180,
      render: (record: FunBuzzRoom) => {
        const hidden = record.visibility === 'hidden';
        return (
          <Space size={0}>
            <Button
              type="link"
              icon={<UnorderedListOutlined />}
              onClick={() => setDetailRoom(record)}
            >
              详情
            </Button>
            <Button
              type="link"
              danger={!hidden}
              icon={hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              onClick={() =>
                setTarget({ type: 'room', id: record.id, name: record.title, hidden })
              }
            >
              {hidden ? '恢复' : '下架'}
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Title level={2}>房间管理</Title>
      <Text type="secondary">
        房间下架后对所有用户不可见，房间内的投稿和评论会一并隐藏，随时可恢复。
        首页推荐位在「首页推荐」页面配置。
      </Text>

      <div style={{ marginTop: 16 }}>
        <FilterPanel
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={(key, value) =>
            setFilters((previous) => ({ ...previous, [key]: value }))
          }
          onReset={() => setFilters({ search: '', visibility: '' })}
          showRefreshButton
          onRefresh={() => void load()}
          resultCount={pagination.total}
        />
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={rooms}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个房间`,
          }}
          onChange={(info) => {
            if (info.current && info.pageSize) {
              void load(info.current, info.pageSize);
            }
          }}
        />
      </Card>

      <ModerateModal
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => void load()}
      />

      <RoomEntriesDrawer
        room={detailRoom}
        onClose={() => setDetailRoom(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
