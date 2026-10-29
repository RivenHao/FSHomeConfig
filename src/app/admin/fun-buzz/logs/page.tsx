'use client';

import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { getModerationLogs } from '@/lib/fun-buzz-queries';
import type {
  FunBuzzModerationLog,
  ModerationAction,
  ModerationTargetType,
} from '@/types/fun-buzz';
import FilterPanel, { type FilterOption } from '@/components/common/FilterPanel';

const { Title, Text } = Typography;

const TARGET_LABEL: Record<ModerationTargetType, string> = {
  room: '房间',
  entry: '投稿',
  comment: '评论',
  featured: '推荐位',
};

const ACTION_META: Record<ModerationAction, { text: string; color: string }> = {
  hide: { text: '下架', color: 'red' },
  unhide: { text: '恢复', color: 'green' },
  feature_add: { text: '加入推荐', color: 'gold' },
  feature_update: { text: '修改推荐', color: 'blue' },
  feature_remove: { text: '移除推荐', color: 'default' },
};

/**
 * 操作日志（只读）。
 *
 * 日志由 sc_moderate / sc_set_featured / sc_remove_featured 以 definer 身份
 * 写入，应用层没有 insert / update / delete 权限，所以这里的记录改不了也删
 * 不掉——这正是审计日志该有的样子。
 */
export default function FunBuzzLogsPage() {
  const [logs, setLogs] = useState<FunBuzzModerationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({ targetType: '' });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const load = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const { data, error, total } = await getModerationLogs({
        page,
        pageSize,
        targetType: (filters.targetType as ModerationTargetType) || '',
      });

      if (error || !data) {
        message.error('加载操作日志失败');
        return;
      }

      setLogs(data);
      setPagination({ current: page, pageSize, total });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.targetType]);

  const filterOptions: FilterOption[] = [
    {
      key: 'targetType',
      label: '对象类型',
      type: 'select',
      placeholder: '全部类型',
      style: { width: 150 },
      options: [
        { value: 'room', label: '房间' },
        { value: 'entry', label: '投稿' },
        { value: 'comment', label: '评论' },
        { value: 'featured', label: '推荐位' },
      ],
    },
  ];

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作人',
      key: 'admin',
      width: 220,
      render: (record: FunBuzzModerationLog) => (
        <Text>{record.admin_email || record.admin_id}</Text>
      ),
    },
    {
      title: '对象',
      key: 'target',
      width: 110,
      render: (record: FunBuzzModerationLog) => (
        <Tag>{TARGET_LABEL[record.target_type]}</Tag>
      ),
    },
    {
      title: '动作',
      key: 'action',
      width: 110,
      render: (record: FunBuzzModerationLog) => {
        const meta = ACTION_META[record.action];
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '影响行数',
      dataIndex: 'affected',
      key: 'affected',
      width: 100,
      render: (value: number, record: FunBuzzModerationLog) =>
        record.target_type === 'comment' && value > 1 ? (
          <Text>{value}（含回复）</Text>
        ) : (
          value
        ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (value: string | null) => value || <Text type="secondary">未填写</Text>,
    },
    {
      title: '对象 ID',
      dataIndex: 'target_id',
      key: 'target_id',
      width: 300,
      render: (value: string) => (
        <Text copyable style={{ fontSize: 12 }} type="secondary">
          {value}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>操作日志</Title>
      <Text type="secondary">
        Fun Buzz 的下架、恢复和推荐位变更记录。日志只能由数据库函数写入，后台无法修改或删除。
      </Text>

      <div style={{ marginTop: 16 }}>
        <FilterPanel
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={(key, value) =>
            setFilters((previous) => ({ ...previous, [key]: value }))
          }
          onReset={() => setFilters({ targetType: '' })}
          showRefreshButton
          onRefresh={() => void load()}
          resultCount={pagination.total}
        />
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          onChange={(info) => {
            if (info.current && info.pageSize) {
              void load(info.current, info.pageSize);
            }
          }}
        />
      </Card>
    </div>
  );
}
