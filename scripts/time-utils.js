/**
 * Dimensional Weather - Time Utilities
 * Centralized time handling and calculations
 */

import { ErrorHandler } from "./utils.js";

export class TimeUtils {
  static _cache = {
    timestamp: 0,
    period: null,
    fullDate: null,
  };

  /**
   * Get current time period based on hour
   * @param {number} timestamp - Optional timestamp (uses current time if not provided)
   * @param {boolean} useCache - Whether to use the cached value if available
   * @returns {string} Time period name
   */
  static getTimePeriod(timestamp = null, useCache = true) {
    if (!window.DSC) {
      console.log(
        "DimensionalWeather | TimeUtils.getTimePeriod: Dark Sun Calendar API not available."
      );
      return "Unknown Time";
    }

    // Determine timestamp
    const currentTimestamp = timestamp || this.getCurrentTimestamp();

    // Use cache if enabled and timestamp matches
    if (useCache && this._cache.timestamp === currentTimestamp) {
      // console.log("DimensionalWeather | TimeUtils.getTimePeriod: Using cached period:", this._cache.period); // Optional: uncomment if suspecting cache issues
      return this._cache.period;
    }

    // Get current date from Dark Sun Calendar
    const currentDate = window.DSC.getCurrentDate();
    console.log(
      "DimensionalWeather | TimeUtils.getTimePeriod: Dark Sun Calendar currentDate:",
      currentDate
    ); // Log Dark Sun Calendar data
    
    if (!currentDate?.time) {
      console.log(
        "DimensionalWeather | TimeUtils.getTimePeriod: Dark Sun Calendar time not available."
      );
      return "Unknown Time";
    }

    // Extract hour from the time object
    const hours = currentDate.time.hour;
    if (hours === undefined || hours === null) {
      console.log(
        "DimensionalWeather | TimeUtils.getTimePeriod: Could not parse hours from Dark Sun Calendar data."
      );
      return "Unknown Time";
    }

    console.log(
      "DimensionalWeather | TimeUtils.getTimePeriod: Parsed hours:",
      hours
    ); // Log parsed hours

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
      period,
    };

    console.log(
      "DimensionalWeather | TimeUtils.getTimePeriod: Determined period:",
      period
    ); // Log final period
    return period;
  }

  /**
   * Get the current timestamp
   * @returns {number} Current timestamp
   */
  static getCurrentTimestamp() {
    if (window.DSC) {
      const currentDate = window.DSC.getCurrentDate();
      // Convert Dark Sun Calendar date to timestamp
      // This is a basic conversion - you may need to adjust based on your calendar system
      return currentDate ? new Date().getTime() : Date.now();
    }
    return Date.now();
  }

  /**
   * Get the current date display
   * @returns {Object} Date display object
   */
  static getCurrentDateDisplay() {
    if (!window.DSC) {
      return {
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        display: new Date().toLocaleString(),
      };
    }

    const currentDate = window.DSC.getCurrentDate();
    if (!currentDate) {
      return {
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        display: new Date().toLocaleString(),
      };
    }

    const formattedDate = window.DSC.formatDarkSunDate(currentDate);
    const timeString = currentDate.time ? currentDate.getTimeString() : "00:00:00";
    
    return {
      date: formattedDate,
      time: timeString,
      display: `${formattedDate} ${timeString}`,
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
   * @param {Object} settingsData - Campaign settings data
   * @returns {string|null} Season key or null if not found
   */
  static getCurrentSeason(settingsData) {
    console.log(
      "DimensionalWeather | TimeUtils.getCurrentSeason: Attempting to get season."
    ); // Log entry
    if (!window.DSC) {
      console.log(
        "DimensionalWeather | TimeUtils.getCurrentSeason: Dark Sun Calendar API not available."
      );
      return null;
    }
    if (!settingsData?.seasons) {
      console.log(
        "DimensionalWeather | TimeUtils.getCurrentSeason: Settings data or seasons missing."
      );
      return null;
    }

    const currentDate = window.DSC.getCurrentDate();
    if (!currentDate) {
      console.log(
        "DimensionalWeather | TimeUtils.getCurrentSeason: Dark Sun Calendar date not available."
      );
      return null;
    }

    const seasonInfo = window.DSC.getSeasonInfo(currentDate);
    console.log(
      "DimensionalWeather | TimeUtils.getCurrentSeason: Dark Sun Calendar season info:",
      seasonInfo
    ); // Log DSC season info
    
    if (!seasonInfo?.name) {
      console.log(
        "DimensionalWeather | TimeUtils.getCurrentSeason: Dark Sun Calendar season name not found."
      );
      return null;
    }

    // Convert Dark Sun Calendar season name to lowercase for comparison
    const dscSeasonName = seasonInfo.name.toLowerCase();
    console.log(
      `DimensionalWeather | TimeUtils.getCurrentSeason: Comparing DSC season "${dscSeasonName}" to module settings.`
    );

    // Find matching season in campaign settings
    for (const [key, season] of Object.entries(settingsData.seasons)) {
      const campaignSeasonName = season.name.toLowerCase();
      console.log(
        `DimensionalWeather | TimeUtils.getCurrentSeason: Checking against module season "${campaignSeasonName}" (key: ${key})`
      );

      // Handle both "Fall" and "Autumn" names
      if (
        campaignSeasonName === dscSeasonName ||
        (dscSeasonName === "fall" && campaignSeasonName === "autumn") ||
        (dscSeasonName === "autumn" && campaignSeasonName === "fall")
      ) {
        console.log(
          `DimensionalWeather | TimeUtils.getCurrentSeason: Match found! Returning key: ${key}`
        );
        return key;
      }
    }

    console.log(
      "DimensionalWeather | TimeUtils.getCurrentSeason: No matching season found in module settings."
    );
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
   * Format a timestamp as a readable string
   * @param {number} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
  static formatTimestamp(timestamp) {
    if (!window.DSC) {
      return new Date(timestamp).toLocaleString();
    }

    try {
      // For Dark Sun Calendar, we'll use the current date format
      // This is a simple implementation - you may want to enhance it
      const currentDate = window.DSC.getCurrentDate();
      if (currentDate) {
        const formattedDate = window.DSC.formatDarkSunDate(currentDate);
        const timeString = currentDate.time ? currentDate.getTimeString() : "00:00:00";
        return `${formattedDate} ${timeString}`;
      }
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to format timestamp", error, true);
      return new Date(timestamp).toLocaleString();
    }
  }
}
