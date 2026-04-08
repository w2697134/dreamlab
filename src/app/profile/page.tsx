'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';
import DraggableFixButton from '@/components/ui/DraggableFixButton';
import StarBackground from '@/components/StarBackground';
import GlobalLoading from '@/components/GlobalLoading';

interface Dream {
  id: string;
  prompt: string;
  imageUrl: string;
  date: string;
  videoUrl?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isDeveloper, user: authUser, login: authLogin, logout: authLogout } = useAuth();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [collectionCount, setCollectionCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const { mode, toggleMode } = useTheme();
  // 用户登录状态 - 使用 AuthProvider 的状态 (authUser)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [loginForm, setLoginForm] = useState({username: '', password: ''});
  const [isNavigatingHome, setIsNavigatingHome] = useState(false);
  const [registerForm, setRegisterForm] = useState({username: '', password: '', confirmPassword: ''});
  const [isLogging, setIsLogging] = useState(false); // 防止重复点击
  const [isRegistering, setIsRegistering] = useState(false); // 防止重复点击注册
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // 退出确认弹窗
  
  // 设置相关状态
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  useEffect(() => {
    // 已登录，从后端获取梦境数据
    if (authUser) {
      fetchDreams();
    }
    // 未登录时不读取任何数据，显示为 0
    
    // 加载设置
    const savedNotifications = localStorage.getItem('notifications') !== 'false';
    const savedAutoSave = localStorage.getItem('autoSave') !== 'false';
    setNotifications(savedNotifications);
    setAutoSave(savedAutoSave);
  }, [authUser]);
  
  // 保存设置
  const saveSettings = () => {
    localStorage.setItem('notifications', String(notifications));
    localStorage.setItem('autoSave', String(autoSave));
    setShowSettingsModal(false);
    showToast('设置已保存 ✨', 'success');
  };

  // 从后端获取梦境统计（使用梦境集接口）
  const fetchDreams = async () => {
    const token = localStorage.getItem('dreamToken');
    if (!token) {
      console.log('[个人中心] 无 token，跳过获取');
      return;
    }

    try {
      console.log('[个人中心] 开始获取梦境统计...');
      // 获取梦境集
      const response = await fetch('/api/dream-collections', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        console.error('[个人中心] API 响应失败:', response.status);
        return;
      }

      const data = await response.json();
      const collections = data.collections || [];
      
      console.log('[个人中心] 获取到梦境集:', collections.length);
      
      // 统计梦境集数量和图片数量
      const totalCollections = collections.length;
      const totalImages = collections.reduce((acc: number, c: any) => acc + (c.image_count || c.dreams?.length || 0), 0);
      const totalVideos = collections.reduce((acc: number, c: any) => acc + (c.has_video ? 1 : 0), 0);
      
      console.log('[个人中心] 统计结果:', { totalCollections, totalImages, totalVideos });
      
      setCollectionCount(totalCollections);
      setImageCount(totalImages);
      setVideoCount(totalVideos);
    } catch (error) {
      console.error('获取梦境统计失败:', error);
    }
  };

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      showToast('请输入用户名和密码', 'warning');
      return;
    }
    
    // 防止重复点击
    if (isLogging) return;
    setIsLogging(true);
    
    try {
      // 使用 AuthProvider 的统一登录函数
      const success = await authLogin(loginForm.username, loginForm.password);
      
      if (!success) {
        showToast('登录失败，请检查用户名和密码', 'error');
        setIsLogging(false);
        return;
      }
      
      setShowLoginModal(false);
      setLoginForm({username: '', password: ''});
      showToast('登录成功 ✨', 'success');
      
      // 显示加载遮罩，避免页面闪烁
      setIsNavigatingHome(true);
      
      // 延迟刷新页面以确保状态同步
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      showToast('登录出错，请重试', 'error');
    } finally {
      setIsLogging(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.username || !registerForm.password) {
      showToast('请输入用户名和密码', 'warning');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      showToast('两次输入的密码不一致', 'warning');
      return;
    }
    if (registerForm.password.length < 6) {
      showToast('密码长度至少为6位', 'warning');
      return;
    }
    
    // 防止重复点击
    if (isRegistering) return;
    setIsRegistering(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: registerForm.username,
          password: registerForm.password,
          nickname: registerForm.username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 将技术错误转换为用户友好的提示
        let errorMsg = data.error || '注册失败';
        if (errorMsg.includes('duplicate') || errorMsg.includes('unique') || errorMsg.includes('已存在')) {
          errorMsg = '该用户名已被注册，请更换';
        } else if (errorMsg.includes('password') || errorMsg.includes('密码')) {
          errorMsg = '两次输入的密码不一致，请检查';
        } else {
          // 其他错误（包括uuid格式问题）统一提示
          errorMsg = '用户名格式不正确，请使用字母、数字或中文';
        }
        showToast(errorMsg, 'error');
        setIsRegistering(false);
        return;
      }

      // 自动登录 - 使用 AuthProvider 的统一登录函数
      const success = await authLogin(registerForm.username, registerForm.password);
      
      if (!success) {
        showToast('注册成功但自动登录失败，请手动登录', 'warning');
      }
      
      setShowRegisterModal(false);
      setRegisterForm({username: '', password: '', confirmPassword: ''});
      
      // 显示成功提示，延迟跳转让用户看到提示
      showToast('🎉 注册成功！正在跳转...', 'success');
      
      // 延迟显示加载遮罩和跳转，让用户看到成功提示
      setTimeout(() => {
        setIsNavigatingHome(true);
        // 再延迟一下刷新页面
        setTimeout(() => window.location.reload(), 300);
      }, 1000);
    } catch (error) {
      showToast('注册出错，请重试', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    authLogout(); // 使用 AuthProvider 的统一退出函数
    setDreams([]);
    setImageCount(0);
    setVideoCount(0);
    setShowLogoutConfirm(false);
    // 延迟刷新页面以确保状态同步
    setTimeout(() => window.location.reload(), 300);
  };

  const handleClearAll = () => {
    if (confirm('确定要清空所有梦境集吗？此操作不可恢复。')) {
      localStorage.removeItem('dreamHistory');
      setDreams([]);
      setImageCount(0);
      setVideoCount(0);
    }
  };

  return (
    <div 
      className={`min-h-screen flex flex-col relative transition-colors duration-500 ${
        mode === 'dark' 
          ? '' 
          : 'bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd]'
      }`}
      style={{ backgroundColor: mode === 'dark' ? '#020617' : '#f0f9ff' }}
    >
      {/* 星空背景 */}
      <StarBackground />
      
      {/* 全局加载遮罩 - 登录/注册/跳转时显示 */}
      <GlobalLoading isOpen={isLogging || isRegistering || isNavigatingHome} />
      
      {/* 可拖动修复工具按钮 */}
      {isDeveloper && (
        <DraggableFixButton />
      )}

      {/* 温暖渐变背景 */}
      {mode === 'light' && (
        <>
          <div className="fixed top-20 left-10 w-48 h-48 bg-sky-200/30 rounded-full blur-[80px] pointer-events-none" />
          <div className="fixed bottom-40 right-20 w-56 h-56 bg-blue-200/25 rounded-full blur-[100px] pointer-events-none" />
        </>
      )}

      {/* 顶部 */}
      <header className={`relative z-10 px-4 py-4 border-b ${mode === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/60 border-sky-100/50'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => {
                if (isNavigatingHome) return;
                setIsNavigatingHome(true);
                setTimeout(() => {
                  router.push('/');
                }, 500);
              }}
              disabled={isNavigatingHome}
              className={`p-2 rounded-xl bg-transparent outline-none border-none transition-all duration-300 ${mode === 'dark' ? 'text-white/70 hover:text-sky-300 hover:bg-white/10' : 'text-gray-500 hover:text-sky-500 hover:bg-purple-50'} ${isNavigatingHome ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isNavigatingHome ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </button>
            <h1 className={`text-xl font-light tracking-widest ml-3 ${mode === 'dark' ? 'text-white/90' : 'text-gray-600'}`}>个人中心</h1>
          </div>
          <button
            onClick={toggleMode}
            className={`p-2 rounded-xl transition-colors ${mode === 'dark' ? 'text-white/70 hover:bg-white/10' : 'text-gray-500 hover:bg-purple-50'}`}
          >
            {mode === 'dark' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 relative z-10">
        {/* 用户信息/登录区域 */}
        <div className={`rounded-2xl border p-6 mb-6 shadow-sm ${mode === 'dark' ? 'bg-white/10 border-white/10' : 'bg-white/80 border-sky-100'}`}>
          {authUser ? (
            // 已登录状态
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${mode === 'dark' ? 'bg-gradient-to-br from-sky-500 to-blue-500' : 'bg-gradient-to-br from-sky-300 to-blue-300'}`}>
                  <span className="text-3xl text-white font-bold">{authUser.nickname?.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <h2 className={`text-xl font-light ${mode === 'dark' ? 'text-white/90' : 'text-gray-700'}`}>{authUser.nickname}</h2>
                  <p className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>@{authUser.username}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className={`px-4 py-2 rounded-xl text-sm transition-colors ${mode === 'dark' ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                退出登录
              </button>
            </div>
          ) : (
            // 未登录状态
            <div className="text-center py-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg mx-auto mb-4 ${mode === 'dark' ? 'bg-gradient-to-br from-sky-500/50 to-blue-500/50' : 'bg-gradient-to-br from-sky-200 to-blue-200'}`}>
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className={`text-xl font-light mb-2 ${mode === 'dark' ? 'text-white/90' : 'text-gray-700'}`}>游客模式</h2>
              <p className={`text-sm mb-6 ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>登录后可同步梦境集</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowLoginModal(true)}
                  className={`px-6 py-2 text-white rounded-xl hover:shadow-lg transition-all ${
                    mode === 'dark'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 hover:shadow-purple-900/50'
                      : 'bg-gradient-to-r from-sky-400 to-blue-400'
                  }`}
                >
                  登录
                </button>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className={`px-6 py-2 rounded-xl border transition-all ${mode === 'dark' ? 'border-white/20 text-white/80 hover:bg-white/10' : 'border-sky-200 text-gray-600 hover:bg-purple-50'}`}
                >
                  注册
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className={`rounded-2xl border p-5 text-center shadow-sm cursor-pointer transition-transform hover:scale-105 ${mode === 'dark' ? 'bg-white/10 border-white/10' : 'bg-white/80 border-sky-100'}`} onClick={() => router.push('/dreams')}>
            <div className={`text-3xl font-light mb-1 ${mode === 'dark' ? 'text-sky-300' : 'text-sky-500'}`}>{collectionCount}</div>
            <div className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>梦境集数</div>
          </div>
          <div className={`rounded-2xl border p-5 text-center shadow-sm ${mode === 'dark' ? 'bg-white/10 border-white/10' : 'bg-white/80 border-sky-100'}`}>
            <div className={`text-3xl font-light mb-1 ${mode === 'dark' ? 'text-blue-300' : 'text-blue-400'}`}>{imageCount}</div>
            <div className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>图片生成</div>
          </div>
          <div className={`rounded-2xl border p-5 text-center shadow-sm ${mode === 'dark' ? 'bg-white/10 border-white/10' : 'bg-white/80 border-sky-100'}`}>
            <div className={`text-3xl font-light mb-1 ${mode === 'dark' ? 'text-pink-300' : 'text-pink-400'}`}>{videoCount}</div>
            <div className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>视频生成</div>
          </div>
        </div>

        {/* 功能列表 */}
        <div className={`rounded-2xl border overflow-hidden shadow-sm ${mode === 'dark' ? 'bg-white/10 border-white/10' : 'bg-white/80 border-sky-100'}`}>
          <div className={`${mode === 'dark' ? 'border-b border-white/10' : 'border-b border-sky-100/50'}`}>
            <button 
              onClick={() => router.push('/dreams')}
              className={`w-full px-6 py-4 flex items-center justify-between text-left transition-colors ${mode === 'dark' ? 'hover:bg-white/5' : 'hover:bg-purple-50/50'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${mode === 'dark' ? 'bg-sky-500/20' : 'bg-sky-100'}`}>
                  <svg className={`w-5 h-5 ${mode === 'dark' ? 'text-sky-300' : 'text-sky-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className={mode === 'dark' ? 'text-white/80' : 'text-gray-700'}>我的梦境库</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${mode === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>{dreams.length} 个</span>
                <svg className={`w-5 h-5 ${mode === 'dark' ? 'text-white/30' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
          <button 
            onClick={() => router.push('/assessment')}
            className={`w-full px-6 py-4 flex items-center justify-between text-left transition-colors ${mode === 'dark' ? 'hover:bg-white/5' : 'hover:bg-purple-50/50'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${mode === 'dark' ? 'bg-pink-500/20' : 'bg-pink-100'}`}>
                <svg className={`w-5 h-5 ${mode === 'dark' ? 'text-pink-300' : 'text-pink-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <span className={mode === 'dark' ? 'text-white/80' : 'text-gray-700'}>心理状态报告</span>
                <p className={`text-xs ${mode === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                  {dreams.length > 0 ? `${dreams.length}个梦境可分析` : '探索潜意识'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dreams.length > 0 && (
                <span className={`px-2 py-1 rounded-full text-xs ${
                  mode === 'dark' ? 'bg-sky-500/30 text-sky-300' : 'bg-sky-100 text-sky-600'
                }`}>
                  🧠 推荐
                </span>
              )}
              <svg className={`w-5 h-5 ${mode === 'dark' ? 'text-white/30' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
          <div className={`${mode === 'dark' ? 'border-b border-white/10' : 'border-b border-sky-100/50'}`}>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className={`w-full px-6 py-4 flex items-center justify-between text-left transition-colors ${mode === 'dark' ? 'hover:bg-white/5' : 'hover:bg-purple-50/50'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${mode === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                  <svg className={`w-5 h-5 ${mode === 'dark' ? 'text-blue-300' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className={mode === 'dark' ? 'text-white/80' : 'text-gray-700'}>设置</span>
              </div>
              <svg className={`w-5 h-5 ${mode === 'dark' ? 'text-white/30' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {dreams.length > 0 && (
            <div>
              <button 
                onClick={handleClearAll}
                className={`w-full px-6 py-4 flex items-center justify-between text-left transition-colors ${mode === 'dark' ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${mode === 'dark' ? 'bg-red-500/20' : 'bg-red-100'}`}>
                    <svg className={`w-5 h-5 ${mode === 'dark' ? 'text-red-300' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <span className={mode === 'dark' ? 'text-red-300' : 'text-red-600'}>清空所有梦境</span>
                </div>
                <svg className={`w-5 h-5 ${mode === 'dark' ? 'text-white/30' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* 提示信息 */}
        <div className={`mt-6 p-4 rounded-xl border ${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-purple-50/50 border-sky-100'}`}>
          <p className={`text-sm text-center ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
            通过记录和分析你的梦境，我们可以更好地理解你的内心世界
          </p>
        </div>
      </main>
      {/* 登录弹窗 */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${mode === 'dark' ? 'bg-gray-900 border border-white/10' : 'bg-white border border-sky-100'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-light ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>登录</h3>
              <button 
                onClick={() => {setShowLoginModal(false); setLoginForm({username: '', password: ''});}}
                className={`p-1 rounded-full ${mode === 'dark' ? 'text-white/50 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>用户名</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  placeholder="请输入用户名"
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${mode === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-sky-500/50' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-sky-300 focus:bg-white'}`}
                />
              </div>
              <div>
                <label className={`block text-sm mb-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>密码</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  placeholder="请输入密码"
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${mode === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-sky-500/50' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-sky-300 focus:bg-white'}`}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {setShowLoginModal(false); setLoginForm({username: '', password: ''});}}
                disabled={isLogging}
                className={`flex-1 py-3 rounded-xl border transition-colors ${mode === 'dark' ? 'border-white/20 text-white/70 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50'} ${isLogging ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                取消
              </button>
              <button
                onClick={handleLogin}
                disabled={isLogging}
                className={`flex-1 py-3 rounded-xl text-white transition-all ${
                  isLogging ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                } ${
                  mode === 'dark'
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 hover:shadow-purple-900/50'
                    : 'bg-gradient-to-r from-sky-400 to-blue-400'
                }`}
              >
                {isLogging ? '登录中...' : '登录'}
              </button>
            </div>

            <p className={`text-center text-sm mt-4 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
              还没有账号？
              <button 
                onClick={() => {setShowLoginModal(false); setShowRegisterModal(true); setLoginForm({username: '', password: ''});}}
                className="text-sky-400 hover:text-sky-300 ml-1"
              >
                立即注册
              </button>
            </p>
          </div>
        </div>
      )}

      {/* 注册弹窗 */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${mode === 'dark' ? 'bg-gray-900 border border-white/10' : 'bg-white border border-sky-100'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-light ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>注册账号</h3>
              <button 
                onClick={() => {setShowRegisterModal(false); setRegisterForm({username: '', password: '', confirmPassword: ''});}}
                className={`p-1 rounded-full ${mode === 'dark' ? 'text-white/50 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>用户名</label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                  placeholder="请输入用户名"
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${mode === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-sky-500/50' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-sky-300 focus:bg-white'}`}
                />
              </div>
              <div>
                <label className={`block text-sm mb-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>密码</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                  placeholder="至少6位字符"
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${mode === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-sky-500/50' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-sky-300 focus:bg-white'}`}
                />
              </div>
              <div>
                <label className={`block text-sm mb-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>确认密码</label>
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                  placeholder="再次输入密码"
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${mode === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-sky-500/50' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-sky-300 focus:bg-white'}`}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {setShowRegisterModal(false); setRegisterForm({username: '', password: '', confirmPassword: ''});}}
                disabled={isRegistering}
                className={`flex-1 py-3 rounded-xl border transition-colors ${mode === 'dark' ? 'border-white/20 text-white/70 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50'} ${isRegistering ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                取消
              </button>
              <button
                onClick={handleRegister}
                disabled={isRegistering}
                className={`flex-1 py-3 rounded-xl text-white transition-all ${
                  isRegistering ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                } ${
                  mode === 'dark'
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 hover:shadow-purple-900/50'
                    : 'bg-gradient-to-r from-sky-400 to-blue-400'
                }`}
              >
                {isRegistering ? '注册中...' : '注册'}
              </button>
            </div>

            <p className={`text-center text-sm mt-4 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
              已有账号？
              <button 
                onClick={() => {setShowRegisterModal(false); setShowLoginModal(true); setRegisterForm({username: '', password: '', confirmPassword: ''});}}
                className="text-sky-400 hover:text-sky-300 ml-1"
              >
                立即登录
              </button>
            </p>
          </div>
        </div>
      )}

      {/* 设置弹窗 */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-md rounded-2xl p-6 max-h-[80vh] overflow-y-auto ${mode === 'dark' ? 'bg-gray-900 border border-white/10' : 'bg-white border border-sky-100'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-light ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>⚙️ 设置</h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className={`p-1 rounded-full ${mode === 'dark' ? 'text-white/50 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* 外观设置 */}
              <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                <h4 className={`text-sm font-medium mb-3 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>外观</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{mode === 'dark' ? '🌙' : '☀️'}</span>
                    <span className={mode === 'dark' ? 'text-white/70' : 'text-gray-600'}>深色模式</span>
                  </div>
                  <button
                    onClick={toggleMode}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      mode === 'dark' ? 'bg-sky-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
                      mode === 'dark' ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              {/* 功能设置 */}
              <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                <h4 className={`text-sm font-medium mb-3 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>功能</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🔔</span>
                      <span className={mode === 'dark' ? 'text-white/70' : 'text-gray-600'}>消息通知</span>
                    </div>
                    <button
                      onClick={() => setNotifications(!notifications)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        notifications 
                          ? mode === 'dark' ? 'bg-sky-500' : 'bg-sky-400'
                          : 'bg-gray-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
                        notifications ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💾</span>
                      <span className={mode === 'dark' ? 'text-white/70' : 'text-gray-600'}>自动保存</span>
                    </div>
                    <button
                      onClick={() => setAutoSave(!autoSave)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        autoSave 
                          ? mode === 'dark' ? 'bg-sky-500' : 'bg-sky-400'
                          : 'bg-gray-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
                        autoSave ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 关于 */}
              <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                <h4 className={`text-sm font-medium mb-3 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>关于</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={mode === 'dark' ? 'text-white/50' : 'text-gray-500'}>版本</span>
                    <span className={mode === 'dark' ? 'text-white/70' : 'text-gray-600'}>2.0.0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={mode === 'dark' ? 'text-white/50' : 'text-gray-500'}>开发者</span>
                    <span className={mode === 'dark' ? 'text-white/70' : 'text-gray-600'}>dreamlab</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSettingsModal(false)}
                className={`flex-1 py-3 rounded-xl border transition-colors ${mode === 'dark' ? 'border-white/20 text-white/70 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                取消
              </button>
              <button
                onClick={saveSettings}
                className={`flex-1 py-3 rounded-xl text-white hover:shadow-lg transition-all ${
                  mode === 'dark'
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 hover:shadow-purple-900/50'
                    : 'bg-gradient-to-r from-sky-400 to-blue-400'
                }`}
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 退出确认弹窗 */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl p-6 text-center ${mode === 'dark' ? 'bg-gray-900/95 border border-white/10' : 'bg-white/95 border border-sky-100 shadow-xl'}`}>
            {/* 图标 */}
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
              mode === 'dark' ? 'bg-sky-500/20' : 'bg-sky-100'
            }`}>
              <span className="text-3xl">👋</span>
            </div>
            
            {/* 标题 */}
            <h3 className={`text-xl font-medium mb-2 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              确定要退出吗？
            </h3>
            
            {/* 描述 */}
            <p className={`text-sm mb-6 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
              退出后需要重新登录才能使用完整功能
            </p>
            
            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  mode === 'dark' 
                    ? 'bg-white/10 text-white/80 hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                取消
              </button>
              <button
                onClick={confirmLogout}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  mode === 'dark'
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:shadow-lg'
                    : 'bg-gradient-to-r from-red-400 to-pink-400 text-white hover:shadow-lg'
                }`}
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SD API 配置弹窗 */}
</div>
  );
}
