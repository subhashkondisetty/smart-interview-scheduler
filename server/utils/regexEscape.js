/**
 * Utility to escape regular expression special characters in user input.
 * Prevents Regular Expression Denial of Service (ReDoS) and ensures
 * queries with symbols (e.g. 'C++', '(Node.js)', 'test+foo@bar.com')
 * are evaluated strictly as literal substrings.
 *
 * Special characters escaped: . * + ? ^ $ { } ( ) | [ ] \
 *
 * @param {string} str - Raw user input string
 * @returns {string} Sanitized, regex-escaped string
 */
function escapeRegex(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  escapeRegex,
};
