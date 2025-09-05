import { S3Client } from '@aws-sdk/client-s3'

// Cloudflare R2 配置
const r2Client = new S3Client({
  region: 'auto', // Cloudflare R2 使用 'auto' 作为 region
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT, // 您的 R2 端点 URL
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
})

export default r2Client

// 配置常量
export const R2_CONFIG = {
  bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
  publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || '', // 可选：自定义域名或 R2 公共 URL
}

// 生成唯一文件名
export function generateFileName(originalName: string): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split('.').pop()
  return `freestyle_gif/${timestamp}-${randomString}.${extension}`
}

// 从URL中提取文件key
export function extractKeyFromUrl(url: string): string | null {
  try {
    // 处理自定义域名的URL
    if (R2_CONFIG.publicUrl && url.startsWith(R2_CONFIG.publicUrl)) {
      return url.replace(`${R2_CONFIG.publicUrl}/`, '')
    }
    
    // 处理默认R2域名的URL
    const defaultDomain = `https://${R2_CONFIG.bucketName}.r2.cloudflarestorage.com/`
    if (url.startsWith(defaultDomain)) {
      return url.replace(defaultDomain, '')
    }
    
    // 如果URL格式不匹配，返回null
    return null
  } catch (error) {
    console.error('提取文件key失败:', error)
    return null
  }
}

// 获取支持的图片格式
export const SUPPORTED_GIF_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
]

// 最大GIF文件大小 (10MB)
export const MAX_GIF_SIZE = 10 * 1024 * 1024

// 获取支持的视频格式
export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
]

// 最大文件大小 (100MB)
export const MAX_FILE_SIZE = 100 * 1024 * 1024