import { supabase } from './supabase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
}

// 发送推送通知给单个用户
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) return;

    const messages: PushMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data,
      sound: 'default',
    }));

    await sendPushMessages(messages);
  } catch (error) {
    console.error('发送推送通知失败:', error);
  }
}

// 发送推送通知给所有用户
export async function sendPushToAll(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token');

    if (!tokens || tokens.length === 0) return;

    const messages: PushMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data,
      sound: 'default',
    }));

    await sendPushMessages(messages);
  } catch (error) {
    console.error('群发推送通知失败:', error);
  }
}

// 批量发送（Expo Push API 支持一次最多 100 条）
async function sendPushMessages(messages: PushMessage[]): Promise<void> {
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        console.error('Expo Push API 错误:', res.status, await res.text());
      }
    } catch (error) {
      console.error('发送推送请求失败:', error);
    }
  }
}
