'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, MouseEvent, CSSProperties } from 'react';

interface OptimizedLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  onMouseEnter?: (e: MouseEvent<HTMLAnchorElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

export default function OptimizedLink({ 
  href, 
  children, 
  className = '',
  style,
  onClick,
  onMouseEnter,
  onMouseLeave
}: OptimizedLinkProps) {
  const router = useRouter();

  const handleMouseEnter = () => {
    // 鼠标悬停时预加载页面
    router.prefetch(href);
  };

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <Link 
      href={href} 
      className={className}
      style={style}
      onMouseEnter={(e) => {
        handleMouseEnter();
        onMouseEnter?.(e);
      }}
      onMouseLeave={onMouseLeave}
      onClick={handleClick}
      prefetch={true}
    >
      {children}
    </Link>
  );
}
