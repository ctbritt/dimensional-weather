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
 * Random utility functions
 */
/**
 * Centralized debug logging utility
 */
export class DebugLogger {
  /**
   * Log a debug message if the corresponding debug setting is enabled
   * @param {string} category - Debug category (e.g., 'time', 'settings', 'weather')
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  static log(category, message, data = null) {
    // Import Settings dynamically to avoid circular dependency
    const settingKey = `debug${category.charAt(0).toUpperCase() + category.slice(1)}`;
    
    try {
      // Check if we have access to settings
      if (game?.settings && game.modules.get("dimensional-weather")?.active) {
        const debugEnabled = game.settings.get("dimensional-weather", settingKey);
        if (debugEnabled) {
          if (data) {
            console.log(`Dimensional Weather | ${category}: ${message}`, data);
          } else {
            console.log(`Dimensional Weather | ${category}: ${message}`);
          }
        }
      }
    } catch (error) {
      // Silently skip debug logging if settings aren't available yet
    }
  }

  /**
   * Log a warning message (always shown)
   * @param {string} message - Warning message
   * @param {any} data - Optional data to log
   */
  static warn(message, data = null) {
    if (data) {
      console.warn(`Dimensional Weather | ${message}`, data);
    } else {
      console.warn(`Dimensional Weather | ${message}`);
    }
  }

  /**
   * Log an info message (always shown)
   * @param {string} message - Info message
   * @param {any} data - Optional data to log
   */
  static info(message, data = null) {
    if (data) {
      console.log(`Dimensional Weather | ${message}`, data);
    } else {
      console.log(`Dimensional Weather | ${message}`);
    }
  }
}

export class RandomUtils {
  /**
   * Generate a random number within a range
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random number between min and max
   */
  static getRandomRange(min, max) {
    return Math.random() * (max - min) + min;
  }
  
  /**
   * Generate a random integer within a range
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random integer between min and max (inclusive)
   */
  static getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  /**
   * Get a random element from an array
   * @param {Array} array - Array to pick from
   * @returns {*} Random element from the array
   */
  static getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
  
  /**
   * Generate a random boolean with a given probability
   * @param {number} probability - Probability of true (0-1)
   * @returns {boolean} Random boolean
   */
  static getRandomBool(probability = 0.5) {
    return Math.random() < probability;
  }
}
