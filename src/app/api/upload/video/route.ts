import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import r2Client, { R2_CONFIG, generateFileName, SUPPORTED_VIDEO_TYPES, MAX_FILE_SIZE } from '@/lib/r2'

// 生成预签名上传 URL
export async function POST(request: NextRequest) {
  try {
    // 获取原始请求数据
    const contentType = request.headers.get('content-type')
    console.log('Content-Type:', contentType)
    
    // 检查是否是JSON格式
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: '请求必须为JSON格式' },
        { status: 400 }
      )
    }
    
    // 先获取原始文本
    const rawText = await request.text()
    console.log('原始请求数据:', rawText)
    
    let body
    try {
      body = JSON.parse(rawText)
    } catch (parseError) {
      console.error('JSON解析错误:', parseError)
      console.error('原始数据:', rawText)
      return NextResponse.json(
        { error: `请求数据格式错误: ${parseError instanceof Error ? parseError.message : '未知错误'}` },
        { status: 400 }
      )
    }
    
    console.log('成功解析的数据:', body)
    
    const { fileName, fileType, fileSize } = body

    // 验证必需字段
    if (!fileName || !fileType || fileSize === undefined) {
      return NextResponse.json(
        { error: '缺少必需的文件信息（文件名、类型或大小）' },
        { status: 400 }
      )
    }

    // 验证文件类型
    if (!SUPPORTED_VIDEO_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: '不支持的视频格式。请上传 MP4、WebM、MOV 或 AVI 格式的视频。' },
        { status: 400 }
      )
    }

    // 验证文件大小
    const fileSizeNum = Number(fileSize)
    if (isNaN(fileSizeNum) || fileSizeNum <= 0) {
      return NextResponse.json(
        { error: '无效的文件大小' },
        { status: 400 }
      )
    }
    
    if (fileSizeNum > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件太大。请上传小于 100MB 的视频。' },
        { status: 400 }
      )
    }

    // 生成唯一文件名
    const key = generateFileName(fileName)

    // 创建上传命令
    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      ContentType: fileType,
      ContentLength: fileSizeNum,
      // 设置缓存策略
      CacheControl: 'max-age=31536000', // 1年
      // 设置元数据
      Metadata: {
        'original-name': fileName,
        'upload-time': new Date().toISOString(),
      },
    })

    // 生成预签名 URL（10分钟有效期）
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 600 })

    // 生成文件的公共访问 URL
    const fileUrl = R2_CONFIG.publicUrl 
      ? `${R2_CONFIG.publicUrl}/${key}`
      : `https://${R2_CONFIG.bucketName}.r2.cloudflarestorage.com/${key}`

    return NextResponse.json({
      uploadUrl: signedUrl,
      fileUrl: fileUrl,
      key: key,
    })

  } catch (error) {
    console.error('生成上传 URL 失败:', error)
    return NextResponse.json(
      { error: '服务器错误，请稍后重试。' },
      { status: 500 }
    )
  }
}

// 验证上传是否成功
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json(
        { error: '缺少文件键值' },
        { status: 400 }
      )
    }

    // 检查文件是否存在
    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    })

    try {
      await r2Client.send(command)
      return NextResponse.json({ exists: true })
    } catch (error) {
      return NextResponse.json({ exists: false })
    }

  } catch (error) {
    console.error('验证文件失败:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}