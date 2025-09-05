import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import r2Client, { R2_CONFIG } from '@/lib/r2'

// 支持的图片格式
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp'
]

// 最大文件大小 (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024

// 生成唯一文件名
const generateImageFileName = (originalName: string): string => {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2)
  const extension = originalName.split('.').pop() || 'jpg'
  return `freestyle_gif/${timestamp}_${randomString}.${extension}`
}

// POST - 上传图片
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '没有选择文件' }, { status: 400 })
    }

    // 验证文件类型
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '不支持的图片格式。请上传 JPEG、PNG、GIF 或 WebP 格式的图片。' },
        { status: 400 }
      )
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件太大。请上传小于 5MB 的图片。' },
        { status: 400 }
      )
    }

    // 生成唯一文件名
    const key = generateImageFileName(file.name)

    try {
      // 读取文件内容
      const buffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(buffer)

      // 创建上传命令
      const command = new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        Body: uint8Array,
        ContentType: file.type,
        ContentLength: file.size,
        // 设置缓存策略
        CacheControl: 'max-age=31536000', // 1年
        // 设置元数据
        Metadata: {
          'original-name': file.name,
          'upload-time': new Date().toISOString(),
        },
      })

      // 上传文件
      await r2Client.send(command)

      // 生成文件的公共访问 URL
      const fileUrl = R2_CONFIG.publicUrl 
        ? `${R2_CONFIG.publicUrl}/${key}`
        : `https://${R2_CONFIG.bucketName}.r2.cloudflarestorage.com/${key}`

      return NextResponse.json({
        success: true,
        url: fileUrl,
        key: key,
        message: '图片上传成功'
      })

    } catch (uploadError) {
      console.error('文件上传失败:', uploadError)
      return NextResponse.json(
        { error: '文件上传失败，请重试' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('图片上传API错误:', error)
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    )
  }
}