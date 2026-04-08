import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 生产环境配置
  productionBrowserSourceMaps: false,
  
  // 开发环境优化
  devIndicators: false,
  
  // 实验性功能 - 优化页面加载
  experimental: {
    // 启用视图过渡
    viewTransition: true,
    // 优化包加载
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
  },
  
  // 服务端外部包（SDK需要在服务端运行）
  serverExternalPackages: ['coze-coding-dev-sdk'],
  
  // 图片配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // 编译优化
  compiler: {
    removeConsole: false,
  },
  
  // 响应头配置
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
