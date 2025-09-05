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
      const calDate = ss?.getCurrentDate?.();

      // Fallback to system time when S&S is unavailable
      const hours = calDate?.time?.hour ?? new Date().getHours();
      const minutes = calDate?.time?.minute ?? new Date().getMinutes();

      // Cache key based on hour/minute
      const cacheKey = `${hours}:${minutes}`;
      if (useCache && this._cache.timestamp === cacheKey && this._cache.period) {
        return this._cache.period;
      }

      // Prefer Seasons & Stars canonical hours via named format
      if (calDate?.formatter?.formatNamed) {
        const period = calDate.formatter.formatNamed(calDate, 'mixed') || "Unknown Time";
        this._cache = { ...this._cache, timestamp: cacheKey, period };
        DebugLogger.log("time", `Time ${hours}:${minutes} -> ${period}`);
        return period;
      }

      // Fallback to local mapping
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
   * Get current season using Seasons & Stars if available
   * @returns {string|null} Season key or null if not found
   */
  static getCurrentSeason() {
    try {
      const ss = game.seasonsStars?.api;
      if (!ss) return null;

      const date = typeof ss.getCurrentDate === "function" ? ss.getCurrentDate() : null;
      const seasonInfo = typeof ss.getSeasonInfo === "function"
        ? ss.getSeasonInfo(date)
        : (date?.season || null);

      // Map to campaign keys when possible
      const settingsData = game.dimWeather?.settingsData || null;
      const mapped = this._mapSeasonToCampaignKey(seasonInfo, settingsData);
      if (mapped) return mapped;

      // Fall back to raw identifiers
      if (seasonInfo?.key) return String(seasonInfo.key).toLowerCase();
      if (seasonInfo?.id) return String(seasonInfo.id).toLowerCase();
      if (seasonInfo?.name) return this._normalizeSeasonString(seasonInfo.name);
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

  /**
   * Normalize a season string for comparison (lowercase, remove non-alphanumerics, map synonyms)
   * @private
   * @param {string} value - Season label
   * @returns {string} normalized
   */
  static _normalizeSeasonString(value) {
    if (!value) return "";
    const lower = String(value).toLowerCase();
    // map common synonyms
    const synonym = lower.replace(/autumn/g, "fall");
    return synonym.replace(/[^a-z0-9]/g, "");
  }

  /**
   * Map Seasons & Stars season info to a campaign season key if possible
   * @private
   * @param {Object|null} seasonInfo - Object from S&S (key/id/name)
   * @param {Object|null} settingsData - Current campaign settings
   * @returns {string|null} campaign season key or null
   */
  static _mapSeasonToCampaignKey(seasonInfo, settingsData) {
    try {
      if (!seasonInfo || !settingsData?.seasons) return null;

      const candidates = [];
      if (seasonInfo.key) candidates.push(this._normalizeSeasonString(seasonInfo.key));
      if (seasonInfo.id) candidates.push(this._normalizeSeasonString(seasonInfo.id));
      if (seasonInfo.name) candidates.push(this._normalizeSeasonString(seasonInfo.name));

      if (!candidates.length) return null;

      // Build lookup of campaign seasons by normalized key and name
      const seasonEntries = Object.entries(settingsData.seasons);

      // 1) Try direct key match (normalized)
      for (const [key, season] of seasonEntries) {
        const normKey = this._normalizeSeasonString(key);
        if (candidates.includes(normKey)) return key;
      }

      // 2) Try name match (normalized display name)
      for (const [key, season] of seasonEntries) {
        const normName = this._normalizeSeasonString(season?.name || key);
        if (candidates.includes(normName)) return key;
      }

      return null;
    } catch (err) {
      DebugLogger.warn("Season mapping failed", err);
      return null;
    }
  }

  // Removed legacy extraction helpers and calendar ID resolution to avoid duplication with
  // Seasons & Stars and its calendar packs. TimeUtils now serves as a thin adapter only.
}
