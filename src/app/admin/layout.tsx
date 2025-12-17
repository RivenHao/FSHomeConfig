'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

// 设置 dayjs 中文
dayjs.locale('zh-cn');

// 动态导入AdminLayout，避免服务器端渲染问题
const AdminLayout = dynamic(() => import('@/components/admin/AdminLayout'), {
  ssr: false,
  loading: () => <div>加载中...</div>
});

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // 在服务器端渲染时，直接返回children
  if (!mounted) {
    return children;
  }
  
  // 在客户端渲染后，根据路径决定是否使用AdminLayout
  if (pathname === '/admin/login') {
    return (
      <ConfigProvider locale={zhCN}>
        {children}
      </ConfigProvider>
    );
  }
  
  return (
    <ConfigProvider locale={zhCN}>
      <AdminLayout>{children}</AdminLayout>
    </ConfigProvider>
  );
}
