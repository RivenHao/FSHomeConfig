'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Select, message, Tag, Avatar, Statistic, Row, Col } from 'antd';
import { TrophyOutlined, ReloadOutlined, CrownOutlined, StarOutlined } from '@ant-design/icons';
import {
  getSeasons,
} from '@/lib/weekly-challenge-queries';
import { supabase } from '@/lib/supabase';
import {
  Season,
  SeasonLeaderboard,
} from '@/types/weekly-challenge';

const { Option } = Select;

export default function LeaderboardPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [leaderboard, setLeaderboard] = useState<SeasonLeaderboard[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [seasonStats, setSeasonStats] = useState({
    totalParticipants: 0,
    totalPoints: 0,
    avgPoints: 0,
    topScore: 0,
  });

  // 加载赛季列表
  const loadSeasons = async () => {
    try {
      const result = await getSeasons(1, 100);
      if (result.data) {
        setSeasons(result.data.data);
        // 默认选择第一个赛季
        if (result.data.data.length > 0) {
          const activeSeason = result.data.data.find(s => s.status === 'active') || result.data.data[0];
          setSelectedSeasonId(activeSeason.id);
        }
      }
    } catch (error) {
      console.error('加载赛季数据失败:', error);
    }
  };

  // 加载排行榜数据
  const loadLeaderboard = async (seasonId: string) => {
    if (!seasonId) return;

    setLoading(true);
    try {
      // 获取排行榜数据
      const { data: leaderboardData, error } = await supabase
        .from('season_leaderboards')
        .select(`
          *,
          user_profiles!season_leaderboards_user_id_fkey(
            nickname,
            image_url
          )
        `)
        .eq('season_id', seasonId)
        .order('rank_position');

      if (error) {
        console.error('获取排行榜数据失败:', error);
        message.error('获取排行榜数据失败');
        return;
      }

      setLeaderboard(leaderboardData || []);

      // 计算统计数据
      if (leaderboardData && leaderboardData.length > 0) {
        const totalParticipants = leaderboardData.length;
        const totalPoints = leaderboardData.reduce((sum, item) => sum + item.total_points, 0);
        const avgPoints = Math.round(totalPoints / totalParticipants);
        const topScore = Math.max(...leaderboardData.map(item => item.total_points));

        setSeasonStats({
          totalParticipants,
          totalPoints,
          avgPoints,
          topScore,
        });
      } else {
        setSeasonStats({
          totalParticipants: 0,
          totalPoints: 0,
          avgPoints: 0,
          topScore: 0,
        });
      }
    } catch (error) {
      console.error('加载排行榜数据失败:', error);
      message.error('加载排行榜数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeasonId) {
      loadLeaderboard(selectedSeasonId);
    }
  }, [selectedSeasonId]);

  const handleSeasonChange = (seasonId: string) => {
    setSelectedSeasonId(seasonId);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <CrownOutlined style={{ color: '#FFD700', fontSize: '18px' }} />;
      case 2:
        return <StarOutlined style={{ color: '#C0C0C0', fontSize: '16px' }} />;
      case 3:
        return <StarOutlined style={{ color: '#CD7F32', fontSize: '16px' }} />;
      default:
        return <span style={{ color: '#666', fontWeight: 'bold' }}>{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#666';
  };

  const getPrizeStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'shipped': return 'blue';
      case 'delivered': return 'green';
      default: return 'default';
    }
  };

  const getPrizeStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待发放';
      case 'shipped': return '已发货';
      case 'delivered': return '已送达';
      default: return '无奖品';
    }
  };

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank_position',
      key: 'rank_position',
      width: 80,
      render: (rank: number) => (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          {getRankIcon(rank)}
        </div>
      ),
    },
    {
      title: '用户信息',
      key: 'user_info',
      width: 200,
      render: (record: SeasonLeaderboard) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar 
            size="large" 
            src={record.user_profile?.image_url}
            style={{ 
              border: record.rank_position <= 3 ? `2px solid ${getRankColor(record.rank_position)}` : 'none'
            }}
          >
            {record.user_profile?.nickname?.[0] || 'U'}
          </Avatar>
          <div>
            <div style={{ 
              fontWeight: 'bold', 
              fontSize: '16px',
              color: record.rank_position <= 3 ? getRankColor(record.rank_position) : '#333'
            }}>
              {record.user_profile?.nickname || '未知用户'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              ID: {record.user_id.slice(-8)}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '总积分',
      dataIndex: 'total_points',
      key: 'total_points',
      width: 120,
      render: (points: number, record: SeasonLeaderboard) => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 'bold',
            color: record.rank_position <= 3 ? getRankColor(record.rank_position) : '#1890ff'
          }}>
            {points}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>积分</div>
        </div>
      ),
    },
    {
      title: '参与统计',
      key: 'participation_stats',
      width: 150,
      render: (record: SeasonLeaderboard) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: '#666' }}>总参与: </span>
            <span style={{ fontWeight: 'bold' }}>{record.participation_count}</span>
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: '#52c41a' }}>简单: </span>
            <span style={{ fontWeight: 'bold' }}>{record.simple_completions}</span>
          </div>
          <div>
            <span style={{ color: '#f5222d' }}>困难: </span>
            <span style={{ fontWeight: 'bold' }}>{record.hard_completions}</span>
          </div>
        </div>
      ),
    },
    {
      title: '获奖状态',
      key: 'winner_status',
      width: 120,
      render: (record: SeasonLeaderboard) => (
        <div style={{ textAlign: 'center' }}>
          {record.is_winner ? (
            <div>
              <Tag color="gold" icon={<TrophyOutlined />}>
                获奖者
              </Tag>
              <div style={{ marginTop: 4 }}>
                <Tag color={getPrizeStatusColor(record.prize_status)} size="small">
                  {getPrizeStatusText(record.prize_status)}
                </Tag>
              </div>
            </div>
          ) : (
            <Tag color="default">未获奖</Tag>
          )}
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (text: string) => (
        <div style={{ fontSize: '12px', color: '#666' }}>
          {new Date(text).toLocaleDateString()}
        </div>
      ),
    },
  ];

  const selectedSeason = seasons.find(s => s.id === selectedSeasonId);

  return (
    <div>
      {/* 赛季选择和统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <div style={{ marginBottom: 16 }}>
              <span style={{ marginRight: 8, fontWeight: 'bold' }}>选择赛季:</span>
              <Select
                value={selectedSeasonId}
                onChange={handleSeasonChange}
                style={{ width: '100%' }}
                placeholder="请选择赛季"
              >
                {seasons.map(season => (
                  <Option key={season.id} value={season.id}>
                    {season.name} 
                    {season.status === 'active' && (
                      <Tag color="green" size="small" style={{ marginLeft: 4 }}>
                        进行中
                      </Tag>
                    )}
                  </Option>
                ))}
              </Select>
            </div>
            
            {selectedSeason && (
              <div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>
                  赛季状态: 
                  <Tag 
                    color={selectedSeason.status === 'active' ? 'green' : 'orange'} 
                    size="small" 
                    style={{ marginLeft: 4 }}
                  >
                    {selectedSeason.status === 'active' ? '进行中' : 
                     selectedSeason.status === 'ended' ? '已结束' : '已结算'}
                  </Tag>
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  时间: {new Date(selectedSeason.start_date).toLocaleDateString()} - {new Date(selectedSeason.end_date).toLocaleDateString()}
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col span={18}>
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="参与用户"
                  value={seasonStats.totalParticipants}
                  suffix="人"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="总积分"
                  value={seasonStats.totalPoints}
                  suffix="分"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="平均积分"
                  value={seasonStats.avgPoints}
                  suffix="分"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="最高积分"
                  value={seasonStats.topScore}
                  suffix="分"
                  valueStyle={{ color: '#f5222d' }}
                />
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* 排行榜 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrophyOutlined style={{ color: '#faad14' }} />
            <span>赛季排行榜</span>
            {selectedSeason && (
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {selectedSeason.name}
              </Tag>
            )}
          </div>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                if (selectedSeasonId) {
                  loadLeaderboard(selectedSeasonId);
                }
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {leaderboard.length === 0 && !loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 0', 
            color: '#666',
            fontSize: '16px'
          }}>
            <TrophyOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: 16 }} />
            <div>该赛季暂无排行榜数据</div>
            <div style={{ fontSize: '14px', marginTop: 8 }}>
              用户参与挑战并获得积分后将显示在此处
            </div>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={leaderboard}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 位用户`,
            }}
            rowClassName={(record) => {
              if (record.rank_position === 1) return 'rank-first';
              if (record.rank_position === 2) return 'rank-second';
              if (record.rank_position === 3) return 'rank-third';
              return '';
            }}
          />
        )}
      </Card>

      <style jsx global>{`
        .rank-first {
          background: linear-gradient(90deg, #fff9e6 0%, #ffffff 100%);
        }
        .rank-second {
          background: linear-gradient(90deg, #f6f6f6 0%, #ffffff 100%);
        }
        .rank-third {
          background: linear-gradient(90deg, #fff4e6 0%, #ffffff 100%);
        }
      `}</style>
    </div>
  );
}