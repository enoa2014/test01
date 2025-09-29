function _type_of(obj) {
  return obj && typeof Symbol === 'function' && obj.constructor === Symbol ? 'symbol' : typeof obj;
}
module.exports = _type_of;
module.exports.default = _type_of;
