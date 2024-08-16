/**
 * 
 * @param {string} dateStr 
 * @returns {Date}
 */
module.exports.localDateTimeToUTC = (dateStr) => {
  const date = new Date(dateStr);
  const timeZoneOffsetInMilliSeconds = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.valueOf() + timeZoneOffsetInMilliSeconds);
}
/**
 * 
 * @param {string} date 
 * @returns {Date}
 */
module.exports.dateToDateStr = (date) =>
  module.exports.localDateTimeToUTC(date).toISOString().replace(/\.000/, '');