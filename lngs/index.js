import { ru } from './ru.js';
import { en } from './en.js';

export const lngs = { ru, en };

/**
 * Translation helper function
 * @param {Object} state - User state object containing lng property
 * @param {string} key - Translation key in dot notation (e.g., 'menu.main_title')
 * @param {Object|Array} params - Parameters to pass to translation function or replace in string
 * @returns {string|Function} - Translated string or original key if not found
 */
export function t(state, key, params = {}) {
  const lng = state?.lng || 'en';
  const keys = key.split('.');
  let value = lngs[lng];
  
  // Navigate through the nested object
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }
  
  // Fallback to English if translation not found
  if (value === undefined && lng !== 'en') {
    value = lngs.en;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
  }
  
  // If value is a function, call it with params
  if (typeof value === 'function') {
    // Handle both object params and array params
    if (Array.isArray(params)) {
      return value(...params);
    }
    return value(params);
  }
  
  // Return the value or the key if not found
  return value !== undefined ? value : key;
}
