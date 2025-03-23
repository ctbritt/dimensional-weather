/**
 * Dimensional Weather - API
 * Clean API for integration with other modules
 */

import { Settings } from "./settings.js";
import { WeatherEngine } from "./weather-engine.js";
import { UIController } from "./ui-controller.js";
import { SceneUtils, ErrorHandler, Cache } from "./utils.js";
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
    this.isChatCommand = false; // Flag to prevent settings onChange loops
  }

  /**
   * Initialize the API with all components
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Load campaign settings
      this.settingsData = await this._loadCampaignSettings();

      // Initialize components
      this.engine = new WeatherEngine(this.settingsData);
      this.ui = new UIController(this.settingsData);

      // Initialize description service if API key is provided
      const apiKey = Settings.getSetting("apiKey");
      if (apiKey && Settings.getSetting("useAI")) {
        this.descriptionService = new WeatherDescriptionService(apiKey);
      }

      this.initialized = true;
      console.log("Dimensional Weather API | Initialized successfully");

      // Initialize weather for current scene
      const scene = game.scenes.viewed;
      if (scene?.id) {
        await this.engine.initializeWeather(scene);
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
      const defaultTerrain = Object.keys(newSettingsData.terrains)[0];
      const defaultSeason = Object.keys(newSettingsData.seasons)[0];

      // Update scene flags if a scene is active
      const scene = game.scenes.viewed;
      if (scene?.id) {
        await SceneUtils.updateFlags(scene, "weatherState", {
          terrain: defaultTerrain,
          season: defaultSeason,
        });
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

      await this.engine.updateWeather(true);
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
        await SceneUtils.updateFlags(scene, "weatherState", {
          terrain: terrainKey,
        });

        // Update settings
        await Settings.updateSetting("terrain", terrainKey);

        // Force weather update
        await this.engine.updateWeather(true);
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

      // Check if using Simple Calendar integration
      if (Settings.isSimpleCalendarEnabled()) {
        ErrorHandler.logAndNotify(
          "Cannot manually set season when Simple Calendar integration is enabled",
          null,
          true
        );
        return false;
      }

      if (!this.settingsData?.seasons?.[seasonKey]) {
        ErrorHandler.logAndNotify(`Invalid season: ${seasonKey}`, null, true);
        return false;
      }

      // Update scene flags with new season
      const scene = game.scenes.viewed;
      if (scene?.id) {
        await SceneUtils.updateFlags(scene, "weatherState", {
          season: seasonKey,
        });

        // Update settings
        await Settings.updateSetting("season", seasonKey);

        // Force weather update
        await this.engine.updateWeather(true);
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

    const weatherState = SceneUtils.getWeatherState();
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
      return "<p>Weather system is still initializing...</p>";
    }

    // List available terrains
    const terrainList = Object.entries(this.settingsData.terrains)
      .map(([_, t]) => `<div class="list-item">• ${t.name}</div>`)
      .join("");

    // List available seasons
    const seasonList = Object.entries(this.settingsData.seasons)
      .map(([_, s]) => `<div class="list-item">• ${s.name}</div>`)
      .join("");

    // List available campaign settings
    const campaignList = Settings.getSetting("campaignSettings")
      .map((setting) => `<div class="list-item">• ${setting.name}</div>`)
      .join("");

    return `<div class="weather-help">
      <h2>Weather System Commands</h2>
      <div class="command">
        <span class="command-name">/weather</span>
        <span class="command-desc">Display current weather</span>
      </div>
      
      <h3>GM Commands:</h3>
      <div class="command">
        <span class="command-name">/weather terrain [name]</span>
        <span class="command-desc">Change terrain</span>
      </div>
      <div class="command">
        <span class="command-name">/weather season [name]</span>
        <span class="command-desc">Change season</span>
      </div>
      <div class="command">
        <span class="command-name">/weather update</span>
        <span class="command-desc">Force update</span>
      </div>
      <div class="command">
        <span class="command-name">/weather random [0-10]</span>
        <span class="command-desc">Set variability</span>
      </div>
      <div class="command">
        <span class="command-name">/weather stats</span>
        <span class="command-desc">Show scene base stats</span>
      </div>
      <div class="command">
        <span class="command-name">/weather settings</span>
        <span class="command-desc">Open settings</span>
      </div>
      
      <h3>Available Campaign Settings:</h3>
      <div class="list-section">${campaignList}</div>
      
      <h3>Available Terrains:</h3>
      <div class="list-section">${terrainList}</div>
      
      <h3>Available Seasons:</h3>
      <div class="list-section">${seasonList}</div>
    </div>`;
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
  }
}
