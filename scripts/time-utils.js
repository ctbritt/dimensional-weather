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
   * Get current time period based on hour from Dark Sun Calendar
   * @param {boolean} useCache - Whether to use the cached value if available
   * @returns {string} Time period name
   */
  static getTimePeriod(useCache = true) {
    try {
      const ss = game.seasonsStars?.api;
      const currentDate = ss?.getCurrentDate?.();

      // Fallback to system time when S&S is unavailable
      const hours = currentDate?.time?.hour ?? new Date().getHours();
      const minutes = currentDate?.time?.minute ?? new Date().getMinutes();

      // Cache key based on hour/minute
      const cacheKey = `${hours}:${minutes}`;
      if (useCache && this._cache.timestamp === cacheKey && this._cache.period) {
        return this._cache.period;
      }

      let period = "Unknown Time";
      if (hours >= 0 && hours < 4) period = "2nd Watch";
      else if (hours >= 4 && hours < 8) period = "3rd Watch";
      else if (hours >= 8 && hours < 12) period = "Morning";
      else if (hours >= 12 && hours < 16) period = "Noon";
      else if (hours >= 16 && hours < 20) period = "Evening";
      else if (hours >= 20 && hours < 24) period = "1st Watch";

      this._cache = { ...this._cache, timestamp: cacheKey, period };
      DebugLogger.log("time", `Time ${hours}:${minutes} -> ${period}`);
      return period;
    } catch (error) {
      ErrorHandler.logAndNotify("Error getting time period", error);
      return "Unknown Time";
    }
  }

  /**
   * Get the current timestamp based on Dark Sun Calendar or system time
   * @returns {number} Current timestamp
   */
  static getCurrentTimestamp() {
    try {
      const ss = game.seasonsStars?.api;
      const currentDate = ss?.getCurrentDate?.();
      if (ss && currentDate) {
        // Convert date to world time if possible
        const worldTime = ss.dateToWorldTime?.(currentDate);
        if (typeof worldTime === "number") return worldTime;
      }
    } catch (error) {
      DebugLogger.warn("Error getting Seasons & Stars timestamp", error);
    }
    return Date.now();
  }

  /**
   * Get the current date display from Dark Sun Calendar
   * @returns {Object} Date display object
   */
  static getCurrentDateDisplay() {
    try {
      const ss = game.seasonsStars?.api;
      const currentDate = ss?.getCurrentDate?.();
      if (ss && currentDate) {
        const dateString = ss.formatDate?.(currentDate) || "Unknown Date";
        const time = currentDate.time || {};
        const timeString =
          typeof time.getTimeString === "function"
            ? time.getTimeString()
            : `${String(time.hour ?? 0).padStart(2, "0")}:${String(
                time.minute ?? 0
              ).padStart(2, "0")}:${String(time.second ?? 0).padStart(2, "0")}`;
        return { date: dateString, time: timeString, display: `${dateString} ${timeString}` };
      }
    } catch (error) {
      DebugLogger.warn("Error getting Seasons & Stars date display", error);
    }

    const now = new Date();
    return {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      display: now.toLocaleString(),
    };
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
   * Get current season from Dark Sun Calendar
   * @returns {string|null} Season key or null if not found
   */
  static getCurrentSeason() {
    try {
      const ss = game.seasonsStars?.api;
      const currentDate = ss?.getCurrentDate?.();
      const seasonObj = currentDate?.season;
      if (seasonObj?.key) return seasonObj.key;
      if (seasonObj?.id) return seasonObj.id;
      if (seasonObj?.name) return String(seasonObj.name).toLowerCase();
      return null;
    } catch (error) {
      ErrorHandler.logAndNotify("Error getting current season from Seasons & Stars", error);
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
   * Format a timestamp as a readable string using Dark Sun Calendar if available
   * @param {number} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
  static formatTimestamp(timestamp) {
    try {
      // Best-effort formatting using local time
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      DebugLogger.warn("Error formatting timestamp", error);
      return String(timestamp);
    }
  }
}
