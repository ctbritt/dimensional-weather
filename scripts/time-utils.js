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
   * Get current season from Dark Sun Calendar
   * @returns {string|null} Season key or null if not found
   */
  static getCurrentSeason() {
    try {
      const ss = game.seasonsStars?.api;
      // Prefer Seasons & Stars explicit season info API if available
      let seasonInfo = null;
      if (typeof ss?.getSeasonInfo === "function") {
        const worldTime = game?.time?.worldTime;
        let currentData = null;
        try {
          if (typeof ss.getCurrentDate === "function") {
            const calendarId = this._getSSCalendarId(ss);
            // Try (calendarId, worldTime) signature first if we have an ID
            if (calendarId && ss.getCurrentDate.length >= 2) {
              currentData = ss.getCurrentDate(calendarId, worldTime);
            } else if (ss.getCurrentDate.length >= 1) {
              // Ambiguous single-arg signature: try calendarId then worldTime
              try {
                currentData = ss.getCurrentDate(calendarId || worldTime);
              } catch (e1) {
                try {
                  currentData = ss.getCurrentDate(worldTime);
                } catch (e2) {
                  currentData = ss.getCurrentDate();
                }
              }
            } else {
              currentData = ss.getCurrentDate();
            }
          }
        } catch (e) {
          DebugLogger.warn("Failed S&S getCurrentDate with calendarId/worldTime, falling back", e);
          try {
            currentData = ss?.getCurrentDate?.();
          } catch (_) {
            currentData = null;
          }
        }
        seasonInfo = ss.getSeasonInfo(currentData || ss?.getCurrentDate?.());
      } else {
        seasonInfo = ss?.getCurrentDate?.()?.season || null;
      }

      // Attempt to map S&S season to the current campaign's season keys
      const settingsData = game.dimWeather?.settingsData || null;
      const mapped = this._mapSeasonToCampaignKey(seasonInfo, settingsData);
      if (mapped) return mapped;

      // Fallbacks to raw S&S identifiers
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
   * Get the day of the year (1-based), preferring Seasons & Stars.
   * For Athas: Scorch = Day 1, Highest Sun 5 = Day 375.
   * @returns {number|null} Day of year or null if unavailable
   */
  static getDayOfYear() {
    try {
      const ss = game.seasonsStars?.api;
      if (!ss) return null;

      const calendarId = this._getSSCalendarId(ss);
      const worldTime = game?.time?.worldTime;

      let dateObj = null;
      try {
        if (typeof ss.getCurrentDate === "function") {
          if (calendarId && ss.getCurrentDate.length >= 2) {
            dateObj = ss.getCurrentDate(calendarId, worldTime);
          } else if (ss.getCurrentDate.length >= 1) {
            try {
              dateObj = ss.getCurrentDate(calendarId || worldTime);
            } catch (e1) {
              try {
                dateObj = ss.getCurrentDate(worldTime);
              } catch (e2) {
                dateObj = ss.getCurrentDate();
              }
            }
          } else {
            dateObj = ss.getCurrentDate();
          }
        }
      } catch (err) {
        DebugLogger.warn("S&S getCurrentDate error in getDayOfYear", err);
      }

      // 1) Direct API, if available
      try {
        if (typeof ss.getDayOfYear === "function") {
          const v = ss.getDayOfYear(dateObj);
          if (typeof v === "number" && isFinite(v)) return Math.max(1, Math.floor(v));
        }
      } catch (err) {
        DebugLogger.warn("S&S getDayOfYear failed", err);
      }

      // 2) Use season/date info return fields
      try {
        const seasonInfo = typeof ss.getSeasonInfo === "function" ? ss.getSeasonInfo(dateObj) : null;
        const fromSeason = this._extractOrdinalFromAny(seasonInfo);
        if (fromSeason) return fromSeason;

        const fromDate = this._extractOrdinalFromAny(dateObj);
        if (fromDate) return fromDate;
      } catch (err) {
        DebugLogger.warn("S&S season/date info extraction failed", err);
      }

      return null;
    } catch (error) {
      ErrorHandler.logAndNotify("Error getting day of year", error);
      return null;
    }
  }

  /**
   * Get total number of days since the start of the calendar (1-based).
   * Uses Seasons & Stars with game.time.worldTime; Athas fallback assumes 375-day years.
   * @param {number} [worldTime] - Foundry world time (defaults to game.time.worldTime)
   * @returns {number|null} Total days since day 1, or null if unavailable
   */
  static getTotalDaysSinceCalendarStart(worldTime = undefined) {
    try {
      const ss = game.seasonsStars?.api;
      if (!ss) return null;

      const wt = worldTime ?? game?.time?.worldTime;
      const calendarId = this._getSSCalendarId(ss);

      // Get a date object for the provided world time
      let dateObj = null;
      try {
        if (typeof ss.getCurrentDate === "function") {
          if (calendarId && ss.getCurrentDate.length >= 2) {
            dateObj = ss.getCurrentDate(calendarId, wt);
          } else if (ss.getCurrentDate.length >= 1) {
            try {
              dateObj = ss.getCurrentDate(calendarId || wt);
            } catch (e1) {
              try {
                dateObj = ss.getCurrentDate(wt);
              } catch (e2) {
                dateObj = ss.getCurrentDate();
              }
            }
          } else {
            dateObj = ss.getCurrentDate();
          }
        }
      } catch (err) {
        DebugLogger.warn("S&S getCurrentDate error in getTotalDaysSinceCalendarStart", err);
      }

      // 1) Prefer a direct API if available
      try {
        if (typeof ss.getDaysSinceEpoch === "function") {
          const v = ss.getDaysSinceEpoch(dateObj);
          if (typeof v === "number" && isFinite(v)) return Math.max(1, Math.floor(v));
        }
      } catch (err) {
        DebugLogger.warn("S&S getDaysSinceEpoch failed", err);
      }

      try {
        if (typeof ss.getAbsoluteDay === "function") {
          const v = ss.getAbsoluteDay(dateObj);
          if (typeof v === "number" && isFinite(v)) return Math.max(1, Math.floor(v));
        }
      } catch (err) {
        DebugLogger.warn("S&S getAbsoluteDay failed", err);
      }

      // 2) Try to read an absolute day-like field
      const abs = this._extractAbsoluteDayFromAny(dateObj);
      if (abs) return abs;

      // 3) Derive from year + day-of-year
      const dayOfYear = this.getDayOfYear();
      const yearNum = this._extractYearNumber(dateObj);
      if (dayOfYear && yearNum) {
        // Try dynamic days-per-year from API
        let daysInYear = null;
        try {
          if (typeof ss.getDaysInYear === "function") {
            const diy = ss.getDaysInYear(dateObj);
            if (typeof diy === "number" && isFinite(diy) && diy > 0) daysInYear = Math.floor(diy);
          }
        } catch (err) {
          DebugLogger.warn("S&S getDaysInYear failed", err);
        }

        // Fallback: Athas known year length
        if (!daysInYear && game.dimWeather?.settingsData?.id === "athas") {
          daysInYear = 375;
        }

        if (daysInYear) {
          return (Math.max(1, Math.floor(yearNum) - 1) * daysInYear) + Math.max(1, Math.floor(dayOfYear));
        }
      }

      // 4) Last-resort: derive via world seconds per day, if S&S exposes it
      try {
        const spd = (typeof ss.getWorldSecondsPerDay === "function")
          ? ss.getWorldSecondsPerDay(calendarId)
          : (typeof ss.getSecondsPerDay === "function" ? ss.getSecondsPerDay(calendarId) : null);
        if (typeof spd === "number" && isFinite(spd) && spd > 0 && typeof wt === "number") {
          return Math.max(1, Math.floor(wt / spd) + 1);
        }
      } catch (err) {
        DebugLogger.warn("S&S seconds-per-day fallback failed", err);
      }

      return null;
    } catch (error) {
      ErrorHandler.logAndNotify("Error getting total days since calendar start", error);
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
   * Find the active Seasons & Stars calendar ID, if any
   * @private
   * @param {Object} ss - Seasons & Stars API
   * @returns {string|null} calendar id
   */
  static _getSSCalendarId(ss) {
    try {
      // Common places an active calendar ID might be exposed
      const active = ss?.getActiveCalendar?.();
      if (active?.id) return String(active.id);
      if (typeof ss?.getDefaultCalendarId === "function") {
        const id = ss.getDefaultCalendarId();
        if (id) return String(id);
      }
      if (typeof ss?.getCalendars === "function") {
        const list = ss.getCalendars();
        if (Array.isArray(list) && list.length && list[0]?.id) return String(list[0].id);
      }
      // Last resort: check a likely config spot
      const cfg = game.settings?.get?.("seasons-and-stars", "activeCalendarId");
      if (cfg) return String(cfg);
    } catch (_) {}
    return null;
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

  /**
   * Try to extract a 1-based day-of-year ordinal from an arbitrary S&S object
   * Common fields supported: ordinal, dayOfYear, day, dayOfYearIndex
   * @private
   * @param {any} obj - object to inspect
   * @returns {number|null}
   */
  static _extractOrdinalFromAny(obj) {
    try {
      if (!obj || typeof obj !== "object") return null;
      const candidates = [
        obj.ordinal,
        obj.dayOfYear,
        obj.dayOfYearIndex,
        obj.day, // some calendars expose absolute day within year
      ];
      for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Try to extract an absolute day count from an S&S date object (1-based)
   * Common fields supported: absoluteDay, absolute, dayCount
   * @private
   * @param {any} obj - object to inspect
   * @returns {number|null}
   */
  static _extractAbsoluteDayFromAny(obj) {
    try {
      if (!obj || typeof obj !== "object") return null;
      const candidates = [obj.absoluteDay, obj.absolute, obj.dayCount];
      for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Try to extract a numeric year from an S&S date object
   * Common fields supported: year, y, yearNumber
   * @private
   * @param {any} obj - object to inspect
   * @returns {number|null}
   */
  static _extractYearNumber(obj) {
    try {
      if (!obj || typeof obj !== "object") return null;
      const candidates = [obj.year, obj.y, obj.yearNumber];
      for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n)) return Math.floor(n);
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
