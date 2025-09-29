'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag, Switch, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  getMoveCategories,
  createMoveCategory,
  updateMoveCategory,
  deleteMoveCategory,
  getMoveSubCategories,
  createMoveSubCategory,
  updateMoveSubCategory,
  deleteMoveSubCategory
} from '@/lib/admin-queries';
import { MoveCategory, MoveSubCategory } from '@/types/admin';

const { Option } = Select;
const { TextArea } = Input;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<MoveCategory[]>([]);
  const [subCategories, setSubCategories] = useState<MoveSubCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [subCategoryModalVisible, setSubCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MoveCategory | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<MoveSubCategory | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryForm] = Form.useForm();
  const [subCategoryForm] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 加载招式大类
  const loadCategories = async () => {
    setLoading(true);
    try {
      const result = await getMoveCategories({
        page: pagination.current,
        pageSize: pagination.pageSize
      });
      if (result.error) {
        message.error('加载招式大类失败');
        return;
      }
      setCategories(result.data || []);
      setPagination(prev => ({ ...prev, total: result.total }));
    } catch (error) {
      console.error('加载招式大类失败:', error);
      message.error('加载招式大类失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载招式小类
  const loadSubCategories = async (categoryId?: number) => {
    if (!categoryId) return;
    
    try {
      const result = await getMoveSubCategories({
        page: pagination.current,
        pageSize: pagination.pageSize,
        category_id: categoryId
      });
      if (result.error) {
        message.error('加载招式小类失败');
        return;
      }
      setSubCategories(result.data || []);
      setPagination(prev => ({ ...prev, total: result.total }));
    } catch (error) {
      console.error('加载招式小类失败:', error);
      message.error('加载招式小类失败');
    }
  };

  useEffect(() => {
    loadCategories();
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    if (selectedCategoryId) {
      loadSubCategories(selectedCategoryId);
    }
  }, [selectedCategoryId, pagination.current, pagination.pageSize]);

  // 处理大类操作
  const handleAddCategory = () => {
    setEditingCategory(null);
    categoryForm.resetFields();
    setCategoryModalVisible(true);
  };

  const handleEditCategory = (category: MoveCategory) => {
    setEditingCategory(category);
    categoryForm.setFieldsValue({
      category_name: category.category_name,
      category_code: category.category_code,
      description: category.description,
      sort_order: category.sort_order,
      is_active: category.is_active
    });
    setCategoryModalVisible(true);
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      const result = await deleteMoveCategory(id);
      if (result.error) {
        message.error('删除招式大类失败');
        return;
      }
      message.success('删除招式大类成功');
      loadCategories();
      if (selectedCategoryId === id) {
        setSelectedCategoryId(null);
        setSubCategories([]);
      }
    } catch (error) {
      console.error('删除招式大类失败:', error);
      message.error('删除招式大类失败');
    }
  };

  const handleCategorySubmit = async (values: {
    category_name: string;
    category_code: string;
    description?: string;
    sort_order: number;
    is_active: boolean;
  }) => {
    try {
      if (editingCategory) {
        const result = await updateMoveCategory(editingCategory.id, values);
        if (result.error) {
          message.error('更新招式大类失败');
          return;
        }
        message.success('更新招式大类成功');
      } else {
        const result = await createMoveCategory(values);
        if (result.error) {
          message.error('创建招式大类失败');
          return;
        }
        message.success('创建招式大类成功');
      }
      setCategoryModalVisible(false);
      loadCategories();
    } catch (error) {
      console.error('保存招式大类失败:', error);
      message.error('保存招式大类失败');
    }
  };

  // 处理小类操作
  const handleAddSubCategory = () => {
    if (!selectedCategoryId) {
      message.warning('请先选择一个招式大类');
      return;
    }
    setEditingSubCategory(null);
    subCategoryForm.resetFields();
    subCategoryForm.setFieldValue('category_id', selectedCategoryId);
    setSubCategoryModalVisible(true);
  };

  const handleEditSubCategory = (subCategory: MoveSubCategory) => {
    setEditingSubCategory(subCategory);
    subCategoryForm.setFieldsValue({
      category_id: subCategory.category_id,
      sub_name: subCategory.sub_name,
      sub_code: subCategory.sub_code,
      description: subCategory.description,
      sort_order: subCategory.sort_order,
      is_active: subCategory.is_active
    });
    setSubCategoryModalVisible(true);
  };

  const handleDeleteSubCategory = async (id: number) => {
    try {
      const result = await deleteMoveSubCategory(id);
      if (result.error) {
        message.error('删除招式小类失败');
        return;
      }
      message.success('删除招式小类成功');
      loadSubCategories(selectedCategoryId!);
    } catch (error) {
      console.error('删除招式小类失败:', error);
      message.error('删除招式小类失败');
    }
  };

  const handleSubCategorySubmit = async (values: {
    category_id: number;
    sub_name: string;
    sub_code: string;
    description?: string;
    sort_order: number;
    is_active: boolean;
  }) => {
    try {
      if (editingSubCategory) {
        const result = await updateMoveSubCategory(editingSubCategory.id, values);
        if (result.error) {
          message.error('更新招式小类失败');
          return;
        }
        message.success('更新招式小类成功');
      } else {
        const result = await createMoveSubCategory(values);
        if (result.error) {
          message.error('创建招式小类失败');
          return;
        }
        message.success('创建招式小类成功');
      }
      setSubCategoryModalVisible(false);
      loadSubCategories(selectedCategoryId!);
    } catch (error) {
      console.error('保存招式小类失败:', error);
      message.error('保存招式小类失败');
    }
  };

  // 表格列定义
  const categoryColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '大类名称',
      dataIndex: 'category_name',
      key: 'category_name',
    },
    {
      title: '大类代码',
      dataIndex: 'category_code',
      key: 'category_code',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: MoveCategory) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditCategory(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个招式大类吗？"
            description="删除后，该大类下的所有小类也会被删除！"
            onConfirm={() => handleDeleteCategory(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="primary"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const subCategoryColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '小类名称',
      dataIndex: 'sub_name',
      key: 'sub_name',
    },
    {
      title: '小类代码',
      dataIndex: 'sub_code',
      key: 'sub_code',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: MoveSubCategory) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditSubCategory(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个招式小类吗？"
            onConfirm={() => handleDeleteSubCategory(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="primary"
              danger
              size="small"
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
    <div style={{ padding: '24px' }}>
      {/* 招式大类管理 */}
      <Card
        title="招式大类管理"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddCategory}
            >
              新增大类
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadCategories}
            >
              刷新
            </Button>
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        <Table
          columns={categoryColumns}
          dataSource={categories}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 10 }));
            },
          }}
          onRow={(record) => ({
            onClick: () => setSelectedCategoryId(record.id),
            style: {
              cursor: 'pointer',
              backgroundColor: selectedCategoryId === record.id ? '#f0f0f0' : 'transparent'
            }
          })}
        />
      </Card>

      {/* 招式小类管理 */}
      <Card
        title={`招式小类管理 ${selectedCategoryId ? `(${categories.find(c => c.id === selectedCategoryId)?.category_name})` : ''}`}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddSubCategory}
              disabled={!selectedCategoryId}
            >
              新增小类
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => selectedCategoryId && loadSubCategories(selectedCategoryId)}
              disabled={!selectedCategoryId}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {selectedCategoryId ? (
          <Table
            columns={subCategoryColumns}
            dataSource={subCategories}
            rowKey="id"
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 10 }));
              },
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            请先选择一个招式大类来管理其下的小类
          </div>
        )}
      </Card>

      {/* 招式大类表单 */}
      <Modal
        title={editingCategory ? '编辑招式大类' : '新增招式大类'}
        open={categoryModalVisible}
        onCancel={() => setCategoryModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={categoryForm}
          layout="vertical"
          onFinish={handleCategorySubmit}
        >
          <Form.Item
            name="category_name"
            label="大类名称"
            rules={[{ required: true, message: '请输入大类名称' }]}
          >
            <Input placeholder="请输入大类名称" />
          </Form.Item>

          <Form.Item
            name="category_code"
            label="大类代码"
            rules={[{ required: true, message: '请输入大类代码' }]}
          >
            <Input placeholder="请输入大类代码（英文）" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>

          <Form.Item
            name="sort_order"
            label="排序"
            rules={[{ required: true, message: '请输入排序值' }]}
          >
            <InputNumber
              placeholder="请输入排序值"
              min={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCategoryModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingCategory ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 招式小类表单 */}
      <Modal
        title={editingSubCategory ? '编辑招式小类' : '新增招式小类'}
        open={subCategoryModalVisible}
        onCancel={() => setSubCategoryModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={subCategoryForm}
          layout="vertical"
          onFinish={handleSubCategorySubmit}
        >
          <Form.Item
            name="category_id"
            label="所属大类"
            rules={[{ required: true, message: '请选择所属大类' }]}
          >
            <Select placeholder="请选择所属大类" disabled>
              {categories.map(category => (
                <Option key={category.id} value={category.id}>
                  {category.category_name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="sub_name"
            label="小类名称"
            rules={[{ required: true, message: '请输入小类名称' }]}
          >
            <Input placeholder="请输入小类名称" />
          </Form.Item>

          <Form.Item
            name="sub_code"
            label="小类代码"
            rules={[{ required: true, message: '请输入小类代码' }]}
          >
            <Input placeholder="请输入小类代码（英文）" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>

          <Form.Item
            name="sort_order"
            label="排序"
            rules={[{ required: true, message: '请输入排序值' }]}
          >
            <InputNumber
              placeholder="请输入排序值"
              min={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setSubCategoryModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingSubCategory ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
