'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Position {
  x: number;
  y: number;
}

interface DraggableButtonContextType {
  position: Position;
  setPosition: (pos: Position) => void;
}

const DraggableButtonContext = createContext<DraggableButtonContextType | null>(null);

export function DraggableButtonProvider({ children }: { children: ReactNode }) {
  // 从 localStorage 读取初始位置
  const [position, setPositionState] = useState<Position>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('draggableFixButtonPosition');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return { x: 24, y: 24 };
  });

  const setPosition = useCallback((pos: Position) => {
    setPositionState(pos);
    if (typeof window !== 'undefined') {
      localStorage.setItem('draggableFixButtonPosition', JSON.stringify(pos));
    }
  }, []);

  return (
    <DraggableButtonContext.Provider value={{ position, setPosition }}>
      {children}
    </DraggableButtonContext.Provider>
  );
}

export function useDraggableButton() {
  const context = useContext(DraggableButtonContext);
  if (!context) {
    throw new Error('useDraggableButton must be used within DraggableButtonProvider');
  }
  return context;
}
