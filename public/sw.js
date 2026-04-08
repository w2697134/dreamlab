// Service Worker - 保持 SSE 连接，页面刷新后继续更新

let sseConnection = null;
let lastProgress = 0;
let lastMessage = '';
let isGenerating = false;

// 安装
self.addEventListener('install', (event) => {
  console.log('[SW] 安装');
  self.skipWaiting();
});

// 激活
self.addEventListener('activate', (event) => {
  console.log('[SW] 激活');
  event.waitUntil(self.clients.claim());
});

// 监听消息
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  if (type === 'START_GENERATION') {
    // 开始生成，建立 SSE 连接
    startSSEConnection(data);
  } else if (type === 'STOP_GENERATION') {
    // 停止生成
    stopSSEConnection();
  } else if (type === 'GET_STATUS') {
    // 获取当前状态
    event.source.postMessage({
      type: 'STATUS',
      data: { isGenerating, progress: lastProgress, message: lastMessage }
    });
  }
});

// 建立 SSE 连接
function startSSEConnection(requestData) {
  console.log('[SW] 开始 SSE 连接');
  isGenerating = true;
  
  // 这里需要实际的 SSE 连接逻辑
  // 由于需要 token 等，简化处理：让页面自己连接，SW 只保存进度
}

// 停止 SSE 连接
function stopSSEConnection() {
  console.log('[SW] 停止 SSE 连接');
  isGenerating = false;
  if (sseConnection) {
    sseConnection.close();
    sseConnection = null;
  }
}

// 保存进度（从页面接收）
self.addEventListener('message', (event) => {
  if (event.data.type === 'UPDATE_PROGRESS') {
    lastProgress = event.data.progress;
    lastMessage = event.data.message;
    isGenerating = event.data.isGenerating;
    
    // 广播给所有客户端
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PROGRESS_UPDATE',
          data: { progress: lastProgress, message: lastMessage, isGenerating }
        });
      });
    });
  }
});
