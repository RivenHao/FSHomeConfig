'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { getTags, createTag, deleteTag } from '@/lib/admin-queries';
import { MoveTag } from '@/types/admin';

export default function TagsPage() {
  const [tags, setTags] = useState<MoveTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadTags = async () => {
    setLoading(true);
    try {
      const result = await getTags();
      if (result.error) {
        message.error('加载标签失败');
        return;
      }
      setTags(result.data || []);
    } catch (error) {
      console.error('加载标签失败:', error);
      message.error('加载标签失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const handleAdd = async (values: { tag_name: string }) => {
    try {
      const result = await createTag(values.tag_name);
      if (result.error) {
        message.error('创建标签失败');
        return;
      }
      message.success('创建标签成功');
      setModalVisible(false);
      form.resetFields();
      loadTags();
    } catch (error) {
      console.error('创建标签失败:', error);
      message.error('创建标签失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await deleteTag(id);
      if (result.error) {
        message.error('删除标签失败');
        return;
      }
      message.success('删除标签成功');
      loadTags();
    } catch (error) {
      console.error('删除标签失败:', error);
      message.error('删除标签失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '标签名称',
      dataIndex: 'tag_name',
      key: 'tag_name',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (record: MoveTag) => (
        <Popconfirm
          title="确定要删除这个标签吗？"
          description="删除后已关联该标签的招式可能不再显示该标签"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="标签库管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadTags}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              新增标签
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tags}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="新增标签"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item
            name="tag_name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="请输入标签名称" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                确定
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

