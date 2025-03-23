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
    campaignSettingsIndex: {
      name: "Campaign Settings Index",
      scope: "world",
      config: false,
      type: Object,
      default: {
        campaignSettings: [
          {
            id: "earth",
            name: "Earth",
            path: "earth.json",
          },
          {
            id: "athas",
            name: "Dark Sun: Athas",
            path: "athas.json",
          },
          {
            id: "greyhawk",
            name: "Greyhawk",
            path: "greyhawk.json",
          },
        ],
      },
    },
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
    useSimpleCalendar: {
      name: "Use Simple Calendar",
      hint:
        "Integrate with Simple Calendar for automatic season changes and time-based updates",
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
      // Register all settings first
      for (const [key, config] of Object.entries(this.SETTINGS)) {
        game.settings.register(this.NAMESPACE, key, config);
      }

      // Load campaign settings from directory
      const campaignSettings = await this.loadCampaignSettingsFromDirectory();
      if (campaignSettings && campaignSettings.length > 0) {
        // Create choices object for campaign settings dropdown
        const choices = {};
        campaignSettings.forEach((setting) => {
          choices[setting.id] = setting.name;
        });

        // Update campaign setting choices
        this.SETTINGS.campaign.choices = choices;

        // Set onChange handler for campaign setting
        this.SETTINGS.campaign.onChange = onCampaignChange;

        // Update the index.json file with current campaign settings
        await this.updateSettingsIndex(campaignSettings);
      }

      console.log("Dimensional Weather | Settings registered successfully");
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to register settings", error);
    }
  }

  /**
   * Load campaign settings from the directory
   * @private
   * @returns {Promise<Array>} Array of campaign settings
   */
  static async loadCampaignSettingsFromDirectory() {
    try {
      const campaignSettings = [];
      const campaignFiles = ["earth.json", "athas.json", "greyhawk.json"];

      for (const fileName of campaignFiles) {
        // Skip the index file
        if (fileName === "index.json") continue;

        // Extract the campaign ID from the filename
        const campaignId = fileName.replace(".json", "");

        // Load the campaign setting file
        const settingPath = `${this.SETTINGS_PATH}/${fileName}`;
        const settingData = await Cache.getOrFetch(
          `campaign_${campaignId}`,
          async () => {
            return await ErrorHandler.handleFetch(
              settingPath,
              `Failed to load campaign setting: ${campaignId}`
            );
          }
        );

        if (settingData && settingData.id && settingData.name) {
          campaignSettings.push({
            id: settingData.id,
            name: settingData.name,
            path: fileName,
          });
        }
      }

      return campaignSettings;
    } catch (error) {
      ErrorHandler.logAndNotify(
        "Failed to load campaign settings from directory",
        error
      );
      return null;
    }
  }

  /**
   * Update the settings index file with available campaign settings
   * @private
   * @param {Array} campaignSettings - Array of campaign settings
   */
  static async updateSettingsIndex(campaignSettings) {
    try {
      const settingsIndex = {
        campaignSettings: campaignSettings,
      };

      // Use Foundry's FilePicker to save the updated index
      const file = new File(
        [JSON.stringify(settingsIndex, null, 4)],
        "index.json",
        { type: "application/json" }
      );
      await FilePicker.upload("data", this.SETTINGS_PATH, file, {
        overwrite: true,
      });
      console.log("Dimensional Weather | Settings index updated successfully");
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to update settings index", error);
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
   * Load settings index from the index.json file
   * @returns {Promise<Object>} Settings index data
   */
  static async loadSettingsIndex() {
    try {
      const indexPath = `${this.SETTINGS_PATH}/index.json`;
      return await Cache.getOrFetch("settings_index", async () => {
        return await ErrorHandler.handleFetch(
          indexPath,
          "Failed to load settings index"
        );
      });
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to load settings index", error);
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
   * Check if Simple Calendar is available and enabled
   * @returns {boolean} True if Simple Calendar is available
   */
  static isSimpleCalendarEnabled() {
    return (
      game.modules.get("simple-calendar")?.active &&
      this.getSetting("useSimpleCalendar")
    );
  }
}
