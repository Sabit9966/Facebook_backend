/**
 * Tab Manager
 * Manages browser tabs and tab-related operations
 */

import { Logger } from './logger.js';

const logger = new Logger('TabManager');

/**
 * Tab Manager Class
 */
export class TabManager {
  constructor() {
    this.activeTabs = new Map();
  }

  /**
   * Create a new tab
   * @param {string} url - URL to open
   * @param {Object} options - Tab options
   * @returns {Promise<chrome.tabs.Tab>} Created tab
   */
  async createTab(url, options = {}) {
    try {
      const tab = await chrome.tabs.create({
        url,
        active: options.active !== false,
        ...options
      });

      this.activeTabs.set(tab.id, tab);
      logger.debug('Tab created', { tabId: tab.id, url });
      return tab;
    } catch (error) {
      logger.error('Failed to create tab', { error, url });
      throw error;
    }
  }

  /**
   * Close a tab
   * @param {number} tabId - Tab ID to close
   * @returns {Promise<void>}
   */
  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      this.activeTabs.delete(tabId);
      logger.debug('Tab closed', { tabId });
    } catch (error) {
      logger.error('Failed to close tab', { error, tabId });
      throw error;
    }
  }

  /**
   * Get tab information
   * @param {number} tabId - Tab ID
   * @returns {Promise<chrome.tabs.Tab>} Tab information
   */
  async getTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      this.activeTabs.set(tabId, tab);
      return tab;
    } catch (error) {
      logger.error('Failed to get tab', { error, tabId });
      throw error;
    }
  }

  /**
   * Update tab
   * @param {number} tabId - Tab ID
   * @param {Object} updateProperties - Properties to update
   * @returns {Promise<chrome.tabs.Tab>} Updated tab
   */
  async updateTab(tabId, updateProperties) {
    try {
      const tab = await chrome.tabs.update(tabId, updateProperties);
      this.activeTabs.set(tabId, tab);
      logger.debug('Tab updated', { tabId, properties: updateProperties });
      return tab;
    } catch (error) {
      logger.error('Failed to update tab', { error, tabId });
      throw error;
    }
  }

  /**
   * Query tabs
   * @param {Object} queryInfo - Query parameters
   * @returns {Promise<chrome.tabs.Tab[]>} Matching tabs
   */
  async queryTabs(queryInfo) {
    try {
      return await chrome.tabs.query(queryInfo);
    } catch (error) {
      logger.error('Failed to query tabs', { error, queryInfo });
      throw error;
    }
  }

  /**
   * Handle tab update event
   * @param {number} tabId - Tab ID
   * @param {chrome.tabs.Tab} tab - Tab information
   */
  handleTabUpdate(tabId, tab) {
    this.activeTabs.set(tabId, tab);
  }

  /**
   * Handle tab removal event
   * @param {number} tabId - Tab ID
   */
  handleTabRemoved(tabId) {
    this.activeTabs.delete(tabId);
  }

  /**
   * Get active tab
   * @returns {Promise<chrome.tabs.Tab>} Active tab
   */
  async getActiveTab() {
    const tabs = await this.queryTabs({ active: true, currentWindow: true });
    return tabs[0] || null;
  }
}
