/**
 * Dimensional Weather - UI Controller
 * Handles UI updates and rendering
 */

import { Settings } from "./settings.js";
import { DOMUtils, ErrorHandler } from "./utils.js";
import { SceneManager } from "./scene-manager.js";
import { WeatherDescriptionService } from "./services/weather-description.js";
import { TimeUtils } from "./time-utils.js";

export class UIController {
  /**
   * Create a new UI Controller
   * @param {Object} settingsData - The campaign settings data
   */
  constructor(settingsData = null) {
    this.settingsData = settingsData;
    this.descriptionService = null;

    // Load OpenAI description service
    if (Settings.getSetting("useAI")) {
      const apiKey = Settings.getSetting("apiKey");
      const model = Settings.getSetting("openaiModel");
      if (apiKey) {
        this.descriptionService = new WeatherDescriptionService({ apiKey, model });
      }
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

    // Always apply styles based on useCustomStyles setting
    const useCustomStyles = Settings.getSetting("useCustomStyles");
    if (useCustomStyles && settingsData?.styles) {
      this.updateStyles(settingsData.styles);
    } else {
      this.updateStyles(this.defaultStyles);
    }
  }

  /**
   * Update the campaign settings data
   * @param {Object} settingsData - New settings data
   */
  updateSettingsData(settingsData) {
    this.settingsData = settingsData;

    // Update styles based on useCustomStyles setting
    const useCustomStyles = Settings.getSetting("useCustomStyles");
    if (useCustomStyles && settingsData?.styles) {
      this.updateStyles(settingsData.styles);
    } else {
      this.updateStyles(this.defaultStyles);
    }
  }

  /**
   * Update the module's styles based on campaign settings
   * @param {Object} styles - The styles object from campaign settings
   */
  updateStyles(styles = {}) {
    // Only use custom styles if the setting is enabled
    const useCustomStyles = Settings.getSetting("useCustomStyles");
    const finalStyles = useCustomStyles ? styles : this.defaultStyles;
    const styleId = "dimensional-weather-styles";

    // Only inject custom CSS variables if they differ from defaults
    let customVars = [];
    if (finalStyles.headingFont !== this.defaultStyles.headingFont) {
      customVars.push(`--dw-font-heading: ${finalStyles.headingFont};`);
    }
    if (finalStyles.textFont !== this.defaultStyles.textFont) {
      customVars.push(`--dw-font-text: ${finalStyles.textFont};`);
    }
    if (finalStyles.headingColor !== this.defaultStyles.headingColor) {
      customVars.push(`--dw-color-heading: ${finalStyles.headingColor};`);
    }
    if (finalStyles.textColor !== this.defaultStyles.textColor) {
      customVars.push(`--dw-color-text: ${finalStyles.textColor};`);
    }
    if (finalStyles.backgroundColor !== this.defaultStyles.backgroundColor) {
      customVars.push(`--dw-color-bg: ${finalStyles.backgroundColor};`);
    }
    if (finalStyles.accentColor !== this.defaultStyles.accentColor) {
      customVars.push(`--dw-color-accent: ${finalStyles.accentColor};`);
    }
    if (finalStyles.borderColor !== this.defaultStyles.borderColor) {
      customVars.push(`--dw-color-border: ${finalStyles.borderColor};`);
    }

    // Only create root styles if we have custom variables
    const rootStyles =
      customVars.length > 0
        ? `
      :root {
        ${customVars.join("\n        ")}
      }
    `
        : "";

    // Build CSS rules as a string
    const cssRules = this._buildCssRules();

    // Update or create style element
    DOMUtils.updateStyleElement(styleId, rootStyles + cssRules);
  }

  /**
   * Build CSS rules as a string
   * @private
   * @returns {string} CSS rules
   */
  _buildCssRules() {
    return `
      /* Light Theme Styles */
      .weather-help,
      .weather-report {
        font-family: var(--dw-font-text);
        color: var(--dw-color-text);
        background: var(--dw-color-bg);
        padding: var(--dw-spacing-md);
        border-radius: var(--dw-border-radius);
        border: var(--dw-border-width) solid var(--dw-color-border);
      }

      .weather-help h2, 
      .weather-help h3,
      .weather-report h3,
      .weather-report h4 {
        font-family: var(--dw-font-heading);
        color: var(--dw-color-heading);
        margin: 5px 0;
        border-bottom: 2px solid var(--dw-color-accent);
      }

      .weather-help .command-name,
      .weather-report strong {
        color: var(--dw-color-accent);
        font-weight: bold;
      }

      .weather-help .command-desc,
      .weather-help .list-item,
      .weather-report p,
      .weather-report ul,
      .weather-report li {
        color: var(--dw-color-text);
      }

      .weather-report li {
        border-left: 3px solid var(--dw-color-accent);
        padding-left: 10px;
        margin-bottom: 8px;
      }

      /* Dark Theme Overrides */
      .dark-mode .weather-help,
      .dark-mode .weather-report,
      html[data-theme="dark"] .weather-help,
      html[data-theme="dark"] .weather-report {
        background: rgba(0, 0, 0, 0.8);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.1);
      }

      .dark-mode .weather-help h2,
      .dark-mode .weather-help h3,
      .dark-mode .weather-report h3,
      .dark-mode .weather-report h4,
      html[data-theme="dark"] .weather-help h2,
      html[data-theme="dark"] .weather-help h3,
      html[data-theme="dark"] .weather-report h3,
      html[data-theme="dark"] .weather-report h4 {
        color: #ffffff;
      }

      .dark-mode .weather-help .command-desc,
      .dark-mode .weather-help .list-item,
      .dark-mode .weather-report p,
      .dark-mode .weather-report ul,
      .dark-mode .weather-report li,
      html[data-theme="dark"] .weather-help .command-desc,
      html[data-theme="dark"] .weather-help .list-item,
      html[data-theme="dark"] .weather-report p,
      html[data-theme="dark"] .weather-report ul,
      html[data-theme="dark"] .weather-report li {
        color: #ffffff;
      }

      .dark-mode .weather-help .command-name,
      .dark-mode .weather-report strong,
      html[data-theme="dark"] .weather-help .command-name,
      html[data-theme="dark"] .weather-report strong {
        color: #3498db;
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

      const weatherState = SceneManager.getWeatherState();
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

      // Build chat card
      const campaignStyles = this.settingsData?.styles || {}; // Get styles from loaded settings
      let styleString = "";

      // Build inline style string from campaign styles
      if (campaignStyles.headingFont)
        styleString += `--dw-campaign-heading-font: ${campaignStyles.headingFont};`;
      if (campaignStyles.textFont)
        styleString += `--dw-campaign-text-font: ${campaignStyles.textFont};`;
      if (campaignStyles.backgroundColor)
        styleString += `--dw-campaign-bg-color: ${campaignStyles.backgroundColor};`;
      if (campaignStyles.headingColor)
        styleString += `--dw-campaign-heading-color: ${campaignStyles.headingColor};`;
      if (campaignStyles.textColor)
        styleString += `--dw-campaign-text-color: ${campaignStyles.textColor};`;
      if (campaignStyles.accentColor)
        styleString += `--dw-campaign-accent-color: ${campaignStyles.accentColor};`;
      if (campaignStyles.borderColor)
        styleString += `--dw-campaign-border-color: ${campaignStyles.borderColor};`;

      // Build chat card with inline style
      const chatCardText = `<div class="weather-report" style="${styleString}">
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

    // Ensure description service reflects current settings (handles runtime changes)
    this._ensureDescriptionService();

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

        // Format the weather conditions with appropriate styling
        const weatherDetails = `<p><strong>Heat:</strong> ${tempDesc}</p>
<p><strong>Wind:</strong> ${windDesc}</p>
<p><strong>Humidity:</strong> ${humidDesc}</p>
<p><strong>Precipitation:</strong> ${precipDesc}</p>`;

        return `${aiDescription} ${weatherDetails} ${survivalRules}`;
      } catch (error) {
        // Fall back to basic description silently
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
   * Ensure the description service matches current AI settings
   * Recreates service if provider, key, or model changed
   * @private
   */
  _ensureDescriptionService() {
    if (!Settings.getSetting("useAI")) {
      this.descriptionService = null;
      return;
    }

    const apiKey = Settings.getSetting("apiKey");
    const model = Settings.getSetting("openaiModel");
    if (!apiKey) {
      this.descriptionService = null;
      return;
    }

    const needsNew =
      !this.descriptionService ||
      this.descriptionService.apiKey !== apiKey ||
      this.descriptionService.model !== model;

    if (needsNew) {
      this.descriptionService = new WeatherDescriptionService({ apiKey, model });
    }
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
    // Try to get season from Dark Sun Calendar first
    // Prefer Seasons & Stars via TimeUtils
    const ssSeasonKey = TimeUtils.getCurrentSeason();
    const ssSeasonName = this.settingsData?.seasons?.[ssSeasonKey]?.name;
    if (ssSeasonName) return ssSeasonName;

    // Fall back to settings if S&S not available
    const season = this.settingsData?.seasons?.[seasonKey];
    if (season?.name) {
      return season.name;
    }

    // If all else fails, format the season key
    return seasonKey
      .replace(/([A-Z])/g, " $1")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Get the current time period
   * @private
   * @returns {string} Time period name
   */
  _getTimePeriod() {
    return TimeUtils.getTimePeriod();
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
      weatherState = SceneManager.getWeatherState();
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
    const dateDisplay = TimeUtils.getCurrentDateDisplay();
    return `<div class="weather-calendar">
      <h3>Calendar Information</h3>
      <p>Date: ${dateDisplay.date}</p>
      <p>Time: ${dateDisplay.time}</p>
    </div>`;
  }
}
