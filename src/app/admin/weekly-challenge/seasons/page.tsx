'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag, DatePicker, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, TrophyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    getSeasons,
    createSeason,
    updateSeason,
    deleteSeason,
    getSeasonStats,
} from '@/lib/weekly-challenge-queries';
import {
    Season,
    CreateSeasonRequest,
    UpdateSeasonRequest,
    SeasonStats,
} from '@/types/weekly-challenge';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

export default function SeasonsPage() {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSeason, setEditingSeason] = useState<Season | null>(null);
    const [form] = Form.useForm();
    const [stats, setStats] = useState<SeasonStats | null>(null);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });

    // 加载赛季列表
    const loadSeasons = async (page = 1, pageSize = 10) => {
        setLoading(true);
        try {
            const result = await getSeasons(page, pageSize);
            if (result.error) {
                message.error('加载赛季数据失败');
                return;
            }

            if (result.data) {
                setSeasons(result.data.data);
                setPagination({
                    current: result.data.page,
                    pageSize: result.data.pageSize,
                    total: result.data.total,
                });
            }
        } catch (error) {
            console.error('加载赛季数据失败:', error);
            message.error('加载赛季数据失败');
        } finally {
            setLoading(false);
        }
    };

    // 加载统计数据
    const loadStats = async () => {
        try {
            const result = await getSeasonStats();
            if (result.data) {
                setStats(result.data);
            }
        } catch (error) {
            console.error('加载统计数据失败:', error);
        }
    };

    useEffect(() => {
        loadSeasons();
        loadStats();
    }, []);

    const handleAdd = () => {
        setEditingSeason(null);
        form.resetFields();

        // 设置默认值
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const currentQuarter = Math.ceil(currentMonth / 3);

        form.setFieldsValue({
            year: currentYear,
            quarter: currentQuarter,
        });

        setModalVisible(true);
    };

    const handleEdit = (season: Season) => {
        setEditingSeason(season);
        form.setFieldsValue({
            name: season.name,
            year: season.year,
            quarter: season.quarter,
            date_range: [dayjs(season.start_date), dayjs(season.end_date)],
            prize_description: season.prize_description,
            status: season.status,
        });
        setModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            const result = await deleteSeason(id);
            if (result.error) {
                message.error('删除赛季失败');
                return;
            }
            message.success('删除赛季成功');
            loadSeasons(pagination.current, pagination.pageSize);
            loadStats();
        } catch (error) {
            console.error('删除赛季失败:', error);
            message.error('删除赛季失败');
        }
    };

    const handleSubmit = async (values: any) => {
        try {
            const seasonData = {
                name: values.name,
                year: values.year,
                quarter: values.quarter,
                start_date: values.date_range[0].format('YYYY-MM-DD'),
                end_date: values.date_range[1].format('YYYY-MM-DD'),
                prize_description: values.prize_description,
                ...(editingSeason && { status: values.status }),
            };

            if (editingSeason) {
                // 更新
                const result = await updateSeason(editingSeason.id, seasonData as UpdateSeasonRequest);
                if (result.error) {
                    message.error('更新赛季失败');
                    return;
                }
                message.success('更新赛季成功');
            } else {
                // 新增
                const result = await createSeason(seasonData as CreateSeasonRequest);
                if (result.error) {
                    message.error('创建赛季失败');
                    return;
                }
                message.success('创建赛季成功');
            }

            setModalVisible(false);
            form.resetFields();
            loadSeasons(pagination.current, pagination.pageSize);
            loadStats();
        } catch (error) {
            console.error('保存赛季失败:', error);
            message.error('保存赛季失败');
        }
    };

    const handleTableChange = (paginationConfig: any) => {
        loadSeasons(paginationConfig.current, paginationConfig.pageSize);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'green';
            case 'ended': return 'orange';
            case 'settled': return 'blue';
            default: return 'default';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active': return '进行中';
            case 'ended': return '已结束';
            case 'settled': return '已结算';
            default: return '未知';
        }
    };

    const columns = [
        {
            title: '赛季名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Season) => (
                <div>
                    <strong>{text}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                        {record.year}年第{record.quarter}季度
                    </div>
                </div>
            ),
        },
        {
            title: '时间范围',
            key: 'date_range',
            render: (record: Season) => (
                <div>
                    <div>{dayjs(record.start_date).format('YYYY-MM-DD')}</div>
                    <div style={{ color: '#666' }}>至</div>
                    <div>{dayjs(record.end_date).format('YYYY-MM-DD')}</div>
                </div>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={getStatusColor(status)}>
                    {getStatusText(status)}
                </Tag>
            ),
        },
        {
            title: '奖品描述',
            dataIndex: 'prize_description',
            key: 'prize_description',
            width: 200,
            render: (text: string) => (
                text ? (
                    <div style={{
                        maxWidth: '180px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {text}
                    </div>
                ) : (
                    <span style={{ color: '#999' }}>未设置</span>
                )
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
        },
        {
            title: '操作',
            key: 'actions',
            render: (record: Season) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        编辑
                    </Button>
                    <Popconfirm
                        title="确定要删除这个赛季吗？"
                        description="删除后将无法恢复，相关的挑战赛数据也会被删除。"
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
            {/* 统计卡片 */}
            {stats && (
                <div style={{ marginBottom: 16 }}>
                    <Space size="large">
                        <Card size="small" style={{ minWidth: 120 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                                    {stats.total_seasons}
                                </div>
                                <div style={{ color: '#666' }}>总赛季数</div>
                            </div>
                        </Card>
                        <Card size="small" style={{ minWidth: 120 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                                    {stats.active_season ? '1' : '0'}
                                </div>
                                <div style={{ color: '#666' }}>活跃赛季</div>
                            </div>
                        </Card>
                        <Card size="small" style={{ minWidth: 120 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>
                                    {stats.total_points_awarded}
                                </div>
                                <div style={{ color: '#666' }}>总积分</div>
                            </div>
                        </Card>
                    </Space>
                </div>
            )}

            <Card
                title="赛季管理"
                extra={
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                loadSeasons(pagination.current, pagination.pageSize);
                                loadStats();
                            }}
                        >
                            刷新
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleAdd}
                        >
                            新增赛季
                        </Button>
                    </Space>
                }
            >
                <Table
                    columns={columns}
                    dataSource={seasons}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        ...pagination,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                    }}
                    onChange={handleTableChange}
                />
            </Card>

            <Modal
                title={editingSeason ? '编辑赛季' : '新增赛季'}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    form.resetFields();
                }}
                footer={null}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="name"
                        label="赛季名称"
                        rules={[{ required: true, message: '请输入赛季名称' }]}
                    >
                        <Input placeholder="例如：2024年第1季度" />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item
                            name="year"
                            label="年份"
                            rules={[{ required: true, message: '请选择年份' }]}
                            style={{ flex: 1 }}
                        >
                            <InputNumber
                                min={2024}
                                max={2030}
                                style={{ width: '100%' }}
                                placeholder="年份"
                            />
                        </Form.Item>

                        <Form.Item
                            name="quarter"
                            label="季度"
                            rules={[{ required: true, message: '请选择季度' }]}
                            style={{ flex: 1 }}
                        >
                            <Select placeholder="请选择季度">
                                <Option value={1}>第1季度 (1-3月)</Option>
                                <Option value={2}>第2季度 (4-6月)</Option>
                                <Option value={3}>第3季度 (7-9月)</Option>
                                <Option value={4}>第4季度 (10-12月)</Option>
                            </Select>
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="date_range"
                        label="赛季时间范围"
                        rules={[{ required: true, message: '请选择赛季时间范围' }]}
                    >
                        <RangePicker
                            style={{ width: '100%' }}
                            placeholder={['开始日期', '结束日期']}
                        />
                    </Form.Item>

                    {editingSeason && (
                        <Form.Item
                            name="status"
                            label="赛季状态"
                            rules={[{ required: true, message: '请选择赛季状态' }]}
                        >
                            <Select placeholder="请选择状态">
                                <Option value="active">进行中</Option>
                                <Option value="ended">已结束</Option>
                                <Option value="settled">已结算</Option>
                            </Select>
                        </Form.Item>
                    )}

                    <Form.Item
                        name="prize_description"
                        label="奖品描述"
                    >
                        <TextArea
                            rows={3}
                            placeholder="描述本赛季的奖品内容，例如：冠军将获得专属纪念奖杯和花式足球装备套装"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingSeason ? '更新' : '创建'}
                            </Button>
                            <Button onClick={() => {
                                setModalVisible(false);
                                form.resetFields();
                            }}>
                                取消
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}