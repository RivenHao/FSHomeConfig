'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag, DatePicker, InputNumber } from 'antd';
import type { TableProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined, SettingOutlined, UndoOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    getChallenges,
    createChallenge,
    updateChallenge,
    deleteChallenge,
    getSeasons,
    getChallengeModes,
    createChallengeMode,
    updateChallengeMode,
    deleteChallengeMode,
    getChallengeStats,
} from '@/lib/weekly-challenge-queries';
import {
    WeeklyChallenge,
    ChallengeMode,
    Season,
    CreateChallengeRequest,
    UpdateChallengeRequest,
    CreateChallengeModeRequest,
    UpdateChallengeModeRequest,
    ChallengeStats,
} from '@/types/weekly-challenge';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

export default function ChallengesPage() {
    const [challenges, setChallenges] = useState<WeeklyChallenge[]>([]);
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [modeModalVisible, setModeModalVisible] = useState(false);
    const [editingChallenge, setEditingChallenge] = useState<WeeklyChallenge | null>(null);
    const [editingMode, setEditingMode] = useState<ChallengeMode | null>(null);
    const [selectedChallenge, setSelectedChallenge] = useState<WeeklyChallenge | null>(null);
    const [challengeModes, setChallengeModes] = useState<ChallengeMode[]>([]);
    const [form] = Form.useForm();
    const [modeForm] = Form.useForm();
    const [stats, setStats] = useState<ChallengeStats | null>(null);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });

    // 加载挑战赛列表
    const loadChallenges = async (page = 1, pageSize = 10) => {
        setLoading(true);
        try {
            const result = await getChallenges(page, pageSize);
            if (result.error) {
                message.error('加载挑战赛数据失败');
                return;
            }

            if (result.data) {
                setChallenges(result.data.data);
                setPagination({
                    current: result.data.page,
                    pageSize: result.data.pageSize,
                    total: result.data.total,
                });
            }
        } catch (error) {
            console.error('加载挑战赛数据失败:', error);
            message.error('加载挑战赛数据失败');
        } finally {
            setLoading(false);
        }
    };

    // 加载赛季列表
    const loadSeasons = async () => {
        try {
            const result = await getSeasons(1, 100); // 获取所有赛季
            if (result.data) {
                setSeasons(result.data.data);
            }
        } catch (error) {
            console.error('加载赛季数据失败:', error);
        }
    };

    // 加载挑战模式
    const loadChallengeModes = async (challengeId: string) => {
        try {
            const result = await getChallengeModes(challengeId);
            if (result.data) {
                setChallengeModes(result.data);
            }
        } catch (error) {
            console.error('加载挑战模式失败:', error);
        }
    };

    // 加载统计数据
    const loadStats = async () => {
        try {
            const result = await getChallengeStats();
            if (result.data) {
                setStats(result.data);
            }
        } catch (error) {
            console.error('加载统计数据失败:', error);
        }
    };

    // 激活挑战赛
    const handleActivateChallenge = async (challenge: WeeklyChallenge) => {
        try {
            const result = await updateChallenge(challenge.id, { status: 'active' });
            if (result.error) {
                message.error('激活挑战赛失败');
                return;
            }
            message.success('挑战赛已激活');
            loadChallenges(pagination.current, pagination.pageSize);
            loadStats();
        } catch (error) {
            console.error('激活挑战赛失败:', error);
            message.error('激活挑战赛失败');
        }
    };

    // 结束挑战赛
    const handleEndChallenge = async (challenge: WeeklyChallenge) => {
        try {
            const result = await updateChallenge(challenge.id, { status: 'ended' });
            if (result.error) {
                message.error('结束挑战赛失败');
                return;
            }
            message.success('挑战赛已结束');
            loadChallenges(pagination.current, pagination.pageSize);
            loadStats();
        } catch (error) {
            console.error('结束挑战赛失败:', error);
            message.error('结束挑战赛失败');
        }
    };

    // 重新打开挑战赛
    const handleReopenChallenge = async (challenge: WeeklyChallenge) => {
        try {
            // 检查所属赛季状态
            const season = seasons.find(s => s.id === challenge.season_id);
            if (season && season.status !== 'active') {
                message.error(`无法重新打开：所属赛季「${season.name}」已${season.status === 'ended' ? '结束' : '结算'}，请先重新打开赛季`);
                return;
            }

            const result = await updateChallenge(challenge.id, { status: 'active' });
            if (result.error) {
                message.error('重新打开挑战赛失败');
                return;
            }
            message.success('挑战赛已重新打开');
            loadChallenges(pagination.current, pagination.pageSize);
            loadStats();
        } catch (error) {
            console.error('重新打开挑战赛失败:', error);
            message.error('重新打开挑战赛失败');
        }
    };

    // 检查挑战赛能否重新打开
    const canReopenChallenge = (challenge: WeeklyChallenge): boolean => {
        const season = seasons.find(s => s.id === challenge.season_id);
        return season?.status === 'active';
    };

    useEffect(() => {
        loadChallenges();
        loadSeasons();
        loadStats();
    }, []);

    const handleAdd = () => {
        setEditingChallenge(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (challenge: WeeklyChallenge) => {
        setEditingChallenge(challenge);
        form.setFieldsValue({
            season_id: challenge.season_id,
            title: challenge.title,
            description: challenge.description,
            week_number: challenge.week_number,
            date_range: [dayjs(challenge.start_date), dayjs(challenge.end_date)],
            official_video_url: challenge.official_video_url,
            status: challenge.status,
        });
        setModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            const result = await deleteChallenge(id);
            if (result.error) {
                message.error('删除挑战赛失败');
                return;
            }
            message.success('删除挑战赛成功');
            loadChallenges(pagination.current, pagination.pageSize);
            loadStats();
        } catch (error) {
            console.error('删除挑战赛失败:', error);
            message.error('删除挑战赛失败');
        }
    };

    const handleSubmit = async (values: {
        season_id: string;
        title: string;
        description?: string;
        week_number: number;
        date_range: [dayjs.Dayjs, dayjs.Dayjs];
        official_video_url?: string;
        status?: string;
    }) => {
        try {
            const challengeData = {
                season_id: values.season_id,
                title: values.title,
                description: values.description,
                week_number: values.week_number,
                start_date: values.date_range[0].toISOString(),
                end_date: values.date_range[1].toISOString(),
                official_video_url: values.official_video_url,
                ...(editingChallenge && { status: values.status }),
            };

            if (editingChallenge) {
                // 更新
                const result = await updateChallenge(editingChallenge.id, challengeData as UpdateChallengeRequest);
                if (result.error) {
                    message.error('更新挑战赛失败');
                    return;
                }
                message.success('更新挑战赛成功');
            } else {
                // 新增
                const result = await createChallenge(challengeData as CreateChallengeRequest);
                if (result.error) {
                    message.error('创建挑战赛失败');
                    return;
                }
                message.success('创建挑战赛成功');
            }

            setModalVisible(false);
            form.resetFields();
            loadChallenges(pagination.current, pagination.pageSize);
            loadStats();
        } catch (error) {
            console.error('保存挑战赛失败:', error);
            message.error('保存挑战赛失败');
        }
    };

    // 挑战模式相关函数
    const handleManageModes = (challenge: WeeklyChallenge) => {
        setSelectedChallenge(challenge);
        loadChallengeModes(challenge.id);
    };

    const handleAddMode = () => {
        setEditingMode(null);
        modeForm.resetFields();
        if (selectedChallenge) {
            modeForm.setFieldValue('challenge_id', selectedChallenge.id);
        }
        setModeModalVisible(true);
    };

    const handleEditMode = (mode: ChallengeMode) => {
        setEditingMode(mode);
        modeForm.setFieldsValue({
            challenge_id: mode.challenge_id,
            mode_type: mode.mode_type,
            title: mode.title,
            description: mode.description,
            moves_required: mode.moves_required.join(', '),
            difficulty_level: mode.difficulty_level,
            points_reward: mode.points_reward,
            demo_video_url: mode.demo_video_url,
        });
        setModeModalVisible(true);
    };

    const handleDeleteMode = async (id: string) => {
        try {
            const result = await deleteChallengeMode(id);
            if (result.error) {
                message.error('删除挑战模式失败');
                return;
            }
            message.success('删除挑战模式成功');
            if (selectedChallenge) {
                loadChallengeModes(selectedChallenge.id);
            }
        } catch (error) {
            console.error('删除挑战模式失败:', error);
            message.error('删除挑战模式失败');
        }
    };

    const handleModeSubmit = async (values: {
        challenge_id: string;
        mode_type: 'simple' | 'hard';
        title: string;
        description: string;
        moves_required: string[] | string;
        difficulty_level?: number;
        points_reward: number;
        demo_video_url?: string;
    }) => {
        try {
            // 检查是否已存在相同类型的模式（仅在新增时检查）
            if (!editingMode) {
                const existingMode = challengeModes.find(mode => mode.mode_type === values.mode_type);
                if (existingMode) {
                    message.error(`该挑战赛已存在${values.mode_type === 'simple' ? '简单' : '困难'}模式，每个挑战赛每种模式只能有一个`);
                    return;
                }
            }

            const modeData = {
                challenge_id: values.challenge_id,
                mode_type: values.mode_type,
                title: values.title,
                description: values.description,
                moves_required: Array.isArray(values.moves_required) 
                    ? values.moves_required 
                    : values.moves_required.split(',').map((s: string) => s.trim()).filter((s: string) => s),
                difficulty_level: values.difficulty_level,
                points_reward: values.points_reward,
                demo_video_url: values.demo_video_url,
            };

            if (editingMode) {
                // 更新时也要检查是否与其他模式冲突
                if (editingMode.mode_type !== values.mode_type) {
                    const existingMode = challengeModes.find(mode =>
                        mode.id !== editingMode.id && mode.mode_type === values.mode_type
                    );
                    if (existingMode) {
                        message.error(`该挑战赛已存在${values.mode_type === 'simple' ? '简单' : '困难'}模式，每个挑战赛每种模式只能有一个`);
                        return;
                    }
                }

                const result = await updateChallengeMode(editingMode.id, modeData as UpdateChallengeModeRequest);
                if (result.error) {
                    // 处理特定的数据库错误
                    if (result.error.includes('duplicate key value violates unique constraint')) {
                        message.error('该挑战赛已存在相同类型的模式，每个挑战赛每种模式只能有一个');
                    } else {
                        message.error('更新挑战模式失败');
                    }
                    return;
                }
                message.success('更新挑战模式成功');
            } else {
                // 新增
                const result = await createChallengeMode(modeData as CreateChallengeModeRequest);
                if (result.error) {
                    // 处理特定的数据库错误
                    if (result.error.includes('duplicate key value violates unique constraint')) {
                        message.error('该挑战赛已存在相同类型的模式，每个挑战赛每种模式只能有一个');
                    } else {
                        message.error('创建挑战模式失败');
                    }
                    return;
                }
                message.success('创建挑战模式成功');
            }

            setModeModalVisible(false);
            modeForm.resetFields();
            if (selectedChallenge) {
                loadChallengeModes(selectedChallenge.id);
            }
        } catch (error) {
            console.error('保存挑战模式失败:', error);
            message.error('保存挑战模式失败');
        }
    };

    const handleTableChange: TableProps<WeeklyChallenge>['onChange'] = (paginationConfig) => {
        loadChallenges(paginationConfig?.current || 1, paginationConfig?.pageSize || 10);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'default';
            case 'active': return 'green';
            case 'ended': return 'orange';
            default: return 'default';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'draft': return '草稿';
            case 'active': return '进行中';
            case 'ended': return '已结束';
            default: return '未知';
        }
    };

    const getModeTypeText = (type: string) => {
        return type === 'simple' ? '简单模式' : '困难模式';
    };

    const getModeTypeColor = (type: string) => {
        return type === 'simple' ? 'green' : 'red';
    };

    const columns = [
        {
            title: '挑战赛信息',
            key: 'info',
            render: (record: WeeklyChallenge) => (
                <div>
                    <strong>{record.title}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                        第{record.week_number}周 | {record.season?.name}
                    </div>
                </div>
            ),
        },
        {
            title: '时间范围',
            key: 'date_range',
            render: (record: WeeklyChallenge) => (
                <div>
                    <div>{dayjs(record.start_date).format('MM-DD HH:mm')}</div>
                    <div style={{ color: '#666' }}>至</div>
                    <div>{dayjs(record.end_date).format('MM-DD HH:mm')}</div>
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
            title: '模式数量',
            key: 'modes_count',
            render: (record: WeeklyChallenge) => (
                <span>{record.modes?.length || 0} 个模式</span>
            ),
        },
        {
            title: '参与人数',
            key: 'participant_count',
            render: (record: WeeklyChallenge) => (
                <span>{record.participant_count || 0} 人</span>
            ),
        },
        {
            title: '官方视频',
            dataIndex: 'official_video_url',
            key: 'official_video_url',
            render: (url: string) => (
                url ? (
                    <Button
                        type="link"
                        icon={<PlayCircleOutlined />}
                        onClick={() => window.open(url, '_blank')}
                        size="small"
                    >
                        预览
                    </Button>
                ) : (
                    <span style={{ color: '#999' }}>未设置</span>
                )
            ),
        },
        {
            title: '操作',
            key: 'actions',
            width: 320,
            render: (record: WeeklyChallenge) => (
                <Space wrap>
                    {/* 草稿状态 - 显示激活按钮 */}
                    {record.status === 'draft' && (
                        <Popconfirm
                            title="确定要激活这个挑战赛吗？"
                            description="激活后用户就可以参与这个挑战了。"
                            onConfirm={() => handleActivateChallenge(record)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button
                                type="primary"
                                size="small"
                                icon={<PlayCircleOutlined />}
                            >
                                激活
                            </Button>
                        </Popconfirm>
                    )}
                    {/* 进行中状态 - 显示结束按钮 */}
                    {record.status === 'active' && (
                        <Popconfirm
                            title="确定要结束这个挑战赛吗？"
                            description="结束后用户将无法继续参与。"
                            onConfirm={() => handleEndChallenge(record)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button
                                type="default"
                                size="small"
                                danger
                                icon={<StopOutlined />}
                            >
                                结束
                            </Button>
                        </Popconfirm>
                    )}
                    {/* 已结束状态 - 显示重新打开按钮（仅当赛季还在进行中时可用） */}
                    {record.status === 'ended' && (
                        canReopenChallenge(record) ? (
                            <Popconfirm
                                title="确定要重新打开这个挑战赛吗？"
                                description={
                                    <div>
                                        <p>重新打开后：</p>
                                        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                                            <li>用户可以继续参与挑战</li>
                                            <li>挑战状态变更为「进行中」</li>
                                        </ul>
                                    </div>
                                }
                                onConfirm={() => handleReopenChallenge(record)}
                                okText="确定"
                                cancelText="取消"
                            >
                                <Button
                                    type="default"
                                    size="small"
                                    icon={<UndoOutlined />}
                                    style={{ color: '#52c41a', borderColor: '#52c41a' }}
                                >
                                    重新打开
                                </Button>
                            </Popconfirm>
                        ) : (
                            <Button
                                type="default"
                                size="small"
                                icon={<UndoOutlined />}
                                disabled
                                title="所属赛季已结束，无法重新打开"
                            >
                                重新打开
                            </Button>
                        )
                    )}
                    <Button
                        type="link"
                        icon={<SettingOutlined />}
                        onClick={() => handleManageModes(record)}
                    >
                        管理模式
                    </Button>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        编辑
                    </Button>
                    <Popconfirm
                        title="确定要删除这个挑战赛吗？"
                        description="删除后将无法恢复，相关的参与记录也会被删除。"
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

    const modeColumns = [
        {
            title: '模式类型',
            dataIndex: 'mode_type',
            key: 'mode_type',
            render: (type: string) => (
                <Tag color={getModeTypeColor(type)}>
                    {getModeTypeText(type)}
                </Tag>
            ),
        },
        {
            title: '模式标题',
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: '需要招式',
            dataIndex: 'moves_required',
            key: 'moves_required',
            render: (moves: string[]) => (
                <div>
                    {moves.map((move, index) => (
                        <Tag key={index}>{move}</Tag>
                    ))}
                </div>
            ),
        },
        {
            title: '难度等级',
            dataIndex: 'difficulty_level',
            key: 'difficulty_level',
            render: (level: number) => (
                level ? `${level}星` : '-'
            ),
        },
        {
            title: '积分奖励',
            dataIndex: 'points_reward',
            key: 'points_reward',
            render: (points: number) => (
                <span style={{ color: '#1890ff', fontWeight: 'bold' }}>+{points}分</span>
            ),
        },
        {
            title: '示范视频',
            dataIndex: 'demo_video_url',
            key: 'demo_video_url',
            render: (url: string) => (
                url ? (
                    <Button
                        type="link"
                        icon={<PlayCircleOutlined />}
                        onClick={() => window.open(url, '_blank')}
                        size="small"
                    >
                        预览
                    </Button>
                ) : (
                    <span style={{ color: '#999' }}>未设置</span>
                )
            ),
        },
        {
            title: '操作',
            key: 'actions',
            render: (record: ChallengeMode) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEditMode(record)}
                    >
                        编辑
                    </Button>
                    <Popconfirm
                        title="确定要删除这个模式吗？"
                        onConfirm={() => handleDeleteMode(record.id)}
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
                                    {stats.total_challenges}
                                </div>
                                <div style={{ color: '#666' }}>总挑战数</div>
                            </div>
                        </Card>
                        <Card size="small" style={{ minWidth: 120 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                                    {stats.active_challenges}
                                </div>
                                <div style={{ color: '#666' }}>进行中</div>
                            </div>
                        </Card>
                        <Card size="small" style={{ minWidth: 120 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>
                                    {stats.total_participants}
                                </div>
                                <div style={{ color: '#666' }}>总参与</div>
                            </div>
                        </Card>
                        <Card size="small" style={{ minWidth: 120 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f5222d' }}>
                                    {stats.pending_reviews}
                                </div>
                                <div style={{ color: '#666' }}>待审核</div>
                            </div>
                        </Card>
                    </Space>
                </div>
            )}

            <Card
                title="挑战赛管理"
                extra={
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                loadChallenges(pagination.current, pagination.pageSize);
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
                            新增挑战赛
                        </Button>
                    </Space>
                }
            >
                <Table
                    columns={columns}
                    dataSource={challenges}
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

            {/* 挑战赛编辑Modal */}
            <Modal
                title={editingChallenge ? '编辑挑战赛' : '新增挑战赛'}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    form.resetFields();
                }}
                footer={null}
                width={700}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="season_id"
                        label="所属赛季"
                        rules={[{ required: true, message: '请选择所属赛季' }]}
                    >
                        <Select placeholder="请选择赛季">
                            {seasons.map(season => (
                                <Option key={season.id} value={season.id}>
                                    {season.name} ({season.status === 'active' ? '进行中' : '已结束'})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item
                            name="title"
                            label="挑战赛标题"
                            rules={[{ required: true, message: '请输入挑战赛标题' }]}
                            style={{ flex: 2 }}
                        >
                            <Input placeholder="例如：花式足球基础动作挑战" />
                        </Form.Item>

                        <Form.Item
                            name="week_number"
                            label="第几周"
                            rules={[{ required: true, message: '请输入周数' }]}
                            style={{ flex: 1 }}
                        >
                            <InputNumber
                                min={1}
                                max={52}
                                style={{ width: '100%' }}
                                placeholder="周数"
                            />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="description"
                        label="挑战描述"
                    >
                        <TextArea
                            rows={3}
                            placeholder="描述本次挑战的内容和要求"
                        />
                    </Form.Item>

                    <Form.Item
                        name="date_range"
                        label="挑战时间范围"
                        rules={[{ required: true, message: '请选择挑战时间范围' }]}
                    >
                        <RangePicker
                            showTime
                            style={{ width: '100%' }}
                            placeholder={['开始时间', '结束时间']}
                        />
                    </Form.Item>

                    <Form.Item
                        name="official_video_url"
                        label="官方示范视频URL"
                    >
                        <Input placeholder="https://..." />
                    </Form.Item>

                    {editingChallenge && (
                        <Form.Item
                            name="status"
                            label="挑战状态"
                            rules={[{ required: true, message: '请选择挑战状态' }]}
                        >
                            <Select placeholder="请选择状态">
                                <Option value="draft">草稿</Option>
                                <Option value="active">进行中</Option>
                                <Option value="completed">已结束</Option>
                            </Select>
                        </Form.Item>
                    )}

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingChallenge ? '更新' : '创建'}
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

            {/* 挑战模式管理Modal */}
            <Modal
                title={`管理挑战模式 - ${selectedChallenge?.title}`}
                open={selectedChallenge !== null}
                onCancel={() => {
                    setSelectedChallenge(null);
                    setChallengeModes([]);
                }}
                footer={null}
                width={1000}
            >
                <div style={{ marginBottom: 16 }}>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddMode}
                        disabled={challengeModes.length >= 2}
                    >
                        新增模式
                    </Button>
                    {challengeModes.length >= 2 && (
                        <span style={{ marginLeft: 8, color: '#999', fontSize: '12px' }}>
                            每个挑战赛最多只能有简单和困难两种模式
                        </span>
                    )}
                </div>

                <Table
                    columns={modeColumns}
                    dataSource={challengeModes}
                    rowKey="id"
                    size="small"
                    pagination={false}
                />
            </Modal>

            {/* 挑战模式编辑Modal */}
            <Modal
                title={editingMode ? '编辑挑战模式' : '新增挑战模式'}
                open={modeModalVisible}
                onCancel={() => {
                    setModeModalVisible(false);
                    modeForm.resetFields();
                }}
                footer={null}
                width={600}
            >
                <Form
                    form={modeForm}
                    layout="vertical"
                    onFinish={handleModeSubmit}
                >
                    <Form.Item name="challenge_id" hidden>
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="mode_type"
                        label="模式类型"
                        rules={[{ required: true, message: '请选择模式类型' }]}
                    >
                        <Select placeholder="请选择模式类型">
                            <Option
                                value="simple"
                                disabled={!editingMode && challengeModes.some(mode => mode.mode_type === 'simple')}
                            >
                                简单模式
                                {!editingMode && challengeModes.some(mode => mode.mode_type === 'simple') && ' (已存在)'}
                            </Option>
                            <Option
                                value="hard"
                                disabled={!editingMode && challengeModes.some(mode => mode.mode_type === 'hard')}
                            >
                                困难模式
                                {!editingMode && challengeModes.some(mode => mode.mode_type === 'hard') && ' (已存在)'}
                            </Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="title"
                        label="模式标题"
                        rules={[{ required: true, message: '请输入模式标题' }]}
                    >
                        <Input placeholder="例如：基础颠球挑战" />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="模式描述"
                        rules={[{ required: true, message: '请输入模式描述' }]}
                    >
                        <TextArea
                            rows={3}
                            placeholder="详细描述这个模式的要求和规则"
                        />
                    </Form.Item>

                    <Form.Item
                        name="moves_required"
                        label="需要的招式"
                        rules={[{ required: true, message: '请输入需要的招式' }]}
                    >
                        <Input placeholder="用逗号分隔多个招式，例如：ATW, Crossover, Rainbow" />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item
                            name="difficulty_level"
                            label="难度等级"
                            style={{ flex: 1 }}
                        >
                            <Select placeholder="选择难度等级">
                                <Option value={1}>1星 (入门)</Option>
                                <Option value={2}>2星 (初级)</Option>
                                <Option value={3}>3星 (中级)</Option>
                                <Option value={4}>4星 (高级)</Option>
                                <Option value={5}>5星 (专家)</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="points_reward"
                            label="积分奖励"
                            rules={[{ required: true, message: '请输入积分奖励' }]}
                            style={{ flex: 1 }}
                        >
                            <InputNumber
                                min={1}
                                max={100}
                                style={{ width: '100%' }}
                                placeholder="积分"
                            />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="demo_video_url"
                        label="示范视频URL"
                    >
                        <Input placeholder="https://..." />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingMode ? '更新' : '创建'}
                            </Button>
                            <Button onClick={() => {
                                setModeModalVisible(false);
                                modeForm.resetFields();
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