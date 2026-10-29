'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Drawer, Empty, Space, Table, Tag, Typography, message } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getEntryComments } from '@/lib/fun-buzz-queries';
import {
  funBuzzEntryName,
  VISIBILITY_LABEL,
  type FunBuzzComment,
  type FunBuzzEntry,
} from '@/types/fun-buzz';
import ModerateModal, { type ModerateTarget } from './ModerateModal';

const { Text } = Typography;

/** 摊平后的一行，depth=1 表示这是一条回复 */
type CommentRow = FunBuzzComment & { depth: number };

interface Props {
  entry: FunBuzzEntry | null;
  onClose: () => void;
  /** 下架/恢复之后通知上层刷新，因为投稿的评论数会变 */
  onChanged: () => void;
}

/**
 * 稿件内评论管理。
 *
 * 评论是两级结构（根评论 + 回复），这里摊平成一张表，回复靠缩进和「回复」
 * 标签区分。不做成 Table 的 expandable 树，因为运营要的是一眼扫完所有内容
 * 找违规的，折叠起来反而碍事。
 */
export default function EntryCommentsDrawer({ entry, onClose, onChanged }: Props) {
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<ModerateTarget | null>(null);

  const load = useCallback(async () => {
    if (!entry) return;

    setLoading(true);
    try {
      const { data, error } = await getEntryComments(entry.id);
      if (error || !data) {
        message.error('加载评论失败');
        setRows([]);
        return;
      }
      setRows(flatten(data));
    } finally {
      setLoading(false);
    }
  }, [entry]);

  useEffect(() => {
    if (entry) {
      void load();
    } else {
      setRows([]);
    }
  }, [entry, load]);

  const columns = [
    {
      title: '内容',
      key: 'content',
      render: (record: CommentRow) => (
        <div style={{ paddingLeft: record.depth * 28 }}>
          {record.depth > 0 && (
            <Tag color="default" style={{ marginRight: 6 }}>
              回复
            </Tag>
          )}
          <span
            style={{
              wordBreak: 'break-word',
              color: record.visibility === 'hidden' ? '#bfbfbf' : undefined,
              textDecoration: record.visibility === 'hidden' ? 'line-through' : undefined,
            }}
          >
            {record.content}
          </span>
        </div>
      ),
    },
    {
      title: '作者',
      key: 'author',
      width: 180,
      render: (record: CommentRow) => (
        <div>
          <div>{record.user_profiles?.nickname || '未设昵称'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.user_profiles?.email || '-'}
          </Text>
        </div>
      ),
    },
    {
      title: '赞',
      dataIndex: 'likes_count',
      key: 'likes_count',
      width: 70,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '状态',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 90,
      render: (value: CommentRow['visibility']) => (
        <Tag color={value === 'hidden' ? 'red' : 'green'}>{VISIBILITY_LABEL[value]}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      fixed: 'right' as const,
      render: (record: CommentRow) => {
        const hidden = record.visibility === 'hidden';
        return (
          <Button
            type="link"
            danger={!hidden}
            icon={hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={() =>
              setTarget({
                type: 'comment',
                id: record.id,
                name: record.content.slice(0, 60),
                hidden,
              })
            }
          >
            {hidden ? '恢复' : '下架'}
          </Button>
        );
      },
    },
  ];

  const hiddenCount = rows.filter((row) => row.visibility === 'hidden').length;

  return (
    <>
      <Drawer
        title={entry ? `评论管理 · ${funBuzzEntryName(entry)}` : '评论管理'}
        open={Boolean(entry)}
        onClose={onClose}
        width={900}
        destroyOnHidden
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        }
      >
        {entry && (
          <Space direction="vertical" size="small" style={{ width: '100%', marginBottom: 12 }}>
            <Text type="secondary">
              共 {rows.length} 条
              {hiddenCount > 0 && `，其中 ${hiddenCount} 条已下架`}
              。投稿上显示的评论数只统计未下架的，所以这里的总数可能比它大。
            </Text>
          </Space>
        )}

        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="这条投稿还没有评论" /> }}
        />
      </Drawer>

      <ModerateModal
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => {
          void load();
          onChanged();
        }}
      />
    </>
  );
}

/**
 * 把两级评论摊平成「根评论紧跟它的回复」的顺序。
 *
 * 父评论被作者自己删掉时，回复会被外键 cascade 一起删，所以正常不会出现
 * 孤立回复。但列表有 500 条上限，截断时父级可能不在结果里，所以兜底把找不到
 * 父级的回复追加在最后，不让它们凭空消失。
 */
function flatten(comments: FunBuzzComment[]): CommentRow[] {
  const roots = comments.filter((item) => !item.parent_id);
  const replies = comments.filter((item) => item.parent_id);

  const byParent = new Map<string, FunBuzzComment[]>();
  replies.forEach((reply) => {
    const list = byParent.get(reply.parent_id as string) ?? [];
    list.push(reply);
    byParent.set(reply.parent_id as string, list);
  });

  const out: CommentRow[] = [];
  const seen = new Set<string>();

  roots.forEach((root) => {
    out.push({ ...root, depth: 0 });
    seen.add(root.id);
    (byParent.get(root.id) ?? []).forEach((reply) => {
      out.push({ ...reply, depth: 1 });
      seen.add(reply.id);
    });
  });

  comments.forEach((item) => {
    if (!seen.has(item.id)) out.push({ ...item, depth: 1 });
  });

  return out;
}
