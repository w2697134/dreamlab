'use client';

import { useState, useEffect } from 'react';

export default function AdminStoragePage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 获取存储状态
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/clear-storage');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      setMessage('获取状态失败: ' + (error as Error).message);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // 清空存储
  const clearStorage = async () => {
    if (!confirm('确定要删除所有图片吗？此操作不可恢复！')) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('dreamToken') || 'admin-token';
      const response = await fetch('/api/admin/clear-storage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ ${data.message}`);
        fetchStatus(); // 刷新状态
      } else {
        setMessage('❌ 错误: ' + data.error);
      }
    } catch (error) {
      setMessage('❌ 请求失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">存储桶管理</h1>

        {/* 状态卡片 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">存储状态</h2>
          {status ? (
            <div className="space-y-2">
              <p className="text-gray-600">
                <span className="font-medium">存储桶:</span> {status.bucket}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">文件数量:</span> {status.fileCount} 个
              </p>
              <p className="text-gray-600">
                <span className="font-medium">总大小:</span> {(status.totalSize / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <p className="text-gray-500">加载中...</p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">危险操作</h2>
          <button
            onClick={clearStorage}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? '处理中...' : '⚠️ 清空所有图片'}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            此操作将删除存储桶中的所有图片，不可恢复！
          </p>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`rounded-xl p-4 ${message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        {/* 文件列表 */}
        {status?.files && status.files.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">文件列表</h2>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">文件名</th>
                    <th className="text-right p-3">大小</th>
                  </tr>
                </thead>
                <tbody>
                  {status.files.map((file: any, index: number) => (
                    <tr key={index} className="border-t">
                      <td className="p-3 text-gray-600 truncate max-w-md">{file.name}</td>
                      <td className="p-3 text-right text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
