'use client';

import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useRouter } from 'next/navigation';

export default function ProjectExportPage() {
  const router = useRouter();
  const { mode, toggleMode } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('点击下方按钮导出项目');

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setDownloadUrl(null);
    setProgress('正在打包项目，请稍候...');

    try {
      const response = await fetch('/api/project-export');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '导出失败');
      }

      setProgress(`打包完成！文件大小: ${(data.size / 1024 / 1024).toFixed(2)} MB`);
      setDownloadUrl(data.downloadUrl);
    } catch (err: any) {
      setError(err.message || '导出失败，请重试');
      setProgress('');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;

    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'dream-project.tar.gz';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // 如果直接下载失败，尝试打开新窗口
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div className={`min-h-screen ${mode === 'dark' ? 'bg-black' : 'bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd]'}`}>
      <button
        onClick={toggleMode}
        className="fixed top-4 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl z-50 transition-all duration-300 shadow-lg"
        style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)' }}
      >
        {mode === 'light' ? '🌙' : '☀️'}
      </button>
      {/* 顶部导航 */}
      <header className={`px-4 py-4 border-b ${mode === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/60 border-sky-100/50'}`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className={`bg-transparent outline-none border-none transition-all ${mode === 'dark' ? 'text-white/70 hover:text-sky-300' : 'text-gray-500 hover:text-sky-500'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className={`text-xl font-light tracking-widest ${mode === 'dark' ? 'text-white/90' : 'text-gray-600'}`}>项目导出</h1>
          <div className="w-12" />
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className={`rounded-3xl p-8 ${mode === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white shadow-xl'}`}>
          {/* 图标 */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${
              mode === 'dark' ? 'bg-purple-900/30' : 'bg-sky-100'
            }`}>
              <svg className={`w-10 h-10 ${mode === 'dark' ? 'text-sky-400' : 'text-sky-500'}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>

          {/* 标题 */}
          <h2 className={`text-2xl font-medium text-center mb-4 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            导出项目源码
          </h2>
          <p className={`text-center mb-8 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
            将包含所有源码文件打包下载，方便本地部署或备份
          </p>

          {/* 功能说明 */}
          <div className={`rounded-xl p-4 mb-8 ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
            <h3 className={`font-medium mb-3 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>导出内容</h3>
            <ul className={`space-y-2 text-sm ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                完整项目源码（src目录）
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                配置文件（package.json, tsconfig.json等）
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                文档文件（README.md等）
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                已排除：node_modules、.git、构建缓存
              </li>
            </ul>
          </div>

          {/* 状态显示 */}
          <div className={`text-center mb-6 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
            {progress}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col gap-4">
            {downloadUrl ? (
              <button
                onClick={handleDownload}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-teal-500 text-white font-medium text-lg hover:from-green-600 hover:to-teal-600 transition-all shadow-lg hover:shadow-xl"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下载项目压缩包
                </span>
              </button>
            ) : (
              <button
                onClick={handleExport}
                disabled={isExporting}
                className={`w-full py-4 rounded-xl font-medium text-lg transition-all ${
                  mode === 'dark'
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:from-sky-700 hover:to-blue-700'
                    : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:from-sky-600 hover:to-blue-600'
                } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
              >
                {isExporting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    打包中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    导出项目
                  </span>
                )}
              </button>
            )}
          </div>

          {/* 提示 */}
          <p className={`text-xs text-center mt-6 ${mode === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
            下载链接有效期为 7 天，请及时下载
          </p>
        </div>
      </main>
    </div>
  );
}
