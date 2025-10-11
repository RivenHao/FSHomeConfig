'use client'

import React, { useState, useEffect } from 'react'
import {
    Card,
    Tabs,
    Form,
    Input,
    Button,
    Radio,
    Checkbox,
    List,
    Avatar,
    Typography,
    Space,
    Divider,
    Spin,
    Empty,
    Tag,
    Row,
    Col,
    Collapse,
    message,
    Modal
} from 'antd'
import {
    BellOutlined,
    UserOutlined,
    SendOutlined,
    HistoryOutlined,
    SearchOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons'
import { supabase } from '@/lib/supabase'

const { TextArea } = Input
const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse

interface User {
    id: string
    email: string
    nickname?: string
    created_at: string
}

interface NotificationForm {
    title: string
    message: string
    targetType: 'all' | 'selected' | 'active'
    selectedUsers: string[]
}

interface NotificationHistory {
    id: string
    title: string
    message: string
    target_type: string
    target_count: number
    sent_at: string
    sent_by: string
    target_user_ids?: string[]
}

interface NotificationTemplate {
    id: string
    name: string
    title: string
    message: string
}

export default function NotificationsPage() {
    const [form] = Form.useForm()
    const [users, setUsers] = useState<User[]>([])
    const [filteredUsers, setFilteredUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [activeTab, setActiveTab] = useState('send')
    const [history, setHistory] = useState<NotificationHistory[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [userSearchTerm, setUserSearchTerm] = useState('')
    const [formData, setFormData] = useState<NotificationForm>({
        title: '',
        message: '',
        targetType: 'all',
        selectedUsers: []
    })

    const templates: NotificationTemplate[] = [
        {
            id: '1',
            name: '系统维护通知',
            title: '系统维护通知',
            message: '亲爱的用户，我们将于今晚22:00-24:00进行系统维护，期间可能无法正常使用部分功能，给您带来的不便敬请谅解。'
        },
        {
            id: '2',
            name: '新功能发布',
            title: '新功能上线啦！',
            message: '我们很高兴地宣布，新功能已经上线！快来体验全新的功能吧。'
        },
        {
            id: '3',
            name: '活动通知',
            title: '精彩活动开始了！',
            message: '参与我们的最新活动，赢取丰厚奖品！活动时间有限，快来参加吧。'
        },
        {
            id: '4',
            name: '安全提醒',
            title: '账户安全提醒',
            message: '为了您的账户安全，请定期更换密码，不要在公共场所登录账户。'
        }
    ]

    // 加载用户列表
    useEffect(() => {
        const loadUsers = async () => {
            try {
                // 直接从 user_profiles 表获取用户信息
                const { data: profiles, error } = await supabase
                    .from('user_profiles')
                    .select('id, nickname, email, created_at')
                    .order('created_at', { ascending: false })

                if (error) throw error

                const usersData = profiles?.map(profile => ({
                    id: profile.id,
                    email: profile.email || '',
                    nickname: profile.nickname,
                    created_at: profile.created_at || new Date().toISOString()
                })) || []

                setUsers(usersData)
                setFilteredUsers(usersData)
            } catch (error) {
                console.error('加载用户列表失败:', error)
                message.error('加载用户列表失败')
            } finally {
                setLoading(false)
            }
        }

        loadUsers()
    }, [])

    // 实时搜索用户
    useEffect(() => {
        const searchUsers = async () => {
            if (!userSearchTerm.trim()) {
                // 如果没有搜索词，显示所有用户
                setFilteredUsers(users)
                return
            }

            try {
                // 使用数据库进行模糊搜索
                const { data: profiles, error } = await supabase
                    .from('user_profiles')
                    .select('id, nickname, email, created_at')
                    .or(`nickname.ilike.%${userSearchTerm}%,email.ilike.%${userSearchTerm}%`)
                    .order('created_at', { ascending: false })

                if (error) throw error

                const searchResults = profiles?.map(profile => ({
                    id: profile.id,
                    email: profile.email || '',
                    nickname: profile.nickname,
                    created_at: profile.created_at || new Date().toISOString()
                })) || []

                setFilteredUsers(searchResults)
            } catch (error) {
                console.error('搜索用户失败:', error)
                // 如果搜索失败，回退到本地过滤
                const filtered = users.filter(user =>
                    user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                    (user.nickname && user.nickname.toLowerCase().includes(userSearchTerm.toLowerCase()))
                )
                setFilteredUsers(filtered)
            }
        }

        // 添加防抖，避免频繁请求
        const timeoutId = setTimeout(searchUsers, 300)
        return () => clearTimeout(timeoutId)
    }, [userSearchTerm, users])

    // 应用模板
    const applyTemplate = (template: NotificationTemplate) => {
        setFormData(prev => ({
            ...prev,
            title: template.title,
            message: template.message
        }))
        form.setFieldsValue({
            title: template.title,
            message: template.message
        })
        message.success(`已应用模板：${template.name}`)
    }

    // 加载通知历史
    const loadHistory = async () => {
        setHistoryLoading(true)
        try {
            // 首先尝试使用 RPC 函数
            const { data, error } = await supabase.rpc('get_notification_history', {
                p_limit: 50,
                p_offset: 0
            })

            if (error) {
                console.warn('RPC 函数调用失败，尝试直接查询表:', error)
                
                // 如果 RPC 函数失败，直接查询表
                const { data: directData, error: directError } = await supabase
                    .from('notification_history')
                    .select(`
                        id,
                        title,
                        message,
                        target_type,
                        target_count,
                        sent_at,
                        sent_by,
                        target_user_ids
                    `)
                    .order('sent_at', { ascending: false })
                    .limit(50)

                if (directError) throw directError

                const historyData: NotificationHistory[] = directData?.map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    message: item.message,
                    target_type: item.target_type,
                    target_count: item.target_count,
                    sent_at: item.sent_at,
                    sent_by: item.sent_by || 'Unknown',
                    target_user_ids: item.target_user_ids || []
                })) || []

                setHistory(historyData)
                return
            }

            const historyData: NotificationHistory[] = data?.map((item: any) => ({
                id: item.id,
                title: item.title,
                message: item.message,
                target_type: item.target_type,
                target_count: item.target_count,
                sent_at: item.sent_at,
                sent_by: item.sent_by_email,
                target_user_ids: item.target_user_ids || []
            })) || []

            setHistory(historyData)
        } catch (error) {
            console.error('加载通知历史失败:', error)
            message.error(`加载通知历史失败: ${(error as Error).message}`)
            setHistory([])
        } finally {
            setHistoryLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory()
        }
    }, [activeTab])

    // 获取用户信息
    const getUsersByIds = async (userIds: string[]) => {
        if (!userIds || userIds.length === 0) return []
        
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('id, nickname, email')
                .in('id', userIds)
            
            if (error) throw error
            return data || []
        } catch (error) {
            console.error('获取用户信息失败:', error)
            return []
        }
    }

    // 检查数据库表是否存在
    const checkDatabaseSetup = async () => {
        try {
            // 尝试查询表结构
            const { error } = await supabase
                .from('notification_history')
                .select('id')
                .limit(1)
            
            if (error) {
                console.warn('notification_history 表可能不存在:', error)
                message.warning('通知历史功能需要数据库初始化，请联系管理员')
            }
        } catch (error) {
            console.error('数据库检查失败:', error)
        }
    }

    // 组件加载时检查数据库
    useEffect(() => {
        checkDatabaseSetup()
    }, [])

    // 渲染目标用户列表
    const renderTargetUsers = (item: NotificationHistory) => {
        if (item.target_type !== 'selected' || !item.target_user_ids || item.target_user_ids.length === 0) {
            return null
        }

        return (
            <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                    发送给指定用户：
                </Text>
                <div style={{ marginTop: 4 }}>
                    <TargetUsersList userIds={item.target_user_ids} />
                </div>
            </div>
        )
    }

    // 目标用户列表组件
    const TargetUsersList = ({ userIds }: { userIds: string[] }) => {
        const [targetUsers, setTargetUsers] = useState<any[]>([])
        const [loading, setLoading] = useState(false)
        const [expanded, setExpanded] = useState(false)

        useEffect(() => {
            const loadUsers = async () => {
                setLoading(true)
                const users = await getUsersByIds(userIds)
                setTargetUsers(users)
                setLoading(false)
            }
            loadUsers()
        }, [userIds])

        if (loading) {
            return <Spin size="small" />
        }

        const displayUsers = expanded ? targetUsers : targetUsers.slice(0, 3)
        const hasMore = targetUsers.length > 3

        return (
            <Space wrap size="small">
                {displayUsers.map((user) => (
                    <Tag key={user.id} color="blue" style={{ fontSize: '11px' }}>
                        {user.nickname || user.email || 'Unknown'}
                    </Tag>
                ))}
                {hasMore && !expanded && (
                    <Button 
                        type="link" 
                        size="small" 
                        onClick={() => setExpanded(true)}
                        style={{ padding: 0, height: 'auto', fontSize: '11px' }}
                    >
                        +{targetUsers.length - 3} 更多
                    </Button>
                )}
                {expanded && hasMore && (
                    <Button 
                        type="link" 
                        size="small" 
                        onClick={() => setExpanded(false)}
                        style={{ padding: 0, height: 'auto', fontSize: '11px' }}
                    >
                        收起
                    </Button>
                )}
            </Space>
        )
    }

    // 显示发送确认弹窗
    const showSendConfirm = (values: any) => {
        let targetDescription = ''
        let targetCount = 0

        if (formData.targetType === 'all') {
            targetDescription = '所有用户'
            targetCount = users.length
        } else if (formData.targetType === 'active') {
            targetDescription = '活跃用户（最近30天有活动）'
            targetCount = 0 // 实际数量需要查询
        } else {
            targetDescription = '指定用户'
            targetCount = formData.selectedUsers.length
            if (targetCount === 0) {
                message.warning('请选择要发送的用户')
                return
            }
        }

        Modal.confirm({
            title: '确认发送通知',
            icon: <ExclamationCircleOutlined />,
            content: (
                <div>
                    <p><strong>通知标题：</strong>{values.title}</p>
                    <p><strong>通知内容：</strong>{values.message}</p>
                    <p><strong>发送目标：</strong>{targetDescription}</p>
                    {formData.targetType !== 'active' && (
                        <p><strong>预计接收人数：</strong>{targetCount} 人</p>
                    )}
                    <p style={{ color: '#ff4d4f', marginTop: 16 }}>
                        ⚠️ 通知发送后无法撤回，请确认信息无误后再发送
                    </p>
                </div>
            ),
            okText: '确认发送',
            cancelText: '取消',
            okType: 'primary',
            onOk: () => sendNotification(values),
        })
    }

    // 发送通知
    const sendNotification = async (values: any) => {
        setSending(true)
        try {
            const notificationData = {
                admin_sent: true,
                sent_at: new Date().toISOString()
            }

            let targetUserIds: string[] = []
            let result = ''

            // 获取目标用户ID
            if (formData.targetType === 'all') {
                // 获取所有用户ID
                const { data: allUsers, error: usersError } = await supabase
                    .from('user_profiles')
                    .select('id')
                
                if (usersError) throw usersError
                targetUserIds = allUsers?.map(u => u.id) || []
                result = `已发送给所有用户 (${targetUserIds.length} 个)`
            } else if (formData.targetType === 'active') {
                // 获取活跃用户ID (这里简化为所有用户，你可以根据需要添加活跃条件)
                const { data: activeUsers, error: activeError } = await supabase
                    .from('user_profiles')
                    .select('id')
                
                if (activeError) throw activeError
                targetUserIds = activeUsers?.map(u => u.id) || []
                result = `已发送给活跃用户 (${targetUserIds.length} 个)`
            } else {
                // 指定用户
                if (formData.selectedUsers.length === 0) {
                    message.warning('请选择要发送的用户')
                    return
                }
                targetUserIds = formData.selectedUsers
                result = `已发送给指定用户 (${targetUserIds.length} 个)`
            }

            // 批量插入通知
            const notifications = targetUserIds.map(userId => ({
                user_id: userId,
                type: 'system_announcement',
                title: values.title,
                message: values.message,
                data: notificationData,
                is_read: false
            }))

            const { error: insertError } = await supabase
                .from('notifications')
                .insert(notifications)

            if (insertError) throw insertError

            // 插入历史记录
            try {
                const { error: historyError } = await supabase
                    .from('notification_history')
                    .insert({
                        title: values.title,
                        message: values.message,
                        target_type: formData.targetType,
                        target_count: targetUserIds.length,
                        target_user_ids: targetUserIds,
                        sent_by: (await supabase.auth.getUser()).data.user?.id,
                        data: notificationData
                    })

                if (historyError) {
                    console.warn('插入历史记录失败:', historyError)
                    // 不抛出错误，因为通知已经发送成功了
                }
            } catch (historyError) {
                console.warn('插入历史记录失败:', historyError)
            }

            message.success(`通知发送成功！${result}`)

            // 延迟一下再重置表单，确保用户能看到成功提示
            setTimeout(() => {
                resetForm()
            }, 500)

            // 刷新历史数据
            if (activeTab === 'history') {
                loadHistory()
            }
        } catch (error) {
            console.error('发送通知失败:', error)
            message.error('发送通知失败: ' + (error as Error).message)
        } finally {
            setSending(false)
        }
    }

    // 重置表单函数
    const resetForm = () => {
        // 先重置状态
        setFormData({
            title: '',
            message: '',
            targetType: 'all',
            selectedUsers: []
        })
        setUserSearchTerm('')
        
        // 然后重置表单字段
        form.resetFields()
        
        // 强制设置表单值为空
        form.setFieldsValue({
            title: '',
            message: ''
        })
    }

    // 处理用户选择 - 现在在组件内部直接处理，不需要这个函数了

    // 全选/取消全选
    const handleSelectAll = (checked: boolean) => {
        const userIds = checked ? filteredUsers.map(u => u.id) : []
        setFormData(prev => ({
            ...prev,
            selectedUsers: userIds
        }))
    }

    const renderSendTab = () => (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 通知模板 */}
            <Card title="快速模板" size="small">
                <Collapse ghost>
                    <Panel header="选择模板" key="1">
                        <Row gutter={[16, 16]}>
                            {templates.map((template) => (
                                <Col span={12} key={template.id}>
                                    <Card
                                        size="small"
                                        hoverable
                                        onClick={() => applyTemplate(template)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <Card.Meta
                                            title={<Text strong>{template.name}</Text>}
                                            description={
                                                <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                                                    {template.message}
                                                </Paragraph>
                                            }
                                        />
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    </Panel>
                </Collapse>
            </Card>

            {/* 通知表单 */}
            <Card title={<><SendOutlined /> 发送通知</>}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={sendNotification}
                    initialValues={formData}
                >
                    <Form.Item
                        label="通知标题"
                        name="title"
                        rules={[{ required: true, message: '请输入通知标题' }]}
                    >
                        <Input
                            placeholder="输入通知标题..."
                            maxLength={255}
                            showCount
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        />
                    </Form.Item>

                    <Form.Item
                        label="通知内容"
                        name="message"
                        rules={[{ required: true, message: '请输入通知内容' }]}
                    >
                        <TextArea
                            placeholder="输入通知内容..."
                            rows={4}
                            showCount
                            onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                        />
                    </Form.Item>

                    <Form.Item label="发送目标">
                        <Radio.Group
                            value={formData.targetType}
                            onChange={(e) => setFormData(prev => ({ ...prev, targetType: e.target.value }))}
                        >
                            <Space direction="vertical">
                                <Radio value="all">
                                    所有用户 <Text type="secondary">({users.length} 个用户)</Text>
                                </Radio>
                                <Radio value="active">
                                    活跃用户 <Text type="secondary">(最近30天有活动)</Text>
                                </Radio>
                                <Radio value="selected">
                                    指定用户 <Text type="secondary">({formData.selectedUsers.length} 个已选择)</Text>
                                </Radio>
                            </Space>
                        </Radio.Group>
                    </Form.Item>

                    {/* 用户选择列表 */}
                    {formData.targetType === 'selected' && (
                        <Form.Item label="选择用户">
                            <Card size="small">
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Input
                                        placeholder="搜索用户邮箱或昵称..."
                                        prefix={<SearchOutlined />}
                                        value={userSearchTerm}
                                        onChange={(e) => setUserSearchTerm(e.target.value)}
                                    />

                                    <Space>
                                        <Button
                                            size="small"
                                            onClick={() => handleSelectAll(true)}
                                        >
                                            全选
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={() => handleSelectAll(false)}
                                        >
                                            取消全选
                                        </Button>
                                        <Text type="secondary">
                                            已选择 {formData.selectedUsers.length} / {filteredUsers.length} 个用户
                                            {userSearchTerm && ` (搜索结果: ${filteredUsers.length} / ${users.length})`}
                                        </Text>
                                    </Space>

                                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                        {filteredUsers.length === 0 ? (
                                            <Empty
                                                description={userSearchTerm ? '未找到匹配的用户' : '暂无用户'}
                                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            />
                                        ) : (
                                            <List
                                                dataSource={filteredUsers}
                                                renderItem={(user) => (
                                                    <List.Item>
                                                        <List.Item.Meta
                                                            avatar={
                                                                <Checkbox
                                                                    checked={formData.selectedUsers.includes(user.id)}
                                                                    onChange={(e) => {
                                                                        const checked = e.target.checked
                                                                        const newSelected = checked
                                                                            ? [...formData.selectedUsers, user.id]
                                                                            : formData.selectedUsers.filter(id => id !== user.id)
                                                                        setFormData(prev => ({ ...prev, selectedUsers: newSelected }))
                                                                    }}
                                                                />
                                                            }
                                                            title={
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <Avatar size="small" icon={<UserOutlined />} />
                                                                    <Text strong>{user.nickname || '未设置昵称'}</Text>
                                                                </div>
                                                            }
                                                            description={
                                                                <div style={{ marginLeft: 32 }}>
                                                                    <Space split={<Divider type="vertical" />}>
                                                                        <Text type="secondary">{user.email}</Text>
                                                                        <Text type="secondary">
                                                                            {new Date(user.created_at).toLocaleDateString()}
                                                                        </Text>
                                                                    </Space>
                                                                </div>
                                                            }
                                                        />
                                                    </List.Item>
                                                )}
                                            />
                                        )}
                                    </div>
                                </Space>
                            </Card>
                        </Form.Item>
                    )}

                    <Form.Item>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={sending}
                                icon={<SendOutlined />}
                            >
                                {sending ? '发送中...' : '发送通知'}
                            </Button>
                            <Button onClick={resetForm}>
                                重置
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>


        </Space>
    )

    const renderHistoryTab = () => (
        <Card title={<><HistoryOutlined /> 通知发送历史</>}>
            {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <Spin size="large" />
                </div>
            ) : history.length === 0 ? (
                <Empty description="暂无通知发送记录" />
            ) : (
                <List
                    dataSource={history}
                    renderItem={(item) => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={<Avatar icon={<BellOutlined />} />}
                                title={
                                    <Space>
                                        <Text strong>{item.title}</Text>
                                        <Tag color="green" icon={<CheckCircleOutlined />}>
                                            已发送
                                        </Tag>
                                    </Space>
                                }
                                description={
                                    <Space direction="vertical" size="small">
                                        <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                                            {item.message}
                                        </Paragraph>
                                        <Space wrap>
                                            <Text type="secondary">
                                                发送给: {
                                                    item.target_type === 'all' ? '所有用户' :
                                                        item.target_type === 'active' ? '活跃用户' : '指定用户'
                                                }
                                            </Text>
                                            <Divider type="vertical" />
                                            <Text type="secondary">接收人数: {item.target_count}</Text>
                                            <Divider type="vertical" />
                                            <Text type="secondary">发送人: {item.sent_by}</Text>
                                            <Divider type="vertical" />
                                            <Text type="secondary">
                                                发送时间: {new Date(item.sent_at).toLocaleString()}
                                            </Text>
                                        </Space>
                                        {renderTargetUsers(item)}
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}
        </Card>
    )

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" />
            </div>
        )
    }

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <Title level={2}>系统通知推送</Title>
                <Text type="secondary">向用户发送系统公告和重要通知</Text>
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: 'send',
                        label: (
                            <span>
                                <SendOutlined />
                                发送通知
                            </span>
                        ),
                        children: renderSendTab()
                    },
                    {
                        key: 'history',
                        label: (
                            <span>
                                <HistoryOutlined />
                                历史记录
                            </span>
                        ),
                        children: renderHistoryTab()
                    }
                ]}
            />
        </div>
    )
}