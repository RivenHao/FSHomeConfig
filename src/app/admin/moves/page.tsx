'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { getMoves, createMove, updateMove, deleteMove } from '@/lib/admin-queries';
import { Move } from '@/types/admin';

const { Option } = Select;
const { TextArea } = Input;

export default function MovesPage() {
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMove, setEditingMove] = useState<Move | null>(null);
  const [form] = Form.useForm();
  const [subTypeOptions, setSubTypeOptions] = useState<{ value: string; label: string }[]>([]);

  // 根据主类型更新子类型选项
  const updateSubTypeOptions = (mainType: string | null) => {
    let options: { value: string; label: string }[] = [];
    
    switch (mainType) {
      case 'lower':
        options = [
          { value: '0.5rev', label: '0.5rev' },
          { value: '1rev', label: '1rev' },
          { value: '1.5rev', label: '1.5rev' },
          { value: '2rev', label: '2rev' },
          { value: '2.5rev', label: '2.5rev' },
          { value: '3rev', label: '3rev' },
          { value: '3.5rev', label: '3.5rev' },
          { value: '4rev', label: '4rev' }
        ];
        break;
      case 'upper':
        options = [
          { value: 'handstand', label: 'handstand' },
          { value: 'freeze', label: 'freeze' },
          { value: 'power', label: 'power' }
        ];
        break;
      case 'sit':
        options = [
          { value: 'basic_sit', label: 'basic sit' },
          { value: 'advanced_sit', label: 'advanced sit' }
        ];
        break;
      case 'block':
        options = [
          { value: 'basic_block', label: 'basic block' },
          { value: 'advanced_block', label: 'advanced block' }
        ];
        break;
      case 'new_school':
        options = [
          { value: 'new_style', label: 'new style' },
          { value: 'modern', label: 'modern' }
        ];
        break;
      case 'old_school':
        options = [
          { value: 'classic', label: 'classic' },
          { value: 'traditional', label: 'traditional' }
        ];
        break;
      case 'transition':
        options = [
          { value: 'smooth', label: 'smooth' },
          { value: 'quick', label: 'quick' }
        ];
        break;
      case 'kickball':
        options = [
          { value: 'basic_kick', label: '基础踢法' },
          { value: 'advanced_kick', label: '高级踢法' }
        ];
        break;
      default:
        options = [];
    }
    
    setSubTypeOptions(options);
    // 清空子类型选择
    form.setFieldValue('sub_type', undefined);
  };

  const loadMoves = async () => {
    setLoading(true);
    try {
      const result = await getMoves();
      if (result.error) {
        message.error('加载招式数据失败');
        return;
      }
      setMoves(result.data || []);
    } catch (error) {
      console.error('加载招式数据失败:', error);
      message.error('加载招式数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMoves();
  }, []);

  const handleAdd = () => {
    setEditingMove(null);
    form.resetFields();
    setSubTypeOptions([]);
    setModalVisible(true);
  };

  const handleEdit = (move: Move) => {
    setEditingMove(move);
    form.setFieldsValue({
      move_name: move.move_name,
      main_type: move.main_type,
      sub_type: move.sub_type,
      move_diff: move.move_diff,
      move_desc: move.move_desc,
      move_url: move.move_url,
      move_creater: move.move_creater,
      move_score: move.move_score
    });
    // 根据主类型设置子类型选项
    updateSubTypeOptions(move.main_type);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await deleteMove(id);
      if (result.error) {
        message.error('删除招式失败');
        return;
      }
      message.success('删除招式成功');
      loadMoves();
    } catch (error) {
      console.error('删除招式失败:', error);
      message.error('删除招式失败');
    }
  };

  const handleSubmit = async (values: {
    move_name: string;
    main_type: string;
    sub_type: string;
    move_diff: string;
    move_desc?: string;
    move_url?: string;
    move_creater?: string;
    move_score: number;
  }) => {
    try {
      if (editingMove) {
        // 更新
        const result = await updateMove(editingMove.id, values);
        if (result.error) {
          message.error('更新招式失败');
          return;
        }
        message.success('更新招式成功');
      } else {
        // 新增
        const result = await createMove(values);
        if (result.error) {
          message.error('创建招式失败');
          return;
        }
        message.success('创建招式成功');
      }
      setModalVisible(false);
      loadMoves();
    } catch (error) {
      console.error('保存招式失败:', error);
      message.error('保存招式失败');
    }
  };

  const columns = [
    {
      title: '招式名称',
      dataIndex: 'move_name',
      key: 'move_name',
      render: (text: string) => <strong>{text || '-'}</strong>,
    },
    {
      title: '主类型',
      dataIndex: 'main_type',
      key: 'main_type',
      render: (text: string) => <Tag color="blue">{text || '-'}</Tag>,
    },
    {
      title: '子类型',
      dataIndex: 'sub_type',
      key: 'sub_type',
      render: (text: string) => <Tag color="green">{text || '-'}</Tag>,
    },
    {
      title: '难度',
      dataIndex: 'move_diff',
      key: 'move_diff',
      render: (text: string) => {
        const color = text === '简单' ? 'green' : text === '中等' ? 'orange' : 'red';
        return <Tag color={color}>{text || '-'}</Tag>;
      },
    },
    {
      title: '分数',
      dataIndex: 'move_score',
      key: 'move_score',
      render: (score: number) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{score || 0}</span>,
    },
    {
      title: '创建者',
      dataIndex: 'move_creater',
      key: 'move_creater',
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: Move) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个招式吗？"
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
        title="招式库管理"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadMoves}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增招式
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={moves}
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
        title={editingMove ? '编辑招式' : '新增招式'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="move_name"
            label="招式名称"
            rules={[{ required: true, message: '请输入招式名称' }]}
          >
            <Input placeholder="请输入招式名称" />
          </Form.Item>

          <Form.Item
            name="main_type"
            label="主类型"
            rules={[{ required: true, message: '请选择主类型' }]}
          >
            <Select 
              placeholder="请选择主类型"
              onChange={updateSubTypeOptions}
            >
              <Option value="lower">lower</Option>
              <Option value="upper">upper</Option>
              <Option value="sit">sit down</Option>
              <Option value="block">block</Option>
              <Option value="new_school">new_school</Option>
              <Option value="old_school">old_school</Option>
              <Option value="transition">transition</Option>
              <Option value="kickball">蹴鞠</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="sub_type"
            label="子类型"
            rules={[{ required: true, message: '请选择子类型' }]}
          >
            <Select 
              placeholder="请选择子类型"
              disabled={subTypeOptions.length === 0}
            >
              {subTypeOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="move_diff"
            label="难度等级"
            rules={[{ required: true, message: '请选择难度等级' }]}
          >
            <Select placeholder="请选择难度等级">
              <Option value="简单">简单</Option>
              <Option value="中等">中等</Option>
              <Option value="困难">困难</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="move_score"
            label="招式分数"
            rules={[{ required: true, message: '请输入招式分数' }]}
          >
            <Input type="number" placeholder="请输入招式分数" />
          </Form.Item>

          <Form.Item
            name="move_creater"
            label="创建者"
          >
            <Input placeholder="请输入创建者" />
          </Form.Item>

          <Form.Item
            name="move_url"
            label="招式视频链接"
          >
            <Input placeholder="请输入招式视频链接" />
          </Form.Item>

          <Form.Item
            name="move_desc"
            label="招式描述"
          >
            <TextArea rows={4} placeholder="请输入招式描述" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingMove ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
