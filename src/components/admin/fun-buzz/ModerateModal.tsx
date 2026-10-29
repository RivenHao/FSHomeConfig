'use client';

import React, { useState } from 'react';
import { Alert, Input, Modal, Space, Typography, message } from 'antd';
import { moderateFunBuzzContent } from '@/lib/fun-buzz-queries';

const { Text } = Typography;

export interface ModerateTarget {
  type: 'room' | 'entry' | 'comment';
  id: string;
  /** 显示给运营看的名字，房间用标题、投稿用「作者 · 档位」、评论用内容截断 */
  name: string;
  /** 当前是否已下架。决定这次是下架还是恢复 */
  hidden: boolean;
}

interface Props {
  target: ModerateTarget | null;
  onClose: () => void;
  /** 操作成功后回调，用来让调用方刷新列表 */
  onDone: () => void;
}

const TYPE_LABEL: Record<ModerateTarget['type'], string> = {
  room: '房间',
  entry: '投稿',
  comment: '评论',
};

/**
 * 下架 / 恢复的确认弹窗，房间、投稿、评论三处共用。
 *
 * 下架不是删除：数据库里只改 visibility，用户侧看不到，运营随时能恢复。
 * R2 上的视频文件不动——所以拿到直链的人仍然能播，这一点是已知且接受的。
 */
export default function ModerateModal({ target, onClose, onDone }: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hiding = target ? !target.hidden : true;

  const handleOk = async () => {
    if (!target) return;

    setSubmitting(true);
    try {
      const { affected, error } = await moderateFunBuzzContent(
        target.type,
        target.id,
        hiding,
        reason
      );

      if (error) {
        message.error(error.message);
        return;
      }

      if (affected === 0) {
        // 别人刚好也在改，或者重复点了
        message.warning('状态没有变化，可能已经是目标状态了');
      } else if (target.type === 'comment' && affected > 1) {
        message.success(`已${hiding ? '下架' : '恢复'}，连带处理了 ${affected - 1} 条回复`);
      } else {
        message.success(`已${hiding ? '下架' : '恢复'}`);
      }

      setReason('');
      onDone();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setReason('');
    onClose();
  };

  // 每种目标下架后的连带影响都不一样，必须讲清楚，不然运营不知道自己点下去
  // 会波及什么
  const impact = () => {
    if (!target || !hiding) return null;

    if (target.type === 'room') {
      return '房间下架后，它里面的所有投稿和评论都会一并对用户隐藏，不需要逐条处理。房间本身不会被删除，随时可以恢复。';
    }
    if (target.type === 'entry') {
      return '这条投稿下架后，它下面的评论会一并对用户隐藏。房间的视频数、参与人数、播放量会自动扣掉它。';
    }
    return '如果这是一条主评论，它底下的所有回复会一并下架。注意恢复时这些回复会一起恢复，包括之前被单独下架过的。';
  };

  return (
    <Modal
      title={`${hiding ? '下架' : '恢复'}${target ? TYPE_LABEL[target.type] : ''}`}
      open={Boolean(target)}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={hiding ? '确认下架' : '确认恢复'}
      cancelText="取消"
      okButtonProps={{ danger: hiding, loading: submitting }}
      cancelButtonProps={{ disabled: submitting }}
      destroyOnHidden
    >
      {target && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">操作对象：</Text>
            <div style={{ marginTop: 4, fontWeight: 500, wordBreak: 'break-all' }}>
              {target.name}
            </div>
          </div>

          {impact() && <Alert type="warning" message={impact()} showIcon />}

          {!hiding && (
            <Alert
              type="info"
              message="恢复后该内容会重新对所有用户可见。"
              showIcon
            />
          )}

          <div>
            <Text type="secondary">原因（可选，会记进操作日志）</Text>
            <Input.TextArea
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              showCount
              placeholder="例：内容与花式足球无关 / 盗用他人视频"
              disabled={submitting}
              style={{ marginTop: 4 }}
            />
          </div>
        </Space>
      )}
    </Modal>
  );
}
