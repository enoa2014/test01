/* eslint-disable no-console */
/**
 * 简易日志工具，集中处理所有日志输出，避免直接使用 console.
 */
const PERFORMANCE_CONFIG = require('../config/performance-config');

const loggingConfig =
  PERFORMANCE_CONFIG &&
  PERFORMANCE_CONFIG.MONITORING &&
  PERFORMANCE_CONFIG.MONITORING.LOGGING
    ? PERFORMANCE_CONFIG.MONITORING.LOGGING
    : {};
const isLoggingEnabled = typeof loggingConfig.ENABLED === 'boolean' ? loggingConfig.ENABLED : true;

function createLoggerMethod(method) {
  return (...args) => {
    if (!isLoggingEnabled || typeof console === 'undefined') return;
    const fn = console[method] || console.log;
    fn.apply(console, args);
  };
}

module.exports = {
  info: createLoggerMethod('log'),
  warn: createLoggerMethod('warn'),
  error: createLoggerMethod('error'),
  debug: createLoggerMethod('debug'),
};
