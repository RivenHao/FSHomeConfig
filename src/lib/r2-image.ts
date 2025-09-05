import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// 创建 S3 客户端（用于连接 Cloudflare R2）
const s3Client = new S3Client({
  region: 'auto', // R2 使用 'auto' 作为区域
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME!

/**
 * 生成用于上传图片的预签名 URL
 * @param fileName 文件名
 * @param fileType 文件类型
 * @param expiresIn 过期时间（秒），默认10分钟
 * @returns 预签名 URL 和文件访问 URL
 */
export async function generateImageUploadUrl(
  fileName: string,
  fileType: string,
  expiresIn: number = 600
) {
  try {
    // 生成唯一的文件名
    const timestamp = Date.now()
    const uniqueFileName = `images/${timestamp}-${fileName}`

    // 创建上传命令
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
    })

    // 生成预签名上传 URL
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn })

    // 生成文件访问 URL
    const fileUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
      ? `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${uniqueFileName}`
      : `${process.env.CLOUDFLARE_R2_ENDPOINT}/${BUCKET_NAME}/${uniqueFileName}`

    return {
      uploadUrl,
      fileUrl,
      key: uniqueFileName,
    }
  } catch (error) {
    console.error('生成预签名 URL 失败:', error)
    throw error
  }
}

/**
 * 检查文件是否存在于 R2 存储桶中
 * @param key 文件键值
 * @returns 是否存在
 */
export async function checkImageExists(key: string): Promise<boolean> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    await s3Client.send(command)
    return true
  } catch (error) {
    console.error('检查文件存在性失败:', error)
    return false
  }
}

/**
 * 验证图片文件类型
 * @param fileType 文件MIME类型
 * @returns 是否为支持的图片类型
 */
export function validateImageType(fileType: string): boolean {
  const supportedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ]
  return supportedTypes.includes(fileType)
}

/**
 * 验证图片文件大小
 * @param fileSize 文件大小（字节）
 * @param maxSize 最大大小（字节），默认5MB
 * @returns 是否在允许范围内
 */
export function validateImageSize(fileSize: number, maxSize: number = 5 * 1024 * 1024): boolean {
  return fileSize <= maxSize
}