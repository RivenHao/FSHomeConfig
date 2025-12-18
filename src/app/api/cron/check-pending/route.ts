import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 初始化 Resend 邮件客户端
const resend = new Resend(process.env.RESEND_API_KEY);

// 数据库表名
const TABLES = {
  USER_MOVE_SUBMISSIONS: 'user_move_submissions',
  COMMUNITY_VIDEOS: 'community_videos',
  MOVE_TIPS: 'move_tips',
  USER_PARTICIPATIONS: 'user_participations',
} as const;

// 运营邮箱（支持多个，用逗号分隔）
const OPERATOR_EMAILS = (process.env.OPERATOR_EMAILS || 'freestyle_hao4314@163.com')
  .split(',')
  .map(email => email.trim())
  .filter(email => email.length > 0);

// 后台系统地址
const ADMIN_URL = process.env.ADMIN_URL || 'https://fs-home-config.vercel.app/';

// Cron 密钥验证（防止未授权调用）
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * 查询所有待审核内容的数量
 */
async function getPendingCounts() {
  const [
    { count: pendingVideos },
    { count: pendingCommunityVideos },
    { count: pendingTips },
    { count: pendingParticipations }
  ] = await Promise.all([
    // 待审核的招式视频
    supabase
      .from(TABLES.USER_MOVE_SUBMISSIONS)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    // 待审核的社区视频
    supabase
      .from(TABLES.COMMUNITY_VIDEOS)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    // 待审核的心得
    supabase
      .from(TABLES.MOVE_TIPS)
      .select('*', { count: 'exact', head: true })
      .eq('is_approved', false),
    // 待审核的挑战赛参与（如果表存在的话）
    supabase
      .from(TABLES.USER_PARTICIPATIONS)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
  ]);

  return {
    pendingVideos: pendingVideos || 0,
    pendingCommunityVideos: pendingCommunityVideos || 0,
    pendingTips: pendingTips || 0,
    pendingParticipations: pendingParticipations || 0,
  };
}

/**
 * 生成邮件内容
 */
function generateEmailContent(counts: {
  pendingVideos: number;
  pendingCommunityVideos: number;
  pendingTips: number;
  pendingParticipations: number;
}) {
  const { pendingVideos, pendingCommunityVideos, pendingTips, pendingParticipations } = counts;
  
  const totalPending = pendingVideos + pendingCommunityVideos + pendingTips + pendingParticipations;
  
  if (totalPending === 0) {
    return null; // 没有待审核内容，不发送邮件
  }

  const items: string[] = [];
  
  if (pendingVideos > 0) {
    items.push(`• 招式视频：${pendingVideos} 个`);
  }
  if (pendingCommunityVideos > 0) {
    items.push(`• 社区视频：${pendingCommunityVideos} 个`);
  }
  if (pendingTips > 0) {
    items.push(`• 用户心得：${pendingTips} 条`);
  }
  if (pendingParticipations > 0) {
    items.push(`• 挑战赛参与：${pendingParticipations} 个`);
  }

  const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 10px 10px 0 0;
          text-align: center;
        }
        .content {
          background: #f9fafb;
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-top: none;
        }
        .stats {
          background: white;
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          border-left: 4px solid #667eea;
        }
        .stats-item {
          padding: 5px 0;
          font-size: 16px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 500;
          margin-top: 15px;
        }
        .footer {
          text-align: center;
          padding: 15px;
          color: #6b7280;
          font-size: 12px;
          background: #f3f4f6;
          border-radius: 0 0 10px 10px;
          border: 1px solid #e5e7eb;
          border-top: none;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">⚽ FSHOME 审核提醒</h1>
      </div>
      <div class="content">
        <p>您好，运营同学！</p>
        <p>系统检测到有 <strong>${totalPending}</strong> 项内容需要审核：</p>
        
        <div class="stats">
          ${items.map(item => `<div class="stats-item">${item}</div>`).join('')}
        </div>
        
        <p>请尽快前往后台系统进行审核确认。</p>
        
        <div style="text-align: center;">
          <a href="${ADMIN_URL}/admin/videos" class="button">前往后台审核</a>
        </div>
      </div>
      <div class="footer">
        <p>此邮件由系统自动发送 | 检测时间：${currentTime}</p>
        <p>FSHOME 后台管理系统</p>
      </div>
    </body>
    </html>
  `;

  const text = `
FSHOME 审核提醒

您好，运营同学！

系统检测到有 ${totalPending} 项内容需要审核：

${items.join('\n')}

请前往后台系统进行审核确认：${ADMIN_URL}/admin/videos

检测时间：${currentTime}
  `.trim();

  return { html, text, totalPending };
}

/**
 * 发送邮件通知
 */
async function sendNotificationEmail(content: { html: string; text: string; totalPending: number }) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'FSHOME <noreply@resend.dev>', // 使用 Resend 的默认发件地址，或配置自己的域名
      to: OPERATOR_EMAILS, // 支持多个运营邮箱
      subject: `【FSHOME】有 ${content.totalPending} 项内容待审核`,
      html: content.html,
      text: content.text,
    });

    if (error) {
      console.error('发送邮件失败:', error);
      return { success: false, error };
    }

    console.log('邮件发送成功:', data);
    return { success: true, data };
  } catch (error) {
    console.error('发送邮件异常:', error);
    return { success: false, error };
  }
}

/**
 * GET 请求处理 - Cron Job 调用
 */
export async function GET(request: NextRequest) {
  try {
    // 验证 Cron 密钥（可选但推荐）
    const authHeader = request.headers.get('authorization');
    const urlSecret = request.nextUrl.searchParams.get('secret');
    
    if (CRON_SECRET) {
      const providedSecret = authHeader?.replace('Bearer ', '') || urlSecret;
      if (providedSecret !== CRON_SECRET) {
        return NextResponse.json(
          { error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    console.log('开始检查待审核内容...');

    // 1. 查询待审核数量
    const counts = await getPendingCounts();
    console.log('待审核统计:', counts);

    // 2. 生成邮件内容
    const emailContent = generateEmailContent(counts);

    if (!emailContent) {
      console.log('没有待审核内容，跳过邮件发送');
      return NextResponse.json({
        success: true,
        message: '没有待审核内容',
        counts,
        emailSent: false,
      });
    }

    // 3. 发送邮件
    const emailResult = await sendNotificationEmail(emailContent);

    return NextResponse.json({
      success: true,
      message: `检测到 ${emailContent.totalPending} 项待审核内容`,
      counts,
      emailSent: emailResult.success,
      emailError: emailResult.error || null,
    });

  } catch (error) {
    console.error('Cron 任务执行失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST 请求处理 - 手动触发测试
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

