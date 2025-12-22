'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Input, Select, Button, Space, Tag, Typography, message, Modal, Form, Image } from 'antd';
import { EyeOutlined, CheckCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { getCommunityVideos, reviewCommunityVideo } from '@/lib/admin-queries';
import { CommunityVideo } from '@/types/admin';
import FilterPanel, { FilterOption } from '@/components/common/FilterPanel';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

export default function CommunityVideosPage() {
    const [videos, setVideos] = useState<CommunityVideo[]>([]);
    const [filteredVideos, setFilteredVideos] = useState<CommunityVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        search: '',
        status: ''
    });
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState<CommunityVideo | null>(null);
    const [reviewForm] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });

    const loadVideos = async (page = 1, pageSize = pagination.pageSize) => {
        setLoading(true);
        try {
            const result = await getCommunityVideos({
                page,
                pageSize,
                search: filters.search,
                status: filters.status || undefined
            });

            if (result.error) {
                message.error('加载视频数据失败');
                return;
            }

            setVideos(result.data || []);
            setFilteredVideos(result.data || []);
            setPagination(prev => ({
                ...prev,
                current: page,
                total: result.total || 0,
            }));
        } catch (error) {
            console.error('加载视频数据失败:', error);
            message.error('加载视频数据失败');
        } finally {
            setLoading(false);
        }
    };

    // 筛选函数
    const applyFilters = useCallback(() => {
        let filtered = [...videos];

        // 按搜索条件筛选
        if (filters.search) {
            filtered = filtered.filter(video =>
                video.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
                video.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
                video.user_profiles?.nickname?.toLowerCase().includes(filters.search.toLowerCase()) ||
                video.user_profiles?.email?.toLowerCase().includes(filters.search.toLowerCase())
            );
        }

        // 按状态筛选
        if (filters.status) {
            filtered = filtered.filter(video => video.status === filters.status);
        }

        setFilteredVideos(filtered);
    }, [videos, filters]);

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
            search: '',
            status: ''
        });
    };

    useEffect(() => {
        loadVideos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 只在组件挂载时加载一次

    // 筛选配置
    const filterOptions: FilterOption[] = [
        {
            key: 'search',
            label: '搜索内容',
            type: 'input',
            placeholder: '搜索视频标题、描述或用户昵称',
            style: { width: 200 }
        },
        {
            key: 'status',
            label: '审核状态',
            type: 'select',
            placeholder: '选择审核状态',
            style: { width: 150 },
            options: [
                { value: 'pending', label: '待审核' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已拒绝' }
            ]
        }
    ];

    const handleTableChange = (paginationInfo: { current?: number; pageSize?: number }) => {
        const { current, pageSize } = paginationInfo;
        if (current && pageSize) {
            loadVideos(current, pageSize);
        }
    };

    const handleReview = (video: CommunityVideo) => {
        setSelectedVideo(video);
        setReviewModalVisible(true);
        reviewForm.resetFields();
    };

    const handleReviewSubmit = async (values: { action: string; note?: string }) => {
        if (!selectedVideo) return;

        setSubmitting(true);
        try {
            const result = await reviewCommunityVideo(
                selectedVideo.id,
                values.action as 'approved' | 'rejected',
                values.note
            );

            if (result.error) {
                message.error('审核操作失败');
                return;
            }

            message.success('审核操作成功');
            setReviewModalVisible(false);
            setSelectedVideo(null);
            loadVideos(1); // 重新加载数据
        } catch (error) {
            console.error('审核操作失败:', error);
            message.error('审核操作失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePlayVideo = (videoUrl: string) => {
        window.open(videoUrl, '_blank');
    };

    const getStatusTag = (status: string) => {
        const statusMap = {
            pending: { color: 'orange', text: '待审核' },
            approved: { color: 'green', text: '已通过' },
            rejected: { color: 'red', text: '已拒绝' },
        };
        const statusInfo = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
    };

    const formatDuration = (duration: number | null) => {
        if (!duration) return '-';
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const formatFileSize = (size: number | null) => {
        if (!size) return '-';
        const mb = (size / (1024 * 1024)).toFixed(1);
        return `${mb} MB`;
    };

    const columns = [
        {
            title: '用户信息',
            key: 'user_info',
            fixed: 'left' as const,
            width: 200,
            render: (record: CommunityVideo) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div>
                        <div style={{ fontWeight: 'bold' }}>
                            {record.user_profiles?.nickname || record.user_profiles?.email || '未知用户'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                            {record.user_profiles?.email}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: '视频信息',
            key: 'video_info',
            render: (record: CommunityVideo) => (
                <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                        {record.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: 2 }}>
                        时长: {formatDuration(record.duration)} | 大小: {formatFileSize(record.file_size)}
                    </div>
                    {record.tags && record.tags.length > 0 && (
                        <div style={{ fontSize: '12px' }}>
                            {record.tags.map((tag, index) => (
                                <Tag key={index}>{tag}</Tag>
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: '视频预览',
            key: 'video_preview',
            width: 150,
            render: (record: CommunityVideo) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* {record.thumbnail_url && (
                        <Image
                            src={record.thumbnail_url}
                            alt="视频缩略图"
                            width={60}
                            height={40}
                            style={{ objectFit: 'cover', borderRadius: 4 }}
                        />
                    )} */}
                    <Button
                        type="link"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handlePlayVideo(record.video_url)}
                    >
                        播放视频
                    </Button>
                </div>
            ),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            render: (description: string) => description || '无描述',
            ellipsis: true,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => getStatusTag(status),
        },
        {
            title: '统计',
            key: 'stats',
            render: (record: CommunityVideo) => (
                <div style={{ fontSize: '12px' }}>
                    <div>观看: {record.view_count || 0}</div>
                    <div>点赞: {record.like_count || 0}</div>
                    <div>评论: {record.comment_count || 0}</div>
                </div>
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
        },
        {
            title: '操作',
            key: 'actions',
            fixed: 'right' as const,
            width: 200,
            render: (record: CommunityVideo) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => handlePlayVideo(record.video_url)}
                    >
                        查看
                    </Button>
                    {record.status === 'pending' && (
                        <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleReview(record)}
                        >
                            审核
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Title level={2}>社区交流视频审核</Title>

            {/* 筛选组件 */}
            <FilterPanel
                title="筛选条件"
                filters={filters}
                filterOptions={filterOptions}
                onFilterChange={handleFilterChange}
                onReset={resetFilters}
                showRefreshButton={true}
                onRefresh={() => loadVideos()}
                resultCount={filteredVideos.length}
            />

            {/* 视频列表 */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={filteredVideos}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1400 }}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                    }}
                    onChange={handleTableChange}
                />
            </Card>

            {/* 审核弹窗 */}
            <Modal
                title="社区交流视频审核"
                open={reviewModalVisible}
                onCancel={() => setReviewModalVisible(false)}
                footer={null}
                width={600}
            >
                {selectedVideo && (
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <strong>用户：</strong>{selectedVideo.user_profiles?.nickname || selectedVideo.user_profiles?.email || '未知用户'}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <strong>视频标题：</strong>{selectedVideo.title}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <strong>视频描述：</strong>{selectedVideo.description || '无'}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <strong>视频时长：</strong>{formatDuration(selectedVideo.duration)}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <strong>文件大小：</strong>{formatFileSize(selectedVideo.file_size)}
                        </div>
                        {selectedVideo.tags && selectedVideo.tags.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <strong>标签：</strong>
                                {selectedVideo.tags.map((tag, index) => (
                                    <Tag key={index} style={{ marginLeft: 8 }}>{tag}</Tag>
                                ))}
                            </div>
                        )}

                        <Form form={reviewForm} onFinish={handleReviewSubmit}>
                            <Form.Item
                                name="action"
                                label="审核结果"
                                rules={[{ required: true, message: '请选择审核结果' }]}
                            >
                                <Select placeholder="选择审核结果">
                                    <Option value="approved">通过</Option>
                                    <Option value="rejected">拒绝</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="note"
                                label="审核备注"
                            >
                                <Input.TextArea rows={4} placeholder="请输入审核备注（可选）" />
                            </Form.Item>

                            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                                <Space>
                                    <Button onClick={() => setReviewModalVisible(false)} disabled={submitting}>
                                        取消
                                    </Button>
                                    <Button type="primary" htmlType="submit" loading={submitting}>
                                        提交审核
                                    </Button>
                                </Space>
                            </Form.Item>
                        </Form>
                    </div>
                )}
            </Modal>
        </div>
    );
}