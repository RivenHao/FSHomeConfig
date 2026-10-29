'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getFeaturedRooms,
  removeFeaturedRoom,
  searchRoomsForFeature,
  setFeaturedRoom,
} from '@/lib/fun-buzz-queries';
import type { FunBuzzFeaturedItem } from '@/types/fun-buzz';

const { Title, Text } = Typography;

/** 搜索结果里的房间，字段和 searchRoomsForFeature 的 select 对齐 */
interface RoomOption {
  id: string;
  title: string;
  visibility: string;
  entries_count: number;
  views_count: number;
  created_at: string;
}

/** 编辑中的推荐位。房间 id 定了就不能改，改房间等于删了重加 */
interface EditState {
  skillCheckId: string;
  roomTitle: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  /** true = 新增，false = 改已有的 */
  creating: boolean;
}

/**
 * 首页推荐房间。
 *
 * 运营搜房间、推到新版首页的推荐模块。数量不固定，排序靠 sort_order，
 * 要临时撤下但保留配置就关掉「启用」。
 *
 * 推荐语（label）只存一份，不做多语言（已确认）——所以英语、波兰语用户看到
 * 的也是这里填的原文。
 *
 * 增删改都走 sc_set_featured / sc_remove_featured 两个函数，因为表上没有给
 * 应用层开写权限，这样每次变更都一定会留下日志。
 */
export default function FunBuzzFeaturedPage() {
  const [items, setItems] = useState<FunBuzzFeaturedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 添加弹窗里的房间搜索
  const [picking, setPicking] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<RoomOption[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await getFeaturedRooms();
      if (error || !data) {
        message.error('加载推荐位失败');
        return;
      }
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSearch = async (word: string) => {
    setKeyword(word);
    if (!word.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await searchRoomsForFeature(word);
      if (error || !data) {
        message.error('搜索房间失败');
        setResults([]);
        return;
      }
      setResults(data as RoomOption[]);
    } finally {
      setSearching(false);
    }
  };

  const handlePick = (room: RoomOption) => {
    const existing = items.find((item) => item.skill_check_id === room.id);
    setPicking(false);
    setKeyword('');
    setResults([]);
    setEdit({
      skillCheckId: room.id,
      roomTitle: room.title,
      // 已经在推荐位里的房间，带出现有配置，避免运营覆盖掉自己之前填的推荐语
      label: existing?.label ?? '',
      sortOrder: existing?.sort_order ?? nextSortOrder(items),
      isActive: existing?.is_active ?? true,
      creating: !existing,
    });
  };

  const handleSave = async () => {
    if (!edit) return;

    setSubmitting(true);
    try {
      const { error } = await setFeaturedRoom({
        skillCheckId: edit.skillCheckId,
        label: edit.label,
        sortOrder: edit.sortOrder,
        isActive: edit.isActive,
      });

      if (error) {
        message.error(error.message);
        return;
      }

      message.success(edit.creating ? '已加入首页推荐' : '已更新');
      setEdit(null);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (item: FunBuzzFeaturedItem) => {
    const { error } = await removeFeaturedRoom(item.skill_check_id);
    if (error) {
      message.error(error.message);
      return;
    }
    message.success('已从首页推荐移除');
    void load();
  };

  const columns = [
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
      render: (value: number) => <Tag>{value}</Tag>,
    },
    {
      title: '房间',
      key: 'room',
      render: (record: FunBuzzFeaturedItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.skill_checks?.title || '房间已不存在'}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            视频 {record.skill_checks?.entries_count ?? 0} · 播放{' '}
            {record.skill_checks?.views_count ?? 0}
          </Text>
        </div>
      ),
    },
    {
      title: '推荐语',
      dataIndex: 'label',
      key: 'label',
      width: 160,
      render: (value: string | null) =>
        value ? <Tag color="gold">{value}</Tag> : <Text type="secondary">未设置</Text>,
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'default'}>{value ? '展示中' : '已停用'}</Tag>
      ),
    },
    {
      title: '房间状态',
      key: 'room_visibility',
      width: 150,
      render: (record: FunBuzzFeaturedItem) => {
        const visibility = record.skill_checks?.visibility;
        if (visibility === 'hidden') {
          // 前台用 inner join 取房间，RLS 会挡掉下架房间，所以这个推荐位
          // 实际上是空占位，得提醒运营换掉
          return <Tag color="red">房间已下架，前台不展示</Tag>;
        }
        return <Tag color="green">正常</Tag>;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right' as const,
      render: (record: FunBuzzFeaturedItem) => (
        <Space size={0}>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() =>
              setEdit({
                skillCheckId: record.skill_check_id,
                roomTitle: record.skill_checks?.title || '房间已不存在',
                label: record.label ?? '',
                sortOrder: record.sort_order,
                isActive: record.is_active,
                creating: false,
              })
            }
          >
            编辑
          </Button>
          <Popconfirm
            title="从首页推荐移除？"
            description="只是撤下推荐位，房间本身不受影响。"
            okText="移除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => void handleRemove(record)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              移除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>首页推荐房间</Title>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="推荐语只存一份，不区分语言"
        description="这里填的文字会原样展示给所有语言的用户（英语、波兰语用户看到的也是中文）。前台首页取前几条由前台决定，调整顺序改「排序」数字即可，数字小的靠前。"
      />

      <Card
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setPicking(true)}>
              添加推荐房间
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="还没有配置推荐房间" /> }}
        />
      </Card>

      {/* 选房间 */}
      <Modal
        title="搜索房间"
        open={picking}
        onCancel={() => {
          setPicking(false);
          setKeyword('');
          setResults([]);
        }}
        footer={null}
        width={640}
        destroyOnHidden
      >
        <Input.Search
          placeholder="输入房间名，或粘贴房间 ID"
          value={keyword}
          onChange={(event) => void handleSearch(event.target.value)}
          loading={searching}
          allowClear
        />

        <Text type="secondary" style={{ fontSize: 12, display: 'block', margin: '8px 0' }}>
          只显示未下架的房间。已经在推荐位里的房间会带出现有配置。
        </Text>

        <List
          dataSource={results}
          locale={{
            emptyText: keyword.trim() ? '没有匹配的房间' : '输入关键词开始搜索',
          }}
          renderItem={(room) => {
            const already = items.some((item) => item.skill_check_id === room.id);
            return (
              <List.Item
                actions={[
                  <Button key="pick" type="link" onClick={() => handlePick(room)}>
                    {already ? '编辑配置' : '选择'}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {room.title}
                      {already && <Tag color="gold">已推荐</Tag>}
                    </Space>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      视频 {room.entries_count} · 播放 {room.views_count} · 创建于{' '}
                      {dayjs(room.created_at).format('YYYY-MM-DD')}
                    </Text>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Modal>

      {/* 填推荐语和排序 */}
      <Modal
        title={edit?.creating ? '加入首页推荐' : '编辑推荐位'}
        open={Boolean(edit)}
        onOk={() => void handleSave()}
        onCancel={() => setEdit(null)}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ loading: submitting }}
        cancelButtonProps={{ disabled: submitting }}
        destroyOnHidden
      >
        {edit && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">房间</Text>
              <div style={{ marginTop: 4, fontWeight: 500 }}>{edit.roomTitle}</div>
            </div>

            <div>
              <Text type="secondary">推荐语（最多 20 字，可留空）</Text>
              <Input
                value={edit.label}
                onChange={(event) =>
                  setEdit({ ...edit, label: event.target.value.slice(0, 20) })
                }
                maxLength={20}
                showCount
                placeholder="例：最热门buzz"
                style={{ marginTop: 4 }}
              />
            </div>

            <div>
              <Text type="secondary">排序（数字小的靠前）</Text>
              <div style={{ marginTop: 4 }}>
                <InputNumber
                  value={edit.sortOrder}
                  onChange={(value) => setEdit({ ...edit, sortOrder: value ?? 0 })}
                  min={0}
                  max={999}
                />
              </div>
            </div>

            <Space>
              <Switch
                checked={edit.isActive}
                onChange={(checked) => setEdit({ ...edit, isActive: checked })}
              />
              <Text>{edit.isActive ? '在首页展示' : '已停用（保留配置但不展示）'}</Text>
            </Space>
          </Space>
        )}
      </Modal>
    </div>
  );
}

/** 新加的推荐位默认排到最后 */
function nextSortOrder(items: FunBuzzFeaturedItem[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((item) => item.sort_order)) + 1;
}
