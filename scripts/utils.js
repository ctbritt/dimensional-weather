/**
 * Dimensional Weather - Utilities
 * Shared utility functions for the Dimensional Weather module
 */

export class ErrorHandler {
  /**
   * Handle fetch requests with standardized error handling
   * @param {string} url - URL to fetch
   * @param {string} errorMessage - User-friendly error message
   * @returns {Promise<Object|null>} - Parsed JSON response or null on error
   */
  static async handleFetch(url, errorMessage) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed with status ${response.status}: ${response.statusText}`
        );
      }
      return await response.json();
    } catch (error) {
      this.logAndNotify(errorMessage, error);
      return null;
    }
  }

  /**
   * Log error and show notification
   * @param {string} message - User-friendly message
   * @param {Error} error - Error object
   * @param {boolean} isWarning - Whether to show as warning instead of error
   */
  static logAndNotify(message, error, isWarning = false) {
    console[isWarning ? "warn" : "error"](
      `Dimensional Weather | ${message}`,
      error
    );
    if (ui.notifications) {
      ui.notifications[isWarning ? "warn" : "error"](message);
    }
  }
}

export class Cache {
  static _cache = new Map();

  /**
   * Get an item from cache, or fetch and store it
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to call if item not in cache
   * @returns {Promise<any>} - Cached or fetched value
   */
  static async getOrFetch(key, fetchFn) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }

    const data = await fetchFn();
    if (data) {
      this._cache.set(key, data);
    }
    return data;
  }

  /**
   * Set a value in the cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  static set(key, value) {
    this._cache.set(key, value);
  }

  /**
   * Clear all cached values
   */
  static clear() {
    this._cache.clear();
  }
}

/**
 * Batch updates to avoid multiple renders
 */
export class BatchUpdater {
  static pendingUpdates = new Map();
  static updateTimers = new Map();

  /**
   * Schedule an update to be executed after a delay
   * @param {string} id - Unique identifier for this update
   * @param {Function} updateFn - Function to execute for the update
   * @param {number} delay - Delay in ms before executing (defaults to 100ms)
   */
  static scheduleUpdate(id, updateFn, delay = 100) {
    // If a timer already exists for this ID, clear it
    if (this.updateTimers.has(id)) {
      clearTimeout(this.updateTimers.get(id));
    }

    // Store the update function
    this.pendingUpdates.set(id, updateFn);

    // Set a new timer
    const timerId = setTimeout(() => {
      if (this.pendingUpdates.has(id)) {
        const fn = this.pendingUpdates.get(id);
        this.pendingUpdates.delete(id);
        this.updateTimers.delete(id);
        fn();
      }
    }, delay);

    this.updateTimers.set(id, timerId);
  }
}

export class DOMUtils {
  /**
   * Create or update a style element
   * @param {string} id - ID for the style element
   * @param {string} cssText - CSS text content
   */
  static updateStyleElement(id, cssText) {
    let styleElement = document.getElementById(id);

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = id;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = cssText;
  }
}

/**
 * Utilities for working with scene flags
 */
export class SceneUtils {
  /**
   * Update scene flags in a batch
   * @param {Scene} scene - Scene to update
   * @param {string} flagScope - Flag scope (e.g., "weatherState")
   * @param {Object} updates - Object with updates to apply
   * @returns {Promise<Scene>} - Updated scene
   */
  static async updateFlags(scene, flagScope, updates) {
    if (!scene?.id) return null;

    const currentFlags = scene.getFlag("dimensional-weather", flagScope) || {};
    const updatedFlags = { ...currentFlags, ...updates };

    return scene.setFlag("dimensional-weather", flagScope, updatedFlags);
  }

  /**
   * Get current weather state from the active scene
   * @returns {Object|null} - Weather state or null if not available
   */
  static getWeatherState() {
    const scene = game.scenes.viewed;
    if (!scene?.id) return null;

    return scene.getFlag("dimensional-weather", "weatherState");
  }
}
