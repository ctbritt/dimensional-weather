/**
 * Dimensional Weather - API
 * Clean API for integration with other modules
 */

import { Settings } from "./settings.js";
import { WeatherEngine } from "./weather-engine.js";
import { UIController } from "./ui-controller.js";
import { ErrorHandler, Cache, DebugLogger } from "./utils.js";
import { SceneManager } from "./scene-manager.js";
import { StateManager } from "./state-manager.js";
import { WeatherDescriptionService } from "./services/weather-description.js";

export class DimensionalWeatherAPI {
  /**
   * Initialize the API
   */
  constructor() {
    this.initialized = false;
    this.engine = null;
    this.ui = null;
    this.descriptionService = null;
    this.settingsData = null;
    this.stateManager = null;
    this.isChatCommand = false; // Flag to prevent settings onChange loops
  }

  /**
   * Initialize the API with all components
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Initialize state manager
      this.stateManager = new StateManager();
      await this.stateManager.initialize();
      
      // Load campaign settings
      this.settingsData = await this._loadCampaignSettings();

      // Initialize components
      this.engine = new WeatherEngine(this.settingsData);
      this.ui = new UIController(this.settingsData);

      // Initialize AI description service (OpenAI or Anthropic)
      if (Settings.getSetting("useAI")) {
        console.log("Dimensional Weather | Ensuring AI service is initialized...");
        const provider = Settings.getSetting("aiProvider") || "openai";
        console.log("Dimensional Weather | Selected provider:", provider);

        let apiKey, model;

        if (provider === "anthropic") {
          apiKey = Settings.getSetting("anthropicApiKey");
          model = Settings.getSetting("anthropicModel");
        } else {
          apiKey = Settings.getSetting("apiKey");
          model = Settings.getSetting("openaiModel");
        }

        console.log("Dimensional Weather | API key present:", !!apiKey);
        console.log("Dimensional Weather | Model:", model);

        if (apiKey) {
          this.descriptionService = new WeatherDescriptionService({ apiKey, provider, model });
          console.log("Dimensional Weather | AI service initialized with provider:", provider);
        } else {
          console.warn("Dimensional Weather | No API key found for provider:", provider);
        }
      }

      this.initialized = true;
      DebugLogger.log("weather", "API initialized successfully");

      // Initialize weather for current scene if it exists (skip in manual-only mode)
      if (!Settings.getSetting("manualOnly") && game.scenes?.viewed?.id) {
        await this.engine.initializeWeather(game.scenes.viewed);
      }

      return true;
    } catch (error) {
      ErrorHandler.logAndNotify(
        "Failed to initialize Dimensional Weather API",
        error
      );
      return false;
    }
  }

  /**
   * Load campaign settings from settings storage
   * @private
   * @returns {Promise<Object>} Campaign settings data
   */
  async _loadCampaignSettings() {
    try {
      const campaignId = Settings.getCurrentCampaign();
      return await Settings.loadCampaignSetting(campaignId);
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to load campaign settings", error);
      return null;
    }
  }

  /**
   * Update campaign settings
   * @param {string} campaignId - Campaign ID to load
   * @returns {Promise<boolean>} Success status
   */
  async updateCampaignSetting(campaignId) {
    try {
      this.isChatCommand = true;

      // Load the new campaign setting data
      const newSettingsData = await Settings.loadCampaignSetting(campaignId);
      if (!newSettingsData) {
        throw new Error(`Campaign setting not found: ${campaignId}`);
      }

      // Update components with new settings
      this.settingsData = newSettingsData;
      this.engine.updateSettingsData(newSettingsData);
      this.ui.updateSettingsData(newSettingsData);

      // Get default terrain and season
      const defaultTerrain =
        newSettingsData.defaultTerrain ||
        Object.keys(newSettingsData.terrains)[0];
      const defaultSeason = Object.keys(newSettingsData.seasons)[0];

      // Update scene flags if a scene is active
      const scene = game.scenes.viewed;
      if (scene?.id) {
        await SceneManager.updateWeatherState({
          terrain: defaultTerrain,
          season: defaultSeason
        }, scene);
      }

      // Update settings
      await Settings.updateSetting("terrain", defaultTerrain);
      await Settings.updateSetting("season", defaultSeason);

      // Reset chat command flag and return success
      this.isChatCommand = false;
      return true;
    } catch (error) {
      this.isChatCommand = false;
      ErrorHandler.logAndNotify(
        `Error updating campaign setting: ${campaignId}`,
        error
      );
      return false;
    }
  }

  /**
   * Force a weather update
   * @returns {Promise<boolean>} Success status
   */
  async updateWeather() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Pass forced: true to ensure update happens
      await this.engine.updateWeather({ forced: true });
      return true;
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to update weather", error);
      return false;
    }
  }

  /**
   * Display current weather
   * @returns {Promise<boolean>} Success status
   */
  async displayWeather() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      return await this.ui.displayWeatherReport();
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to display weather", error);
      return false;
    }
  }

  /**
   * Display weather forecast
   * @returns {Promise<string>} Forecast text
   */
  async displayForecast() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      return await this.engine.generateForecast();
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to generate forecast", error);
      return "Unable to generate forecast.";
    }
  }

  /**
   * Set the current terrain
   * @param {string} terrainKey - Terrain ID
   * @returns {Promise<boolean>} Success status
   */
  async setTerrain(terrainKey) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.settingsData?.terrains?.[terrainKey]) {
        ErrorHandler.logAndNotify(`Invalid terrain: ${terrainKey}`, null, true);
        return false;
      }

      // Update scene flags with new terrain
      const scene = game.scenes.viewed;
      if (scene?.id) {
        await SceneManager.setWeatherAttribute("terrain", terrainKey, scene);

        // Update settings
        await Settings.updateSetting("terrain", terrainKey);

        // Force weather update
        await this.engine.updateWeather({ forced: true });
        return true;
      }

      return false;
    } catch (error) {
      ErrorHandler.logAndNotify(`Failed to set terrain: ${terrainKey}`, error);
      return false;
    }
  }

  /**
   * Set the current season
   * @param {string} seasonKey - Season ID
   * @returns {Promise<boolean>} Success status
   */
  async setSeason(seasonKey) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.settingsData?.seasons?.[seasonKey]) {
        ErrorHandler.logAndNotify(`Invalid season: ${seasonKey}`, null, true);
        return false;
      }

      // Update scene flags with new season
      const scene = game.scenes.viewed;
      if (scene?.id) {
        await SceneManager.setWeatherAttribute("season", seasonKey, scene);

        // Update settings
        await Settings.updateSetting("season", seasonKey);

        // Force weather update
        await this.engine.updateWeather({ forced: true });
        return true;
      }

      return false;
    } catch (error) {
      ErrorHandler.logAndNotify(`Failed to set season: ${seasonKey}`, error);
      return false;
    }
  }

  /**
   * Set weather variability
   * @param {number} value - Variability value (0-10)
   * @returns {Promise<boolean>} Success status
   */
  async setVariability(value) {
    try {
      // Validate range
      const variability = Math.max(0, Math.min(10, parseInt(value)));

      // Update settings
      await Settings.updateSetting("variability", variability);
      return true;
    } catch (error) {
      ErrorHandler.logAndNotify(`Failed to set variability: ${value}`, error);
      return false;
    }
  }

  /**
   * Get current weather statistics
   * @returns {Object} Weather statistics
   */
  getWeatherStats() {
    if (!this.initialized) {
      return { initialized: false };
    }

    const weatherState = SceneManager.getWeatherState();
    if (!weatherState) {
      return { initialized: true, weatherAvailable: false };
    }

    const campaignName = this.settingsData?.name || "Unknown Campaign";
    const terrainData = this.settingsData?.terrains?.[weatherState.terrain];
    const terrainName = terrainData?.name || weatherState.terrain;
    const seasonData = this.settingsData?.seasons?.[weatherState.season];
    const seasonName = seasonData?.name || weatherState.season;

    return {
      initialized: true,
      weatherAvailable: true,
      campaign: campaignName,
      temperature: weatherState.temperature,
      wind: weatherState.wind,
      precipitation: weatherState.precipitation,
      humidity: weatherState.humidity,
      variability: Settings.getSetting("variability"),
      terrain: terrainName,
      season: seasonName,
      lastUpdate: weatherState.lastUpdate,
      scene: game.scenes.viewed?.name || "No active scene",
    };
  }

  /**
   * Get help text about available commands
   * @returns {string} Help text HTML
   */
  getHelpText() {
    if (!this.initialized || !this.settingsData) {
      return "Weather system not initialized.";
    }

    // Get lists of available options
    const terrainList = Object.entries(this.settingsData.terrains)
      .map(([key, terrain]) => `<div class="list-item">${terrain.name}</div>`)
      .join("");

    const seasonList = Object.entries(this.settingsData.seasons)
      .map(([key, season]) => `<div class="list-item">${season.name}</div>`)
      .join("");

    return `<div class="weather-report"><h3>WEATHER SYSTEM COMMANDS</h3><div class="command"><span class="command-name">/weather</span><span class="command-desc">: Display current weather</span></div><h4>GM Commands:</h4><div class="command"><span class="command-name">/weather calc</span><span class="command-desc">: Display weather calculation details (GM only)</span></div><div class="command"><span class="command-name">/weather random [0-10]</span><span class="command-desc">: Set randomness</span></div><div class="command"><span class="command-name">/weather season [name]</span><span class="command-desc">: Change season</span></div><div class="command"><span class="command-name">/weather settings</span><span class="command-desc">: Open settings</span></div><div class="command"><span class="command-name">/weather stats</span><span class="command-desc">: Display scene base stats</span></div><div class="command"><span class="command-name">/weather terrain [name]</span><span class="command-desc">: Change terrain</span></div><div class="command"><span class="command-name">/weather update</span><span class="command-desc">: Force update</span></div><h4>Available Terrains:</h4><div class="list-section">${terrainList}</div><h4>Available Seasons:</h4><div class="list-section">${seasonList}</div></div>`;
  }

  /**
   * Generate a weather forecast
   * @returns {Promise<string>} Forecast text
   */
  async generateForecast() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const scene = game.scenes.viewed;
      if (!scene?.id) {
        return "No active scene.";
      }

      const weatherState = scene.getFlag("dimensional-weather", "weatherState");
      if (!weatherState) {
        return "No weather state found for current scene.";
      }

      const terrain = this.settingsData.terrains[weatherState.terrain];
      const season = this.settingsData.seasons[weatherState.season];

      let forecast = `<div class="weather-report"><h3>WEATHER FORECAST</h3><h4>Current Conditions</h4><ul><li>Terrain: ${terrain.name}</li><li>Season: ${season.name}</li><li>Temperature: ${weatherState.temperature}</li><li>Wind: ${weatherState.wind}</li><li>Precipitation: ${weatherState.precipitation}</li><li>Humidity: ${weatherState.humidity}</li></ul>`;

      // Add survival rules if any apply
      const rules = [];
      if (weatherState.temperature >= 2)
        rules.push("Water consumption is doubled");
      if (weatherState.wind >= 6)
        rules.push("Ranged attacks have disadvantage");
      if (weatherState.precipitation >= 3) rules.push("Visibility is reduced");

      if (rules.length > 0) {
        forecast += `<h4>Survival Rules</h4><ul>${rules
          .map((rule) => `<li>${rule}</li>`)
          .join("")}</ul>`;
      }

      forecast += "</div>";
      return forecast;
    } catch (error) {
      ErrorHandler.logAndNotify("Error generating forecast", error);
      return "Error generating forecast.";
    }
  }

  /**
   * Get current time period
   * @returns {string} Time period name
   */
  getTimePeriod() {
    if (!this.initialized) {
      return "Unknown";
    }

    return this.engine.getTimePeriod();
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    Cache.clear();
    if (this.stateManager) {
      this.stateManager.clearCaches();
    }
    // Import these directly to avoid circular dependencies
    import("./time-utils.js").then(module => {
      module.TimeUtils.clearCache();
    });
  }

  /**
   * Toggle debug logging for a specific category
   * @param {string} category - Debug category: "weather", "time", "timePeriod", or "settings"
   * @param {boolean} [enabled] - Enable or disable (toggles if not provided)
   * @returns {Promise<boolean>} New state
   */
  async toggleDebug(category, enabled) {
    const settingMap = {
      weather: "debugWeather",
      time: "debugTime",
      timePeriod: "debugTimePeriod",
      settings: "debugSettings"
    };

    const settingKey = settingMap[category];
    if (!settingKey) {
      ui.notifications.error(`Invalid debug category: ${category}. Use: weather, time, timePeriod, or settings`);
      return false;
    }

    const currentValue = Settings.getSetting(settingKey);
    const newValue = enabled !== undefined ? enabled : !currentValue;

    await Settings.updateSetting(settingKey, newValue);
    ui.notifications.info(`Debug ${category}: ${newValue ? "ENABLED" : "DISABLED"}`);
    return newValue;
  }

  /**
   * Get current debug settings
   * @returns {Object} Debug settings status
   */
  getDebugStatus() {
    return {
      weather: Settings.getSetting("debugWeather"),
      time: Settings.getSetting("debugTime"),
      timePeriod: Settings.getSetting("debugTimePeriod"),
      settings: Settings.getSetting("debugSettings")
    };
  }

  /**
   * Enable all debug logging
   * @returns {Promise<void>}
   */
  async enableAllDebug() {
    await Settings.updateSetting("debugWeather", true);
    await Settings.updateSetting("debugTime", true);
    await Settings.updateSetting("debugTimePeriod", true);
    await Settings.updateSetting("debugSettings", true);
    ui.notifications.info("All debug logging ENABLED");
  }

  /**
   * Disable all debug logging
   * @returns {Promise<void>}
   */
  async disableAllDebug() {
    await Settings.updateSetting("debugWeather", false);
    await Settings.updateSetting("debugTime", false);
    await Settings.updateSetting("debugTimePeriod", false);
    await Settings.updateSetting("debugSettings", false);
    ui.notifications.info("All debug logging DISABLED");
  }

  /**
   * Process chat commands
   * @param {string} command - Command name
   * @param {string[]} args - Command arguments
   * @returns {Promise<void>}
   */
  async _processChatCommand(command, args) {
    try {
      switch (command) {
        case "help":
          await this.displayHelp();
          break;
        case "update":
          await this.engine.updateWeather({ forced: true });
          await this.ui.displayWeatherReport();
          break;
        case "forecast":
          const forecast = await this.engine.generateForecast();
          await ChatMessage.create({
            content: forecast,
            speaker: { alias: "Dimensional Weather" },
            whisper: ChatMessage.getWhisperRecipients("GM"),
          });
          break;
        case "calc":
          if (!game.user.isGM) {
            ui.notifications.warn("Only GMs can use the calc command.");
            return;
          }
          const calc = this.engine.getLastCalculation();
          if (!calc) {
            ui.notifications.warn("No weather calculation data available.");
            return;
          }

          const details = `<div class="weather-report">
            <h3>Weather Calculation Details</h3>
            <hr>
            <h4>Base Values (${calc.terrain.name})</h4>
            <ul>
              <li>Temperature: ${calc.terrain.baseTemp}</li>
              <li>Wind: ${calc.terrain.baseWind}</li>
              <li>Precipitation: ${calc.terrain.basePrecip}</li>
              <li>Humidity: ${calc.terrain.baseHumid}</li>
            </ul>
            ${
              calc.previous
                ? `
            <h4>Previous Values</h4>
            <ul>
              <li>Temperature: ${calc.previous.temp}</li>
              <li>Wind: ${calc.previous.wind}</li>
              <li>Precipitation: ${calc.previous.precip}</li>
              <li>Humidity: ${calc.previous.humid}</li>
            </ul>`
                : ""
            }
            <h4>Random Factors (Variability: ${calc.variability})</h4>
            <ul>
              <li>Temperature: ${calc.randomFactors.temp.toFixed(2)}</li>
              <li>Wind: ${calc.randomFactors.wind.toFixed(2)}</li>
              <li>Precipitation: ${calc.randomFactors.precip.toFixed(2)}</li>
              <li>Humidity: ${calc.randomFactors.humid.toFixed(2)}</li>
            </ul>
            <h4>Time Modifiers (${calc.timePeriod})</h4>
            <ul>
              <li>Temperature: ${calc.timeModifiers.temperature || 0}</li>
              <li>Wind: ${calc.timeModifiers.wind || 0}</li>
              <li>Precipitation: ${calc.timeModifiers.precipitation || 0}</li>
              <li>Humidity: ${calc.timeModifiers.humidity || 0}</li>
            </ul>
            <h4>Season Modifiers (${calc.season})</h4>
            <ul>
              <li>Temperature: ${calc.seasonModifiers.temperature || 0}</li>
              <li>Wind: ${calc.seasonModifiers.wind || 0}</li>
              <li>Precipitation: ${calc.seasonModifiers.precipitation || 0}</li>
              <li>Humidity: ${calc.seasonModifiers.humidity || 0}</li>
            </ul>
            <h4>Intermediate Values (After Random)</h4>
            <ul>
              <li>Temperature: ${calc.intermediate.temp}</li>
              <li>Wind: ${calc.intermediate.wind}</li>
              <li>Precipitation: ${calc.intermediate.precip}</li>
              <li>Humidity: ${calc.intermediate.humid}</li>
            </ul>
            <h4>Final Values (After Modifiers)</h4>
            <ul>
              <li>Temperature: ${calc.final.temp}</li>
              <li>Wind: ${calc.final.wind}</li>
              <li>Precipitation: ${calc.final.precip}</li>
              <li>Humidity: ${calc.final.humid}</li>
            </ul>
          </div>`;

          await ChatMessage.create({
            content: details,
            speaker: { alias: "Dimensional Weather Calculation" },
            whisper: ChatMessage.getWhisperRecipients("GM"),
          });
          break;
        default:
          ui.notifications.warn(
            `Unknown command: ${command}. Type /weather help for usage.`
          );
      }
    } catch (error) {
      ErrorHandler.logAndNotify("Error processing chat command", error);
    }
  }

  /**
   * Display help information in chat
   * @returns {Promise<void>}
   */
  async displayHelp() {
    const isGM = game.user.isGM;
    const commands = `<h3>Available Commands:</h3>
<ul>
  <li><code>/weather help</code> - Display this help message</li>
  <li><code>/weather update</code> - Force a weather update</li>
  <li><code>/weather forecast</code> - Display a 5-day weather forecast</li>
  ${
    isGM
      ? `<li><code>/weather calc</code> - (GM Only) Show detailed weather calculation breakdown</li>`
      : ""
  }
</ul>`;

    await ChatMessage.create({
      content: `<div class="weather-report">
        <h2>Dimensional Weather Help</h2>
        ${commands}
      </div>`,
      speaker: { alias: "Dimensional Weather" },
    });
  }
}
