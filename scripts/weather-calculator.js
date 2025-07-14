/**
 * Dimensional Weather - Weather Calculator
 * Centralizes all weather calculation logic
 */

import { TimeUtils } from "./time-utils.js";

export class WeatherCalculator {
  /**
   * Calculate weather changes based on input parameters
   * @param {Object} params - Weather calculation parameters
   * @param {Object} params.terrain - Terrain data
   * @param {Object} params.savedState - Previous weather state
   * @param {number} params.variability - Weather variability setting
   * @param {string} params.currentSeason - Current season key
   * @param {Object} params.settingsData - Full campaign settings data 
   * @returns {Object} Calculation results
   */
  static calculateWeatherChanges(params) {
    const { 
      terrain, 
      savedState, 
      variability, 
      currentSeason,
      settingsData 
    } = params;
    
    // Initialize calculation details object
    const details = this._initializeDetails(terrain, savedState, variability);
    
    // Get current time
    const currentTime = TimeUtils.getCurrentTimestamp();
    
    // Calculate base values with randomization
    const baseValues = this._calculateBaseValues(terrain, savedState, variability);
    details.randomFactors = baseValues.randomFactors;
    
    // Get time period
    const timePeriod = TimeUtils.getTimePeriod(currentTime);
    details.timePeriod = timePeriod;
    
    // Get modifiers
    const globalTimeModifiers = TimeUtils.getTimeModifiers(timePeriod, settingsData);
    const terrainTimeModifiers = this._getTerrainTimeModifiers(timePeriod, terrain);
    
    // Combine global and terrain-specific time modifiers
    const timeModifiers = {
      temperature: (globalTimeModifiers.temperature || 0) + (terrainTimeModifiers.temperature || 0),
      wind: (globalTimeModifiers.wind || 0) + (terrainTimeModifiers.wind || 0),
      precipitation: (globalTimeModifiers.precipitation || 0) + (terrainTimeModifiers.precipitation || 0),
      humidity: (globalTimeModifiers.humidity || 0) + (terrainTimeModifiers.humidity || 0)
    };
    
    details.timeModifiers = timeModifiers;
    details.globalTimeModifiers = globalTimeModifiers;
    details.terrainTimeModifiers = terrainTimeModifiers;
    
    const seasonModifiers = this._getSeasonModifiers(currentSeason, settingsData);
    details.seasonModifiers = seasonModifiers;
    details.season = currentSeason;
    
    // Apply modifiers to base values
    const finalValues = this._applyModifiers(
      baseValues.values,
      timeModifiers,
      seasonModifiers
    );
    
    // Store intermediate and final values
    details.intermediate = baseValues.values;
    details.final = finalValues;
    
    // Create the new weather state
    const newWeather = {
      temperature: finalValues.temp,
      wind: finalValues.wind,
      precipitation: finalValues.precip,
      humidity: finalValues.humid,
      lastUpdate: currentTime,
      terrain: savedState?.terrain || this._formatTerrainKey(terrain.name),
      season: currentSeason
    };
    
    return {
      weatherState: newWeather,
      details: details
    };
  }
  
  /**
   * Initialize calculation details object
   * @private
   * @param {Object} terrain - Terrain data
   * @param {Object} savedState - Previous weather state
   * @param {number} variability - Weather variability
   * @returns {Object} Initialized details object
   */
  static _initializeDetails(terrain, savedState, variability) {
    return {
      terrain: {
        name: terrain.name,
        baseTemp: terrain.temperature,
        baseWind: terrain.wind,
        basePrecip: terrain.precipitation,
        baseHumid: terrain.humidity,
      },
      previous: savedState
        ? {
            temp: savedState.temperature,
            wind: savedState.wind,
            precip: savedState.precipitation,
            humid: savedState.humidity,
          }
        : null,
      variability,
    };
  }
  
  /**
   * Calculate base weather values with randomization
   * @private
   * @param {Object} terrain - Terrain data
   * @param {Object} savedState - Previous weather state
   * @param {number} variability - Weather variability
   * @returns {Object} Base values and random factors
   */
  static _calculateBaseValues(terrain, savedState, variability) {
    // Generate random factors
    const randomFactors = this._generateRandomFactors(variability);
    
    // Apply terrain baseline with random variation
    const temperature = Math.round(terrain.temperature + randomFactors.temp);
    
    const wind = Math.round(
      (terrain.wind + (savedState?.wind ?? terrain.wind)) / 2 + randomFactors.wind
    );
    
    const precipitation = Math.round(
      (terrain.precipitation + (savedState?.precipitation ?? terrain.precipitation)) / 2 + 
      randomFactors.precip
    );
    
    const humidity = Math.round(
      (terrain.humidity + (savedState?.humidity ?? terrain.humidity)) / 2 +
      randomFactors.humid
    );
    
    return {
      values: {
        temp: temperature,
        wind: wind,
        precip: precipitation,
        humid: humidity,
      },
      randomFactors
    };
  }
  
  /**
   * Generate random factors based on variability
   * @private
   * @param {number} variability - Weather variability
   * @returns {Object} Random factors
   */
  static _generateRandomFactors(variability) {
    return {
      temp: ((Math.random() * 2 - 1) * variability) / 4,
      wind: ((Math.random() * 2 - 1) * variability) / 2,
      precip: ((Math.random() * 2 - 1) * variability) / 2,
      humid: ((Math.random() * 2 - 1) * variability) / 2,
    };
  }
  
  /**
   * Get season modifiers
   * @private
   * @param {string} seasonKey - Season key
   * @param {Object} settingsData - Campaign settings data
   * @returns {Object} Season modifiers
   */
  static _getSeasonModifiers(seasonKey, settingsData) {
    const season = settingsData?.seasons?.[seasonKey];
    return (
      season?.modifiers || {
        temperature: 0,
        wind: 0,
        precipitation: 0,
        humidity: 0,
        variability: 0,
      }
    );
  }
  
  /**
   * Apply modifiers to base values
   * @private
   * @param {Object} baseValues - Base weather values
   * @param {Object} timeModifiers - Time modifiers
   * @param {Object} seasonModifiers - Season modifiers
   * @returns {Object} Final values
   */
  static _applyModifiers(baseValues, timeModifiers, seasonModifiers) {
    // Apply time and season modifiers
    const finalTemp = 
      baseValues.temp + 
      (timeModifiers.temperature || 0) + 
      (seasonModifiers.temperature || 0);
    
    const finalWind = 
      baseValues.wind + 
      (timeModifiers.wind || 0) + 
      (seasonModifiers.wind || 0);
    
    const finalPrecip = 
      baseValues.precip + 
      (timeModifiers.precipitation || 0) + 
      (seasonModifiers.precipitation || 0);
    
    const finalHumid = 
      baseValues.humid + 
      (timeModifiers.humidity || 0) + 
      (seasonModifiers.humidity || 0);
    
    // Clamp values between -10 and 10
    return {
      temp: Math.max(-10, Math.min(10, finalTemp)),
      wind: Math.max(-10, Math.min(10, finalWind)),
      precip: Math.max(-10, Math.min(10, finalPrecip)),
      humid: Math.max(-10, Math.min(10, finalHumid)),
    };
  }
  
  /**
   * Get terrain-specific time modifiers
   * @private
   * @param {string} timePeriod - Time period name
   * @param {Object} terrain - Terrain data
   * @returns {Object} Terrain time modifiers
   */
  static _getTerrainTimeModifiers(timePeriod, terrain) {
    if (!terrain?.timeModifiers?.[timePeriod]) {
      return {
        temperature: 0,
        wind: 0,
        precipitation: 0,
        humidity: 0
      };
    }
    
    return terrain.timeModifiers[timePeriod];
  }
  
  /**
   * Format terrain name to key
   * @private
   * @param {string} name - Terrain name
   * @returns {string} Formatted terrain key
   */
  static _formatTerrainKey(name) {
    return name.toLowerCase().replace(/\s+/g, "");
  }
  
  /**
   * Generate a weather forecast
   * @param {Object} params - Forecast parameters 
   * @param {Object} params.terrain - Current terrain
   * @param {Object} params.weatherState - Current weather state
   * @param {number} params.variability - Weather variability
   * @param {number} params.days - Number of days to forecast
   * @returns {Array<Object>} Array of forecast days
   */
  static generateForecast(params) {
    const { terrain, weatherState, variability, days = 5 } = params;
    
    // Generate forecast days
    const forecast = [];
    
    // Use current weather as starting point
    let previousWeather = weatherState;
    
    for (let i = 0; i < days; i++) {
      // Apply increasing randomness for each day in the future
      const dayVariability = variability * (1 + i * 0.2); 
      
      // Generate random factors for this day
      const randTemp = ((Math.random() * 2 - 1) * dayVariability) / 4;
      const randWind = ((Math.random() * 2 - 1) * dayVariability) / 2;
      const randPrecip = ((Math.random() * 2 - 1) * dayVariability) / 2;
      const randHumid = ((Math.random() * 2 - 1) * dayVariability) / 2;
      
      // Calculate new weather values using previous day as base
      const dayWeather = {
        temperature: Math.max(-10, Math.min(10, Math.round(
          (terrain.temperature + previousWeather.temperature) / 2 + randTemp
        ))),
        wind: Math.max(-10, Math.min(10, Math.round(
          (terrain.wind + previousWeather.wind) / 2 + randWind
        ))),
        precipitation: Math.max(-10, Math.min(10, Math.round(
          (terrain.precipitation + previousWeather.precipitation) / 2 + randPrecip
        ))),
        humidity: Math.max(-10, Math.min(10, Math.round(
          (terrain.humidity + previousWeather.humidity) / 2 + randHumid
        ))),
        day: i + 1
      };
      
      // Add day to forecast
      forecast.push(dayWeather);
      
      // Use this day as base for next day
      previousWeather = dayWeather;
    }
    
    return forecast;
  }
  
  /**
   * Create change indicators between weather states
   * @param {Object} current - Current weather value
   * @param {Object} previous - Previous weather value
   * @param {string} type - Value type (temp, wind, precip, humid)
   * @returns {string} Change indicator text
   */
  static getChangeIndicator(current, previous, type) {
    if (!previous) return "";
    
    const diff = current - previous;
    if (Math.abs(diff) < 0.5) return "";
    
    switch (type) {
      case "temp":
        return diff > 0 ? " (warmer)" : " (cooler)";
      case "wind":
        return diff > 0 ? " (windier)" : " (calmer)";
      case "precip":
        return diff > 0 ? " (wetter)" : " (drier)";
      case "humid":
        return diff > 0 ? " (more humid)" : " (less humid)";
      default:
        return "";
    }
  }
}