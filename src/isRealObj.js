/** Gets if the given object is an object (and not Array or Date or null). */
const isRealObj = obj => obj && typeof obj === 'object' && !(obj instanceof Date) && !Array.isArray(obj);

module.exports = isRealObj;