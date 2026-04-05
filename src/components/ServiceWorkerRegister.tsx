'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('[SW] 注册成功:', registration);
        })
        .catch(error => {
          console.log('[SW] 注册失败:', error);
        });
    }
  }, []);

  return null;
}
