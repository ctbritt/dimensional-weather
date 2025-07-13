/**
 * Dimensional Weather - Weather Engine (Optimized)
 * Core weather generation logic with improved performance
 */

import { Settings } from "./settings.js";
import { ErrorHandler } from "./utils.js";
import { TimeUtils } from "./time-utils.js";
import { WeatherCalculator } from "./weather-calculator.js";
import { SceneManager } from "./scene-manager.js";

export class WeatherEngine {
  /**
   * Create a new WeatherEngine
   * @param {Object} settingsData - The campaign settings data
   */
  constructor(settingsData = null) {
    this.settingsData = settingsData;
    this._lastCalculation = null;
    this._calculationHistoryLimit = 5;
    this._calculationHistory = [];
  }

  /**
   * Update the campaign settings data
   * @param {Object} settingsData - New settings data
   */
  updateSettingsData(settingsData) {
    this.settingsData = settingsData;
  }

  /**
   * Initialize weather state for a scene
   * @param {Scene} scene - The scene to initialize weather for
   * @returns {Promise<boolean>} Success status
   */
  async initializeWeather(scene) {
    if (!scene?.id) {
      ErrorHandler.logAndNotify(
        "No scene provided to initialize weather",
        null,
        true
      );
      return false;
    }

    // Check for existing weather state
    const existingState = SceneManager.getWeatherState(scene);
    if (existingState) {
      console.log(
        "Dimensional Weather | Preserving existing weather state:",
        existingState
      );
      return false;
    }

    try {
      // Get current terrain and season from settings
      const terrain = Settings.getSetting("terrain");

      // Determine season
      const season =
        this._determineCurrentSeason() || Settings.getSetting("season");

      // Validate terrain exists
      if (!this.settingsData?.terrains?.[terrain]) {
        ErrorHandler.logAndNotify(
          `Invalid terrain: ${terrain}, falling back to first available terrain`,
          null,
          true
        );
        const defaultTerrain = Object.keys(this.settingsData.terrains)[0];
        await Settings.updateSetting("terrain", defaultTerrain);
        return false;
      }

      // Validate season exists
      if (!this.settingsData?.seasons?.[season]) {
        ErrorHandler.logAndNotify(
          `Invalid season: ${season}, falling back to first available season`,
          null,
          true
        );
        const defaultSeason = Object.keys(this.settingsData.seasons)[0];
        await Settings.updateSetting("season", defaultSeason);
        return false;
      }

      const terrainData = this.settingsData.terrains[terrain];

      // Initialize weather state using terrain data
      const initialState = {
        temperature: terrainData.temperature,
        wind: terrainData.wind,
        precipitation: terrainData.precipitation,
        humidity: terrainData.humidity,
        terrain: terrain,
        season: season,
      };

      // Initialize weather state in scene flags
      return await SceneManager.initializeWeatherState(scene, initialState);
    } catch (error) {
      ErrorHandler.logAndNotify(
        "Failed to initialize weather for scene",
        error
      );
      return false;
    }
  }

  /**
   * Update weather based on terrain, season, and time of day
   * @param {Object} options - Update options
   * @param {boolean} options.forced - Whether this is a forced update
   * @returns {Promise<Object|null>} New weather state or null on failure
   */
  async updateWeather(options = {}) {
    const { forced = false } = options;

    if (!this.settingsData?.terrains) {
      ErrorHandler.logAndNotify("Settings data or terrains not loaded", null);
      return null;
    }

    const scene = game.scenes.viewed;
    if (!scene?.id) {
      ErrorHandler.logAndNotify(
        "No viewed scene found to update weather",
        null,
        true
      );
      return null;
    }

    try {
      // Get current weather state
      const weatherState = SceneManager.getWeatherState(scene);

      // If no weather state, initialize it first
      if (!weatherState) {
        const success = await this.initializeWeather(scene);
        if (!success) return null;
        return SceneManager.getWeatherState(scene);
      }

      // Check if update is needed
      if (!forced) {
        const updateFrequency = Settings.getSetting("updateFrequency");
        if (
          !TimeUtils.isUpdateNeeded(weatherState.lastUpdate, updateFrequency)
        ) {
          return weatherState;
        }
      }

      // Get current terrain from saved state
      const currentTerrain = weatherState.terrain;

      // Determine current season
      const currentSeason =
        this._determineCurrentSeason(weatherState) || weatherState.season;

      // Validate terrain exists
      const terrain = this.settingsData.terrains[currentTerrain];
      if (!terrain) {
        ErrorHandler.logAndNotify(
          `Invalid terrain "${currentTerrain}", falling back to default`,
          null,
          true
        );
        const defaultTerrain = Object.keys(this.settingsData.terrains)[0];
        await SceneManager.setWeatherAttribute(
          "terrain",
          defaultTerrain,
          scene
        );
        return null;
      }

      // Get variability setting
      const weatherVariability = Settings.getSetting("variability");

      // Calculate new weather
      const result = WeatherCalculator.calculateWeatherChanges({
        terrain,
        savedState: weatherState,
        variability: weatherVariability,
        currentSeason,
        settingsData: this.settingsData,
      });

      // Store calculation details
      this._lastCalculation = result.details;
      this._addToCalculationHistory(result.details);

      // Update weather state
      await SceneManager.updateWeatherState(result.weatherState, scene);

      return result.weatherState;
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to update weather", error);
      return null;
    }
  }

  /**
   * Get the last weather calculation details
   * @returns {Object|null} Calculation details or null if no calculation performed
   */
  getLastCalculation() {
    return this._lastCalculation;
  }

  /**
   * Get calculation history
   * @returns {Array} Calculation history
   */
  getCalculationHistory() {
    return this._calculationHistory;
  }

  /**
   * Add calculation to history
   * @private
   * @param {Object} calculation - Calculation details
   */
  _addToCalculationHistory(calculation) {
    // Add timestamp if not present
    const calculationWithTime = {
      ...calculation,
      timestamp: calculation.timestamp || Date.now(),
    };

    // Add to history
    this._calculationHistory.unshift(calculationWithTime);

    // Limit history size
    if (this._calculationHistory.length > this._calculationHistoryLimit) {
      this._calculationHistory = this._calculationHistory.slice(
        0,
        this._calculationHistoryLimit
      );
    }
  }

  /**
   * Determine current season based on Simple Calendar or saved state
   * @private
   * @param {Object} weatherState - Current weather state
   * @returns {string|null} Season key or null if not found
   */
  _determineCurrentSeason(weatherState = null) {
    console.log(
      "DimensionalWeather | WeatherEngine._determineCurrentSeason: Called.",
      { weatherState }
    ); // Log entry
    // Direct checks
    const isDSCActive = game.modules.get("dark-sun-calendar")?.active; // Keep for logging
    const useDarkSunCalendarSetting = Settings.getSetting("useDarkSunCalendar");
    const dscAPI = window.DSC;
    console.log(
      "DimensionalWeather | WeatherEngine._determineCurrentSeason: Direct check results.",
      { isDSCActive, useDarkSunCalendarSetting, dscAPIAvailable: !!dscAPI }
    ); // Log direct checks

    // If the setting is enabled AND the Dark Sun Calendar API exists
    if (useDarkSunCalendarSetting && dscAPI) {
      console.log(
        "DimensionalWeather | WeatherEngine._determineCurrentSeason: Using Dark Sun Calendar (checked API exists). Calling TimeUtils.getCurrentSeason..."
      ); // Log decision
      return TimeUtils.getCurrentSeason(this.settingsData);
    }

    console.log(
      "DimensionalWeather | WeatherEngine._determineCurrentSeason: Falling back to stored season."
    ); // Log fallback
    // Fall back to stored season
    return weatherState?.season || null;
  }

  /**
   * Get the current time period based on Simple Calendar
   * @returns {string} Time period name
   */
  getTimePeriod() {
    return TimeUtils.getTimePeriod();
  }

  /**
   * Generate survival rules based on current weather conditions and terrain
   * @returns {string} HTML for survival rules
   */
  getSurvivalRules() {
    const weatherState = SceneManager.getWeatherState();
    if (!weatherState || !this.settingsData) {
      return "<p>No weather data available</p>";
    }

    // Build rules list
    let rulesList = "";

    // Helper function to split effect text into bullet points
    const addEffectBullets = (effect) => {
      // Split by periods and filter out empty strings
      const bullets = effect.split(".").filter((bullet) => bullet.trim());
      bullets.forEach((bullet) => {
        rulesList += `<li>${bullet.trim()}.</li>`;
      });
    };

    // Temperature-based rules
    if (this.settingsData?.weatherDimensions?.temperature?.rules) {
      const tempRules = this.settingsData.weatherDimensions.temperature.rules;
      tempRules.forEach((rule) => {
        if (
          rule.extremeHeat !== undefined &&
          weatherState.temperature >= rule.extremeHeat
        ) {
          addEffectBullets(rule.effect);
        }
        if (
          rule.extremeCold !== undefined &&
          weatherState.temperature <= rule.extremeCold
        ) {
          addEffectBullets(rule.effect);
        }
      });
    }

    // Wind-based rules
    if (this.settingsData?.weatherDimensions?.wind?.rules) {
      const windRules = this.settingsData.weatherDimensions.wind.rules;
      windRules.forEach((rule) => {
        if (
          rule.strongWind !== undefined &&
          weatherState.wind >= rule.strongWind
        ) {
          addEffectBullets(rule.effect);
        }
      });
    }

    // Precipitation-based rules
    if (this.settingsData?.weatherDimensions?.precipitation?.rules) {
      const precipRules = this.settingsData.weatherDimensions.precipitation
        .rules;
      precipRules.forEach((rule) => {
        if (
          rule.heavyPrecipitation !== undefined &&
          weatherState.precipitation >= rule.heavyPrecipitation
        ) {
          addEffectBullets(rule.effect);
        }
      });
    }

    // Add terrain-specific rules
    const terrain = this.settingsData?.terrains?.[weatherState.terrain];
    if (terrain?.rules) {
      terrain.rules.forEach((rule) => {
        rulesList += `<li>${rule}</li>`;
      });
    }

    // If no rules found, provide a default message
    if (!rulesList) {
      rulesList = "<li>No special rules apply to current conditions.</li>";
    }

    return `<div class="weather-rules">
      <details>
        <summary>Survival Rules</summary>
        <ul>${rulesList}</ul>
      </details>
    </div>`;
  }

  /**
   * Generate a basic weather description
   * @returns {string} Weather description
   */
  getBasicWeatherDescription() {
    const weatherState = SceneManager.getWeatherState();
    if (!weatherState || !this.settingsData) {
      return "<p>No weather data available</p>";
    }

    // Get terrain description
    const terrain = this.settingsData?.terrains?.[weatherState.terrain];
    const atmosphericDesc =
      terrain?.description || "The landscape stretches before you.";

    // Get weather dimension descriptions
    const tempDesc = this._getDimensionDescription(
      "temperature",
      weatherState.temperature
    );

    const windDesc = this._getDimensionDescription("wind", weatherState.wind);

    const precipDesc = this._getDimensionDescription(
      "precipitation",
      weatherState.precipitation
    );

    const humidDesc = this._getDimensionDescription(
      "humidity",
      weatherState.humidity
    );

    // Format the weather conditions with appropriate styling
    return `${atmosphericDesc}
<p><strong>Heat:</strong> ${tempDesc}</p>
<p><strong>Wind:</strong> ${windDesc}</p>
<p><strong>Humidity:</strong> ${humidDesc}</p>
<p><strong>Precipitation:</strong> ${precipDesc}</p>`;
  }

  /**
   * Generate a 5-day weather forecast
   * @returns {string} Forecast HTML
   */
  async generateForecast() {
    if (!this.settingsData) {
      return "Weather system is not initialized.";
    }

    const weatherState = SceneManager.getWeatherState();
    if (!weatherState) {
      return "No current weather data available.";
    }

    const currentTerrain = weatherState.terrain;
    const terrain =
      this.settingsData.terrains[currentTerrain] ||
      Object.values(this.settingsData.terrains)[0];

    const variability = Settings.getSetting("variability");

    // Generate forecast using the calculator
    const forecast = WeatherCalculator.generateForecast({
      terrain,
      weatherState,
      variability,
      days: 5,
    });

    // Format the forecast
    const forecastText = forecast
      .map((day, index) => {
        const dayNum = index + 1;
        const prevDay = index > 0 ? forecast[index - 1] : null;

        return `Day ${dayNum}:
Temperature: ${day.temperature}${WeatherCalculator.getChangeIndicator(
          day.temperature,
          prevDay?.temperature,
          "temp"
        )}
Wind: ${day.wind}${WeatherCalculator.getChangeIndicator(
          day.wind,
          prevDay?.wind,
          "wind"
        )}
Precipitation: ${day.precipitation}${WeatherCalculator.getChangeIndicator(
          day.precipitation,
          prevDay?.precipitation,
          "precip"
        )}
Humidity: ${day.humidity}${WeatherCalculator.getChangeIndicator(
          day.humidity,
          prevDay?.humidity,
          "humid"
        )}`;
      })
      .join("\n\n");

    // Format terrain name
    const formattedTerrain =
      terrain.name || currentTerrain.replace(/([A-Z])/g, " $1").trim();

    return `5-Day Weather Forecast
Current Terrain: ${formattedTerrain}

${forecastText}`;
  }

  /**
   * Get a formatted dimension description
   * @private
   * @param {string} dimension - Dimension name
   * @param {number} value - Dimension value
   * @returns {string} Formatted description
   */
  _getDimensionDescription(dimension, value) {
    if (!this.settingsData?.weatherDimensions?.[dimension]?.descriptions) {
      return `Normal ${dimension}`;
    }

    const descriptions = this.settingsData.weatherDimensions[dimension]
      .descriptions;
    const level = this._roundToNextLevel(value, descriptions);

    return descriptions[level] || `Normal ${dimension}`;
  }

  /**
   * Rounds a value to the next available level in the descriptions
   * For positive numbers, rounds down. For negative numbers, rounds up.
   * @private
   * @param {number} value - Value to round
   * @param {Object} descriptions - Description mapping
   * @returns {string} Rounded value as string
   */
  _roundToNextLevel(value, descriptions) {
    // Get all available levels and sort them
    const levels = Object.keys(descriptions)
      .map(Number)
      .sort((a, b) => a - b);

    // For negative numbers, find the next higher level
    if (value < 0) {
      for (let i = 0; i < levels.length; i++) {
        if (value <= levels[i]) {
          return levels[i].toString();
        }
      }
      // If no higher level found, return the highest negative level
      const negLevels = levels.filter((l) => l < 0);
      return negLevels.length ? Math.max(...negLevels).toString() : "0";
    }

    // For positive numbers, find the next lower level
    for (let i = levels.length - 1; i >= 0; i--) {
      if (value >= levels[i]) {
        return levels[i].toString();
      }
    }

    // If no lower level found, return the lowest level
    return levels[0].toString();
  }
}
