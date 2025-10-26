import { test, expect } from '@playwright/test';

/**
 * Chrome DevTools 高级E2E测试
 *
 * 功能：
 * 1. 深度性能分析和优化建议
 * 2. 网络请求优化分析
 * 3. JavaScript执行性能监控
 * 4. 渲染性能检测
 * 5. 用户体验指标监控
 */

test.describe('Chrome DevTools 高级功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 增强的控制台监听
    page.on('console', msg => {
      const timestamp = new Date().toISOString();
      const logData = {
        timestamp,
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      };

      if (msg.type() === 'error') {
        console.error(`[${timestamp}] ERROR:`, msg.text(), msg.location());
      } else if (msg.type() === 'warning') {
        console.warn(`[${timestamp}] WARNING:`, msg.text());
      } else {
        console.log(`[${timestamp}] ${msg.type().toUpperCase()}:`, msg.text());
      }
    });

    // 监听未处理的Promise拒绝
    page.on('pageerror', error => {
      console.error('Page Error:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    });
  });

  test('JavaScript 执行性能分析', async ({ page }) => {
    await page.goto('/');

    // 启用JavaScript性能监控
    const jsPerformanceMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const metrics = {
          longTasks: [],
          functionCalls: [],
          scriptExecutionTime: 0,
          domOperations: 0
        };

        // 监控长任务
        if ('PerformanceObserver' in window) {
          const longTaskObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (entry.duration > 50) { // 长于50ms的任务
                metrics.longTasks.push({
                  name: entry.name,
                  startTime: entry.startTime,
                  duration: entry.duration,
                  attribution: entry.attribution
                });
              }
            });
          });

          try {
            longTaskObserver.observe({ entryTypes: ['longtask'] });
          } catch (e) {
            console.log('Long task observer not supported');
          }
        }

        // 监控函数执行时间
        const originalSetTimeout = window.setTimeout;
        const originalSetInterval = window.setInterval;
        const originalRequestAnimationFrame = window.requestAnimationFrame;

        window.setTimeout = function(callback, delay) {
          const start = performance.now();
          const timerId = originalSetTimeout.call(this, function() {
            const end = performance.now();
            metrics.functionCalls.push({
              type: 'setTimeout',
              delay,
              duration: end - start
            });
            return callback.apply(this, arguments);
          }, delay);
          return timerId;
        };

        window.setInterval = function(callback, interval) {
          const start = performance.now();
          const intervalId = originalSetInterval.call(this, function() {
            const end = performance.now();
            metrics.functionCalls.push({
              type: 'setInterval',
              interval,
              duration: end - start
            });
            return callback.apply(this, arguments);
          }, interval);
          return intervalId;
        };

        window.requestAnimationFrame = function(callback) {
          const start = performance.now();
          const frameId = originalRequestAnimationFrame.call(this, function(timestamp) {
            const end = performance.now();
            metrics.functionCalls.push({
              type: 'requestAnimationFrame',
              timestamp,
              duration: end - start
            });
            return callback.apply(this, arguments);
          });
          return frameId;
        };

        // 监控DOM操作
        const originalAppendChild = Element.prototype.appendChild;
        const originalRemoveChild = Element.prototype.removeChild;
        const originalSetAttribute = Element.prototype.setAttribute;

        Element.prototype.appendChild = function(node) {
          metrics.domOperations++;
          return originalAppendChild.call(this, node);
        };

        Element.prototype.removeChild = function(node) {
          metrics.domOperations++;
          return originalRemoveChild.call(this, node);
        };

        Element.prototype.setAttribute = function(name, value) {
          metrics.domOperations++;
          return originalSetAttribute.call(this, name, value);
        };

        // 执行一些测试操作
        setTimeout(() => {
          // 创建一些DOM元素
          for (let i = 0; i < 100; i++) {
            const div = document.createElement('div');
            div.textContent = `Test element ${i}`;
            div.setAttribute('data-test', 'true');
            document.body.appendChild(div);
          }

          // 移除这些元素
          setTimeout(() => {
            const elements = document.querySelectorAll('[data-test="true"]');
            elements.forEach(el => el.remove());

            // 恢复原始方法
            window.setTimeout = originalSetTimeout;
            window.setInterval = originalSetInterval;
            window.requestAnimationFrame = originalRequestAnimationFrame;
            Element.prototype.appendChild = originalAppendChild;
            Element.prototype.removeChild = originalRemoveChild;
            Element.prototype.setAttribute = originalSetAttribute;

            // 计算总脚本执行时间
          metrics.scriptExecutionTime = performance.now();

            resolve(metrics);
          }, 1000);
        }, 1000);
      });
    });

    console.log('=== JavaScript 执行性能分析 ===');
    console.log('长任务数量:', jsPerformanceMetrics.longTasks.length);
    console.log('函数调用数量:', jsPerformanceMetrics.functionCalls.length);
    console.log('DOM操作数量:', jsPerformanceMetrics.domOperations);
    console.log('脚本执行总时间:', jsPerformanceMetrics.scriptExecutionTime + 'ms');

    // 分析长任务
    if (jsPerformanceMetrics.longTasks.length > 0) {
      console.log('长任务详情:');
      jsPerformanceMetrics.longTasks.forEach((task, index) => {
        console.log(`  任务 ${index + 1}: ${task.name} - ${task.duration.toFixed(2)}ms`);
      });
    }

    // 分析函数调用
    const functionCallStats = {};
    jsPerformanceMetrics.functionCalls.forEach(call => {
      functionCallStats[call.type] = (functionCallStats[call.type] || 0) + 1;
    });
    console.log('函数调用统计:', functionCallStats);

    // 性能断言
    expect(jsPerformanceMetrics.longTasks.length).toBeLessThan(5); // 长任务不应超过5个
    expect(jsPerformanceMetrics.domOperations).toBeGreaterThan(0);
    expect(jsPerformanceMetrics.scriptExecutionTime).toBeGreaterThan(0);

    // 生成JavaScript性能报告
    const jsPerformanceReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      metrics: jsPerformanceMetrics,
      performanceGrade: {
        longTasks: jsPerformanceMetrics.longTasks.length === 0 ? 'A' :
                   jsPerformanceMetrics.longTasks.length <= 2 ? 'B' :
                   jsPerformanceMetrics.longTasks.length <= 5 ? 'C' : 'D',
        domOperations: jsPerformanceMetrics.domOperations < 1000 ? 'A' :
                      jsPerformanceMetrics.domOperations < 5000 ? 'B' : 'C'
      }
    };

    console.log('JavaScript性能报告:', JSON.stringify(jsPerformanceReport, null, 2));
  });

  test('渲染性能和布局分析', async ({ page }) => {
    await page.goto('/');

    // 等待页面完全加载
    await page.waitForLoadState('networkidle');

    const renderPerformanceMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const metrics = {
          layoutShifts: [],
          paintEvents: [],
          renderTime: 0,
          domSize: 0,
          reflowCount: 0,
          repaintCount: 0
        };

        // 监控布局偏移
        if ('PerformanceObserver' in window) {
          const layoutShiftObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (entry.hadRecentInput) {
                metrics.layoutShifts.push({
                  value: entry.value,
                  startTime: entry.startTime,
                  sources: entry.sources
                });
              }
            });
          });

          try {
            layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
          } catch (e) {
            console.log('Layout shift observer not supported');
          }

          // 监控绘制事件
          const paintObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              metrics.paintEvents.push({
                name: entry.name,
                startTime: entry.startTime,
                duration: entry.duration
              });
            });
          });

          try {
            paintObserver.observe({ entryTypes: ['paint'] });
          } catch (e) {
            console.log('Paint observer not supported');
          }
        }

        // 监控DOM大小变化
        const measureDOMSize = () => {
          metrics.domSize = document.documentElement.scrollWidth * document.documentElement.scrollHeight;
        };

        // 监控重排和重绘
        const originalOffsetHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'offsetHeight');
        const originalOffsetWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'offsetWidth');

        if (originalOffsetHeight && originalOffsetWidth) {
          Object.defineProperty(Element.prototype, 'offsetHeight', {
            get() {
              metrics.reflowCount++;
              return originalOffsetHeight.get.call(this);
            }
          });

          Object.defineProperty(Element.prototype, 'offsetWidth', {
            get() {
              metrics.reflowCount++;
              return originalOffsetWidth.get.call(this);
            }
          });
        }

        // 测量初始DOM大小
        measureDOMSize();

        // 模拟一些会导致重排的操作
        setTimeout(() => {
          // 改变元素样式
          const elements = document.querySelectorAll('div, section, article');
          for (let i = 0; i < Math.min(elements.length, 10); i++) {
            const element = elements[i];
            const originalHeight = element.offsetHeight;
            element.style.marginTop = '10px';
            const newHeight = element.offsetHeight;
            element.style.marginTop = '0px';
          }

          // 添加和移除元素
          const container = document.createElement('div');
          container.style.position = 'absolute';
          container.style.left = '-9999px';
          container.style.top = '-9999px';
          document.body.appendChild(container);

          for (let i = 0; i < 50; i++) {
            const div = document.createElement('div');
            div.textContent = `Test ${i}`;
            container.appendChild(div);
          }

          setTimeout(() => {
            container.remove();

            // 恢复原始属性
            if (originalOffsetHeight && originalOffsetWidth) {
              Object.defineProperty(Element.prototype, 'offsetHeight', originalOffsetHeight);
              Object.defineProperty(Element.prototype, 'offsetWidth', originalOffsetWidth);
            }

            // 最终测量
            measureDOMSize();
            metrics.renderTime = performance.now();

            resolve(metrics);
          }, 1000);
        }, 2000);
      });
    });

    console.log('=== 渲染性能和布局分析 ===');
    console.log('布局偏移数量:', renderPerformanceMetrics.layoutShifts.length);
    console.log('绘制事件数量:', renderPerformanceMetrics.paintEvents.length);
    console.log('重排次数:', renderPerformanceMetrics.reflowCount);
    console.log('重绘次数:', renderPerformanceMetrics.repaintCount);
    console.log('DOM大小:', renderPerformanceMetrics.domSize);
    console.log('渲染时间:', renderPerformanceMetrics.renderTime + 'ms');

    // 计算累积布局偏移 (CLS)
    const clsValue = renderPerformanceMetrics.layoutShifts.reduce((sum, shift) => sum + shift.value, 0);
    console.log('累积布局偏移 (CLS):', clsValue.toFixed(4));

    // 分析绘制事件
    if (renderPerformanceMetrics.paintEvents.length > 0) {
      console.log('绘制事件详情:');
      renderPerformanceMetrics.paintEvents.forEach(paint => {
        console.log(`  ${paint.name}: ${paint.startTime.toFixed(2)}ms (${paint.duration.toFixed(2)}ms)`);
      });
    }

    // 性能断言
    expect(clsValue).toBeLessThan(0.1); // CLS应该小于0.1
    expect(renderPerformanceMetrics.reflowCount).toBeLessThan(1000); // 重排次数应该合理
    expect(renderPerformanceMetrics.domSize).toBeGreaterThan(0);

    // 生成渲染性能报告
    const renderPerformanceReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      metrics: renderPerformanceMetrics,
      cls: clsValue,
      performanceGrade: {
        cls: clsValue < 0.025 ? 'A' : clsValue < 0.1 ? 'B' : clsValue < 0.25 ? 'C' : 'D',
        reflowCount: renderPerformanceMetrics.reflowCount < 100 ? 'A' :
                    renderPerformanceMetrics.reflowCount < 500 ? 'B' :
                    renderPerformanceMetrics.reflowCount < 1000 ? 'C' : 'D'
      },
      recommendations: []
    };

    // 添加优化建议
    if (clsValue > 0.1) {
      renderPerformanceReport.recommendations.push('考虑使用明确的尺寸和位置来减少布局偏移');
    }
    if (renderPerformanceMetrics.reflowCount > 500) {
      renderPerformanceReport.recommendations.push('减少DOM查询和样式修改以降低重排次数');
    }

    console.log('渲染性能报告:', JSON.stringify(renderPerformanceReport, null, 2));
  });

  test('网络性能优化分析', async ({ page }) => {
    const networkData = {
      requests: [],
      responses: [],
      timings: {},
      cacheAnalysis: {}
    };

    // 详细的网络监控
    page.on('request', request => {
      const requestData = {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        resourceType: request.resourceType(),
        timestamp: Date.now()
      };

      networkData.requests.push(requestData);
    });

    page.on('response', response => {
      const responseData = {
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        serverAddress: response.serverAddr(),
        securityDetails: response.securityDetails(),
        timestamp: Date.now()
      };

      networkData.responses.push(responseData);

      // 分析响应时间
      const matchingRequest = networkData.requests.find(req => req.url === response.url());
      if (matchingRequest) {
        const responseTime = responseData.timestamp - matchingRequest.timestamp;
        networkData.timings[response.url()] = responseTime;
      }
    });

    await page.goto('/');

    // 等待所有网络活动完成
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    console.log('=== 网络性能优化分析 ===');

    // 分析请求类型和大小
    const resourceAnalysis = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const analysis = {
        total: resources.length,
        totalSize: 0,
        categories: {
          javascript: { count: 0, size: 0 },
          css: { count: 0, size: 0 },
          images: { count: 0, size: 0 },
          fonts: { count: 0, size: 0 },
          api: { count: 0, size: 0 },
          other: { count: 0, size: 0 }
        },
        slowRequests: [],
        largeResources: [],
        cachedResources: 0
      };

      resources.forEach(resource => {
        const size = resource.transferSize || 0;
        analysis.totalSize += size;

        // 分类资源
        if (resource.name.endsWith('.js')) {
          analysis.categories.javascript.count++;
          analysis.categories.javascript.size += size;
        } else if (resource.name.endsWith('.css')) {
          analysis.categories.css.count++;
          analysis.categories.css.size += size;
        } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
          analysis.categories.images.count++;
          analysis.categories.images.size += size;
        } else if (resource.name.match(/\.(woff|woff2|ttf|eot)$/i)) {
          analysis.categories.fonts.count++;
          analysis.categories.fonts.size += size;
        } else if (resource.name.includes('api') || resource.name.includes('tcb-api')) {
          analysis.categories.api.count++;
          analysis.categories.api.size += size;
        } else {
          analysis.categories.other.count++;
          analysis.categories.other.size += size;
        }

        // 检查慢请求
        if (resource.duration > 2000) {
          analysis.slowRequests.push({
            url: resource.name,
            duration: resource.duration,
            size: size
          });
        }

        // 检查大资源
        if (size > 1024 * 1024) { // 大于1MB
          analysis.largeResources.push({
            url: resource.name,
            size: size
          });
        }

        // 检查缓存命中
        if (size === 0 && resource.transferSize !== undefined) {
          analysis.cachedResources++;
        }
      });

      return analysis;
    });

    console.log('资源分析结果:', resourceAnalysis);

    // 分析网络时间
    const networkTimingAnalysis = Object.entries(networkData.timings).map(([url, time]) => ({
      url,
      time,
      size: networkData.responses.find(r => r.url === url)?.headers['content-length'] || 0
    }));

    // 按时间排序
    networkTimingAnalysis.sort((a, b) => b.time - a.time);

    console.log('最慢的10个请求:');
    networkTimingAnalysis.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. ${item.url.split('/').pop()}: ${item.time}ms (${(item.size / 1024).toFixed(2)}KB)`);
    });

    // 生成优化建议
    const optimizationSuggestions = [];

    if (resourceAnalysis.slowRequests.length > 0) {
      optimizationSuggestions.push({
        type: 'performance',
        severity: 'high',
        description: `发现${resourceAnalysis.slowRequests.length}个慢请求，建议优化API响应时间`,
        details: resourceAnalysis.slowRequests.slice(0, 3)
      });
    }

    if (resourceAnalysis.largeResources.length > 0) {
      optimizationSuggestions.push({
        type: 'size',
        severity: 'medium',
        description: `发现${resourceAnalysis.largeResources.length}个大文件，建议压缩或拆分`,
        details: resourceAnalysis.largeResources.slice(0, 3)
      });
    }

    const totalSizeMB = resourceAnalysis.totalSize / (1024 * 1024);
    if (totalSizeMB > 5) {
      optimizationSuggestions.push({
        type: 'size',
        severity: 'high',
        description: `页面总大小${totalSizeMB.toFixed(2)}MB过大，建议优化资源加载`,
        details: { totalSize: totalSizeMB }
      });
    }

    if (resourceAnalysis.categories.javascript.size > 1024 * 1024) {
      optimizationSuggestions.push({
        type: 'javascript',
        severity: 'medium',
        description: 'JavaScript文件总大小过大，建议代码分割和tree-shaking',
        details: { jsSize: resourceAnalysis.categories.javascript.size }
      });
    }

    // 生成网络性能报告
    const networkPerformanceReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      summary: {
        totalRequests: resourceAnalysis.total,
        totalSize: resourceAnalysis.totalSize,
        totalSizeMB: (resourceAnalysis.totalSize / (1024 * 1024)).toFixed(2),
        cachedResources: resourceAnalysis.cachedResources,
        slowRequests: resourceAnalysis.slowRequests.length,
        largeResources: resourceAnalysis.largeResources.length
      },
      resourceBreakdown: resourceAnalysis.categories,
      slowRequests: resourceAnalysis.slowRequests,
      largeResources: resourceAnalysis.largeResources,
      optimizationSuggestions
    };

    console.log('网络性能报告:', JSON.stringify(networkPerformanceReport, null, 2));

    // 性能断言
    expect(totalSizeMB).toBeLessThan(10); // 页面总大小应小于10MB
    expect(resourceAnalysis.slowRequests.length).toBeLessThan(resourceAnalysis.total * 0.2); // 慢请求应少于20%
  });

  test('用户体验指标监控 (Core Web Vitals)', async ({ page }) => {
    await page.goto('/');

    // 等待页面完全加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const coreWebVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {
          // Largest Contentful Paint (LCP) - 最大内容绘制
          lcp: 0,
          // First Input Delay (FID) - 首次输入延迟
          fid: 0,
          // Cumulative Layout Shift (CLS) - 累积布局偏移
          cls: 0,
          // Time to First Byte (TTFB) - 首字节时间
          ttfb: 0,
          // First Contentful Paint (FCP) - 首次内容绘制
          fcp: 0
        };

        // 测量LCP
        if ('PerformanceObserver' in window) {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            vitals.lcp = lastEntry.startTime;
          });

          try {
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
          } catch (e) {
            console.log('LCP observer not supported');
          }

          // 测量FID
          const fidObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (entry.name === 'first-input') {
                vitals.fid = entry.processingStart - entry.startTime;
              }
            });
          });

          try {
            fidObserver.observe({ entryTypes: ['first-input'] });
          } catch (e) {
            console.log('FID observer not supported');
          }

          // 测量CLS
          const clsObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (!entry.hadRecentInput) {
                vitals.cls += entry.value;
              }
            });
          });

          try {
            clsObserver.observe({ entryTypes: ['layout-shift'] });
          } catch (e) {
            console.log('CLS observer not supported');
          }
        }

        // 测量TTFB
        const navigation = performance.getEntriesByType('navigation')[0];
        vitals.ttfb = navigation.responseStart - navigation.requestStart;

        // 测量FCP
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        vitals.fcp = fcpEntry ? fcpEntry.startTime : 0;

        // 模拟用户交互来触发FID测量
        setTimeout(() => {
          // 创建并点击一个按钮
          const button = document.createElement('button');
          button.textContent = 'Test Button';
          button.style.position = 'absolute';
          button.style.left = '-9999px';
          document.body.appendChild(button);

          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          button.dispatchEvent(clickEvent);

          setTimeout(() => {
            button.remove();

            // 获取额外的性能指标
            vitals.additionalMetrics = {
              domInteractive: navigation.domInteractive - navigation.navigationStart,
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
              memoryUsage: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize
              } : null
            };

            resolve(vitals);
          }, 2000);
        }, 1000);
      });
    });

    console.log('=== Core Web Vitals 用户体验指标 ===');
    console.log('LCP (最大内容绘制):', coreWebVitals.lcp.toFixed(2) + 'ms');
    console.log('FID (首次输入延迟):', coreWebVitals.fid.toFixed(2) + 'ms');
    console.log('CLS (累积布局偏移):', coreWebVitals.cls.toFixed(4));
    console.log('TTFB (首字节时间):', coreWebVitals.ttfb.toFixed(2) + 'ms');
    console.log('FCP (首次内容绘制):', coreWebVitals.fcp.toFixed(2) + 'ms');

    if (coreWebVitals.additionalMetrics) {
      console.log('额外指标:', coreWebVitals.additionalMetrics);
    }

    // 评估指标质量
    const vitalsAssessment = {
      lcp: {
        value: coreWebVitals.lcp,
        grade: coreWebVitals.lcp < 2500 ? 'good' : coreWebVitals.lcp < 4000 ? 'needs-improvement' : 'poor',
        recommendation: coreWebVitals.lcp > 2500 ? '优化服务器响应时间和资源加载' : '良好'
      },
      fid: {
        value: coreWebVitals.fid,
        grade: coreWebVitals.fid < 100 ? 'good' : coreWebVitals.fid < 300 ? 'needs-improvement' : 'poor',
        recommendation: coreWebVitals.fid > 100 ? '减少JavaScript执行时间和主线程阻塞' : '良好'
      },
      cls: {
        value: coreWebVitals.cls,
        grade: coreWebVitals.cls < 0.1 ? 'good' : coreWebVitals.cls < 0.25 ? 'needs-improvement' : 'poor',
        recommendation: coreWebVitals.cls > 0.1 ? '为图片和广告设置明确的尺寸以减少布局偏移' : '良好'
      },
      ttfb: {
        value: coreWebVitals.ttfb,
        grade: coreWebVitals.ttfb < 600 ? 'good' : coreWebVitals.ttfb < 1000 ? 'needs-improvement' : 'poor',
        recommendation: coreWebVitals.ttfb > 600 ? '优化服务器响应时间和使用CDN' : '良好'
      },
      fcp: {
        value: coreWebVitals.fcp,
        grade: coreWebVitals.fcp < 1800 ? 'good' : coreWebVitals.fcp < 3000 ? 'needs-improvement' : 'poor',
        recommendation: coreWebVitals.fcp > 1800 ? '减少关键资源大小和优化关键渲染路径' : '良好'
      }
    };

    console.log('Core Web Vitals 评估:', vitalsAssessment);

    // 性能断言
    expect(coreWebVitals.lcp).toBeLessThan(4000); // LCP应小于4秒
    expect(coreWebVitals.fid).toBeLessThan(300); // FID应小于300ms
    expect(coreWebVitals.cls).toBeLessThan(0.25); // CLS应小于0.25
    expect(coreWebVitals.ttfb).toBeLessThan(1000); // TTFB应小于1秒
    expect(coreWebVitals.fcp).toBeLessThan(3000); // FCP应小于3秒

    // 生成Core Web Vitals报告
    const coreWebVitalsReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      metrics: coreWebVitals,
      assessment: vitalsAssessment,
      overallGrade: Object.values(vitalsAssessment).filter(v => v.grade === 'good').length >= 3 ? 'good' :
                     Object.values(vitalsAssessment).filter(v => v.grade === 'poor').length >= 2 ? 'poor' : 'needs-improvement'
    };

    console.log('Core Web Vitals 完整报告:', JSON.stringify(coreWebVitalsReport, null, 2));
  });
});