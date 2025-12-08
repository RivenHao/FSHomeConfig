'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { getAchievementCategories, createAchievementCategory, updateAchievementCategory, deleteAchievementCategory } from '@/lib/admin-queries';
import { AchievementCategory } from '@/types/admin';

export default function AchievementCategoriesPage() {
  const [categories, setCategories] = useState<AchievementCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AchievementCategory | null>(null);
  const [form] = Form.useForm();

  const loadCategories = async () => {
    setLoading(true);
    try {
      const result = await getAchievementCategories();
      if (result.error) {
        message.error('加载成就分类失败');
        return;
      }
      setCategories(result.data || []);
    } catch (error) {
      console.error('加载成就分类失败:', error);
      message.error('加载成就分类失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAdd = () => {
    setEditingCategory(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (category: AchievementCategory) => {
    setEditingCategory(category);
    form.setFieldsValue({
      name: category.name
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await deleteAchievementCategory(id);
      if (result.error) {
        message.error('删除成就分类失败');
        return;
      }
      message.success('删除成就分类成功');
      loadCategories();
    } catch (error) {
      console.error('删除成就分类失败:', error);
      message.error('删除成就分类失败');
    }
  };

  const handleSubmit = async (values: { name: string }) => {
    try {
      if (editingCategory) {
        const result = await updateAchievementCategory(editingCategory.id, values.name);
        if (result.error) {
          message.error('更新成就分类失败');
          return;
        }
        message.success('更新成就分类成功');
      } else {
        const result = await createAchievementCategory(values.name);
        if (result.error) {
          message.error('创建成就分类失败');
          return;
        }
        message.success('创建成就分类成功');
      }
      setModalVisible(false);
      loadCategories();
    } catch (error) {
      console.error('保存成就分类失败:', error);
      message.error('保存成就分类失败');
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
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
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
      width: 200,
      render: (_: unknown, record: AchievementCategory) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个分类吗？"
            description="删除分类不会删除其下的成就，但这些成就将没有分类。"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="成就分类管理"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadCategories}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增分类
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={categories}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title={editingCategory ? '编辑分类' : '新增分类'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingCategory ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

