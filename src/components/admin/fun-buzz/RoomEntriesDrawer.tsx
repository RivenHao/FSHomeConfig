'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Drawer, Empty, Modal, Space, Table, Tag, Typography, message } from 'antd';
import {
  CommentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getRoomEntries } from '@/lib/fun-buzz-queries';
import {
  ENTRY_TAG_COLOR,
  ENTRY_TAG_LABEL,
  funBuzzEntryName,
  funBuzzVideoUrl,
  VISIBILITY_LABEL,
  type FunBuzzEntry,
  type FunBuzzRoom,
} from '@/types/fun-buzz';
import ModerateModal, { type ModerateTarget } from './ModerateModal';
import EntryCommentsDrawer from './EntryCommentsDrawer';

const { Text } = Typography;

interface Props {
  room: FunBuzzRoom | null;
  onClose: () => void;
  /** 投稿下架会改动房间的视频数等计数，所以要通知上层刷新房间列表 */
  onChanged: () => void;
}

/**
 * 房间详情：房间内的投稿列表。
 *
 * 不分页，一个房间的视频量级很小，运营要的是一眼看全。
 * 发起视频固定排第一，和前台播放列表的顺序一致。
 */
export default function RoomEntriesDrawer({ room, onClose, onChanged }: Props) {
  const [entries, setEntries] = useState<FunBuzzEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<ModerateTarget | null>(null);
  const [commentEntry, setCommentEntry] = useState<FunBuzzEntry | null>(null);
  const [preview, setPreview] = useState<FunBuzzEntry | null>(null);

  const load = useCallback(async () => {
    if (!room) return;

    setLoading(true);
    try {
      const { data, error } = await getRoomEntries(room.id);
      if (error || !data) {
        message.error('加载投稿失败');
        setEntries([]);
        return;
      }
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [room]);

  useEffect(() => {
    if (room) {
      void load();
    } else {
      setEntries([]);
    }
  }, [room, load]);

  // R2 域名没配的话视频地址拼不出来，先提示运营去配，而不是给一堆坏链接
  const r2Missing = !process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  const columns = [
    {
      title: '投稿',
      key: 'name',
      width: 220,
      fixed: 'left' as const,
      render: (record: FunBuzzEntry) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.user_profiles?.nickname || record.user_profiles?.email || '未知用户'}
          </div>
          <Space size={4} style={{ marginTop: 4 }}>
            {record.role === 'origin' ? (
              <Tag color="purple">发起视频</Tag>
            ) : (
              <Tag color={ENTRY_TAG_COLOR[record.tag ?? 'replica']}>
                {ENTRY_TAG_LABEL[record.tag ?? 'replica']}
              </Tag>
            )}
          </Space>
        </div>
      ),
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (note: string | null) => note || <Text type="secondary">无</Text>,
    },
    {
      title: '视频',
      key: 'video',
      width: 110,
      render: (record: FunBuzzEntry) => (
        <Button
          type="link"
          icon={<PlayCircleOutlined />}
          disabled={r2Missing}
          onClick={() => setPreview(record)}
        >
          播放
        </Button>
      ),
    },
    {
      title: '数据',
      key: 'stats',
      width: 150,
      render: (record: FunBuzzEntry) => (
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>
          <div>
            赞 {record.likes_count} · 评 {record.comments_count}
          </div>
          <div>
            完成 {record.approve_count} · 未完成 {record.reject_count}
          </div>
          <div>播放 {record.views_count}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 90,
      render: (value: FunBuzzEntry['visibility']) => (
        <Tag color={value === 'hidden' ? 'red' : 'green'}>{VISIBILITY_LABEL[value]}</Tag>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      fixed: 'right' as const,
      render: (record: FunBuzzEntry) => {
        const hidden = record.visibility === 'hidden';
        return (
          <Space size={0}>
            <Button
              type="link"
              icon={<CommentOutlined />}
              onClick={() => setCommentEntry(record)}
            >
              评论
            </Button>
            <Button
              type="link"
              danger={!hidden}
              icon={hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              onClick={() =>
                setTarget({
                  type: 'entry',
                  id: record.id,
                  name: funBuzzEntryName(record),
                  hidden,
                })
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
    <>
      <Drawer
        title={room ? `房间详情 · ${room.title}` : '房间详情'}
        open={Boolean(room)}
        onClose={onClose}
        width={1100}
        destroyOnHidden
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        }
      >
        {room && (
          <Space direction="vertical" size="small" style={{ width: '100%', marginBottom: 12 }}>
            {room.visibility === 'hidden' && (
              <Alert
                type="warning"
                showIcon
                message="该房间已下架，下面所有投稿对用户都不可见（无论它们自己的状态）。"
              />
            )}
            {r2Missing && (
              <Alert
                type="error"
                showIcon
                message="缺少 NEXT_PUBLIC_R2_PUBLIC_URL 环境变量，无法拼出视频地址，播放按钮已禁用。"
              />
            )}
            {room.origin_type === 'move' && (
              <Text type="secondary">
                这个房间是选招式库招式发起的，没有发起视频，参照物是招式本身的演示视频
                {room.moves?.move_name ? `（${room.moves.move_name}）` : ''}。
              </Text>
            )}
            <Text type="secondary">
              共 {entries.length} 条投稿。房间卡片上显示的视频数只统计未下架的。
            </Text>
          </Space>
        )}

        <Table
          columns={columns}
          dataSource={entries}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="这个房间还没有投稿" /> }}
        />
      </Drawer>

      {/* 视频预览。只在打开时渲染一个 video 元素，避免表格里每行挂一个连接 */}
      <Modal
        title={preview ? funBuzzEntryName(preview) : '视频预览'}
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        footer={null}
        width={720}
        destroyOnHidden
      >
        {preview && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <video
              key={preview.id}
              src={funBuzzVideoUrl(preview.video_key)}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '60vh', background: '#000' }}
            />
            <Text type="secondary" style={{ fontSize: 12, wordBreak: 'break-all' }}>
              {preview.video_key}
            </Text>
            <Button
              type="link"
              style={{ paddingLeft: 0 }}
              onClick={() => window.open(funBuzzVideoUrl(preview.video_key), '_blank')}
            >
              在新标签页打开
            </Button>
          </Space>
        )}
      </Modal>

      <ModerateModal
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => {
          void load();
          onChanged();
        }}
      />

      <EntryCommentsDrawer
        entry={commentEntry}
        onClose={() => setCommentEntry(null)}
        onChanged={() => {
          void load();
          onChanged();
        }}
      />
    </>
  );
}
