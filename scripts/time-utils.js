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
   * Get current time period based on hour from Simple Calendar
   * @param {boolean} useCache - Whether to use the cached value if available
   * @returns {string} Time period name
   */
  static getTimePeriod(useCache = true) {
    const scApi = game.modules.get("simple-calendar")?.api;
    if (!scApi) {
      DebugLogger.log(
        "time",
        "Simple Calendar API not available in getTimePeriod"
      );
      return "Unknown Time";
    }

    try {
      // Get current date from Simple Calendar
      const currentDate = scApi.currentDate;
      if (!currentDate?.time) {
        DebugLogger.log(
          "time",
          "Simple Calendar time not available in getTimePeriod"
        );
        return "Unknown Time";
      }

      // Create a simple cache key based on the time
      const cacheKey = `${currentDate.time.hour}:${
        currentDate.time.minute || 0
      }`;

      // Use cache if enabled and time hasn't changed
      if (
        useCache &&
        this._cache.timestamp === cacheKey &&
        this._cache.period
      ) {
        return this._cache.period;
      }

      // Extract hour from the time object
      const hours = currentDate.time.hour;
      if (hours === undefined || hours === null) {
        DebugLogger.log(
          "time",
          "Could not parse hours from Simple Calendar data in getTimePeriod"
        );
        return "Unknown Time";
      }

      // Determine period based on hour
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
      this._cache.timestamp = cacheKey;
      this._cache.period = period;

      return period;
    } catch (error) {
      DebugLogger.warn("Error getting time period from Simple Calendar", error);
      return "Unknown Time";
    }
  }

  /**
   * Get the current timestamp based on Simple Calendar or system time
   * @returns {number} Current timestamp
   */
  static getCurrentTimestamp() {
    const scApi = game.modules.get("simple-calendar")?.api;
    if (scApi) {
      try {
        const currentDate = scApi.currentDate;
        if (currentDate) {
          // Use Simple Calendar timestamp if available, otherwise fallback to system time
          return currentDate.timestamp || Date.now();
        }
      } catch (error) {
        DebugLogger.warn("Error getting Simple Calendar timestamp", error);
      }
    }
    return Date.now();
  }

  /**
   * Get the current date display from Simple Calendar
   * @returns {Object} Date display object
   */
  static getCurrentDateDisplay() {
    const scApi = game.modules.get("simple-calendar")?.api;
    if (!scApi) {
      const now = new Date();
      return {
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        display: now.toLocaleString(),
      };
    }

    try {
      const currentDate = scApi.currentDate;
      if (!currentDate) {
        const now = new Date();
        return {
          date: now.toLocaleDateString(),
          time: now.toLocaleTimeString(),
          display: now.toLocaleString(),
        };
      }

      // Format date using Simple Calendar's date object
      const formattedDate = currentDate.dateString || "Unknown Date";

      // Format time string
      const timeString = currentDate.time
        ? `${currentDate.time.hour || 0}:${String(
            currentDate.time.minute || 0
          ).padStart(2, "0")}:${String(currentDate.time.second || 0).padStart(
            2,
            "0"
          )}`
        : "00:00:00";

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
        humidity: 0,
      };
    }

    return settingsData.timeModifiers[timePeriod];
  }

  /**
   * Get current season from Simple Calendar
   * @returns {string|null} Season key or null if not found
   */
  static getCurrentSeason() {
    const scApi = game.modules.get("simple-calendar")?.api;
    if (!scApi) {
      DebugLogger.log(
        "time",
        "Simple Calendar API not available in getCurrentSeason"
      );
      return null;
    }

    try {
      const currentSeason = scApi.getCurrentSeason();
      if (!currentSeason) {
        DebugLogger.log("time", "No season data in current date");
        return null;
      }

      // Get the season key directly from the Simple Calendar season object
      const seasonKey = currentSeason.key || currentSeason.id;
      if (seasonKey) {
        DebugLogger.log("time", `Found season key: ${seasonKey}`);
        return seasonKey;
      }

      // Fallback to season name if no key/id available
      const seasonName = currentSeason.name;
      if (seasonName) {
        // Convert name to lowercase key format
        const seasonKey = seasonName.toLowerCase();
        DebugLogger.log("time", `Using season name as key: ${seasonKey}`);
        return seasonKey;
      }

      DebugLogger.log("time", "No season key or name found");
      return null;
    } catch (error) {
      ErrorHandler.logAndNotify("Error getting season", error);
      return null;
    }
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
      days: timeDiff / 86400000,
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
      fullDate: null,
    };
  }

  /**
   * Format a timestamp as a readable string using Simple Calendar if available
   * @param {number} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
  static formatTimestamp(timestamp) {
    const scApi = game.modules.get("simple-calendar")?.api;
    if (!scApi) {
      return new Date(timestamp).toLocaleString();
    }

    try {
      // Use current Simple Calendar date formatting
      const dateDisplay = this.getCurrentDateDisplay();
      return dateDisplay.display;
    } catch (error) {
      DebugLogger.warn("Error formatting timestamp", error);
      return new Date(timestamp).toLocaleString();
    }
  }
}
