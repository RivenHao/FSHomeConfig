'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag, Image, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined, EyeOutlined, CloseOutlined, InboxOutlined } from '@ant-design/icons';
import { getMoves, createMove, updateMove, deleteMove, getAllMoveCategories, getMoveSubCategories, getTags } from '@/lib/admin-queries';
import { Move, MoveCategory, MoveTag } from '@/types/admin';
import FilterPanel, { FilterOption } from '@/components/common/FilterPanel';

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
  const [allTags, setAllTags] = useState<MoveTag[]>([]);
  const [previewVideo, setPreviewVideo] = useState<string>('');
  const [previewGif, setPreviewGif] = useState<string>('');

  // 筛选相关状态
  const [filteredMoves, setFilteredMoves] = useState<Move[]>([]);
  const [filters, setFilters] = useState({
    move_name: '',
    main_type: '',
    move_diff: ''
  });

  // GIF上传相关状态
  const [selectedGifFile, setSelectedGifFile] = useState<File | null>(null);
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [gifUploading, setGifUploading] = useState(false);
  const gifFileInputRef = useRef<HTMLInputElement>(null);

  // 视频上传相关状态
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [isVideoDragOver, setIsVideoDragOver] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // GIF文件验证
  const validateGifFile = (file: File): boolean => {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!supportedTypes.includes(file.type)) {
      message.error('不支持的文件格式。请上传 JPEG、PNG、GIF 或 WebP 格式的图片。');
      return false;
    }

    if (file.size > maxSize) {
      message.error('文件太大。请上传小于 10MB 的图片。');
      return false;
    }

    return true;
  };

  // 处理GIF文件选择（仅预览，不上传）
  const handleGifFileSelect = (file: File) => {
    if (!validateGifFile(file)) {
      return;
    }

    setSelectedGifFile(file);

    // 创建本地预览URL
    const previewUrl = URL.createObjectURL(file);
    setGifPreviewUrl(previewUrl);

    message.success('图片已选择，提交表单时将上传到云存储');
  };

  // 上传GIF到R2（在表单提交时调用）
  const uploadGifToR2 = async (file: File): Promise<string | null> => {
    if (!file) return null;

    setGifUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/gif', {
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
        message.success('GIF图片上传成功');
        return result.url;
      } else {
        throw new Error(result.details || result.error || '上传失败');
      }
    } catch (error) {
      console.error('GIF上传错误:', error);
      message.error(error instanceof Error ? error.message : 'GIF上传失败，请重试');
      return null;
    } finally {
      setGifUploading(false);
    }
  };

  // 重置GIF上传状态
  const resetGifUploadState = () => {
    setSelectedGifFile(null);
    // 清理本地blob URL
    if (gifPreviewUrl) {
      URL.revokeObjectURL(gifPreviewUrl);
      setGifPreviewUrl('');
    }
    setPreviewGif('');
    setIsDragOver(false);
    setGifUploading(false);
    // 重置文件输入
    if (gifFileInputRef.current) {
      gifFileInputRef.current.value = '';
    }
  };

  // 删除GIF
  const handleDeleteGif = () => {
    resetGifUploadState();
    form.setFieldValue('move_gif', '');
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
      handleGifFileSelect(files[0]);
    }
  };

  // 触发文件选择
  const triggerFileSelect = () => {
    gifFileInputRef.current?.click();
  };

  // 视频文件验证
  const validateVideoFile = (file: File): boolean => {
    const supportedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/ogg'];
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (!supportedTypes.includes(file.type)) {
      message.error('不支持的视频格式。请上传 MP4、WebM、MOV、AVI、MPEG 或 OGG 格式的视频。');
      return false;
    }

    if (file.size > maxSize) {
      message.error('文件太大。请上传小于 100MB 的视频。');
      return false;
    }

    return true;
  };

  // 处理视频文件选择（仅预览，不上传）
  const handleVideoFileSelect = (file: File) => {
    if (!validateVideoFile(file)) {
      return;
    }

    setSelectedVideoFile(file);

    // 创建本地预览URL
    const previewUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(previewUrl);

    message.success('视频已选择，提交表单时将上传到云存储');
  };

  // 上传视频到R2（在表单提交时调用）
  const uploadVideoToR2 = async (file: File): Promise<string | null> => {
    if (!file) return null;

    setVideoUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/video', {
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
        message.success('视频上传成功');
        return result.url;
      } else {
        throw new Error(result.details || result.error || '上传失败');
      }
    } catch (error) {
      console.error('视频上传错误:', error);
      message.error(error instanceof Error ? error.message : '视频上传失败，请重试');
      return null;
    } finally {
      setVideoUploading(false);
    }
  };

  // 重置视频上传状态
  const resetVideoUploadState = () => {
    setSelectedVideoFile(null);
    // 清理本地blob URL
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl('');
    }
    setPreviewVideo('');
    setIsVideoDragOver(false);
    setVideoUploading(false);
    // 重置文件输入
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = '';
    }
  };

  // 删除视频
  const handleDeleteVideo = () => {
    resetVideoUploadState();
    form.setFieldValue('move_url', '');
  };

  // 视频拖拽处理
  const handleVideoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVideoDragOver(true);
  };

  const handleVideoDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVideoDragOver(false);
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVideoDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleVideoFileSelect(files[0]);
    }
  };

  // 触发视频文件选择
  const triggerVideoFileSelect = () => {
    videoFileInputRef.current?.click();
  };

  // 处理Modal关闭
  const handleModalClose = () => {
    setModalVisible(false);
    // 清理所有状态
    resetGifUploadState();
    resetVideoUploadState();
    setEditingMove(null);
    form.resetFields();
    setSubTypeOptions([]);
    setPreviewVideo('');
    setPreviewGif('');
  };

  // 根据主类型更新子类型选项
  const updateSubTypeOptions = useCallback(async (mainType: string | null, preserveValue = false) => {
    if (!mainType) {
      setSubTypeOptions([]);
      if (!preserveValue) {
        form.setFieldValue('sub_type', undefined);
      }
      return;
    }

    try {
      // 根据大类代码查找对应的分类ID
      const category = categories.find(c => c.category_code === mainType);
      if (!category) {
        setSubTypeOptions([]);
        if (!preserveValue) {
          form.setFieldValue('sub_type', undefined);
        }
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
      // 只有在非保留模式下才清空子类型选择
      if (!preserveValue) {
        form.setFieldValue('sub_type', undefined);
      }
    } catch (error) {
      console.error('获取子类型选项失败:', error);
      setSubTypeOptions([]);
      if (!preserveValue) {
        form.setFieldValue('sub_type', undefined);
      }
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
      setFilteredMoves(result.data || []); // 初始化筛选后的数据
    } catch (error) {
      console.error('加载招式数据失败:', error);
      message.error('加载招式数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 筛选函数
  const applyFilters = useCallback(() => {
    let filtered = [...moves];

    // 按招式名称筛选
    if (filters.move_name) {
      filtered = filtered.filter(move =>
        move.move_name?.toLowerCase().includes(filters.move_name.toLowerCase()) ||
        move.move_cn?.toLowerCase().includes(filters.move_name.toLowerCase())
      );
    }

    // 按主类型筛选
    if (filters.main_type) {
      filtered = filtered.filter(move => move.main_type === filters.main_type);
    }

    // 按难度筛选
    if (filters.move_diff) {
      filtered = filtered.filter(move => move.move_diff === parseInt(filters.move_diff));
    }

    // 按招式名称排序（完全匹配优先，然后按拼音排序）
    filtered.sort((a, b) => {
      const nameA = a.move_name || '';
      const nameB = b.move_name || '';
      const searchTerm = filters.move_name?.toLowerCase() || '';

      // 如果有搜索条件，优先显示完全匹配的
      if (searchTerm) {
        const aExactMatch = nameA.toLowerCase() === searchTerm;
        const bExactMatch = nameB.toLowerCase() === searchTerm;

        // 完全匹配的排在前面
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;

        // 如果都是完全匹配或都不是完全匹配，按拼音排序
        return nameA.localeCompare(nameB, 'zh-CN', { numeric: true });
      }

      // 没有搜索条件时，直接按拼音排序
      return nameA.localeCompare(nameB, 'zh-CN', { numeric: true });
    });

    setFilteredMoves(filtered);
  }, [moves, filters]);

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
      move_name: '',
      main_type: '',
      move_diff: ''
    });
  };

  // 筛选配置
  const filterOptions: FilterOption[] = [
    {
      key: 'move_name',
      label: '招式名称',
      type: 'input',
      placeholder: '搜索招式名称',
      style: { width: 200 }
    },
    {
      key: 'main_type',
      label: '主类型',
      type: 'select',
      placeholder: '选择主类型',
      style: { width: 150 },
      options: categories.map(category => ({
        value: category.category_code,
        label: category.category_name
      }))
    },
    {
      key: 'move_diff',
      label: '难度等级',
      type: 'select',
      placeholder: '选择难度',
      style: { width: 150 },
      options: [
        { value: '1', label: '⭐ 1星 (入门)' },
        { value: '2', label: '⭐⭐ 2星 (初级)' },
        { value: '3', label: '⭐⭐⭐ 3星 (中级)' },
        { value: '4', label: '⭐⭐⭐⭐ 4星 (高级)' },
        { value: '5', label: '⭐⭐⭐⭐⭐ 5星 (专家)' }
      ]
    }
  ];

  // 加载所有标签
  const loadAllTags = async () => {
    const result = await getTags();
    if (result.data) {
      setAllTags(result.data);
    }
  };

  useEffect(() => {
    loadCategories();
    loadMoves();
    loadAllTags();
  }, []);

  const handleAdd = () => {
    setEditingMove(null);
    form.resetFields();
    setSubTypeOptions([]);
    setPreviewVideo('');
    setPreviewGif('');
    // 重置GIF上传状态
    resetGifUploadState();
    // 重置视频上传状态
    resetVideoUploadState();
    setModalVisible(true);
  };

  const handleEdit = async (move: Move) => {
    setEditingMove(move);
    // 设置预览状态
    setPreviewGif(move.move_gif || '');
    setPreviewVideo(move.move_url || '');
    // 重置GIF上传状态（编辑时清理本地上传状态）
    resetGifUploadState();
    // 重置视频上传状态（编辑时清理本地上传状态）
    resetVideoUploadState();

    // 先加载子类型选项（保留原有的sub_type值）
    if (move.main_type) {
      await updateSubTypeOptions(move.main_type, true);
    }

    // 然后设置表单值（包括子类型）
    form.setFieldsValue({
      move_name: move.move_name,
      move_cn: move.move_cn,
      main_type: move.main_type,
      sub_type: move.sub_type,
      move_diff: move.move_diff, // 直接使用数据库中的数字值
      move_desc: move.move_desc,
      move_url: move.move_url,
      move_gif: move.move_gif,
      move_creater: move.move_creater,
      move_score: move.move_score,
      tags: move.tags || []
    });
    
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
    move_cn?: string;
    main_type: string;
    sub_type: string;
    move_diff: number;
    move_desc?: string;
    move_url?: string;
    move_gif?: string;
    move_creater?: string;
    move_score: number;
    tags?: string[];
  }) => {
    try {
      // 如果选择了新的GIF文件，先上传
      let gifUrl = values.move_gif || '';
      if (selectedGifFile) {
        const uploadedUrl = await uploadGifToR2(selectedGifFile);
        if (!uploadedUrl) {
          message.error('GIF上传失败，请重试');
          return;
        }
        gifUrl = uploadedUrl;

        // 上传成功后清理本地预览状态
        if (gifPreviewUrl) {
          URL.revokeObjectURL(gifPreviewUrl);
          setGifPreviewUrl('');
        }
        setSelectedGifFile(null);
        // 设置新的预览URL为上传后的真实URL
        setPreviewGif(uploadedUrl);
      }

      // 如果选择了新的视频文件，先上传
      let videoUrl = values.move_url || '';
      if (selectedVideoFile) {
        const uploadedUrl = await uploadVideoToR2(selectedVideoFile);
        if (!uploadedUrl) {
          message.error('视频上传失败，请重试');
          return;
        }
        videoUrl = uploadedUrl;

        // 上传成功后清理本地预览状态
        if (videoPreviewUrl) {
          URL.revokeObjectURL(videoPreviewUrl);
          setVideoPreviewUrl('');
        }
        setSelectedVideoFile(null);
        // 设置新的预览URL为上传后的真实URL
        setPreviewVideo(uploadedUrl);
      }

      // 更新values中的move_gif和move_url
      const finalValues = {
        ...values,
        move_gif: gifUrl,
        move_url: videoUrl
      };

      if (editingMove) {
        // 更新
        const result = await updateMove(editingMove.id, finalValues);
        if (result.error) {
          message.error('更新招式失败');
          return;
        }
        message.success('更新招式成功');
      } else {
        // 新增
        const result = await createMove(finalValues);
        if (result.error) {
          message.error('创建招式失败');
          return;
        }
        message.success('创建招式成功');
      }
      handleModalClose(); // 使用统一的关闭处理
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
      render: (text: string, record: Move) => (
        <div>
          <strong>{record.move_cn || text || '-'}</strong>
          {record.move_cn && text && record.move_cn !== text && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              {text}
            </div>
          )}
        </div>
      ),
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
      render: (difficulty: number) => {
        const getDifficultyDisplay = (diff: number) => {
          switch (diff) {
            case 1: return { text: '⭐ 1星 (入门)', color: 'green' };
            case 2: return { text: '⭐⭐ 2星 (初级)', color: 'blue' };
            case 3: return { text: '⭐⭐⭐ 3星 (中级)', color: 'orange' };
            case 4: return { text: '⭐⭐⭐⭐ 4星 (高级)', color: 'red' };
            case 5: return { text: '⭐⭐⭐⭐⭐ 5星 (专家)', color: 'purple' };
            default: return { text: '-', color: 'default' };
          }
        };
        const { text, color } = getDifficultyDisplay(difficulty);
        return <Tag color={color}>{text}</Tag>;
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
      title: '招式描述',
      dataIndex: 'move_desc',
      key: 'move_desc',
      width: 200,
      render: (desc: string) => {
        if (!desc) {
          return <span style={{ color: '#999' }}>无描述</span>;
        }
        return (
          <Tooltip title={desc} placement="topLeft">
            <div
              style={{
                width: '180px',
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
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[] | null) => (
        <>
          {tags?.map(tag => (
            <Tag color="blue" key={tag}>
              {tag}
            </Tag>
          ))}
        </>
      ),
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
        {/* 筛选组件 */}
        <FilterPanel
          title="筛选条件"
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
          resultCount={filteredMoves.length}
        />

        <Table
          columns={columns}
          dataSource={filteredMoves}
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
        onCancel={handleModalClose}
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
            name="move_cn"
            label="招式中文名"
            tooltip="可选字段，用于显示招式的中文名称"
          >
            <Input placeholder="请输入招式中文名（可选）" />
          </Form.Item>

          <Form.Item
            name="main_type"
            label="主类型"
            rules={[{ required: true, message: '请选择主类型' }]}
          >
            <Select
              placeholder="请选择主类型"
              onChange={(value) => updateSubTypeOptions(value, false)}
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
              <Option value={1}>⭐ 1星 (入门)</Option>
              <Option value={2}>⭐⭐ 2星 (初级)</Option>
              <Option value={3}>⭐⭐⭐ 3星 (中级)</Option>
              <Option value={4}>⭐⭐⭐⭐ 4星 (高级)</Option>
              <Option value={5}>⭐⭐⭐⭐⭐ 5星 (专家)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="move_score"
            label="招式分数"
            rules={[{ required: true, message: '请输入招式分数' }]}
          >
            <Input
              type="number"
              placeholder="请输入招式分数"
              onWheel={(e) => e.currentTarget.blur()}
            />
          </Form.Item>

          <Form.Item
            name="move_creater"
            label="创建者"
          >
            <Input placeholder="请输入创建者" />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
            tooltip="可选字段，可多选"
          >
            <Select
              mode="multiple"
              placeholder="请选择标签"
              style={{ width: '100%' }}
              options={allTags.map(tag => ({ label: tag.tag_name, value: tag.tag_name }))}
            />
          </Form.Item>

          <Form.Item
            name="move_url"
            label="招式视频"
          >
            <div>
              {/* 拖拽上传区域 */}
              <div
                style={{
                  border: `2px dashed ${isVideoDragOver ? '#1890ff' : '#d9d9d9'}`,
                  borderRadius: '6px',
                  padding: '20px',
                  textAlign: 'center',
                  backgroundColor: isVideoDragOver ? '#f0f8ff' : '#fafafa',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onDragOver={handleVideoDragOver}
                onDragLeave={handleVideoDragLeave}
                onDrop={handleVideoDrop}
                onClick={triggerVideoFileSelect}
              >
                <PlayCircleOutlined style={{ fontSize: '48px', color: '#999', marginBottom: '16px' }} />
                <p style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
                  点击或拖拽视频文件到此区域上传
                </p>
                <p style={{ margin: 0, color: '#999' }}>
                  支持 MP4、WebM、MOV、AVI、MPEG、OGG 格式，文件大小不超过 100MB
                </p>
              </div>

              {/* 隐藏的文件输入 */}
              <input
                key={`video-input-${modalVisible ? 'open' : 'closed'}-${editingMove?.id || 'new'}`}
                ref={videoFileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg,video/ogg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleVideoFileSelect(file);
                  }
                }}
              />

              {/* 预览区域 */}
              {(videoPreviewUrl || previewVideo) && (
                <div style={{ marginTop: 16, position: 'relative', display: 'inline-block' }}>
                  <div style={{
                    position: 'relative',
                    display: 'inline-block',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    padding: '8px'
                  }}>
                    <Button
                      type="link"
                      icon={<PlayCircleOutlined />}
                      onClick={() => window.open(videoPreviewUrl || previewVideo || '', '_blank')}
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
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                    {selectedVideoFile ? (
                      <span style={{ color: '#1890ff' }}>
                        🎬 {selectedVideoFile.name} (将在提交时上传)
                      </span>
                    ) : (
                      <span>当前视频</span>
                    )}
                  </div>
                </div>
              )}

              {/* 上传进度提示 */}
              {videoUploading && (
                <div style={{ marginTop: 8, color: '#1890ff' }}>
                  正在上传视频...
                </div>
              )}
            </div>
          </Form.Item>

          <Form.Item
            name="move_gif"
            label="招式动图"
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
                  支持 JPEG、PNG、GIF、WebP 格式，文件大小不超过 10MB
                </p>
              </div>

              {/* 隐藏的文件输入 */}
              <input
                key={`gif-input-${modalVisible ? 'open' : 'closed'}-${editingMove?.id || 'new'}`}
                ref={gifFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleGifFileSelect(file);
                  }
                }}
              />

              {/* 预览区域 */}
              {(gifPreviewUrl || previewGif) && (
                <div style={{ marginTop: 16, position: 'relative', display: 'inline-block' }}>
                  <div style={{
                    position: 'relative',
                    display: 'inline-block',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    padding: '4px'
                  }}>
                    <Image
                      src={gifPreviewUrl || previewGif || undefined}
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
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                    {selectedGifFile ? (
                      <span style={{ color: '#1890ff' }}>
                        📎 {selectedGifFile.name} (将在提交时上传)
                      </span>
                    ) : (
                      <span>当前图片</span>
                    )}
                  </div>
                </div>
              )}

              {/* 上传进度提示 */}
              {gifUploading && (
                <div style={{ marginTop: 8, color: '#1890ff' }}>
                  正在上传GIF图片...
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
              <Button onClick={handleModalClose}>
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
