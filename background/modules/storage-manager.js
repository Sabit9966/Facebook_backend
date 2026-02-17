/**
 * Storage Manager
 * Manages persistent storage using chrome.storage.local
 */

import { Logger } from './logger.js';

const logger = new Logger('StorageManager');

/**
 * Storage Manager Class
 */
export class StorageManager {
  constructor() {
    this.storage = chrome.storage.local;
  }

  /**
   * Initialize storage
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      const data = await this.storage.get(null);
      logger.debug('Storage initialized', { keys: Object.keys(data).length });
    } catch (error) {
      logger.error('Failed to initialize storage', { error });
      throw error;
    }
  }

  /**
   * Get value from storage
   * @param {string} key - Storage key
   * @returns {Promise<*>} Stored value
   */
  async get(key) {
    try {
      if (!key || typeof key !== 'string') {
        throw new Error('Invalid key: must be a non-empty string');
      }

      const result = await this.storage.get(key);
      return result[key];
    } catch (error) {
      logger.error('Failed to get from storage', { error, key });
      throw error;
    }
  }

  /**
   * Set value in storage
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    try {
      if (!key || typeof key !== 'string') {
        throw new Error('Invalid key: must be a non-empty string');
      }

      await this.storage.set({ [key]: value });
      logger.debug('Storage set', { key });
    } catch (error) {
      logger.error('Failed to set storage', { error, key });
      throw error;
    }
  }

  /**
   * Remove value from storage
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      if (!key || typeof key !== 'string') {
        throw new Error('Invalid key: must be a non-empty string');
      }

      await this.storage.remove(key);
      logger.debug('Storage removed', { key });
    } catch (error) {
      logger.error('Failed to remove from storage', { error, key });
      throw error;
    }
  }

  /**
   * Clear all storage
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      await this.storage.clear();
      logger.debug('Storage cleared');
    } catch (error) {
      logger.error('Failed to clear storage', { error });
      throw error;
    }
  }

  /**
   * Get all storage data
   * @returns {Promise<Object>} All stored data
   */
  async getAll() {
    try {
      return await this.storage.get(null);
    } catch (error) {
      logger.error('Failed to get all storage', { error });
      throw error;
    }
  }

  /**
   * Get multiple keys from storage
   * @param {string[]} keys - Array of keys
   * @returns {Promise<Object>} Object with key-value pairs
   */
  async getMultiple(keys) {
    try {
      if (!Array.isArray(keys)) {
        throw new Error('Keys must be an array');
      }

      return await this.storage.get(keys);
    } catch (error) {
      logger.error('Failed to get multiple from storage', { error, keys });
      throw error;
    }
  }

  /**
   * Set multiple key-value pairs
   * @param {Object} items - Object with key-value pairs
   * @returns {Promise<void>}
   */
  async setMultiple(items) {
    try {
      if (!items || typeof items !== 'object') {
        throw new Error('Items must be an object');
      }

      await this.storage.set(items);
      logger.debug('Storage set multiple', { keys: Object.keys(items) });
    } catch (error) {
      logger.error('Failed to set multiple in storage', { error });
      throw error;
    }
  }
}
