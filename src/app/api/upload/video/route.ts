import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import r2Client, { R2_CONFIG } from '@/lib/r2'

// 支持的视频格式
const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/mpeg',
  'video/ogg'
]

// 最大文件大小 (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024

// 生成唯一文件名
const generateVideoFileName = (originalName: string): string => {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split('.').pop()?.toLowerCase() || 'mp4'
  return `freestyle_video/${timestamp}-${randomString}.${extension}`
}

// POST - 上传视频
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '没有选择文件' }, { status: 400 })
    }

    // 验证文件类型
    if (!SUPPORTED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '不支持的视频格式。请上传 MP4、WebM、MOV、AVI、MPEG 或 OGG 格式的视频。' },
        { status: 400 }
      )
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件太大。请上传小于 100MB 的视频。' },
        { status: 400 }
      )
    }

    // 生成唯一文件名
    const key = generateVideoFileName(file.name)

    try {
      // 读取文件内容
      const buffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(buffer)

      // 使用Base64编码文件名以避免header字符问题
      const encodedFileName = Buffer.from(file.name, 'utf8').toString('base64')

      // 创建上传命令
      const command = new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        Body: uint8Array,
        ContentType: file.type,
        ContentLength: file.size,
        // 设置缓存策略
        CacheControl: 'max-age=31536000', // 1年
        // 设置元数据（使用Base64编码的文件名）
        Metadata: {
          'original-name-b64': encodedFileName,
          'upload-time': new Date().toISOString(),
          'content-type': file.type,
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
        message: '视频上传成功'
      })

    } catch (uploadError) {
      console.error('R2上传失败详细错误:', uploadError)
      console.error('错误类型:', uploadError instanceof Error ? uploadError.constructor.name : typeof uploadError)
      console.error('错误消息:', uploadError instanceof Error ? uploadError.message : uploadError)
      console.error('错误堆栈:', uploadError instanceof Error ? uploadError.stack : 'No stack trace')
      
      return NextResponse.json(
        { 
          error: '文件上传失败，请重试',
          details: uploadError instanceof Error ? uploadError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('视频上传API总体错误:', error)
    console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('错误消息:', error instanceof Error ? error.message : error)
    
    return NextResponse.json(
      { 
        error: '服务器错误，请稍后重试',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}