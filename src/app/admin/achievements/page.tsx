'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag, Image, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, EyeOutlined, CloseOutlined, InboxOutlined, TrophyOutlined } from '@ant-design/icons';
import { getAchievements, createAchievement, updateAchievement, deleteAchievement, getMoves, getAchievementCategories } from '@/lib/admin-queries';
import { Achievement, Move, AchievementCategory } from '@/types/admin';
import FilterPanel, { FilterOption } from '@/components/common/FilterPanel';

const { Option } = Select;
const { TextArea } = Input;

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [categories, setCategories] = useState<AchievementCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false); // 表单提交中
  const [deleting, setDeleting] = useState<string | null>(null); // 正在删除的成就ID

  // 筛选相关状态
  const [filteredAchievements, setFilteredAchievements] = useState<Achievement[]>([]);
  const [filters, setFilters] = useState({
    name: '',
    difficulty: '',
    is_active: ''
  });

  // 图标上传相关状态
  const [selectedIconFile, setSelectedIconFile] = useState<File | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);
  const iconFileInputRef = useRef<HTMLInputElement>(null);

  // 图标文件验证
  const validateIconFile = (file: File): boolean => {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!supportedTypes.includes(file.type)) {
      message.error('不支持的文件格式。请上传 JPEG、PNG、GIF 或 WebP 格式的图片。');
      return false;
    }

    if (file.size > maxSize) {
      message.error('文件太大。请上传小于 5MB 的图片。');
      return false;
    }

    return true;
  };

  // 处理图标文件选择（仅预览，不上传）
  const handleIconFileSelect = (file: File) => {
    if (!validateIconFile(file)) {
      return;
    }

    setSelectedIconFile(file);

    // 创建本地预览URL
    const previewUrl = URL.createObjectURL(file);
    setIconPreviewUrl(previewUrl);

    message.success('图标已选择，提交表单时将上传到云存储');
  };

  // 上传图标到R2（在表单提交时调用）
  const uploadIconToR2 = async (file: File): Promise<string | null> => {
    if (!file) return null;

    setIconUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API响应错误:', errorData);
        throw new Error(errorData.details || errorData.error || '上传失败');
      }

      const result = await response.json();

      if (result.success) {
        message.success('图标上传成功');
        return result.url;
      } else {
        throw new Error(result.details || result.error || '上传失败');
      }
    } catch (error) {
      console.error('图标上传错误:', error);
      message.error(error instanceof Error ? error.message : '图标上传失败，请重试');
      return null;
    } finally {
      setIconUploading(false);
    }
  };

  // 重置图标上传状态
  const resetIconUploadState = () => {
    setSelectedIconFile(null);
    // 清理本地blob URL
    if (iconPreviewUrl) {
      URL.revokeObjectURL(iconPreviewUrl);
      setIconPreviewUrl('');
    }
    setIsDragOver(false);
    setIconUploading(false);
    // 重置文件输入
    if (iconFileInputRef.current) {
      iconFileInputRef.current.value = '';
    }
  };

  // 删除图标
  const handleDeleteIcon = () => {
    resetIconUploadState();
    form.setFieldValue('icon_url', '');
  };

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleIconFileSelect(files[0]);
    }
  };

  // 触发文件选择
  const triggerFileSelect = () => {
    iconFileInputRef.current?.click();
  };

  // 处理Modal关闭
  const handleModalClose = () => {
    setModalVisible(false);
    resetIconUploadState();
    setEditingAchievement(null);
    setSearchKeyword(''); // 清空搜索关键词
    form.resetFields();
  };

  // 加载成就数据
  const loadAchievements = async () => {
    setLoading(true);
    try {
      const result = await getAchievements();
      if (result.error) {
        message.error('加载成就数据失败');
        return;
      }
      setAchievements(result.data || []);
      setFilteredAchievements(result.data || []);
    } catch (error) {
      console.error('加载成就数据失败:', error);
      message.error('加载成就数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载招式数据（用于选择关联招式）
  const loadMoves = async () => {
    try {
      const result = await getMoves();
      if (result.error) {
        console.error('加载招式数据失败:', result.error);
        return;
      }
      setMoves(result.data || []);
    } catch (error) {
      console.error('加载招式数据失败:', error);
    }
  };

  // 加载成就分类数据
  const loadCategories = async () => {
    try {
      const result = await getAchievementCategories();
      if (result.error) {
        console.error('加载成就分类失败:', result.error);
        return;
      }
      setCategories(result.data || []);
    } catch (error) {
      console.error('加载成就分类失败:', error);
    }
  };

  // 招式搜索时的排序函数
  const [searchKeyword, setSearchKeyword] = useState('');
  
  const getSortedMoves = useCallback(() => {
    if (!searchKeyword.trim()) {
      // 没有搜索时，按拼音排序
      return [...moves].sort((a, b) => {
        const nameA = a.move_cn || a.move_name || '';
        const nameB = b.move_cn || b.move_name || '';
        return nameA.localeCompare(nameB, 'zh-CN');
      });
    }

    const keyword = searchKeyword.toLowerCase().trim();
    
    // 计算匹配分数
    const movesWithScore = moves.map(move => {
      const chineseName = (move.move_cn || '').toLowerCase();
      const englishName = (move.move_name || '').toLowerCase();
      const mainType = (move.main_type || '').toLowerCase();
      const subType = (move.sub_type || '').toLowerCase();
      
      let score = 0;
      
      // 完全匹配得分最高（100分）
      if (chineseName === keyword) score += 100;
      if (englishName === keyword) score += 100;
      
      // 开头匹配得分次之（50分）
      if (chineseName.startsWith(keyword)) score += 50;
      if (englishName.startsWith(keyword)) score += 50;
      
      // 包含匹配得分较低（10分）
      if (chineseName.includes(keyword)) score += 10;
      if (englishName.includes(keyword)) score += 10;
      if (mainType.includes(keyword)) score += 5;
      if (subType.includes(keyword)) score += 5;
      
      return { move, score };
    });
    
    // 过滤出有匹配的，并按分数排序
    return movesWithScore
      .filter(item => item.score > 0)
      .sort((a, b) => {
        // 分数高的排前面
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // 分数相同时，按拼音排序
        const nameA = a.move.move_cn || a.move.move_name || '';
        const nameB = b.move.move_cn || b.move.move_name || '';
        return nameA.localeCompare(nameB, 'zh-CN');
      })
      .map(item => item.move);
  }, [moves, searchKeyword]);

  // 筛选函数
  const applyFilters = useCallback(() => {
    let filtered = [...achievements];

    // 按成就名称筛选
    if (filters.name) {
      filtered = filtered.filter(achievement =>
        achievement.name?.toLowerCase().includes(filters.name.toLowerCase())
      );
    }

    // 按难度筛选
    if (filters.difficulty) {
      filtered = filtered.filter(achievement => 
        achievement.difficulty === parseInt(filters.difficulty)
      );
    }

    // 按启用状态筛选
    if (filters.is_active) {
      filtered = filtered.filter(achievement => 
        achievement.is_active === (filters.is_active === 'true')
      );
    }

    setFilteredAchievements(filtered);
  }, [achievements, filters]);

  // 当筛选条件或数据变化时重新筛选
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // 处理筛选条件变化
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      name: '',
      difficulty: '',
      is_active: ''
    });
  };

  // 筛选配置
  const filterOptions: FilterOption[] = [
    {
      key: 'name',
      label: '成就名称',
      type: 'input',
      placeholder: '搜索成就名称',
      style: { width: 200 }
    },
    {
      key: 'difficulty',
      label: '难度等级',
      type: 'select',
      placeholder: '选择难度',
      style: { width: 150 },
      options: [
        { value: '1', label: '⭐ 1星' },
        { value: '2', label: '⭐⭐ 2星' },
        { value: '3', label: '⭐⭐⭐ 3星' },
        { value: '4', label: '⭐⭐⭐⭐ 4星' },
        { value: '5', label: '⭐⭐⭐⭐⭐ 5星' }
      ]
    },
    {
      key: 'is_active',
      label: '启用状态',
      type: 'select',
      placeholder: '选择状态',
      style: { width: 150 },
      options: [
        { value: 'true', label: '已启用' },
        { value: 'false', label: '已禁用' }
      ]
    }
  ];

  useEffect(() => {
    loadAchievements();
    loadMoves();
    loadCategories();
  }, []);

  const handleAdd = () => {
    setEditingAchievement(null);
    form.resetFields();
    resetIconUploadState();
    setSearchKeyword(''); // 清空搜索关键词
    setModalVisible(true);
  };

  const handleEdit = async (achievement: Achievement) => {
    setEditingAchievement(achievement);
    resetIconUploadState();
    setSearchKeyword(''); // 清空搜索关键词，显示所有招式

    form.setFieldsValue({
      name: achievement.name,
      description: achievement.description,
      difficulty: achievement.difficulty,
      is_active: achievement.is_active,
      icon_url: achievement.icon_url,
      move_ids: achievement.move_ids || [],
      category_id: achievement.category_id // 设置分类ID
    });

    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const result = await deleteAchievement(id);
      if (result.error) {
        message.error('删除成就失败');
        return;
      }
      message.success('删除成就成功');
      loadAchievements();
    } catch (error) {
      console.error('删除成就失败:', error);
      message.error('删除成就失败');
    } finally {
      setDeleting(null);
    }
  };

  const handleSubmit = async (values: {
    name: string;
    description: string;
    difficulty: number;
    is_active: boolean;
    icon_url?: string;
    move_ids: number[];
    category_id: number;
  }) => {
    setSubmitting(true);
    try {
      // 如果选择了新的图标文件，先上传
      let iconUrl = values.icon_url || '';
      if (selectedIconFile) {
        const uploadedUrl = await uploadIconToR2(selectedIconFile);
        if (!uploadedUrl) {
          message.error('图标上传失败，请重试');
          return;
        }
        iconUrl = uploadedUrl;

        // 上传成功后清理本地预览状态
        if (iconPreviewUrl) {
          URL.revokeObjectURL(iconPreviewUrl);
          setIconPreviewUrl('');
        }
        setSelectedIconFile(null);
      }

      // 更新values中的icon_url
      const finalValues = {
        ...values,
        icon_url: iconUrl,
        category_id: values.category_id
      };

      if (editingAchievement) {
        // 更新
        const result = await updateAchievement(editingAchievement.id, finalValues);
        if (result.error) {
          message.error('更新成就失败');
          return;
        }
        message.success('更新成就成功');
      } else {
        // 新增
        const result = await createAchievement(finalValues);
        if (result.error) {
          message.error('创建成就失败');
          return;
        }
        message.success('创建成就成功');
      }
      handleModalClose();
      loadAchievements();
    } catch (error) {
      console.error('保存成就失败:', error);
      message.error('保存成就失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '成就图标',
      dataIndex: 'icon_url',
      key: 'icon_url',
      width: 100,
      render: (iconUrl: string, record: Achievement) => {
        if (!iconUrl) {
          return (
            <div style={{ 
              width: 60, 
              height: 60, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: '#f0f0f0',
              borderRadius: '8px'
            }}>
              <TrophyOutlined style={{ fontSize: 24, color: '#999' }} />
            </div>
          );
        }
        return (
          <Tooltip title="点击查看大图">
            <Image
              src={iconUrl}
              alt={record.name || '成就图标'}
              width={60}
              height={60}
              style={{
                objectFit: 'cover',
                borderRadius: '8px',
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
      title: '成就名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text || '-'}</strong>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: AchievementCategory | null) => (
        <Tag color="purple">{category?.name || '未分类'}</Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      render: (desc: string) => {
        if (!desc) {
          return <span style={{ color: '#999' }}>无描述</span>;
        }
        return (
          <Tooltip title={desc} placement="topLeft">
            <div
              style={{
                width: '230px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              {desc}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      render: (difficulty: number) => {
        const getDifficultyDisplay = (diff: number) => {
          switch (diff) {
            case 1: return { text: '⭐ 1星', color: 'green' };
            case 2: return { text: '⭐⭐ 2星', color: 'blue' };
            case 3: return { text: '⭐⭐⭐ 3星', color: 'orange' };
            case 4: return { text: '⭐⭐⭐⭐ 4星', color: 'red' };
            case 5: return { text: '⭐⭐⭐⭐⭐ 5星', color: 'purple' };
            default: return { text: '-', color: 'default' };
          }
        };
        const { text, color } = getDifficultyDisplay(difficulty);
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '关联招式',
      dataIndex: 'moves_count',
      key: 'moves_count',
      render: (count: number) => (
        <Tag color="cyan">{count || 0} 个招式</Tag>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '已启用' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: Achievement) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={deleting === record.id}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个成就吗？"
            description="删除后，用户的成就进度也会被清除"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            disabled={deleting === record.id}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              loading={deleting === record.id}
              disabled={deleting !== null && deleting !== record.id}
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
        title={
          <Space>
            <TrophyOutlined style={{ fontSize: 20 }} />
            <span>成就系统管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadAchievements}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增成就
            </Button>
          </Space>
        }
      >
        {/* 筛选组件 */}
        <FilterPanel
          title="筛选条件"
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
          resultCount={filteredAchievements.length}
        />

        <Table
          columns={columns}
          dataSource={filteredAchievements}
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
        title={editingAchievement ? '编辑成就' : '新增成就'}
        open={modalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={700}
        closable={!submitting && !iconUploading}
        maskClosable={!submitting && !iconUploading}
        keyboard={!submitting && !iconUploading}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            is_active: true,
            difficulty: 1,
            move_ids: []
          }}
        >
          <Form.Item
            name="name"
            label="成就名称"
            rules={[{ required: true, message: '请输入成就名称' }]}
          >
            <Input placeholder="例如：基础达人" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="category_id"
            label="成就分类"
            rules={[{ required: true, message: '请选择成就分类' }]}
          >
            <Select placeholder="请选择成就分类">
              {categories.map(category => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="成就描述"
            rules={[{ required: true, message: '请输入成就描述' }]}
          >
            <TextArea 
              rows={3} 
              placeholder="例如：解锁所有难度为1的基础招式，迈出花式足球的第一步！" 
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="difficulty"
            label="难度等级"
            rules={[{ required: true, message: '请选择难度等级' }]}
            tooltip="难度等级用于用户端展示，1星最简单，5星最困难"
          >
            <Select placeholder="请选择难度等级">
              <Option value={1}>⭐ 1星 (非常简单)</Option>
              <Option value={2}>⭐⭐ 2星 (简单)</Option>
              <Option value={3}>⭐⭐⭐ 3星 (中等)</Option>
              <Option value={4}>⭐⭐⭐⭐ 4星 (困难)</Option>
              <Option value={5}>⭐⭐⭐⭐⭐ 5星 (非常困难)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="move_ids"
            label="关联招式"
            rules={[{ required: true, message: '请至少选择一个招式' }]}
            tooltip="用户解锁这些招式后，成就会自动点亮"
          >
            <Select
              mode="multiple"
              placeholder="请选择招式（支持中英文搜索）"
              showSearch
              onSearch={(value) => setSearchKeyword(value)}
              filterOption={() => true} // 禁用默认过滤，使用自定义排序
              optionFilterProp="children"
              maxTagCount="responsive"
              maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} 个招式`}
              optionLabelProp="label" // 选中后只显示 label 属性
            >
              {getSortedMoves().map(move => (
                <Option 
                  key={move.id} 
                  value={move.id}
                  label={move.move_name || move.move_cn} // 选中后显示英文名
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 500 }}>
                      {move.move_cn || move.move_name}
                    </span>
                    {move.move_cn && move.move_name && (
                      <span style={{ color: '#999', fontSize: '12px' }}>
                        ({move.move_name})
                      </span>
                    )}
                    <Tag color="blue" style={{ fontSize: '11px', margin: 0 }}>
                      {move.main_type}
                    </Tag>
                    {move.sub_type && (
                      <Tag color="green" style={{ fontSize: '11px', margin: 0 }}>
                        {move.sub_type}
                      </Tag>
                    )}
                    <span style={{ color: '#999', fontSize: '12px' }}>
                      {'⭐'.repeat(move.move_diff || 1)}
                    </span>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="icon_url"
            label="成就图标"
            tooltip="建议上传方形图片，尺寸：256x256px"
          >
            <div>
              {/* 拖拽上传区域 */}
              <div
                style={{
                  border: `2px dashed ${isDragOver ? '#1890ff' : '#d9d9d9'}`,
                  borderRadius: '6px',
                  padding: '20px',
                  textAlign: 'center',
                  backgroundColor: isDragOver ? '#f0f8ff' : '#fafafa',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
              >
                <InboxOutlined style={{ fontSize: '48px', color: '#999', marginBottom: '16px' }} />
                <p style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
                  点击或拖拽文件到此区域上传
                </p>
                <p style={{ margin: 0, color: '#999' }}>
                  支持 JPEG、PNG、GIF、WebP 格式，文件大小不超过 5MB
                </p>
              </div>

              {/* 隐藏的文件输入 */}
              <input
                key={`icon-input-${modalVisible ? 'open' : 'closed'}-${editingAchievement?.id || 'new'}`}
                ref={iconFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleIconFileSelect(file);
                  }
                }}
              />

              {/* 预览区域 */}
              {(iconPreviewUrl || form.getFieldValue('icon_url')) && (
                <div style={{ marginTop: 16, position: 'relative', display: 'inline-block' }}>
                  <div style={{
                    position: 'relative',
                    display: 'inline-block',
                    border: '1px solid #d9d9d9',
                    borderRadius: '8px',
                    padding: '4px'
                  }}>
                    <Image
                      src={iconPreviewUrl || form.getFieldValue('icon_url') || undefined}
                      alt="成就图标预览"
                      width={100}
                      height={100}
                      style={{
                        objectFit: 'cover',
                        borderRadius: '8px'
                      }}
                      preview={{
                        mask: <EyeOutlined />
                      }}
                    />
                    <Button
                      type="text"
                      icon={<CloseOutlined />}
                      onClick={handleDeleteIcon}
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
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                    {selectedIconFile ? (
                      <span style={{ color: '#1890ff' }}>
                        📎 {selectedIconFile.name} (将在提交时上传)
                      </span>
                    ) : (
                      <span>当前图标</span>
                    )}
                  </div>
                </div>
              )}

              {/* 上传进度提示 */}
              {iconUploading && (
                <div style={{ marginTop: 8, color: '#1890ff' }}>
                  正在上传图标...
                </div>
              )}
            </div>
          </Form.Item>

          <Form.Item
            name="is_active"
            label="启用状态"
            tooltip="禁用后，该成就不会在用户端显示"
          >
            <Select>
              <Option value={true}>启用</Option>
              <Option value={false}>禁用</Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleModalClose} disabled={submitting || iconUploading}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={submitting || iconUploading}
                disabled={submitting || iconUploading}
              >
                {editingAchievement ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
