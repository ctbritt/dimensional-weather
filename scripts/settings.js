/**
 * Dimensional Weather - Settings Manager
 * Handles registration and management of module settings
 */

import { ErrorHandler, Cache, DebugLogger } from "./utils.js";

export class Settings {
  static NAMESPACE = "dimensional-weather";
  static SETTINGS_PATH = "modules/dimensional-weather/campaign_settings";
  static DEFAULT_CAMPAIGN = "earth";

  /**
   * Get the base URL for the module
   * @returns {string} Base URL for the module
   */
  static getModuleBaseUrl() {
    // Try multiple approaches to get the correct module URL
    const module = game.modules.get(this.NAMESPACE);

    // Method 1: Try module.data.path
    if (module && module.data && module.data.path) {
      DebugLogger.log("settings", "Using module data path", module.data.path);
      return module.data.path;
    }

    // Method 2: Try constructing from current location
    const baseUrl = `${window.location.origin}/modules/${this.NAMESPACE}`;
    DebugLogger.log("settings", "Using constructed base URL", baseUrl);

    // Method 3: Try using the module's URL property if available
    if (module && module.data && module.data.url) {
      DebugLogger.log("settings", "Using module data URL", module.data.url);
      return module.data.url;
    }

    return baseUrl;
  }

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
    debugTime: {
      name: "Debug Time Utils",
      hint: "Enable debug logging for time utility functions",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    },
    debugSettings: {
      name: "Debug Settings",
      hint: "Enable debug logging for settings operations",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    },
    debugWeather: {
      name: "Debug Weather",
      hint: "Enable debug logging for weather calculations",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    },

    // Dark Sun Calendar integration removed in favor of Seasons & Stars
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
    openaiModel: {
      name: "OpenAI Model",
      hint: "Model used for OpenAI descriptions",
      scope: "world",
      config: true,
      type: String,
      default: "gpt-5-mini",
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

      DebugLogger.info("Settings registered successfully");
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
      // Use absolute URL constructed from module base URL
      const baseUrl = this.getModuleBaseUrl();
      const indexPath = `${baseUrl}/campaign_settings/index.json`;
      DebugLogger.log("settings", "Attempting to load index from", indexPath);

      const indexData = await Cache.getOrFetch("settings_index", async () => {
        try {
          DebugLogger.log("settings", "Fetching index from", indexPath);
          const response = await fetch(indexPath);
          DebugLogger.log("settings", "Index response status", response.status);
          if (!response.ok) {
            throw new Error(
              `Failed with status ${response.status}: ${response.statusText}`
            );
          }
          const data = await response.json();
          DebugLogger.log("settings", "Successfully loaded index data", data);
          return data;
        } catch (error) {
          DebugLogger.warn("Failed to load index from file, using fallback");
          return this.getFallbackCampaignSettingsIndex();
        }
      });

      return Array.isArray(indexData?.campaignSettings)
        ? indexData.campaignSettings
        : this.getFallbackCampaignSettingsIndex();
    } catch (error) {
      ErrorHandler.logAndNotify(
        "Failed to load campaign settings index",
        error
      );
      return this.getFallbackCampaignSettingsIndex();
    }
  }

  /**
   * Get fallback campaign settings index for when file loading fails
   * @returns {Array} Array of campaign setting entries
   */
  static getFallbackCampaignSettingsIndex() {
    return [
      { id: "earth", name: "Earth", path: "earth.json" },
      { id: "athas", name: "Athas", path: "athas.json" },
      { id: "greyhawk", name: "Greyhawk", path: "greyhawk.json" },
      { id: "spelljammer", name: "Spelljammer", path: "spelljammer.json" },
    ];
  }

  /**
   * Load a specific campaign setting
   * @param {string} settingId - ID of the campaign setting to load
   * @returns {Promise<Object>} Campaign setting data
   */
  static async loadCampaignSetting(settingId) {
    try {
      // Use absolute URL constructed from module base URL
      const baseUrl = this.getModuleBaseUrl();
      const settingPath = `${baseUrl}/campaign_settings/${settingId}.json`;
      DebugLogger.log("settings", "Attempting to load setting from", settingPath);

      return await Cache.getOrFetch(`campaign_${settingId}`, async () => {
        try {
          DebugLogger.log("settings", "Fetching setting from", settingPath);
          const response = await fetch(settingPath);
          DebugLogger.log("settings", "Setting response status", response.status);
          if (!response.ok) {
            throw new Error(
              `Failed with status ${response.status}: ${response.statusText}`
            );
          }
          const data = await response.json();
          DebugLogger.log("settings", `Successfully loaded setting: ${settingId}`, data);
          return data;
        } catch (error) {
          DebugLogger.warn(`Failed to load ${settingId} from file, trying fallback`);
          // Fallback to embedded data for common settings
          return this.getFallbackCampaignSetting(settingId);
        }
      });
    } catch (error) {
      ErrorHandler.logAndNotify(
        `Failed to load campaign setting: ${settingId}`,
        error
      );
      return this.getFallbackCampaignSetting(settingId);
    }
  }

  /**
   * Get fallback campaign setting data for when file loading fails
   * @param {string} settingId - ID of the campaign setting
   * @returns {Object|null} Campaign setting data or null
   */
  static getFallbackCampaignSetting(settingId) {
    // Provide basic fallback data for common settings
    const fallbackSettings = {
      earth: {
        id: "earth",
        name: "Earth",
        description: "A balanced weather system correspondent to Earth.",
        defaultTerrain: "temperate",
        seasons: {
          spring: {
            name: "Spring",
            description: "A season of renewal and moderate weather.",
          },
          summer: {
            name: "Summer",
            description: "The hottest season with increased humidity.",
          },
          fall: {
            name: "Autumn",
            description: "Cooling temperatures and increased wind.",
          },
          winter: {
            name: "Winter",
            description: "Cold temperatures and potential for snow.",
          },
        },
        terrains: {
          temperate: {
            name: "Temperate Forest",
            description: "Mild climate with distinct seasons.",
          },
          desert: {
            name: "Desert",
            description: "Arid region with extreme temperature variations.",
          },
          arctic: {
            name: "Arctic Tundra",
            description: "Frozen wasteland with permafrost.",
          },
        },
      },
    };

    return fallbackSettings[settingId] || null;
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
  // Dark Sun Calendar integration helper removed
}
