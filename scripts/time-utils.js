/**
 * Dimensional Weather - Time Utilities
 * Centralized time handling and calculations
 */

import { ErrorHandler, DebugLogger } from "./utils.js";

export class TimeUtils {
  static _cache = {
    timestamp: 0,
    period: null,
    fullDate: null,
  };

  /**
   * Check if Simple Calendar API is available
   * @returns {boolean} True if Simple Calendar API is available
   */
  static isSimpleCalendarAvailable() {
    return (
      game.modules.get("foundryvtt-simple-calendar")?.active &&
      SimpleCalendar?.api
    );
  }

  /**
   * Get current time period based on hour from Simple Calendar
   * @param {boolean} useCache - Whether to use the cached value if available
   * @returns {string} Time period name
   */
  static getTimePeriod(useCache = true) {
    try {
      // Check if Simple Calendar is available
      if (!this.isSimpleCalendarAvailable()) {
        DebugLogger.log(
          "time",
          "Simple Calendar not available, using system time"
        );
        return this._getTimePeriodFromSystem();
      }

      // Get current date from Simple Calendar
      const currentDate = SimpleCalendar.api.currentDateTime();
      if (!currentDate) {
        DebugLogger.log(
          "time",
          "Simple Calendar returned null date, using system time"
        );
        return this._getTimePeriodFromSystem();
      }

      // Create a simple cache key based on the time
      const cacheKey = `${currentDate.hour}:${currentDate.minute || 0}`;

      // Use cache if enabled and time hasn't changed
      if (
        useCache &&
        this._cache.timestamp === cacheKey &&
        this._cache.period
      ) {
        return this._cache.period;
      }

      // Extract hour from the time object
      const hours = currentDate.hour;
      if (hours === undefined || hours === null) {
        DebugLogger.log(
          "time",
          "Could not parse hours from Simple Calendar data in getTimePeriod"
        );
        return "Unknown Time";
      }

      DebugLogger.log("time", `Simple Calendar hour: ${hours}`);

      // Determine period based on hour
      const period = this._determineTimePeriod(hours);
      DebugLogger.log("time", `Determined time period: ${period}`);

      // Update cache
      this._cache.timestamp = cacheKey;
      this._cache.period = period;

      return period;
    } catch (error) {
      DebugLogger.warn("Error getting time period from Simple Calendar", error);
      return this._getTimePeriodFromSystem();
    }
  }

  /**
   * Get time period from system time as fallback
   * @private
   * @returns {string} Time period name
   */
  static _getTimePeriodFromSystem() {
    const now = new Date();
    const hours = now.getHours();
    return this._determineTimePeriod(hours);
  }

  /**
   * Determine time period based on hour
   * @private
   * @param {number} hours - Hour of day (0-23)
   * @returns {string} Time period name
   */
  static _determineTimePeriod(hours) {
    if (hours >= 0 && hours < 4) {
      return "2nd Watch";
    } else if (hours >= 4 && hours < 8) {
      return "3rd Watch";
    } else if (hours >= 8 && hours < 12) {
      return "Morning";
    } else if (hours >= 12 && hours < 16) {
      return "Noon";
    } else if (hours >= 16 && hours < 20) {
      return "Evening";
    } else if (hours >= 20 && hours < 24) {
      return "1st Watch";
    } else {
      return "Unknown Time";
    }
  }

  /**
   * Get the current timestamp based on Simple Calendar or system time
   * @returns {number} Current timestamp in milliseconds
   */
  static getCurrentTimestamp() {
    try {
      if (!this.isSimpleCalendarAvailable()) {
        return Date.now();
      }

      const scTimestamp = SimpleCalendar.api.timestamp();
      if (scTimestamp !== null && scTimestamp !== undefined) {
        // Simple Calendar returns timestamp in seconds, convert to milliseconds
        return scTimestamp * 1000;
      }
    } catch (error) {
      DebugLogger.warn("Error getting Simple Calendar timestamp", error);
    }

    return Date.now();
  }

  /**
   * Get the current date display from Simple Calendar
   * @returns {Object} Date display object
   */
  static getCurrentDateDisplay() {
    try {
      if (!this.isSimpleCalendarAvailable()) {
        const now = new Date();
        return {
          date: now.toLocaleDateString(),
          time: now.toLocaleTimeString(),
          display: now.toLocaleString(),
        };
      }

      const currentDate = SimpleCalendar.api.currentDateTimeDisplay();
      if (!currentDate) {
        const now = new Date();
        return {
          date: now.toLocaleDateString(),
          time: now.toLocaleTimeString(),
          display: now.toLocaleString(),
        };
      }

      // Format date using Simple Calendar's date object
      const formattedDate = currentDate.date || "Unknown Date";

      // Format time string
      const timeString = currentDate.time;

      return {
        date: formattedDate,
        time: timeString,
        display: `${formattedDate} ${timeString}`,
      };
    } catch (error) {
      DebugLogger.warn("Error getting date display", error);
      const now = new Date();
      return {
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        display: now.toLocaleString(),
      };
    }
  }

  /**
   * Get the current hour from Simple Calendar or system time
   * @returns {number} Current hour (1-24)
   */
  static getCurrentHour() {
    try {
      if (!this.isSimpleCalendarAvailable()) {
        const now = new Date();
        return now.getHours() + 1; // Convert to 1-24 range
      }

      const currentDate = SimpleCalendar.api.currentDateTime();
      if (
        !currentDate ||
        currentDate.hour === undefined ||
        currentDate.hour === null
      ) {
        DebugLogger.log(
          "time",
          "Could not get hour from Simple Calendar, using system time"
        );
        const now = new Date();
        return now.getHours() + 1; // Convert to 1-24 range
      }

      // Simple Calendar uses 0-23, convert to 1-24 for our timeModifiers
      return currentDate.hour + 1;
    } catch (error) {
      DebugLogger.warn("Error getting current hour", error);
      const now = new Date();
      return now.getHours() + 1; // Convert to 1-24 range
    }
  }

  /**
   * Get time modifiers for the current hour
   * @param {Object} settingsData - Campaign settings data
   * @returns {Object} Time modifiers
   */
  static getTimeModifiers(settingsData) {
    const currentHour = this.getCurrentHour();
    DebugLogger.log("time", `Getting time modifiers for hour: ${currentHour}`);

    if (!settingsData?.timeModifiers?.[currentHour]) {
      DebugLogger.log(
        "time",
        `No time modifiers found for hour ${currentHour}, using default`
      );
      return {
        temperature: 0,
        wind: 0,
        precipitation: 0,
        humidity: 0,
      };
    }

    const modifiers = settingsData.timeModifiers[currentHour];
    DebugLogger.log(
      "time",
      `Time modifiers for hour ${currentHour}:`,
      modifiers
    );
    return modifiers;
  }

  /**
   * Get current season from Simple Calendar
   * @returns {string|null} Season name or null if not found
   */
  static getCurrentSeason() {
    try {
      if (!this.isSimpleCalendarAvailable()) {
        DebugLogger.log(
          "time",
          "Simple Calendar not available for season lookup"
        );
        return null;
      }

      DebugLogger.log("time", "Getting current season from Simple Calendar");
      const currentSeason = SimpleCalendar.api.getCurrentSeason();
      DebugLogger.log("time", "Simple Calendar season data:", currentSeason);

      if (!currentSeason) {
        DebugLogger.log("time", "No season data in current date");
        return null;
      }

      // Always use the season name from Simple Calendar
      if (currentSeason?.name) {
        DebugLogger.log(
          "time",
          `Using Simple Calendar season name: ${currentSeason.name}`
        );
        return currentSeason.name;
      }

      DebugLogger.log("time", "No season name found");
      return null;
    } catch (error) {
      ErrorHandler.logAndNotify("Error getting season", error);
      return null;
    }
  }

  /**
   * Calculate time passed since a timestamp
   * @param {number} timestamp - Previous timestamp in milliseconds
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
      days: timeDiff / 86400000,
    };
  }

  /**
   * Check if an update is needed based on frequency
   * @param {number} lastUpdate - Last update timestamp in milliseconds
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
      timestamp: null,
      period: null,
    };
    DebugLogger.log("time", "Time cache cleared");
  }

  /**
   * Force refresh the time period (ignores cache)
   * @returns {string} Time period name
   */
  static getTimePeriodForceRefresh() {
    return this.getTimePeriod(false);
  }

  /**
   * Format a timestamp as a readable string using Simple Calendar if available
   * @param {number} timestamp - Timestamp in milliseconds to format
   * @returns {string} Formatted timestamp
   */
  static formatTimestamp(timestamp) {
    try {
      if (!this.isSimpleCalendarAvailable()) {
        return new Date(timestamp).toLocaleString();
      }

      // Convert milliseconds to seconds for Simple Calendar
      const scTimestamp = Math.floor(timestamp / 1000);

      // Use Simple Calendar's formatTimestamp method
      const formatted = SimpleCalendar.api.formatTimestamp(scTimestamp);
      if (formatted && typeof formatted === "object") {
        return `${formatted.date} ${formatted.time}`;
      } else if (typeof formatted === "string") {
        return formatted;
      }
    } catch (error) {
      DebugLogger.warn(
        "Error formatting timestamp with Simple Calendar",
        error
      );
    }

    return new Date(timestamp).toLocaleString();
  }
}
