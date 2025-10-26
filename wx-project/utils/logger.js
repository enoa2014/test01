/* eslint-disable no-console */
/* global __wxConfig */
const isDevelopment =
  typeof __wxConfig !== 'undefined' ? __wxConfig.envVersion !== 'release' : true;

function debug(...args) {
  if (isDevelopment) {
    console.log(...args);
  }
}

function info(...args) {
  if (isDevelopment) {
    console.info(...args);
  }
}

function warn(...args) {
  if (isDevelopment) {
    console.warn(...args);
  }
}

function error(...args) {
  console.error(...args);
}

module.exports = {
  debug,
  info,
  warn,
  error,
};
