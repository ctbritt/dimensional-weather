/**
 * Dimensional Weather - Time Utilities
 * Centralized time handling and calculations
 */

import { ErrorHandler } from "./utils.js";

export class TimeUtils {
  static _cache = {
    timestamp: 0,
    period: null,
    fullDate: null
  };
  
  /**
   * Get current time period based on hour
   * @param {number} timestamp - Optional timestamp (uses current time if not provided)
   * @param {boolean} useCache - Whether to use the cached value if available
   * @returns {string} Time period name
   */
  static getTimePeriod(timestamp = null, useCache = true) {
    if (!SimpleCalendar?.api) {
      return "Unknown Time";
    }
    
    // Determine timestamp
    const currentTimestamp = timestamp || this.getCurrentTimestamp();
    
    // Use cache if enabled and timestamp matches
    if (useCache && this._cache.timestamp === currentTimestamp) {
      return this._cache.period;
    }
    
    // Get current time
    const dt = SimpleCalendar.api.currentDateTimeDisplay();
    if (!dt?.time) {
      return "Unknown Time";
    }
    
    // Parse the time
    const [hours] = dt.time.split(":").map(Number);
    
    // Determine period
    let period;
    if (hours >= 5 && hours < 8) {
      period = "Early Morning";
    } else if (hours >= 8 && hours < 12) {
      period = "Morning";
    } else if (hours >= 12 && hours < 14) {
      period = "Noon";
    } else if (hours >= 14 && hours < 18) {
      period = "Afternoon";
    } else if (hours >= 18 && hours < 21) {
      period = "Evening";
    } else if (hours >= 21 || hours < 2) {
      period = "Night";
    } else {
      period = "Late Night";
    }
    
    // Update cache
    this._cache = {
      ...this._cache,
      timestamp: currentTimestamp,
      period
    };
    
    return period;
  }
  
  /**
   * Get the current timestamp
   * @returns {number} Current timestamp
   */
  static getCurrentTimestamp() {
    return SimpleCalendar?.api ? SimpleCalendar.api.timestamp() : Date.now();
  }
  
  /**
   * Get the current date display
   * @returns {Object} Date display object
   */
  static getCurrentDateDisplay() {
    if (!SimpleCalendar?.api) {
      return { 
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        display: new Date().toLocaleString()
      };
    }
    
    return SimpleCalendar.api.currentDateTimeDisplay();
  }
  
  /**
   * Get time modifiers for a time period
   * @param {string} timePeriod - Time period name
   * @param {Object} settingsData - Campaign settings data
   * @returns {Object} Time modifiers
   */
  static getTimeModifiers(timePeriod, settingsData) {
    if (!settingsData?.timeModifiers?.[timePeriod]) {
      return {
        temperature: 0,
        wind: 0,
        precipitation: 0,
        humidity: 0
      };
    }
    
    return settingsData.timeModifiers[timePeriod];
  }
  
  /**
   * Get current season from Simple Calendar
   * @param {Object} settingsData - Campaign settings data
   * @returns {string|null} Season key or null if not found
   */
  static getCurrentSeason(settingsData) {
    if (!SimpleCalendar?.api || !settingsData?.seasons) {
      return null;
    }
    
    const scSeason = SimpleCalendar.api.getCurrentSeason();
    if (!scSeason?.name) {
      return null;
    }
    
    // Convert Simple Calendar season name to lowercase for comparison
    const scSeasonName = scSeason.name.toLowerCase();
    
    // Find matching season in campaign settings
    for (const [key, season] of Object.entries(settingsData.seasons)) {
      const campaignSeasonName = season.name.toLowerCase();
      
      // Handle both "Fall" and "Autumn" names
      if (
        campaignSeasonName === scSeasonName ||
        (scSeasonName === "fall" && campaignSeasonName === "autumn") ||
        (scSeasonName === "autumn" && campaignSeasonName === "fall")
      ) {
        return key;
      }
    }
    
    return null;
  }
  
  /**
   * Calculate time passed since a timestamp
   * @param {number} timestamp - Previous timestamp
   * @returns {Object} Time passed in different units
   */
  static getTimeSince(timestamp) {
    const currentTime = this.getCurrentTimestamp();
    const timeDiff = currentTime - timestamp;
    
    return {
      milliseconds: timeDiff,
      seconds: timeDiff / 1000,
      minutes: timeDiff / 60000,
      hours: timeDiff / 3600000,
      days: timeDiff / 86400000
    };
  }
  
  /**
   * Check if an update is needed based on frequency
   * @param {number} lastUpdate - Last update timestamp
   * @param {number} frequency - Update frequency in hours
   * @returns {boolean} Whether an update is needed
   */
  static isUpdateNeeded(lastUpdate, frequency) {
    if (!lastUpdate) return true;
    
    const timeSince = this.getTimeSince(lastUpdate);
    return timeSince.hours >= frequency;
  }
  
  /**
   * Clear the time utils cache
   */
  static clearCache() {
    this._cache = {
      timestamp: 0,
      period: null,
      fullDate: null
    };
  }
  
  /**
   * Format a timestamp as a readable string
   * @param {number} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
  static formatTimestamp(timestamp) {
    if (!SimpleCalendar?.api) {
      return new Date(timestamp).toLocaleString();
    }
    
    try {
      const dt = SimpleCalendar.api.timestampToDate(timestamp);
      return `${dt.display.date} ${dt.display.time}`;
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to format timestamp", error, true);
      return new Date(timestamp).toLocaleString();
    }
  }
}