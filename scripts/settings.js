/**
 * Dimensional Weather - Settings Manager
 * Handles registration and management of module settings
 */

import { ErrorHandler, Cache } from "./utils.js";

export class Settings {
  static NAMESPACE = "dimensional-weather";
  static SETTINGS_PATH = "modules/dimensional-weather/campaign_settings";
  static DEFAULT_CAMPAIGN = "earth";

  // Settings definitions with default values
  static SETTINGS = {
    campaign: {
      name: "Campaign Setting",
      hint:
        "Choose the campaign setting that determines available terrains, seasons, and weather rules",
      scope: "world",
      config: true,
      type: String,
      default: "earth",
      choices: {}, // Will be populated dynamically
      onChange: null, // Will be set during initialization
    },
    terrain: {
      name: "Current Terrain",
      hint: "The current terrain type affecting weather",
      scope: "world",
      config: false,
      type: String,
      default: "temperate",
    },
    season: {
      name: "Current Season",
      hint: "The current season affecting weather",
      scope: "world",
      config: false,
      type: String,
      default: "spring",
    },
    settings: {
      scope: "world",
      config: false,
      type: Object,
      default: {
        variability: 5,
        temperature: 0,
        wind: 0,
        precipitation: 0,
        humidity: 0,
      },
    },
    debugTimePeriod: {
      name: "Debug Time Period",
      hint: "Enable debug logging for time period calculations",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    },
    useDarkSunCalendar: {
      name: "Use Dark Sun Calendar",
      hint:
        "Integrate with Dark Sun Calendar for automatic season changes and time-based updates",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
    },
    autoUpdate: {
      name: "Auto-update Weather",
      hint: "Automatically update weather based on the update frequency",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
    },
    manualOnly: {
      name: "Manual Weather Updates Only",
      hint:
        "When enabled, weather will only initialize or update when you explicitly use '/weather update'",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    },
    updateFrequency: {
      name: "Weather Update Frequency (hours)",
      hint: "How often the weather should automatically update",
      scope: "world",
      config: true,
      type: Number,
      range: {
        min: 1,
        max: 24,
        step: 1,
      },
      default: 6,
    },
    variability: {
      name: "Weather Variability",
      hint: "How much the weather can vary from the baseline (1-10)",
      scope: "world",
      config: true,
      type: Number,
      range: {
        min: 1,
        max: 10,
        step: 1,
      },
      default: 5,
    },
    useAI: {
      name: "Use AI for Descriptions",
      hint: "Use OpenAI to generate more detailed weather descriptions",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    },
    apiKey: {
      name: "OpenAI API Key",
      hint: "Your OpenAI API key for generating weather descriptions",
      scope: "world",
      config: true,
      type: String,
      default: "",
      inputType: "password",
      display: (value) => "••••••••" + (value ? value.slice(-4) : ""),
      requiresReload: false,
      restricted: true,
    },
    useCustomStyles: {
      name: "Use Custom Campaign Styles",
      hint:
        "Use custom styles defined in campaign JSON files for weather displays",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
    },

    campaignSettings: {
      name: "Campaign Settings Data",
      scope: "world",
      config: false,
      type: Object,
      default: {},
    },
  };

  /**
   * Register all module settings
   * @param {Function} onCampaignChange - Callback when campaign setting changes
   */
  static async register(onCampaignChange) {
    try {
      // Dynamically load the list of campaign settings and configure the campaign choice setting
      try {
        const campaignSettings = await this.loadCampaignSettingsFromDirectory();
        if (Array.isArray(campaignSettings) && campaignSettings.length) {
          const choices = {};
          for (const s of campaignSettings) choices[s.id] = s.name;
          this.SETTINGS.campaign.choices = choices;
          this.SETTINGS.campaign.onChange = onCampaignChange;
        }
      } catch (err) {
        ErrorHandler.logAndNotify(
          "Failed to load campaign settings for dropdown",
          err
        );
      }
      // Register all settings
      for (const [key, config] of Object.entries(this.SETTINGS)) {
        if (key === "apiKey") {
          const baseConfig = { ...config };
          baseConfig.type = String;
          baseConfig.onChange = (value) => {
            const input = document.querySelector(
              'input[name="dimensional-weather.apiKey"]'
            );
            if (input) {
              input.type = "password";
              input.value = value;
            }
          };
          game.settings.register(this.NAMESPACE, key, baseConfig);
        } else {
          game.settings.register(this.NAMESPACE, key, config);
        }
      }

      // Add custom styling for API key input
      const style = document.createElement("style");
      style.textContent = `
        input[name="dimensional-weather.apiKey"] {
          -webkit-text-security: disc;
          text-security: disc;
        }
      `;
      document.head.appendChild(style);

      console.log("Dimensional Weather | Settings registered successfully");
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to register settings", error);
    }
  }

  /**
   * Load the campaign settings index from index.json
   * @private
   * @returns {Promise<Array>} Array of {id, name, path} entries
   */
  static async loadCampaignSettingsFromDirectory() {
    try {
      // index.json should list all available campaign setting files
      const indexPath = `${this.SETTINGS_PATH}/index.json`;
      const indexData = await Cache.getOrFetch("settings_index", async () => {
        return await ErrorHandler.handleFetch(
          indexPath,
          "Failed to load campaign settings index"
        );
      });
      return Array.isArray(indexData?.campaignSettings)
        ? indexData.campaignSettings
        : [];
    } catch (error) {
      ErrorHandler.logAndNotify(
        "Failed to load campaign settings index",
        error
      );
      return [];
    }
  }

  /**
   * Load a specific campaign setting
   * @param {string} settingId - ID of the campaign setting to load
   * @returns {Promise<Object>} Campaign setting data
   */
  static async loadCampaignSetting(settingId) {
    try {
      const settingPath = `${this.SETTINGS_PATH}/${settingId}.json`;
      return await Cache.getOrFetch(`campaign_${settingId}`, async () => {
        return await ErrorHandler.handleFetch(
          settingPath,
          `Failed to load campaign setting: ${settingId}`
        );
      });
    } catch (error) {
      ErrorHandler.logAndNotify(
        `Failed to load campaign setting: ${settingId}`,
        error
      );
      return null;
    }
  }

  /**
   * Get current campaign setting ID
   * @returns {string} Campaign setting ID
   */
  static getCurrentCampaign() {
    return (
      game.settings.get(this.NAMESPACE, "campaign") || this.DEFAULT_CAMPAIGN
    );
  }

  /**
   * Update a setting value
   * @param {string} key - Setting key
   * @param {any} value - New value
   * @returns {Promise<void>}
   */
  static async updateSetting(key, value) {
    return game.settings.set(this.NAMESPACE, key, value);
  }

  /**
   * Get a setting value
   * @param {string} key - Setting key
   * @returns {any} Setting value
   */
  static getSetting(key) {
    return game.settings.get(this.NAMESPACE, key);
  }

  /**
   * Check if Dark Sun Calendar is available and enabled
   * @returns {boolean} True if Dark Sun Calendar is available
   */
  static isDarkSunCalendarEnabled() {
    return (
      game.modules.get("dark-sun-calendar")?.active &&
      Settings.getSetting("useDarkSunCalendar")
    );
  }
}
