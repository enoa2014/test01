import React from 'react';

interface OptimizedLoadingProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'spinner' | 'skeleton';
}

/**
 * 优化的加载组件 - 提供更好的用户体验
 * 支持骨架屏和加载动画两种模式
 */
export const OptimizedLoading: React.FC<OptimizedLoadingProps> = ({
  message = '加载中...',
  size = 'medium',
  variant = 'spinner'
}) => {
  if (variant === 'skeleton') {
    return <SkeletonLoader size={size} />;
  }

  return <SpinnerLoading message={message} size={size} />;
};

interface SpinnerLoadingProps {
  message: string;
  size: 'small' | 'medium' | 'large';
}

const SpinnerLoading: React.FC<SpinnerLoadingProps> = ({ message, size }) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  const textSizes = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg'
  };

  return (
    <div className="loading">
      <div
        className={`loading-spinner ${sizeClasses[size]}`}
        role="status"
        aria-label="loading"
      />
      <span className={`ml-2 ${textSizes[size]}`}>{message}</span>
    </div>
  );
};

interface SkeletonLoaderProps {
  size: 'small' | 'medium' | 'large';
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ size }) => {
  const heights = {
    small: 'h-4',
    medium: 'h-6',
    large: 'h-8'
  };

  return (
    <div className="animate-pulse">
      <div className="flex space-x-4">
        <div className={`skeleton ${heights[size]} rounded w-3/4`}></div>
      </div>
      <div className="flex space-x-4 mt-3">
        <div className={`skeleton ${heights[size]} rounded w-1/2`}></div>
      </div>
      <div className="flex space-x-4 mt-3">
        <div className={`skeleton ${heights[size]} rounded w-5/6`}></div>
      </div>
    </div>
  );
};

/**
 * 页面级骨架屏组件
 */
export const PageSkeleton: React.FC = () => {
  return (
    <div className="admin-layout">
      {/* 侧边栏骨架 */}
      <div className="skeleton skeleton-sidebar">
        <div className="p-4 space-y-4">
          <div className="skeleton h-8 w-3/4 rounded"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-4 w-full rounded"></div>
            ))}
          </div>
        </div>
      </div>

      {/* 主内容区骨架 */}
      <div className="admin-content">
        {/* 头部骨架 */}
        <div className="skeleton skeleton-header">
          <div className="flex items-center justify-between h-full px-6">
            <div className="skeleton h-6 w-48 rounded"></div>
            <div className="flex items-center space-x-4">
              <div className="skeleton h-8 w-8 rounded-full"></div>
              <div className="skeleton h-4 w-24 rounded"></div>
            </div>
          </div>
        </div>

        {/* 内容骨架 */}
        <div className="p-6 space-y-6">
          <div className="card">
            <div className="card-header">
              <div className="skeleton h-6 w-32 rounded"></div>
              <div className="skeleton h-8 w-20 rounded"></div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-lg">
                    <div className="skeleton h-4 w-16 rounded mb-2"></div>
                    <div className="skeleton h-8 w-12 rounded"></div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton h-4 w-full rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 表格骨架屏组件
 */
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="overflow-hidden">
      <div className="border border-gray-200 rounded-lg">
        {/* 表头骨架 */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-4 w-20 rounded"></div>
            ))}
          </div>
        </div>

        {/* 表格行骨架 */}
        <div className="divide-y divide-gray-200">
          {[...Array(rows)].map((_, rowIndex) => (
            <div key={rowIndex} className="px-6 py-4">
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, colIndex) => (
                  <div key={colIndex} className="skeleton h-4 w-full rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OptimizedLoading;