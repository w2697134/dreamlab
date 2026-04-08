'use client';

import { ReactNode, useState, useEffect } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { ToastProvider } from '@/components/Toast';
import { DraggableButtonProvider } from '@/components/ui/DraggableButtonContext';
import { DreamStateProvider } from '@/components/DreamStateProvider';
import { GenerationProvider } from '@/components/GenerationProvider';
import { NavigationProvider } from '@/components/NavigationProvider';

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <GenerationProvider>
            <DreamStateProvider>
              <NavigationProvider>
                <DraggableButtonProvider>
                  {children}
                </DraggableButtonProvider>
              </NavigationProvider>
            </DreamStateProvider>
          </GenerationProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
