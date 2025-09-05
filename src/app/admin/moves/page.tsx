'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag, Image, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined, EyeOutlined, CloseOutlined } from '@ant-design/icons';
import { getMoves, createMove, updateMove, deleteMove, getAllMoveCategories, getMoveSubCategories } from '@/lib/admin-queries';
import { Move, MoveCategory } from '@/types/admin';

const { Option } = Select;
const { TextArea } = Input;

export default function MovesPage() {
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMove, setEditingMove] = useState<Move | null>(null);
  const [form] = Form.useForm();
  const [subTypeOptions, setSubTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [categories, setCategories] = useState<MoveCategory[]>([]);
  const [previewVideo, setPreviewVideo] = useState<string>('');
  const [previewGif, setPreviewGif] = useState<string>('');

  // 根据主类型更新子类型选项
  const updateSubTypeOptions = useCallback(async (mainType: string | null) => {
    if (!mainType) {
      setSubTypeOptions([]);
      form.setFieldValue('sub_type', undefined);
      return;
    }

    try {
      // 根据大类代码查找对应的分类ID
      const category = categories.find(c => c.category_code === mainType);
      if (!category) {
        setSubTypeOptions([]);
        form.setFieldValue('sub_type', undefined);
        return;
      }

      // 获取该分类下的小类
      const result = await getMoveSubCategories({
        page: 1,
        pageSize: 1000, // 获取所有小类
        category_id: category.id
      });

      if (result.error || !result.data) {
        setSubTypeOptions([]);
        return;
      }

      // 转换为选项格式
      const options = result.data
        .filter(sub => sub.is_active) // 只显示启用的
        .map(sub => ({
          value: sub.sub_code,
          label: sub.sub_name
        }))
        .sort((a, b) => a.label.localeCompare(b.label)); // 按名称排序

      setSubTypeOptions(options);
      // 清空子类型选择
      form.setFieldValue('sub_type', undefined);
    } catch (error) {
      console.error('获取子类型选项失败:', error);
      setSubTypeOptions([]);
      form.setFieldValue('sub_type', undefined);
    }
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  // 加载招式分类数据
  const loadCategories = async () => {
    try {
      const result = await getAllMoveCategories();
      if (result.error) {
        console.error('加载招式分类失败:', result.error);
        return;
      }
      setCategories(result.data || []);
    } catch (error) {
      console.error('加载招式分类失败:', error);
    }
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
    loadCategories();
    loadMoves();
  }, []);

  const handleAdd = () => {
    setEditingMove(null);
    form.resetFields();
    setSubTypeOptions([]);
    setPreviewVideo('');
    setPreviewGif('');
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
      move_gif: move.move_gif,
      move_creater: move.move_creater,
      move_score: move.move_score
    });
    // 设置预览状态
    setPreviewGif(move.move_gif || '');
    setPreviewVideo(move.move_url || '');
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

  // 删除动图预览
  const handleDeleteGif = () => {
    setPreviewGif('');
    form.setFieldValue('move_gif', '');
  };

  // 删除视频预览
  const handleDeleteVideo = () => {
    setPreviewVideo('');
    form.setFieldValue('move_url', '');
  };

  const handleSubmit = async (values: {
    move_name: string;
    main_type: string;
    sub_type: string;
    move_diff: string;
    move_desc?: string;
    move_url?: string;
    move_gif?: string;
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
      title: '动图预览',
      dataIndex: 'move_gif',
      key: 'move_gif',
      width: 120,
      render: (gifUrl: string, record: Move) => {
        if (!gifUrl) {
          return <span style={{ color: '#999' }}>无动图</span>;
        }
        return (
          <Tooltip title="点击查看大图">
            <Image
              src={gifUrl}
              alt={record.move_name || '招式动图'}
              width={80}
              height={60}
              style={{ 
                objectFit: 'cover',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              preview={{
                mask: <EyeOutlined />
              }}
            />
          </Tooltip>
        );
      },
    },
    {
      title: '视频预览',
      dataIndex: 'move_url',
      key: 'move_url',
      width: 100,
      render: (videoUrl: string) => {
        if (!videoUrl) {
          return <span style={{ color: '#999' }}>无视频</span>;
        }
        return (
          <Tooltip title="点击在新标签页中预览视频">
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => window.open(videoUrl, '_blank')}
              style={{ padding: 0 }}
            >
              预览
            </Button>
          </Tooltip>
        );
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
              {categories
                .filter(category => category.is_active)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(category => (
                  <Option key={category.id} value={category.category_code}>
                    {category.category_name}
                  </Option>
                ))}
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
            label="招式视频"
          >
            <div>
              <Button 
                type="dashed" 
                style={{ width: '100%', marginBottom: 8 }}
                onClick={() => {
                  // TODO: 实现上传逻辑
                  console.log('上传视频');
                }}
              >
                上传视频
              </Button>
              {previewVideo && (
                <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                  <div style={{ 
                    position: 'relative', 
                    display: 'inline-block',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    padding: '4px'
                  }}>
                    <Button
                      type="link"
                      icon={<PlayCircleOutlined />}
                      onClick={() => window.open(previewVideo, '_blank')}
                      style={{ padding: 0, height: 'auto' }}
                    >
                      预览视频
                    </Button>
                    <Button
                      type="text"
                      icon={<CloseOutlined />}
                      onClick={handleDeleteVideo}
                      style={{ 
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        width: 20,
                        height: 20,
                        minWidth: 20,
                        padding: 0,
                        borderRadius: '50%',
                        backgroundColor: '#ff4d4f',
                        color: 'white',
                        border: 'none',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Form.Item>

          <Form.Item
            name="move_gif"
            label="招式动图"
          >
            <div>
              <Button 
                type="dashed" 
                style={{ width: '100%', marginBottom: 8 }}
                onClick={() => {
                  // TODO: 实现上传逻辑
                  console.log('上传动图');
                }}
              >
                上传动图
              </Button>
              {previewGif && (
                <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                  <div style={{ 
                    position: 'relative', 
                    display: 'inline-block',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    padding: '4px'
                  }}>
                    <Image
                      src={previewGif}
                      alt="招式动图预览"
                      width={120}
                      height={90}
                      style={{ 
                        objectFit: 'cover',
                        borderRadius: '4px'
                      }}
                      preview={{
                        mask: <EyeOutlined />
                      }}
                    />
                    <Button
                      type="text"
                      icon={<CloseOutlined />}
                      onClick={handleDeleteGif}
                      style={{ 
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        width: 20,
                        height: 20,
                        minWidth: 20,
                        padding: 0,
                        borderRadius: '50%',
                        backgroundColor: '#ff4d4f',
                        color: 'white',
                        border: 'none',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
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
