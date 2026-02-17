/**
 * Message Handler
 * Validates and routes messages between extension components
 */

import { Logger } from './logger.js';
import { MessageValidator } from './message-validator.js';

const logger = new Logger('MessageHandler');

/**
 * Valid message types
 */
const MESSAGE_TYPES = {
  AUTOMATION_EXECUTE: 'AUTOMATION_EXECUTE',
  AUTOMATION_RESULT: 'AUTOMATION_RESULT',
  STORAGE_GET: 'STORAGE_GET',
  STORAGE_SET: 'STORAGE_SET',
  STORAGE_REMOVE: 'STORAGE_REMOVE',
  TAB_CREATE: 'TAB_CREATE',
  TAB_UPDATE: 'TAB_UPDATE',
  TAB_CLOSE: 'TAB_CLOSE',
  PERMISSION_REQUEST: 'PERMISSION_REQUEST',
  LOG: 'LOG'
};

/**
 * Message Handler Class
 */
export class MessageHandler {
  constructor() {
    this.validator = new MessageValidator();
    this.handlers = new Map();
    this.setupHandlers();
  }

  /**
   * Setup message handlers
   */
  setupHandlers() {
    this.handlers.set(MESSAGE_TYPES.AUTOMATION_EXECUTE, this.handleAutomationExecute.bind(this));
    this.handlers.set(MESSAGE_TYPES.STORAGE_GET, this.handleStorageGet.bind(this));
    this.handlers.set(MESSAGE_TYPES.STORAGE_SET, this.handleStorageSet.bind(this));
    this.handlers.set(MESSAGE_TYPES.STORAGE_REMOVE, this.handleStorageRemove.bind(this));
    this.handlers.set(MESSAGE_TYPES.TAB_CREATE, this.handleTabCreate.bind(this));
    this.handlers.set(MESSAGE_TYPES.TAB_CLOSE, this.handleTabClose.bind(this));
    this.handlers.set(MESSAGE_TYPES.PERMISSION_REQUEST, this.handlePermissionRequest.bind(this));
    this.handlers.set(MESSAGE_TYPES.LOG, this.handleLog.bind(this));
  }

  /**
   * Handle incoming message
   * @param {Object} message - Message object
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @param {Function} sendResponse - Response callback
   */
  async handle(message, sender, sendResponse) {
    try {
      if (!this.validator.validate(message)) {
        logger.warn('Invalid message received', { message, sender });
        sendResponse({ success: false, error: 'Invalid message format' });
        return;
      }

      const handler = this.handlers.get(message.type);
      if (!handler) {
        logger.warn('Unknown message type', { type: message.type });
        sendResponse({ success: false, error: 'Unknown message type' });
        return;
      }

      const result = await handler(message, sender);
      sendResponse({ success: true, data: result });
    } catch (error) {
      logger.error('Error handling message', { error, message });
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle automation execution request
   * @param {Object} message - Message object
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @returns {Promise<Object>} Execution result
   */
  async handleAutomationExecute(message, sender) {
    const { tabId, script, options } = message.payload;
    
    if (!tabId || !script) {
      throw new Error('Missing required parameters: tabId and script');
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        files: ['injected/automation.js']
      });

      const response = await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.AUTOMATION_EXECUTE,
        payload: { script, options }
      });

      return response;
    } catch (error) {
      logger.error('Automation execution failed', { error, tabId });
      throw error;
    }
  }

  /**
   * Handle storage get request
   * @param {Object} message - Message object
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @returns {Promise<*>} Stored value
   */
  async handleStorageGet(message, sender) {
    const { StorageManager } = await import('./storage-manager.js');
    const storageManager = new StorageManager();
    return await storageManager.get(message.payload.key);
  }

  /**
   * Handle storage set request
   * @param {Object} message - Message object
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @returns {Promise<void>}
   */
  async handleStorageSet(message, sender) {
    const { StorageManager } = await import('./storage-manager.js');
    const storageManager = new StorageManager();
    return await storageManager.set(message.payload.key, message.payload.value);
  }

  /**
   * Handle storage remove request
   * @param {Object} message - Message object
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @returns {Promise<void>}
   */
  async handleStorageRemove(message, sender) {
    const { StorageManager } = await import('./storage-manager.js');
    const storageManager = new StorageManager();
    return await storageManager.remove(message.payload.key);
  }

  /**
   * Handle tab create request
   * @param {Object} message - Message object
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @returns {Promise<chrome.tabs.Tab>} Created tab
   */
  async handleTabCreate(message, sender) {
    const { TabManager } = await import('./tab-manager.js');
    const tabManager = new TabManager();
    return await tabManager.createTab(message.payload.url, message.payload.options);
  }

  /**
   * Handle tab close request
   * @param {Object} message - Message object
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @returns {Promise<void>}
   */
  async handleTabClose(message, sender) {
    const { TabManager } = await import('./tab-manager.js');
    const tabManager = new TabManager();
    return await tabManager.closeTab(message.payload.tabId);
  }

  /**
   * Handle permission request
   * @param {Object} message - Message object
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @returns {Promise<boolean>} Permission granted status
   */
  async handlePermissionRequest(message, sender) {
    const { PermissionManager } = await import('./permission-manager.js');
    const permissionManager = new PermissionManager();
    return await permissionManager.requestPermissions(message.payload.permissions);
  }

  /**
   * Handle log message
   * @param {Object} message - Message object
   * @param {chrome.runtime.MessageSender} sender - Message sender
   * @returns {Promise<void>}
   */
  async handleLog(message, sender) {
    const { level, message: logMessage, data } = message.payload;
    logger.log(level, logMessage, data);
  }
}
