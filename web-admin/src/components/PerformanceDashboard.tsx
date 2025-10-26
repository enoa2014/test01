import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface PerformanceMetrics {
  timestamp: string;
  fcp: number;
  ttfb: number;
  cls: number;
  lcp: number;
  fid: number;
  memory: number;
  score: number;
  grade: string;
}

interface PerformanceDashboardProps {
  testResults?: PerformanceMetrics[];
  isLive?: boolean;
}

/**
 * 性能监控仪表板组件
 *
 * 功能：
 * - 显示实时性能指标
 * - 展示历史趋势
 * - 提供性能等级评定
 * - 支持实时监控模式
 */
export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  testResults = [],
  isLive = false
}) => {
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (isLive && !isMonitoring) {
      setIsMonitoring(true);
      startRealTimeMonitoring();
    }
  }, [isLive, isMonitoring]);

  const startRealTimeMonitoring = () => {
    // 模拟实时性能监控
    const collectMetrics = () => {
      if (typeof window !== 'undefined' && 'performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint') as PerformancePaintTiming[];

        const metrics: PerformanceMetrics = {
          timestamp: new Date().toISOString(),
          fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          ttfb: navigation.responseStart - navigation.requestStart,
          cls: 0, // 需要专门的CLS计算
          lcp: 0, // 需要专门的LCP计算
          fid: 0, // 需要用户交互才能测量
          memory: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0,
          score: 0,
          grade: 'A'
        };

        // 计算分数
        const fcpScore = metrics.fcp < 1800 ? 100 : metrics.fcp < 2500 ? 80 : 60;
        const ttfbScore = metrics.ttfb < 600 ? 100 : metrics.ttfb < 1000 ? 80 : 60;
        const memoryScore = metrics.memory < 50 ? 100 : metrics.memory < 100 ? 80 : 60;

        metrics.score = Math.round((fcpScore + ttfbScore + memoryScore) / 3);
        metrics.grade = metrics.score >= 90 ? 'A' : metrics.score >= 80 ? 'B' : metrics.score >= 70 ? 'C' : metrics.score >= 60 ? 'D' : 'F';

        setCurrentMetrics(metrics);
      }
    };

    collectMetrics();
    const interval = setInterval(collectMetrics, 5000); // 每5秒更新一次

    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'F': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatMetric = (value: number, unit: string) => {
    return `${value.toFixed(value < 10 ? 1 : 0)}${unit}`;
  };

  const latestMetrics = testResults.length > 0 ? testResults[testResults.length - 1] : currentMetrics;

  return (
    <div className="space-y-6 p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">性能监控仪表板</h2>
          <p className="text-gray-600 mt-1">
            {isLive ? '实时监控中...' : '基于测试数据'}
          </p>
        </div>
        {latestMetrics && (
          <div className={`px-4 py-2 rounded-full ${getGradeColor(latestMetrics.grade)}`}>
            <span className="font-semibold text-lg">综合评级: {latestMetrics.grade}</span>
          </div>
        )}
      </div>

      {/* 综合评分卡片 */}
      {latestMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>综合性能评分</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className={`text-6xl font-bold ${getScoreColor(latestMetrics.score)}`}>
                  {latestMetrics.score}
                </div>
                <div className="text-gray-600 mt-2">满分 100</div>
                <div className={`mt-2 px-3 py-1 rounded-full ${getGradeColor(latestMetrics.grade)} inline-block`}>
                  {latestMetrics.grade} 级
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Core Web Vitals 指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {latestMetrics && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">FCP</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatMetric(latestMetrics.fcp, 'ms')}
                </div>
                <div className="text-xs text-gray-600 mt-1">首次内容绘制</div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min((latestMetrics.fcp / 3000) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">TTFB</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatMetric(latestMetrics.ttfb, 'ms')}
                </div>
                <div className="text-xs text-gray-600 mt-1">首字节时间</div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min((latestMetrics.ttfb / 1000) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">内存使用</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatMetric(latestMetrics.memory, 'MB')}
                </div>
                <div className="text-xs text-gray-600 mt-1">JS堆内存</div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${Math.min((latestMetrics.memory / 100) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">CLS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatMetric(latestMetrics.cls, '')}
                </div>
                <div className="text-xs text-gray-600 mt-1">累积布局偏移</div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-600 h-2 rounded-full"
                    style={{ width: `${Math.min((latestMetrics.cls / 0.25) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 性能建议 */}
      <Card>
        <CardHeader>
          <CardTitle>性能优化建议</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {latestMetrics && (
              <>
                {latestMetrics.fcp > 2500 && (
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">优化FCP</div>
                      <div className="text-sm text-gray-600">
                        考虑减少关键资源大小，优化服务器响应时间
                      </div>
                    </div>
                  </div>
                )}

                {latestMetrics.ttfb > 1000 && (
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">优化TTFB</div>
                      <div className="text-sm text-gray-600">
                        使用CDN，优化服务器配置，减少网络延迟
                      </div>
                    </div>
                  </div>
                )}

                {latestMetrics.memory > 50 && (
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium">优化内存使用</div>
                      <div className="text-sm text-gray-600">
                        检查内存泄漏，优化数据结构，减少不必要的对象创建
                      </div>
                    </div>
                  </div>
                )}

                {latestMetrics.fcp <= 2500 && latestMetrics.ttfb <= 1000 && latestMetrics.memory <= 50 && (
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <div className="font-medium text-green-700">性能表现优秀</div>
                      <div className="text-sm text-gray-600">
                        所有核心指标都在良好范围内，继续保持！
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 历史趋势 */}
      {testResults.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>性能趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>综合评分趋势</span>
                  <span>最近 {testResults.length} 次测试</span>
                </div>
                <div className="flex items-end space-x-2 h-20">
                  {testResults.slice(-10).map((metric, index) => (
                    <div
                      key={index}
                      className={`flex-1 ${getScoreColor(metric.score)} bg-current rounded-t`}
                      style={{ height: `${(metric.score / 100) * 80}px` }}
                      title={`分数: ${metric.score} (${new Date(metric.timestamp).toLocaleTimeString()})`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 实时监控状态 */}
      {isLive && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-medium">实时监控中</span>
              </div>
              <div className="text-sm text-gray-600">
                最后更新: {latestMetrics ? new Date(latestMetrics.timestamp).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// UI组件的简化实现（如果没有现有的）
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <div className={`bg-white rounded-lg shadow-md ${className}`}>
    {children}
  </div>
);

const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
    {children}
  </div>
);

const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <div className={`px-6 py-4 ${className}`}>
    {children}
  </div>
);

const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
    {children}
  </h3>
);

export default PerformanceDashboard;