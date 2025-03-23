/**
 * Dimensional Weather - UI Controller
 * Handles UI updates and rendering
 */

import { Settings } from "./settings.js";
import { DOMUtils, SceneUtils, ErrorHandler } from "./utils.js";
import { WeatherDescriptionService } from "./services/weather-description.js";

export class UIController {
  /**
   * Create a new UI Controller
   * @param {Object} settingsData - The campaign settings data
   */
  constructor(settingsData = null) {
    this.settingsData = settingsData;
    this.descriptionService = null;

    // Load description service if API key is available
    const apiKey = Settings.getSetting("apiKey");
    if (apiKey && Settings.getSetting("useAI")) {
      this.descriptionService = new WeatherDescriptionService(apiKey);
    }

    // Default styles
    this.defaultStyles = {
      headingFont: "Signika, sans-serif",
      textFont: "Signika, sans-serif",
      headingColor: "#2C3E50",
      textColor: "#34495E",
      backgroundColor: "#ECF0F1",
      accentColor: "#3498DB",
      borderColor: "#2980B9",
    };
  }

  /**
   * Update the campaign settings data
   * @param {Object} settingsData - New settings data
   */
  updateSettingsData(settingsData) {
    this.settingsData = settingsData;

    // Update styles if available
    if (settingsData?.styles) {
      this.updateStyles(settingsData.styles);
    }
  }

  /**
   * Update the module's styles based on campaign settings
   * @param {Object} styles - The styles object from campaign settings
   */
  updateStyles(styles = {}) {
    const finalStyles = { ...this.defaultStyles, ...styles };
    const styleId = "dimensional-weather-styles";

    // Build CSS rules as a string
    const cssRules = this._buildCssRules(finalStyles);

    // Update or create style element
    DOMUtils.updateStyleElement(styleId, cssRules);
  }

  /**
   * Build CSS rules as a string
   * @private
   * @param {Object} styles - Style definitions
   * @returns {string} CSS rules
   */
  _buildCssRules(styles) {
    return `
      .weather-help {
        font-family: ${styles.textFont};
        color: ${styles.textColor};
        background: ${styles.backgroundColor};
        padding: 10px;
        border-radius: 5px;
      }
      .weather-help h2, .weather-help h3 {
        font-family: ${styles.headingFont};
        color: ${styles.headingColor};
        margin: 5px 0;
        border-bottom: 2px solid ${styles.accentColor};
      }
      .weather-help .command {
        margin: 5px 0;
      }
      .weather-help .command-name {
        color: ${styles.accentColor};
        font-weight: bold;
        margin-right: 10px;
      }
      .weather-help .command-desc {
        color: ${styles.textColor};
        font-style: italic;
      }
      .weather-help .list-section {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 5px;
      }
      .weather-help .list-item {
        color: ${styles.textColor};
        padding: 2px 5px;
      }
      
      .weather-report.${this.settingsData?.id || "default"} {
        font-family: ${styles.textFont};
      }
      .weather-report.${this.settingsData?.id || "default"} h4 {
        font-family: ${styles.headingFont};
        color: ${styles.headingColor};
        border-bottom: 2px solid ${styles.accentColor};
      }
      .weather-report.${this.settingsData?.id || "default"} ul {
        color: ${styles.textColor};
      }
      .weather-report.${this.settingsData?.id || "default"} li {
        border-left: 3px solid ${styles.accentColor};
        padding-left: 10px;
        margin-bottom: 8px;
      }
    `;
  }

  /**
   * Display the current weather report as a chat message
   * @returns {Promise<boolean>} Success status
   */
  async displayWeatherReport() {
    try {
      const scene = game.scenes.viewed;
      if (!scene?.id) {
        ErrorHandler.logAndNotify(
          "No viewed scene found to display weather",
          null,
          true
        );
        return false;
      }

      const weatherState = SceneUtils.getWeatherState();
      if (!weatherState) {
        ErrorHandler.logAndNotify(
          "No weather state found for scene",
          null,
          true
        );
        return false;
      }

      // Get weather description
      const description = await this._getWeatherDescription(weatherState);

      // Format terrain name
      const terrainDisplay = this._getFormattedTerrainName(
        weatherState.terrain
      );

      // Get season and time information
      const seasonDisplay = this._getSeasonName(weatherState.season);
      const timeDisplay = this._getTimePeriod();

      // Get campaign ID for styling
      const campaignId = this.settingsData?.id || "default";

      // Build chat card
      const chatCardText = `<div class="weather-report ${campaignId}">
        <h3>Current Weather</h3>
        <p class="terrain-type">${terrainDisplay} - ${timeDisplay} - ${seasonDisplay}</p>
        <hr>
        <div class="weather-description">${description}</div>
      </div>`;

      // Send chat message
      await ChatMessage.create({
        content: chatCardText,
        speaker: { alias: "Dimensional Weather" },
      });

      return true;
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to display weather report", error);
      return false;
    }
  }

  /**
   * Get weather description - uses AI if available, otherwise uses basic description
   * @private
   * @param {Object} weatherState - Current weather state
   * @returns {Promise<string>} Weather description HTML
   */
  async _getWeatherDescription(weatherState) {
    if (!this.settingsData) {
      return "<p>Weather system is not fully initialized.</p>";
    }

    // Get dimension descriptions
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

    // Get terrain description
    const terrain = this.settingsData?.terrains?.[weatherState.terrain];
    const atmosphericDesc =
      terrain?.description || "The landscape stretches before you.";

    // Get time period
    const timePeriod = this._getTimePeriod();

    // Try to use AI description service if enabled
    if (Settings.getSetting("useAI") && this.descriptionService) {
      try {
        const prompt = {
          campaign: this.settingsData.name,
          terrain: atmosphericDesc,
          tempDesc,
          windDesc,
          precipDesc,
          humidDesc,
          timePeriod,
        };

        const aiDescription = await this.descriptionService.generateWeatherDescription(
          prompt
        );

        // Get survival rules
        const survivalRules = this._getSurvivalRules(weatherState);

        return `${aiDescription} ${survivalRules}`;
      } catch (error) {
        console.error("AI description generation failed:", error);
        // Fall back to basic description
      }
    }

    // Basic description as fallback
    return this._getBasicDescription(
      atmosphericDesc,
      tempDesc,
      windDesc,
      precipDesc,
      humidDesc
    );
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
   * Round a value to the nearest available description level
   * @private
   * @param {number} value - The value to round
   * @param {Object} descriptions - Description mapping
   * @returns {string} The nearest level as a string
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
   * Get a formatted terrain name
   * @private
   * @param {string} terrainKey - Terrain key
   * @returns {string} Formatted terrain name
   */
  _getFormattedTerrainName(terrainKey) {
    const terrain = this.settingsData?.terrains?.[terrainKey];

    if (terrain?.name) {
      return terrain.name;
    }

    // Format camelCase to Title Case
    return terrainKey
      .replace(/([A-Z])/g, " $1")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Get the name of the current season
   * @private
   * @param {string} seasonKey - Season key
   * @returns {string} Season name
   */
  _getSeasonName(seasonKey) {
    // Try to get season from Simple Calendar first
    if (Settings.isSimpleCalendarEnabled() && SimpleCalendar?.api) {
      const currentSeason = SimpleCalendar.api.getCurrentSeason();
      if (currentSeason) {
        return currentSeason.name;
      }
    }

    // Fall back to settings
    const season = this.settingsData?.seasons?.[seasonKey];
    return season?.name || seasonKey;
  }

  /**
   * Get the current time period
   * @private
   * @returns {string} Time period name
   */
  _getTimePeriod() {
    const timestamp = SimpleCalendar?.api?.timestamp?.();

    if (!timestamp || !SimpleCalendar?.api) {
      return "Unknown Time";
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

    // Normalize timestamp to 24-hour cycle
    const normalizedTimestamp = timestamp % 24;

    // Determine current time period based on normalized timestamp
    if (
      normalizedTimestamp >= sunrise &&
      normalizedTimestamp < earlyMorningEnd
    ) {
      return "Early Morning";
    } else if (
      normalizedTimestamp >= earlyMorningEnd &&
      normalizedTimestamp < noonEnd
    ) {
      return "Noon";
    } else if (
      normalizedTimestamp >= noonEnd &&
      normalizedTimestamp < afternoonEnd
    ) {
      return "Afternoon";
    } else if (
      normalizedTimestamp >= afternoonEnd &&
      normalizedTimestamp < nightEnd
    ) {
      return "Night";
    } else {
      return "Late Night";
    }
  }

  /**
   * Get a basic weather description
   * @private
   * @param {string} atmosphericDesc - Terrain description
   * @param {string} tempDesc - Temperature description
   * @param {string} windDesc - Wind description
   * @param {string} precipDesc - Precipitation description
   * @param {string} humidDesc - Humidity description
   * @returns {string} Formatted weather description
   */
  _getBasicDescription(
    atmosphericDesc,
    tempDesc,
    windDesc,
    precipDesc,
    humidDesc
  ) {
    // Format the weather conditions with appropriate styling
    const weatherDesc = `${atmosphericDesc}
<p><strong>Heat:</strong> ${tempDesc}</p>
<p><strong>Wind:</strong> ${windDesc}</p>
<p><strong>Humidity:</strong> ${humidDesc}</p>
<p><strong>Precipitation:</strong> ${precipDesc}</p>`;

    // Get survival rules
    const survivalRules = this._getSurvivalRules();

    return `${weatherDesc}\n\n${survivalRules}`;
  }

  /**
   * Get survival rules based on current weather
   * @private
   * @param {Object} weatherState - Weather state (optional, uses scene flag if not provided)
   * @returns {string} Survival rules HTML
   */
  _getSurvivalRules(weatherState = null) {
    if (!weatherState) {
      weatherState = SceneUtils.getWeatherState();
    }

    if (!weatherState || !this.settingsData) {
      return "<h4>Survival Rules:</h4><ul><li>No weather data available</li></ul>";
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
   * Display calendar information
   * @returns {string} Calendar info HTML
   */
  getCalendarInfo() {
    if (!SimpleCalendar?.api) {
      return "Simple Calendar is not active.";
    }

    const dt = SimpleCalendar.api.currentDateTimeDisplay();

    return `<div class="weather-calendar">
      <h3>Calendar Information</h3>
      <p>Date: ${dt.day}${dt.daySuffix} ${dt.monthName}</p>
      <p>Time: ${dt.time}</p>
    </div>`;
  }
}
