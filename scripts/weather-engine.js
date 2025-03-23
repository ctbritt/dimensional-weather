/**
 * Dimensional Weather - Weather Engine
 * Core weather generation logic
 */

import { Settings } from "./settings.js";
import { ErrorHandler, SceneUtils } from "./utils.js";

export class WeatherEngine {
  /**
   * Create a new WeatherEngine
   * @param {Object} settingsData - The campaign settings data
   */
  constructor(settingsData = null) {
    this.settingsData = settingsData;
    this._timePeriodCache = {
      timestamp: 0,
      period: null,
    };
    this._lastDebugTimestamp = null;
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
   * @returns {Promise<void>}
   */
  async initializeWeather(scene) {
    if (!scene?.id) {
      ErrorHandler.logAndNotify(
        "No scene provided to initialize weather",
        null,
        true
      );
      return;
    }

    // Check for existing weather state
    const existingState = scene.getFlag("dimensional-weather", "weatherState");
    if (existingState) {
      console.log(
        "Dimensional Weather | Preserving existing weather state:",
        existingState
      );
      return;
    }

    // Get current terrain and season from settings
    const terrain = Settings.getSetting("terrain");
    const season = Settings.getSetting("season");

    // Validate terrain exists
    if (!this.settingsData?.terrains?.[terrain]) {
      ErrorHandler.logAndNotify(
        `Invalid terrain: ${terrain}, falling back to first available terrain`,
        null,
        true
      );
      const defaultTerrain = Object.keys(this.settingsData.terrains)[0];
      await Settings.updateSetting("terrain", defaultTerrain);
      return;
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
      return;
    }

    const terrainData = this.settingsData.terrains[terrain];

    // Initialize weather state in scene flags
    const weatherState = {
      temperature: terrainData.temperature,
      wind: terrainData.wind,
      precipitation: terrainData.precipitation,
      humidity: terrainData.humidity,
      lastUpdate: this._getCurrentTimestamp(),
      terrain: terrain,
      season: season,
    };

    await scene.setFlag("dimensional-weather", "weatherState", weatherState);
  }

  /**
   * Updates the weather based on terrain, season, and time of day
   * @param {boolean} forced - Whether this is a forced update
   * @returns {Promise<void>}
   */
  async updateWeather(forced = false) {
    if (!this.settingsData?.terrains) {
      ErrorHandler.logAndNotify("Settings data or terrains not loaded", null);
      return;
    }

    const scene = game.scenes.viewed;
    if (!scene?.id) {
      ErrorHandler.logAndNotify(
        "No viewed scene found to update weather",
        null,
        true
      );
      return;
    }

    // Get current time once at the start
    const currentTime = this._getCurrentTimestamp();

    const savedState = scene.getFlag("dimensional-weather", "weatherState");
    const autoUpdate = Settings.getSetting("autoUpdate");
    const updateFrequency = Settings.getSetting("updateFrequency");
    const weatherVariability = Settings.getSetting("variability");

    const lastUpdateTime = savedState?.lastUpdate || 0;
    const hoursSinceLastUpdate = (currentTime - lastUpdateTime) / 3600;

    // If this is a forced update, we'll update regardless of time
    // If it's not forced, check if auto-update is enabled and enough time has passed
    if (!forced && (!autoUpdate || hoursSinceLastUpdate < updateFrequency)) {
      console.log(
        "Dimensional Weather | Skipping update - not enough time has passed or auto-update disabled"
      );
      return;
    }

    // Get current terrain and season from saved state or settings
    const currentTerrain =
      savedState?.terrain || Settings.getSetting("terrain");
    const currentSeason = savedState?.season || Settings.getSetting("season");

    // Validate terrain exists
    if (!this.settingsData.terrains[currentTerrain]) {
      ErrorHandler.logAndNotify(
        `Invalid terrain: ${currentTerrain}, falling back to first available terrain`,
        null,
        true
      );
      const defaultTerrain = Object.keys(this.settingsData.terrains)[0];
      await Settings.updateSetting("terrain", defaultTerrain);

      // Update scene flags with the new terrain
      await SceneUtils.updateFlags(scene, "weatherState", {
        terrain: defaultTerrain,
      });

      ui.notifications.warn(
        `Invalid terrain "${currentTerrain}" for current campaign setting. Changed to "${defaultTerrain}".`
      );

      return; // Exit and wait for next update cycle
    }

    const terrain = this.settingsData.terrains[currentTerrain];

    // Calculate weather changes
    const newWeather = this._calculateWeatherChanges(
      terrain,
      savedState,
      weatherVariability,
      currentTime,
      currentSeason
    );

    // Save the new weather state to scene flags
    await scene.setFlag("dimensional-weather", "weatherState", newWeather);
  }

  /**
   * Calculate weather changes based on terrain, past weather, and variability
   * @private
   * @param {Object} terrain - Terrain data
   * @param {Object|null} savedState - Previous weather state
   * @param {number} variability - Weather variability setting
   * @param {number} currentTime - Current timestamp
   * @param {string} currentSeason - Current season key
   * @returns {Object} New weather state
   */
  _calculateWeatherChanges(
    terrain,
    savedState,
    variability,
    currentTime,
    currentSeason
  ) {
    // Apply terrain baseline with random variation
    const temperature = Math.round(
      terrain.temperature + // Start with base terrain temperature
        ((Math.random() * 2 - 1) * variability) / 4 // Reduce variability impact
    );

    const wind = Math.round(
      (terrain.wind + (savedState?.wind ?? terrain.wind)) / 2 +
        ((Math.random() * 2 - 1) * variability) / 2
    );

    const precipitation = Math.round(
      (terrain.precipitation +
        (savedState?.precipitation ?? terrain.precipitation)) /
        2 +
        ((Math.random() * 2 - 1) * variability) / 2
    );

    const humidity = Math.round(
      (terrain.humidity + (savedState?.humidity ?? terrain.humidity)) / 2 +
        ((Math.random() * 2 - 1) * variability) / 2
    );

    // Apply time-of-day modifier
    const timePeriod = this.getTimePeriod(currentTime);
    const modifiers = this.settingsData?.timeModifiers?.[timePeriod] || {};

    // Apply season modifiers
    const seasonModifiers = this._getSeasonModifiers(currentSeason);

    // Calculate final values with time and season modifiers
    // Reduce the impact of time modifiers on temperature
    const finalTemperature =
      temperature +
      (modifiers.temperature || 0) / 2 +
      (seasonModifiers.temperature || 0);

    const finalWind =
      wind + (modifiers.wind || 0) + (seasonModifiers.wind || 0);

    const finalPrecipitation =
      precipitation +
      (modifiers.precipitation || 0) +
      (seasonModifiers.precipitation || 0);

    const finalHumidity =
      humidity + (modifiers.humidity || 0) + (seasonModifiers.humidity || 0);

    // Clamp values within -10 and 10
    return {
      temperature: Math.max(-10, Math.min(10, finalTemperature)),
      wind: Math.max(-10, Math.min(10, finalWind)),
      precipitation: Math.max(-10, Math.min(10, finalPrecipitation)),
      humidity: Math.max(-10, Math.min(10, finalHumidity)),
      lastUpdate: currentTime,
      terrain:
        savedState?.terrain || terrain.name.toLowerCase().replace(/\s+/g, ""),
      season: currentSeason,
    };
  }

  /**
   * Get modifiers for the current season
   * @private
   * @param {string} seasonKey - Season key
   * @returns {Object} Season modifiers
   */
  _getSeasonModifiers(seasonKey) {
    const season = this.settingsData?.seasons?.[seasonKey];
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
   * Get the current time period based on Simple Calendar data
   * @param {number} timestamp - Current timestamp
   * @returns {string} Time period name
   */
  getTimePeriod(timestamp) {
    if (!SimpleCalendar?.api) {
      return "Unknown Time";
    }

    // Use cached value if timestamp hasn't changed
    if (this._timePeriodCache.timestamp === timestamp) {
      return this._timePeriodCache.period;
    }

    // If no timestamp provided, get current time from Simple Calendar
    if (!timestamp) {
      timestamp = SimpleCalendar.api.timestamp();
    }

    const dateData = SimpleCalendar.api.timestampToDate(timestamp);
    const { sunrise, sunset, midday } = dateData;

    // Validate the time values
    if (sunrise === undefined || sunset === undefined || midday === undefined) {
      return "Unknown Time";
    }

    // Calculate period boundaries in timestamps
    const daylightDuration = sunset - sunrise;
    const nightDuration = 24 - daylightDuration;

    // Ensure durations are positive
    if (daylightDuration <= 0 || nightDuration <= 0) {
      return "Unknown Time";
    }

    const earlyMorningEnd = sunrise + daylightDuration * 0.25;
    const noonEnd = sunrise + daylightDuration * 0.5;
    const afternoonEnd = sunset;
    const nightEnd = sunset + nightDuration * 0.5;

    // Debug logging only if enabled and timestamp is different from last debug
    if (
      Settings.getSetting("debugTimePeriod") &&
      this._lastDebugTimestamp !== timestamp
    ) {
      this._lastDebugTimestamp = timestamp;
      console.log("Dimensional Weather | Time Period Debug:", {
        currentTimestamp: timestamp,
        sunrise,
        sunset,
        midday,
        earlyMorningEnd,
        noonEnd,
        afternoonEnd,
        nightEnd,
        nightDuration,
        normalizedTimestamp: timestamp % 24,
      });
    }

    // Normalize timestamp to 24-hour cycle
    const normalizedTimestamp = timestamp % 24;

    // Determine current time period based on normalized timestamp
    let period;
    if (
      normalizedTimestamp >= sunrise &&
      normalizedTimestamp < earlyMorningEnd
    ) {
      period = "Early Morning";
    } else if (
      normalizedTimestamp >= earlyMorningEnd &&
      normalizedTimestamp < noonEnd
    ) {
      period = "Noon";
    } else if (
      normalizedTimestamp >= noonEnd &&
      normalizedTimestamp < afternoonEnd
    ) {
      period = "Afternoon";
    } else if (
      normalizedTimestamp >= afternoonEnd &&
      normalizedTimestamp < nightEnd
    ) {
      period = "Night";
    } else {
      period = "Late Night";
    }

    // Cache the result
    this._timePeriodCache = {
      timestamp,
      period,
    };

    return period;
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

  /**
   * Generate survival rules based on current weather conditions and terrain
   * @returns {string} HTML for survival rules
   */
  getSurvivalRules() {
    const weatherState = SceneUtils.getWeatherState();
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

    return `<h4>Survival Rules:</h4><ul>${rulesList}</ul>`;
  }

  /**
   * Generate a basic weather description
   * @returns {string} Weather description
   */
  getBasicWeatherDescription() {
    const weatherState = SceneUtils.getWeatherState();
    if (!weatherState || !this.settingsData) {
      return "<p>No weather data available</p>";
    }

    // Get terrain description
    const terrain = this.settingsData?.terrains?.[weatherState.terrain];
    const atmosphericDesc =
      terrain?.description || "The landscape stretches before you.";

    // Get weather dimension descriptions
    const tempDesc =
      this.settingsData.weatherDimensions.temperature.descriptions[
        this._roundToNextLevel(
          weatherState.temperature,
          this.settingsData.weatherDimensions.temperature.descriptions
        )
      ] || "Normal temperature";

    const windDesc =
      this.settingsData.weatherDimensions.wind.descriptions[
        this._roundToNextLevel(
          weatherState.wind,
          this.settingsData.weatherDimensions.wind.descriptions
        )
      ] || "Normal wind";

    const precipDesc =
      this.settingsData.weatherDimensions.precipitation.descriptions[
        this._roundToNextLevel(
          weatherState.precipitation,
          this.settingsData.weatherDimensions.precipitation.descriptions
        )
      ] || "Clear skies";

    const humidDesc =
      this.settingsData.weatherDimensions.humidity.descriptions[
        this._roundToNextLevel(
          weatherState.humidity,
          this.settingsData.weatherDimensions.humidity.descriptions
        )
      ] || "Normal humidity";

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

    const weatherState = SceneUtils.getWeatherState();
    if (!weatherState) {
      return "No current weather data available.";
    }

    const currentTerrain = weatherState.terrain;
    const terrain =
      this.settingsData.terrains[currentTerrain] ||
      Object.values(this.settingsData.terrains)[0];

    const variability = Settings.getSetting("variability");

    // Generate 5 days of weather
    const forecast = [];
    for (let i = 0; i < 5; i++) {
      // Use the terrain as a base and add some randomness
      const dayWeather = {
        temperature: Math.round(
          terrain.temperature + (Math.random() * 2 - 1) * variability
        ),
        wind: Math.round(terrain.wind + (Math.random() * 2 - 1) * variability),
        precipitation: Math.round(
          terrain.precipitation + (Math.random() * 2 - 1) * variability
        ),
        humidity: Math.round(
          terrain.humidity + (Math.random() * 2 - 1) * variability
        ),
      };

      // Clamp values within -10 and 10
      dayWeather.temperature = Math.max(
        -10,
        Math.min(10, dayWeather.temperature)
      );
      dayWeather.wind = Math.max(-10, Math.min(10, dayWeather.wind));
      dayWeather.precipitation = Math.max(
        -10,
        Math.min(10, dayWeather.precipitation)
      );
      dayWeather.humidity = Math.max(-10, Math.min(10, dayWeather.humidity));

      forecast.push(dayWeather);
    }

    // Helper to create change indicators
    const getChangeIndicator = (current, previous, type) => {
      if (!previous) return "";
      const diff = current - previous;
      if (diff === 0) return "";

      switch (type) {
        case "temp":
          return diff > 0 ? " (hotter)" : " (cooler)";
        case "wind":
          return diff > 0 ? " (more windy)" : " (less windy)";
        case "precip":
          return diff > 0 ? " (more precip)" : " (less precip)";
        case "humid":
          return diff > 0 ? " (more humid)" : " (less humid)";
        default:
          return "";
      }
    };

    // Format the forecast
    const forecastText = forecast
      .map((day, index) => {
        const dayNum = index + 1;
        const prevDay = index > 0 ? forecast[index - 1] : null;

        return `Day ${dayNum}:
Temperature: ${day.temperature}${getChangeIndicator(
          day.temperature,
          prevDay?.temperature,
          "temp"
        )}
Wind: ${day.wind}${getChangeIndicator(day.wind, prevDay?.wind, "wind")}
Precipitation: ${day.precipitation}${getChangeIndicator(
          day.precipitation,
          prevDay?.precipitation,
          "precip"
        )}
Humidity: ${day.humidity}${getChangeIndicator(
          day.humidity,
          prevDay?.humidity,
          "humid"
        )}`;
      })
      .join("\n\n");

    // Format terrain name
    const formattedTerrain = currentTerrain.replace(/([A-Z])/g, " $1").trim();

    return `5-Day Weather Forecast
Current Terrain: ${formattedTerrain}

${forecastText}`;
  }

  /**
   * Get current timestamp
   * @private
   * @returns {number} Current timestamp
   */
  _getCurrentTimestamp() {
    return SimpleCalendar?.api ? SimpleCalendar.api.timestamp() : Date.now();
  }
}
