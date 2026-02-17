/**
 * Permission Manager
 * Manages extension permissions
 */

import { Logger } from './logger.js';

const logger = new Logger('PermissionManager');

/**
 * Permission Manager Class
 */
export class PermissionManager {
  /**
   * Request permissions
   * @param {Object} permissions - Permissions object
   * @param {string[]} permissions.permissions - Permission strings
   * @param {string[]} permissions.origins - Origin patterns
   * @returns {Promise<boolean>} True if granted
   */
  async requestPermissions(permissions) {
    try {
      if (!permissions || typeof permissions !== 'object') {
        throw new Error('Invalid permissions object');
      }

      const result = await chrome.permissions.request(permissions);
      logger.debug('Permission request result', { permissions, granted: result });
      return result;
    } catch (error) {
      logger.error('Failed to request permissions', { error, permissions });
      throw error;
    }
  }

  /**
   * Check if permissions are granted
   * @param {Object} permissions - Permissions object
   * @param {string[]} permissions.permissions - Permission strings
   * @param {string[]} permissions.origins - Origin patterns
   * @returns {Promise<boolean>} True if granted
   */
  async hasPermissions(permissions) {
    try {
      if (!permissions || typeof permissions !== 'object') {
        throw new Error('Invalid permissions object');
      }

      return await chrome.permissions.contains(permissions);
    } catch (error) {
      logger.error('Failed to check permissions', { error, permissions });
      throw error;
    }
  }

  /**
   * Remove permissions
   * @param {Object} permissions - Permissions object
   * @param {string[]} permissions.permissions - Permission strings
   * @param {string[]} permissions.origins - Origin patterns
   * @returns {Promise<boolean>} True if removed
   */
  async removePermissions(permissions) {
    try {
      if (!permissions || typeof permissions !== 'object') {
        throw new Error('Invalid permissions object');
      }

      const result = await chrome.permissions.remove(permissions);
      logger.debug('Permission removal result', { permissions, removed: result });
      return result;
    } catch (error) {
      logger.error('Failed to remove permissions', { error, permissions });
      throw error;
    }
  }

  /**
   * Get all permissions
   * @returns {Promise<Object>} All permissions
   */
  async getAllPermissions() {
    try {
      return await chrome.permissions.getAll();
    } catch (error) {
      logger.error('Failed to get all permissions', { error });
      throw error;
    }
  }
}
