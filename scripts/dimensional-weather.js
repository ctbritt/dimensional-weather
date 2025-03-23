/**
 * Dimensional Weather Module
 * A clean, rearchitected weather system for FoundryVTT
 *
 * Features:
 *  - Climate presets (e.g. Scrub Plains, Rocky Badlands)
 *  - Weather dimensions (temperature, wind, precipitation, humidity, variability)
 *  - Time-of-day adjustments (integrated with Simple Calendar if available)
 *  - Chat commands for weather updates, forecasts, and calendar info
 */

class DimensionalWeather {
  constructor(options = {}) {
    this.settingsData = null;
    this.settingsIndex = null;
    this.initialized = false;
    this._timePeriodCache = {
      timestamp: 0,
      period: null,
    };
    this._lastDebugTimestamp = null; // Track the last debug timestamp
  }

  /**
   * Fetches the settings data for a given campaign setting
   * @static
   * @param {string} settingId - The ID of the campaign setting
   * @returns {Promise<Object>} The settings data
   */
  static async fetchSettingsData(settingId) {
    try {
      // First get the settings index
      const indexResponse = await fetch(
        "/modules/dimensional-weather/campaign_settings/index.json"
      );
      if (!indexResponse.ok) {
        throw new Error(
          `Failed to load settings index: ${indexResponse.status} ${indexResponse.statusText}`
        );
      }
      const settingsIndex = await indexResponse.json();

      // Find the setting info
      const settingInfo = settingsIndex.campaignSettings.find(
        (s) => s.id === settingId
      );
      if (!settingInfo) {
        throw new Error(`Invalid campaign setting: ${settingId}`);
      }

      // Load the settings data
      const response = await fetch(
        `/modules/dimensional-weather/campaign_settings/${settingInfo.path}`
      );
      if (!response.ok) {
        throw new Error(
          `Failed to load settings: ${response.status} ${response.statusText}`
        );
      }
      return await response.json();
    } catch (error) {
      console.error(
        "Dimensional Weather | Failed to fetch settings data:",
        error
      );
      return null;
    }
  }

  /**
   * Registers all module settings
   * @static
   */
  static async registerSettings() {
    try {
      // Load the settings index first
      const response = await fetch(
        "/modules/dimensional-weather/campaign_settings/index.json"
      );
      if (!response.ok) {
        throw new Error(
          `Failed to load settings index: ${response.status} ${response.statusText}`
        );
      }
      const settingsIndex = await response.json();

      // Create choices object for the campaign setting dropdown
      const choices = {};
      settingsIndex.campaignSettings.forEach((setting) => {
        choices[setting.id] = setting.name;
      });

      // Register campaign setting choice in the main settings panel
      game.settings.register("dimensional-weather", "campaign", {
        name: "Campaign Setting",
        hint:
          "Choose the campaign setting that determines available terrains, seasons, and weather rules",
        scope: "world",
        config: true,
        type: String,
        choices: choices,
        default: "earth",
        onChange: async (value) => {
          try {
            // Skip all settings panel updates if this is a chat command change
            if (game.dimWeather?.isChatCommand) {
              return;
            }

            // Load the new campaign settings
            await game.dimWeather.loadCampaignSettings();

            ui.notifications.info(`Campaign setting updated to ${value}`);
          } catch (error) {
            console.error("Failed to update campaign settings:", error);
            ui.notifications.error("Failed to update campaign settings");
          }
        },
      });

      // Register terrain setting
      game.settings.register("dimensional-weather", "terrain", {
        name: "Current Terrain",
        hint: "The current terrain type affecting weather",
        scope: "world",
        config: false,
        type: String,
        default: "temperate",
      });

      // Register season setting
      game.settings.register("dimensional-weather", "season", {
        name: "Current Season",
        hint: "The current season affecting weather",
        scope: "world",
        config: false,
        type: String,
        default: "spring",
      });

      // Register weather settings
      game.settings.register("dimensional-weather", "settings", {
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
      });

      // Register debug setting
      game.settings.register("dimensional-weather", "debugTimePeriod", {
        name: "Debug Time Period",
        hint: "Enable debug logging for time period calculations",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
      });

      // Register campaign settings data (not visible in settings panel)
      game.settings.register("dimensional-weather", "campaignSettings", {
        name: "Campaign Settings Data",
        scope: "world",
        config: false,
        type: Object,
        default: {},
      });
    } catch (error) {
      console.error("Failed to register settings:", error);
      ui.notifications.error(
        "Failed to register settings. Check the console for details."
      );
    }
  }

  /**
   * Updates the module's styles based on campaign settings
   * @param {Object} styles - The styles object from campaign settings
   */
  updateStyles(styles) {
    const defaultStyles = {
      headingFont: "Signika, sans-serif",
      textFont: "Signika, sans-serif",
      headingColor: "#2C3E50",
      textColor: "#34495E",
      backgroundColor: "#ECF0F1",
      accentColor: "#3498DB",
      borderColor: "#2980B9",
    };

    // Merge default styles with campaign-specific styles
    const finalStyles = { ...defaultStyles, ...styles };

    // Create or update the style element
    let styleElement = document.getElementById("dimensional-weather-styles");
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = "dimensional-weather-styles";
      document.head.appendChild(styleElement);
    }

    // Update the styles
    styleElement.textContent = `
      .weather-help {
        font-family: ${finalStyles.textFont};
        color: ${finalStyles.textColor};
        background: ${finalStyles.backgroundColor};
        padding: 10px;
        border-radius: 5px;
      }
      .weather-help h2, .weather-help h3 {
        font-family: ${finalStyles.headingFont};
        color: ${finalStyles.headingColor};
        margin: 5px 0;
        border-bottom: 2px solid ${finalStyles.accentColor};
      }
      .weather-help .command {
        margin: 5px 0;
      }
      .weather-help .command-name {
        color: ${finalStyles.accentColor};
        font-weight: bold;
        margin-right: 10px;
      }
      .weather-help .command-desc {
        color: ${finalStyles.textColor};
        font-style: italic;
      }
      .weather-help .list-section {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 5px;
      }
      .weather-help .list-item {
        color: ${finalStyles.textColor};
        padding: 2px 5px;
      }
    `;
  }

  /**
   * Loads campaign settings data
   */
  async loadCampaignSettings() {
    try {
      const selectedSetting = game.settings.get(
        "dimensional-weather",
        "campaign"
      );
      const response = await fetch(
        `modules/dimensional-weather/campaign_settings/${selectedSetting}.json`
      );
      const settingsData = await response.json();

      // Update the settings data
      this.settingsData = settingsData;

      // Set the default terrain for this campaign setting
      if (settingsData.defaultTerrain) {
        await game.settings.set(
          "dimensional-weather",
          "terrain",
          settingsData.defaultTerrain
        );
      }

      // Update styles
      if (settingsData.styles) {
        this.updateStyles(settingsData.styles);
      }
    } catch (error) {
      console.error("Failed to load campaign settings:", error);
      ui.notifications.error(
        "Failed to load campaign settings. Check the console for details."
      );
    }
  }

  /**
   * Updates the index.json file by scanning the campaign_settings directory
   * @private
   */
  async _updateSettingsIndex() {
    try {
      // Get all JSON files in the campaign_settings directory
      const settingsFiles = await FilePicker.browse(
        "data",
        "modules/dimensional-weather/campaign_settings",
        { extensions: [".json"] }
      );

      // Filter out index.json itself and build the settings array
      const campaignSettings = [];
      for (const file of settingsFiles.files) {
        if (file.endsWith("index.json")) continue;

        try {
          // Load each settings file to get its metadata
          const response = await fetch(file);
          if (!response.ok) continue;

          const settingsData = await response.json();
          const filename = file.split("/").pop();

          // Add to the campaign settings array
          campaignSettings.push({
            id: filename.replace(".json", ""),
            name: settingsData.name || filename.replace(".json", ""),
            path: filename,
          });
        } catch (error) {
          console.warn(`Failed to process settings file ${file}:`, error);
        }
      }

      // Just return the index content without trying to save it
      return { campaignSettings };
    } catch (error) {
      console.error(
        "Dimensional Weather | Failed to scan settings directory:",
        error
      );
      throw error;
    }
  }

  async loadSettings() {
    try {
      // First try to update the settings index
      try {
        // Get the current index of available settings
        this.settingsIndex = await this._updateSettingsIndex();
      } catch (error) {
        console.warn(
          "Dimensional Weather | Failed to scan settings directory, falling back to existing index:",
          error
        );
        // If scanning fails, try to load existing index
        const indexResponse = await fetch(
          "/modules/dimensional-weather/campaign_settings/index.json"
        );
        if (!indexResponse.ok) {
          throw new Error(
            `Failed to load settings index: ${indexResponse.status} ${indexResponse.statusText}`
          );
        }
        this.settingsIndex = await indexResponse.json();
      }

      // Get the current settings
      const settings = game.settings.get("dimensional-weather", "settings");
      const selectedSetting =
        game.settings.get("dimensional-weather", "campaign") || "earth";
      const settingInfo = this.settingsIndex.campaignSettings.find(
        (s) => s.id === selectedSetting
      );

      if (!settingInfo) {
        throw new Error(`Invalid campaign setting: ${selectedSetting}`);
      }

      // Load the selected campaign setting
      const response = await fetch(
        `/modules/dimensional-weather/campaign_settings/${settingInfo.path}`
      );
      if (!response.ok) {
        throw new Error(
          `Failed to load settings: ${response.status} ${response.statusText}`
        );
      }
      this.settingsData = await response.json();

      // Update terrain choices based on loaded settings
      const terrainChoices = {};
      Object.entries(this.settingsData.terrains).forEach(([key, terrain]) => {
        terrainChoices[key] =
          terrain.name || key.replace(/([A-Z])/g, " $1").trim();
      });

      // Update season choices based on loaded settings
      const seasonChoices = {};
      Object.entries(this.settingsData.seasons).forEach(([key, season]) => {
        seasonChoices[key] = season.name;
      });

      // Update the settings with new choices and defaults if not set
      if (!settings.terrain || !settings.season) {
        settings.terrain = Object.keys(terrainChoices)[0];
        settings.season = Object.keys(seasonChoices)[0];
        await game.settings.set("dimensional-weather", "settings", settings);
      }

      // Validate current terrain and season against new choices
      if (!terrainChoices[settings.terrain]) {
        settings.terrain = Object.keys(terrainChoices)[0];
        await game.settings.set("dimensional-weather", "settings", settings);
      }
      if (!seasonChoices[settings.season]) {
        settings.season = Object.keys(seasonChoices)[0];
        await game.settings.set("dimensional-weather", "settings", settings);
      }

      // Update scene flags with validated terrain and season
      const scene = game.scenes.viewed;
      if (scene?.id) {
        const savedState =
          scene.getFlag("dimensional-weather", "weatherState") || {};
        await scene.setFlag("dimensional-weather", "weatherState", {
          ...savedState,
          terrain: settings.terrain,
          season: settings.season,
        });
      }
    } catch (error) {
      console.error("Dimensional Weather | Failed to load settings:", error);
      ui.notifications.error(
        "Failed to load weather settings. Check the console for details."
      );
    }
  }

  /**
   * Saves the current weather state to scene flags
   * @private
   */
  async _saveWeatherState() {
    const currentTime = SimpleCalendar.api.timestamp();

    const weatherState = {
      temperature: this.temperature,
      wind: this.wind,
      precipitation: this.precipitation,
      humidity: this.humidity,
      lastUpdate: currentTime,
      terrain: this.currentTerrain,
      season: this.currentSeason,
    };

    // Save to scene flags
    const scene = game.scenes.viewed;
    if (scene?.id) {
      await scene.setFlag("dimensional-weather", "weatherState", weatherState);
    } else {
      console.warn(
        "Dimensional Weather | No viewed scene found to save weather state"
      );
    }
  }

  async initWeather() {
    if (!this.settingsData) {
      console.warn(
        "Dimensional Weather | Waiting for settings to load before initializing weather"
      );
      await this.loadSettings();
      return;
    }

    const scene = game.scenes.viewed;
    if (!scene?.id) {
      console.warn(
        "Dimensional Weather | No viewed scene found to initialize weather"
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
    const terrain = game.settings.get("dimensional-weather", "terrain");
    const season = game.settings.get("dimensional-weather", "season");

    // Validate terrain exists
    if (!this.settingsData.terrains[terrain]) {
      console.warn(
        `Dimensional Weather | Invalid terrain: ${terrain}, falling back to first available terrain`
      );
      const defaultTerrain = Object.keys(this.settingsData.terrains)[0];
      await game.settings.set("dimensional-weather", "terrain", defaultTerrain);
      return;
    }

    // Validate season exists
    if (!this.settingsData.seasons[season]) {
      console.warn(
        `Dimensional Weather | Invalid season: ${season}, falling back to first available season`
      );
      const defaultSeason = Object.keys(this.settingsData.seasons)[0];
      await game.settings.set("dimensional-weather", "season", defaultSeason);
      return;
    }

    const terrainData = this.settingsData.terrains[terrain];

    // Initialize weather state in scene flags
    const weatherState = {
      temperature: terrainData.temperature,
      wind: terrainData.wind,
      precipitation: terrainData.precipitation,
      humidity: terrainData.humidity,
      lastUpdate: SimpleCalendar.api.timestamp(),
      terrain: terrain,
      season: season,
    };

    await scene.setFlag("dimensional-weather", "weatherState", weatherState);
  }

  /**
   * Updates the weather dimensions using a simple interpolation between the
   * current values and the terrain baseline. Optionally applies time-of-day modifiers.
   */
  async updateWeather(forced = false) {
    if (!this.settingsData?.terrains) {
      console.error(
        "Dimensional Weather | Settings data or terrains not loaded"
      );
      ui.notifications.error(
        "Weather system settings not loaded. Please try reloading the page."
      );
      return;
    }

    const scene = game.scenes.viewed;
    if (!scene?.id) {
      console.warn(
        "Dimensional Weather | No viewed scene found to update weather"
      );
      return;
    }

    // Get current time once at the start
    const currentTime = SimpleCalendar?.api
      ? SimpleCalendar.api.timestamp()
      : Date.now();

    const savedState = scene.getFlag("dimensional-weather", "weatherState");
    const settings = game.settings.get("dimensional-weather", "settings");
    const autoUpdate = game.settings.get("dimensional-weather", "autoUpdate");
    const updateFrequency = game.settings.get(
      "dimensional-weather",
      "updateFrequency"
    );
    const weatherVariability = game.settings.get(
      "dimensional-weather",
      "variability"
    );

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

    // Get current terrain and season from settings
    const currentTerrain = settings.terrain;
    const currentSeason = settings.season;

    // Validate terrain exists
    if (!this.settingsData.terrains[currentTerrain]) {
      console.warn(
        `Dimensional Weather | Invalid terrain: ${currentTerrain}, falling back to first available terrain`
      );
      const defaultTerrain = Object.keys(this.settingsData.terrains)[0];
      settings.terrain = defaultTerrain;
      await game.settings.set("dimensional-weather", "settings", settings);

      // Update scene flags with the new terrain
      const savedState =
        scene.getFlag("dimensional-weather", "weatherState") || {};
      await scene.setFlag("dimensional-weather", "weatherState", {
        ...savedState,
        terrain: defaultTerrain,
      });

      ui.notifications.warn(
        `Invalid terrain "${currentTerrain}" for current campaign setting. Changed to "${defaultTerrain}".`
      );
    }

    const terrain = this.settingsData.terrains[settings.terrain];

    // Calculate new weather values using weatherVariability
    const temperature = Math.round(
      terrain.temperature + // Start with base terrain temperature
        ((Math.random() * 2 - 1) * weatherVariability) / 4 // Reduce variability impact
    );
    const wind = Math.round(
      (terrain.wind + (savedState?.wind ?? terrain.wind)) / 2 +
        ((Math.random() * 2 - 1) * weatherVariability) / 2
    );
    const precipitation = Math.round(
      (terrain.precipitation +
        (savedState?.precipitation ?? terrain.precipitation)) /
        2 +
        ((Math.random() * 2 - 1) * weatherVariability) / 2
    );
    const humidity = Math.round(
      (terrain.humidity + (savedState?.humidity ?? terrain.humidity)) / 2 +
        ((Math.random() * 2 - 1) * weatherVariability) / 2
    );

    // Apply time-of-day modifier (if available via Simple Calendar)
    const timePeriod = this.getTimePeriod(currentTime);
    const modifiers = this.settingsData?.timeModifiers?.[timePeriod] || {};
    // Reduce the impact of time modifiers on temperature
    const finalTemperature = temperature + (modifiers.temperature || 0) / 2;

    // Clamp values within -10 and 10
    const weatherState = {
      temperature: Math.max(-10, Math.min(10, finalTemperature)),
      wind: Math.max(-10, Math.min(10, wind)),
      precipitation: Math.max(-10, Math.min(10, precipitation)),
      humidity: Math.max(-10, Math.min(10, humidity)),
      lastUpdate: currentTime,
      terrain: currentTerrain,
      season: currentSeason,
    };

    // Save the new weather state to scene flags
    await scene.setFlag("dimensional-weather", "weatherState", weatherState);

    if (forced) {
      await this.displayWeatherReport(currentTime);
    }
  }

  /**
   * Determines the current time period based on Simple Calendar data.
   */
  getTimePeriod(timestamp) {
    if (!SimpleCalendar?.api) {
      console.warn(
        "Dimensional Weather | Simple Calendar not available for time period"
      );
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
      console.warn(
        "Dimensional Weather | Invalid time values from Simple Calendar"
      );
      return "Unknown Time";
    }

    // Calculate period boundaries in timestamps
    const daylightDuration = sunset - sunrise;
    const nightDuration = 24 - daylightDuration;

    // Ensure durations are positive
    if (daylightDuration <= 0 || nightDuration <= 0) {
      console.warn("Dimensional Weather | Invalid duration calculations");
      return "Unknown Time";
    }

    const earlyMorningEnd = sunrise + daylightDuration * 0.25;
    const noonEnd = sunrise + daylightDuration * 0.5;
    const afternoonEnd = sunset;
    const nightEnd = sunset + nightDuration * 0.5;

    // Debug logging only if enabled and timestamp is different from last debug
    if (
      game.settings.get("dimensional-weather", "debugTimePeriod") &&
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
        source: new Error().stack.split("\n")[2], // Get the caller's location
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
   * Generates survival rules based on current weather conditions and terrain
   */
  getSurvivalRules() {
    // Get style information from settings
    const styles = this.settingsData?.styles || {};
    const defaultStyles = {
      headingFont: "Papyrus, Uncial Antiqua, Luminari, fantasy",
      textFont: "Arial, sans-serif",
      headingColor: "#000000",
      textColor: "#000000",
      backgroundColor: "#ffffff",
      accentColor: "#e67e22",
      borderColor: "#d35400",
    };

    // Merge default styles with campaign-specific styles
    const finalStyles = { ...defaultStyles, ...styles };

    // Create style string
    const styleString = `
      <style>
        .weather-report.${this.settingsData?.id || "default"} {
          font-family: ${finalStyles.textFont};
        }
        .weather-report.${this.settingsData?.id || "default"} h4 {
          font-family: ${finalStyles.headingFont};
          color: ${finalStyles.headingColor};
          border-bottom: 2px solid ${finalStyles.accentColor};
        }
        .weather-report.${this.settingsData?.id || "default"} ul {
          color: ${finalStyles.textColor};
        }
        .weather-report.${this.settingsData?.id || "default"} li {
          border-left: 3px solid ${finalStyles.accentColor};
          padding-left: 10px;
          margin-bottom: 8px;
        }
      </style>
    `;

    let survivalRules = `${styleString}<h4>Survival Rules:</h4><ul>`;

    // Get current weather state from scene flags
    const scene = game.scenes.viewed;
    if (!scene?.id) {
      console.warn(
        "Dimensional Weather | No viewed scene found to get survival rules"
      );
      return survivalRules + "</ul>";
    }

    const savedState = scene.getFlag("dimensional-weather", "weatherState");
    if (!savedState) {
      console.warn("Dimensional Weather | No weather state found for scene");
      return survivalRules + "</ul>";
    }

    // Helper function to split effect text into bullet points
    const addEffectBullets = (effect) => {
      // Split by periods and filter out empty strings
      const bullets = effect.split(".").filter((bullet) => bullet.trim());
      bullets.forEach((bullet) => {
        survivalRules += `<li>${bullet.trim()}.</li>`;
      });
    };

    // Temperature-based rules
    if (this.settingsData?.weatherDimensions?.temperature?.rules) {
      const tempRules = this.settingsData.weatherDimensions.temperature.rules;
      tempRules.forEach((rule) => {
        if (
          rule.extremeHeat !== undefined &&
          savedState.temperature >= rule.extremeHeat
        ) {
          addEffectBullets(rule.effect);
        }
        if (
          rule.extremeCold !== undefined &&
          savedState.temperature <= rule.extremeCold
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
          savedState.wind >= rule.strongWind
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
          savedState.precipitation >= rule.heavyPrecipitation
        ) {
          addEffectBullets(rule.effect);
        }
      });
    }

    // Add terrain-specific rules
    const terrain = this.settingsData?.terrains?.[savedState.terrain];
    if (terrain?.rules) {
      terrain.rules.forEach((rule) => {
        survivalRules += `<li>${rule}</li>`;
      });
    }

    survivalRules += "</ul>";
    return survivalRules;
  }

  /**
   * Rounds a value to the next available level in the descriptions
   * For positive numbers, rounds down. For negative numbers, rounds up.
   * @private
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
      return levels[0].toString();
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
   * Returns a narrative description of the current weather conditions.
   */
  async getWeatherDescription() {
    if (!this.settingsData?.weatherDimensions) {
      console.warn("Dimensional Weather | Weather dimensions not loaded");
      return "Weather system is still initializing...";
    }

    // Get the current weather state from scene flags
    const scene = game.scenes.viewed;
    if (!scene?.id) {
      console.warn(
        "Dimensional Weather | No viewed scene found to get weather description"
      );
      return "No active scene found.";
    }

    const savedState = scene.getFlag("dimensional-weather", "weatherState");
    if (!savedState) {
      console.warn("Dimensional Weather | No weather state found for scene");
      return "Weather state not initialized.";
    }

    const tempDesc =
      this.settingsData.weatherDimensions.temperature.descriptions[
        this._roundToNextLevel(
          savedState.temperature,
          this.settingsData.weatherDimensions.temperature.descriptions
        )
      ] || "Normal temperature";
    const windDesc =
      this.settingsData.weatherDimensions.wind.descriptions[
        this._roundToNextLevel(
          savedState.wind,
          this.settingsData.weatherDimensions.wind.descriptions
        )
      ] || "Normal wind";
    const precipDesc =
      this.settingsData.weatherDimensions.precipitation.descriptions[
        this._roundToNextLevel(
          savedState.precipitation,
          this.settingsData.weatherDimensions.precipitation.descriptions
        )
      ] || "Clear skies";
    const humidDesc =
      this.settingsData.weatherDimensions.humidity.descriptions[
        this._roundToNextLevel(
          savedState.humidity,
          this.settingsData.weatherDimensions.humidity.descriptions
        )
      ] || "Normal humidity";
    const currentTerrain = savedState.terrain;
    const timePeriod = this.getTimePeriod();

    // Get terrain description from settings
    const terrain = this.settingsData?.terrains?.[currentTerrain];
    let atmosphericDesc =
      terrain?.description || "The landscape stretches before you.";

    // If LLM is enabled, generate enhanced description
    if (game.settings.get("dimensional-weather", "useAI")) {
      try {
        const prompt = `You are a weather system for the Dark Sun D&D setting. Generate very concise, atmospheric descriptions (2-3 sentences max) focusing on the most critical environmental effects and immediate survival concerns. Be direct and avoid flowery language.
        Current conditions:
        - Terrain: ${atmosphericDesc}
        - Temperature: ${tempDesc}
        - Wind: ${windDesc}
        - Precipitation: ${precipDesc}
        - Humidity: ${humidDesc}
        - Time of Day: ${timePeriod}
        
        Generate a brief, atmospheric description of these conditions. Focus on the most important environmental effects and survival considerations. Keep it concise and avoid repetition.`;

        const response = await this.callLLM(prompt);
        return `${response} ${this.getSurvivalRules()}`;
      } catch (error) {
        console.error("LLM description generation failed:", error);
        // Fallback to basic description
        return this.getBasicDescription(
          atmosphericDesc,
          tempDesc,
          windDesc,
          precipDesc,
          humidDesc
        );
      }
    }

    // Fallback to basic description if LLM is disabled
    return this.getBasicDescription(
      atmosphericDesc,
      tempDesc,
      windDesc,
      precipDesc,
      humidDesc
    );
  }

  /**
   * Returns a basic weather description without LLM enhancement
   */
  getBasicDescription(
    atmosphericDesc,
    tempDesc,
    windDesc,
    precipDesc,
    humidDesc
  ) {
    // Format the weather conditions with bold text
    const weatherDesc = `${atmosphericDesc}
<p><strong>Heat:</strong> ${tempDesc}</p>
<p><strong>Wind:</strong> ${windDesc}</p>
<p><strong>Humidity:</strong> ${humidDesc}</p>
<p><strong>Precipitation:</strong> ${precipDesc}</p>`;

    return `${weatherDesc}\n\n${this.getSurvivalRules()}`;
  }

  /**
   * Calls the configured LLM API
   */
  async callLLM(prompt) {
    const apiKey = game.settings.get("dimensional-weather", "apiKey");

    if (!apiKey) {
      throw new Error(
        "No OpenAI API key configured. Please set your API key in the module settings."
      );
    }

    // Rate limiting - only allow one request every 5 seconds
    if (this._lastLLMCall) {
      const timeSinceLastCall = Date.now() - this._lastLLMCall;
      if (timeSinceLastCall < 5000) {
        // Instead of throwing an error, wait for the remaining time
        const waitTime = 5000 - timeSinceLastCall;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    try {
      // Add retry logic
      let lastError;
      for (let i = 0; i < 3; i++) {
        try {
          const result = await this._callOpenAI(prompt, apiKey);
          this._lastLLMCall = Date.now(); // Update the last call time after successful call
          return result;
        } catch (error) {
          lastError = error;
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
      throw lastError;
    } catch (error) {
      console.error("LLM API call failed:", error);
      throw error;
    }
  }

  /**
   * Calls OpenAI's API (ChatGPT)
   */
  async _callOpenAI(prompt, apiKey) {
    console.log("Dimensional Weather | Attempting OpenAI API call");
    console.log("Dimensional Weather | Prompt:", prompt);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are a weather system for the Dark Sun D&D setting. Generate very concise, atmospheric descriptions (2-3 sentences max) focusing on the most critical environmental effects and immediate survival concerns. Be direct and avoid flowery language.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 150,
          }),
          proxy: true,
        }
      );

      console.log(
        "Dimensional Weather | OpenAI API Response Status:",
        response.status
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `OpenAI API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      console.log("Dimensional Weather | OpenAI API Response:", data);

      if (!data.choices?.[0]?.message?.content) {
        console.error(
          "Dimensional Weather | Unexpected API response format:",
          data
        );
        throw new Error("Unexpected API response format");
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error("Dimensional Weather | OpenAI API call failed:", error);
      throw error;
    }
  }

  /**
   * Outputs the current weather report as a chat message.
   */
  async displayWeatherReport() {
    const scene = game.scenes.viewed;
    if (!scene?.id) {
      console.warn(
        "Dimensional Weather | No viewed scene found to display weather"
      );
      return;
    }

    const savedState = scene.getFlag("dimensional-weather", "weatherState");
    if (!savedState) {
      console.warn("Dimensional Weather | No weather state found for scene");
      return;
    }

    const description = await this.getWeatherDescription();
    const terrainDisplay = savedState.terrain
      ? this.settingsData?.terrains?.[savedState.terrain]?.name ||
        savedState.terrain
          .replace(/([A-Z])/g, " $1")
          .trim()
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ")
      : "Unknown Terrain";

    const seasonDisplay = this.getCurrentSeason();
    const timeDisplay = this.getTimePeriod(SimpleCalendar.api.timestamp());
    const campaignId = this.settingsData?.id || "default";

    const chatCardText = `<div class="weather-report ${campaignId}">
                  <h3>Current Weather</h3>
                  <p class="terrain-type">${terrainDisplay} - ${timeDisplay} - ${seasonDisplay}</p>
                  <hr>
                  <p>${description}</p>
                </div>`;
    ChatMessage.create({
      content: chatCardText,
      speaker: { alias: "Dimensional Weather" },
    });
  }

  /**
   * Displays a 5-day weather forecast in chat.
   */
  async displayForecast() {
    const settings = game.settings.get("dimensional-weather", "settings");
    const currentTerrain = settings.terrain;
    const terrain =
      this.settingsData.terrains[currentTerrain] ||
      this.settingsData.terrains["scrubPlains"];

    // Generate 5 days of weather
    const forecast = [];
    for (let i = 0; i < 5; i++) {
      // Use the terrain as a base and add some randomness
      const dayWeather = {
        temperature: Math.round(
          terrain.temperature + (Math.random() * 2 - 1) * settings.variability
        ),
        wind: Math.round(
          terrain.wind + (Math.random() * 2 - 1) * settings.variability
        ),
        precipitation: Math.round(
          terrain.precipitation + (Math.random() * 2 - 1) * settings.variability
        ),
        humidity: Math.round(
          terrain.humidity + (Math.random() * 2 - 1) * settings.variability
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

    // Create the forecast message
    const forecastHtml = forecast
      .map((day, index) => {
        const dayNum = index + 1;
        const prevDay = index > 0 ? forecast[index - 1] : null;

        const getChangeIndicator = (current, previous, type) => {
          if (!previous) return "";
          const diff = current - previous;
          if (diff === 0) return "";
          if (type === "temp") return diff > 0 ? " (hotter)" : " (cooler)";
          if (type === "wind")
            return diff > 0 ? " (more windy)" : " (less windy)";
          if (type === "precip")
            return diff > 0 ? " (more precip)" : " (less precip)";
          if (type === "humid")
            return diff > 0 ? " (more humid)" : " (less humid)";
          return "";
        };

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

    const forecastMessage = `5-Day Weather Forecast
Current Terrain: ${currentTerrain.replace(/([A-Z])/g, " $1").trim()}

${forecastHtml}`;
    return forecastMessage;
  }

  /**
   * Displays the current calendar information.
   */
  async displayCalendarInfo() {
    if (SimpleCalendar?.api) {
      const dt = SimpleCalendar.api.currentDateTimeDisplay();
      const calendarInfo = `<div class="weather-calendar">
                    <h3>Calendar Information</h3>
                    <p>Date: ${dt.day}${dt.daySuffix} ${dt.monthName}</p>
                    <p>Time: ${dt.time}</p>
                  </div>`;
      return calendarInfo;
    } else {
      ui.notifications.warn("Simple Calendar module is not active.");
    }
  }

  /**
   * Updates the current season
   * @param {string} season - The new season
   */
  async setSeason(season) {
    // If Simple Calendar is available, don't allow manual season changes
    if (SimpleCalendar?.api) {
      console.warn(
        "Dimensional Weather | Cannot manually set season while using Simple Calendar"
      );
      return;
    }

    // Handle both object and string values from settings
    const seasonKey = typeof season === "object" ? season.value : season;

    if (!this.settingsData?.seasons?.[seasonKey]) {
      console.warn(`Dimensional Weather | Invalid season: ${seasonKey}`);
      return;
    }

    const scene = game.scenes.viewed;
    if (!scene?.id) {
      console.warn("Dimensional Weather | No viewed scene found to set season");
      return;
    }

    const savedState =
      scene.getFlag("dimensional-weather", "weatherState") || {};
    await scene.setFlag("dimensional-weather", "weatherState", {
      ...savedState,
      season: seasonKey,
    });
  }

  /**
   * Gets the current season's modifiers
   * @returns {Object} The season modifiers
   */
  getSeasonModifiers() {
    // Try to get season from Simple Calendar first
    if (SimpleCalendar?.api) {
      const currentSeason = SimpleCalendar.api.getCurrentSeason();
      if (currentSeason) {
        const seasonKey = currentSeason.name.toLowerCase();
        const seasonMods = this.settingsData?.seasons?.[seasonKey]?.modifiers;
        if (seasonMods) {
          return seasonMods;
        }
      }
    }

    // Fall back to our JSON-defined season
    const currentSeason = game.settings.get("dimensional-weather", "season");
    return (
      this.settingsData?.seasons?.[currentSeason]?.modifiers || {
        temperature: 0,
        wind: 0,
        precipitation: 0,
        humidity: 0,
        variability: 0,
      }
    );
  }

  /**
   * Gets the current season name
   * @returns {string} The current season name
   */
  getCurrentSeason() {
    // Try to get season from Simple Calendar first
    if (SimpleCalendar?.api) {
      const currentSeason = SimpleCalendar.api.getCurrentSeason();
      if (currentSeason) {
        return currentSeason.name;
      }
    }

    // Fall back to our JSON-defined season
    const scene = game.scenes.viewed;
    if (!scene?.id) {
      console.warn("Dimensional Weather | No viewed scene found to get season");
      return "Unknown Season";
    }

    const savedState = scene.getFlag("dimensional-weather", "weatherState");
    if (!savedState?.season) {
      console.warn("Dimensional Weather | No season found in weather state");
      return "Unknown Season";
    }

    return (
      this.settingsData?.seasons?.[savedState.season]?.name || "Unknown Season"
    );
  }

  /**
   * Gets the current season description
   * @returns {string} The current season description
   */
  getSeasonDescription() {
    // Try to get season from Simple Calendar first
    if (SimpleCalendar?.api) {
      const currentSeason = SimpleCalendar.api.getCurrentSeason();
      if (currentSeason) {
        const seasonKey = currentSeason.name.toLowerCase();
        return (
          this.settingsData?.seasons?.[seasonKey]?.description ||
          currentSeason.description ||
          "A season of change."
        );
      }
    }

    // Fall back to our JSON-defined season
    const currentSeason = game.settings.get("dimensional-weather", "season");
    return (
      this.settingsData?.seasons?.[currentSeason]?.description ||
      "A season of change."
    );
  }

  /**
   * Generates new weather conditions based on terrain and season
   */
  generateWeather() {
    const terrain = this.settingsData.terrains[this.currentTerrain];
    const seasonMods = this.getSeasonModifiers();
    const variability = (terrain.variability + seasonMods.variability) / 2;

    // Generate base values with terrain and season modifiers
    this.temperature = this._generateValue(
      terrain.temperature + seasonMods.temperature,
      variability
    );
    this.wind = this._generateValue(
      terrain.wind + seasonMods.wind,
      variability
    );
    this.precipitation = this._generateValue(
      terrain.precipitation + seasonMods.precipitation,
      variability
    );
    this.humidity = this._generateValue(
      terrain.humidity + seasonMods.humidity,
      variability
    );

    // Apply time of day modifiers
    const timeMods = this.settingsData.timeModifiers[this.getTimePeriod()];
    if (timeMods) {
      this.temperature += timeMods.temperature;
    }
  }

  /**
   * Returns help text for available commands
   */
  getHelpText() {
    const terrainList = Object.entries(this.settingsData.terrains)
      .map(([_, t]) => `<div class="list-item">• ${t.name}</div>`)
      .join("");

    const seasonList = Object.entries(this.settingsData.seasons)
      .map(([_, s]) => `<div class="list-item">• ${s.name}</div>`)
      .join("");

    const campaignList = this.settingsIndex.campaignSettings
      .map((setting) => `<div class="list-item">• ${setting.name}</div>`)
      .join("");

    return `<div class="weather-help"><h2>Weather System Commands</h2><div class="command"><span class="command-name">/weather</span><span class="command-desc">Display current weather</span></div><h3>GM Commands:</h3><div class="command"><span class="command-name">/weather terrain [name]</span><span class="command-desc">Change terrain</span></div><div class="command"><span class="command-name">/weather season [name]</span><span class="command-desc">Change season</span></div><div class="command"><span class="command-name">/weather update</span><span class="command-desc">Force update</span></div><div class="command"><span class="command-name">/weather random [0-10]</span><span class="command-desc">Set variability</span></div><div class="command"><span class="command-name">/weather stats</span><span class="command-desc">Show scene base stats</span></div><div class="command"><span class="command-name">/weather settings</span><span class="command-desc">Open settings</span></div><h3>Available Campaign Settings:</h3><div class="list-section">${campaignList}</div><h3>Available Terrains:</h3><div class="list-section">${terrainList}</div><h3>Available Seasons:</h3><div class="list-section">${seasonList}</div></div>`;
  }

  /**
   * Sets the current terrain and updates weather
   * @param {string} terrainKey - The key of the terrain to set
   */
  async setTerrain(terrainKey) {
    console.log("Dimensional Weather | Setting terrain to:", terrainKey);

    if (!this.settingsData?.terrains) {
      console.error(
        "Dimensional Weather | Settings data or terrains not loaded"
      );
      return;
    }

    // Validate terrain exists
    if (!this.settingsData.terrains[terrainKey]) {
      console.error(`Dimensional Weather | Invalid terrain: ${terrainKey}`);
      return;
    }

    const scene = game.scenes.viewed;
    if (!scene?.id) {
      console.warn(
        "Dimensional Weather | No viewed scene found to set terrain"
      );
      return;
    }

    const savedState =
      scene.getFlag("dimensional-weather", "weatherState") || {};
    await scene.setFlag("dimensional-weather", "weatherState", {
      ...savedState,
      terrain: terrainKey,
    });
    await this.initWeather();
  }

  // Hook into Simple Calendar's time change event
  async loadSceneWeather() {
    const scene = game.scenes.viewed;
    if (!scene?.id) {
      console.warn(
        "Dimensional Weather | No viewed scene found to load weather state"
      );
      return;
    }

    const savedState = scene.getFlag("dimensional-weather", "weatherState");
    if (savedState) {
      console.log(
        "Dimensional Weather | Loading saved weather state from scene:",
        savedState
      );
      // No need to store state in the class, we'll read from flags when needed
      return;
    }

    // If no saved state, initialize with terrain values
    console.log(
      "Dimensional Weather | No saved weather state found, initializing with terrain values"
    );
    const terrain = game.settings.get("dimensional-weather", "terrain");
    const season = game.settings.get("dimensional-weather", "season");

    if (terrain && this.settingsData?.terrains[terrain]) {
      const terrainData = this.settingsData.terrains[terrain];
      const weatherState = {
        temperature: terrainData.temperature,
        wind: terrainData.wind,
        precipitation: terrainData.precipitation,
        humidity: terrainData.humidity,
        lastUpdate: Date.now(),
        terrain: terrain,
        season: season,
      };

      await scene.setFlag("dimensional-weather", "weatherState", weatherState);
      await scene.setFlag("dimensional-weather", "lastUpdateTime", Date.now());
    }
  }

  /**
   * Updates the campaign setting
   * @param {string} value - The ID of the campaign setting to load
   */
  async updateCampaignSetting(value) {
    try {
      const settingInfo = this.settingsIndex.campaignSettings.find(
        (s) => s.id === value
      );
      if (!settingInfo) {
        throw new Error(`Campaign setting not found: ${value}`);
      }

      // Load the new campaign setting data
      const response = await fetch(
        `/modules/dimensional-weather/campaign_settings/${settingInfo.path}`
      );
      if (!response.ok) {
        throw new Error(
          `Failed to load campaign setting: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();

      // Update campaign settings
      const campaignSettings = game.settings.get(
        "dimensional-weather",
        "campaignSettings"
      );
      campaignSettings[value] = data;
      await game.settings.set(
        "dimensional-weather",
        "campaignSettings",
        campaignSettings
      );

      // Get default terrain and season
      const defaultTerrain = Object.keys(data.terrains)[0];
      const defaultSeason = Object.keys(data.seasons)[0];

      // Update scene flags if a scene is active
      const scene = game.scenes.viewed;
      if (scene?.id) {
        const savedState =
          scene.getFlag("dimensional-weather", "weatherState") || {};
        await scene.setFlag("dimensional-weather", "weatherState", {
          ...savedState,
          terrain: defaultTerrain,
          season: defaultSeason,
        });
      }

      // Reload settings and weather state
      await this.loadSettings();
      await this.loadSceneWeather();

      ui.notifications.info("Weather system updated with new campaign setting");
    } catch (error) {
      console.error(
        "Dimensional Weather | Error updating campaign setting:",
        error
      );
      ui.notifications.error(
        "Failed to update campaign setting. Check the console for details."
      );
    }
  }
}

// Register module settings during initialization
Hooks.once("init", async () => {
  try {
    // Load the settings index first by scanning the campaign_settings directory
    const settingsFiles = await FilePicker.browse(
      "data",
      "modules/dimensional-weather/campaign_settings",
      { extensions: [".json"] }
    );

    // Filter out index.json itself and build the settings array
    const campaignSettings = [];
    for (const file of settingsFiles.files) {
      if (file.endsWith("index.json")) continue;

      try {
        // Load each settings file to get its metadata
        const response = await fetch(file);
        if (!response.ok) continue;

        const settingsData = await response.json();
        const filename = file.split("/").pop();
        const id = filename.replace(".json", "");

        // Add to the campaign settings array
        campaignSettings.push({
          id: id,
          name: settingsData.name || id,
          path: filename,
        });
      } catch (error) {
        console.warn(`Failed to process settings file ${file}:`, error);
      }
    }

    // Create choices object for the campaign setting dropdown
    const choices = {};
    campaignSettings.forEach((setting) => {
      choices[setting.id] = setting.name;
    });

    // Register campaign setting choice in the main settings panel
    game.settings.register("dimensional-weather", "campaign", {
      name: "Campaign Setting",
      hint:
        "Choose the campaign setting that determines available terrains, seasons, and weather rules",
      scope: "world",
      config: true,
      type: String,
      choices: choices,
      default: "earth",
      onChange: async (value) => {
        try {
          // Skip if this is a chat command change
          if (game.dimWeather?.isChatCommand) return;

          // Wait for game to be ready
          if (!game.ready) return;

          await game.dimWeather?.updateCampaignSetting(value);
        } catch (error) {
          console.error(
            "Dimensional Weather | Error updating campaign setting:",
            error
          );
          ui.notifications?.error(
            "Failed to update campaign setting. Check the console for details."
          );
        }
      },
    });

    // Register terrain setting
    game.settings.register("dimensional-weather", "terrain", {
      name: "Current Terrain",
      hint: "The current terrain type affecting weather",
      scope: "world",
      config: false,
      type: String,
      default: "temperate",
    });

    // Register season setting
    game.settings.register("dimensional-weather", "season", {
      name: "Current Season",
      hint: "The current season affecting weather",
      scope: "world",
      config: false,
      type: String,
      default: "spring",
    });

    // Register weather settings
    game.settings.register("dimensional-weather", "settings", {
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
    });

    // Register debug setting
    game.settings.register("dimensional-weather", "debugTimePeriod", {
      name: "Debug Time Period",
      hint: "Enable debug logging for time period calculations",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    });

    // Register Simple Calendar integration setting
    game.settings.register("dimensional-weather", "useSimpleCalendar", {
      name: "Use Simple Calendar",
      hint:
        "Integrate with Simple Calendar for automatic season changes and time-based updates",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    });

    // Register auto-update setting
    game.settings.register("dimensional-weather", "autoUpdate", {
      name: "Auto-update Weather",
      hint: "Automatically update weather based on the update frequency",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
    });

    // Register update frequency setting
    game.settings.register("dimensional-weather", "updateFrequency", {
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
    });

    // Register variability setting
    game.settings.register("dimensional-weather", "variability", {
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
    });

    // Register AI description setting
    game.settings.register("dimensional-weather", "useAI", {
      name: "Use AI for Descriptions",
      hint: "Use OpenAI to generate more detailed weather descriptions",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
    });

    // Register API key setting
    game.settings.register("dimensional-weather", "apiKey", {
      name: "OpenAI API Key",
      hint: "Your OpenAI API key for generating weather descriptions",
      scope: "world",
      config: true,
      type: String,
      default: "",
    });

    // Register campaign settings data (not visible in settings panel)
    game.settings.register("dimensional-weather", "campaignSettings", {
      name: "Campaign Settings Data",
      scope: "world",
      config: false,
      type: Object,
      default: {},
    });
  } catch (error) {
    console.error("Dimensional Weather | Failed to register settings:", error);
  }
});

// Create and initialize the weather system
Hooks.once("ready", async () => {
  try {
    // Create the weather system instance
    game.dimWeather = new DimensionalWeather();

    // Load initial campaign settings
    await game.dimWeather.loadCampaignSettings();

    // Load settings for the weather system
    await game.dimWeather.loadSettings();

    // Set initialization flag
    game.dimWeather.initialized = true;

    console.log("Dimensional Weather | Module initialized successfully");
  } catch (error) {
    console.error("Dimensional Weather | Failed to initialize module:", error);
    ui.notifications.error(
      "Failed to initialize weather system. Check the console for details."
    );
  }
});

// Register chat commands
Hooks.on("chatCommandsReady", (commands) => {
  console.log("Dimensional Weather | Registering chat commands");

  // Register the main weather command - available to all players
  commands.register({
    name: "/weather",
    module: "dimensional-weather",
    description: "Display current weather conditions",
    icon: "<i class='fas fa-cloud-sun'></i>",
    requiredRole: "NONE",
    callback: async (chat, parameters, messageData) => {
      try {
        if (!game.dimWeather) {
          ui.notifications.warn(
            "Weather system not initialized. Please reload the module."
          );
          return;
        }

        if (!parameters) {
          await game.dimWeather.displayWeatherReport();
          return;
        }

        const args = parameters.split(" ");
        const subcommand = args[0]?.toLowerCase();

        // Handle version command first since it's available to all users
        if (subcommand === "version" || subcommand === "v") {
          if (!game.dimWeather?.settingsData) {
            return {
              content: "Weather system not initialized or settings not loaded.",
              speaker: { alias: "Dimensional Weather" },
            };
          }
          return {
            content: `Weather System Info:<br>
                     Name: ${game.dimWeather.settingsData.name}<br>
                     Version: ${game.dimWeather.settingsData.version}<br>
                     Description: ${game.dimWeather.settingsData.description}`,
            speaker: { alias: "Dimensional Weather" },
          };
        }

        // Handle setting command - available to GMs only
        if (subcommand === "campaign") {
          if (!game.user.isGM) {
            ui.notifications.warn("Only the GM can change campaign settings.");
            return;
          }

          if (args.length < 2) {
            ui.notifications.warn(
              "Please specify a campaign setting. Use /weather help for available options."
            );
            return;
          }

          const settingId = args[1].toLowerCase();
          const setting = game.dimWeather.settingsIndex.campaignSettings.find(
            (s) => s.id.toLowerCase() === settingId
          );

          if (!setting) {
            ui.notifications.warn(
              `Invalid campaign setting: ${settingId}. Use /weather help for available options.`
            );
            return;
          }

          // Set the campaign setting
          game.dimWeather.isChatCommand = true;
          try {
            // Set the campaign setting
            await game.settings.set(
              "dimensional-weather",
              "campaign",
              setting.id
            );

            // Load the new settings
            await game.dimWeather.loadSettings();

            // Get the first available terrain and season
            const defaultTerrain = Object.keys(
              game.dimWeather.settingsData.terrains
            )[0];
            const defaultSeason = Object.keys(
              game.dimWeather.settingsData.seasons
            )[0];

            if (!defaultTerrain || !defaultSeason) {
              ui.notifications.error(
                "Failed to load default terrain or season from new settings."
              );
              return;
            }

            // Update the settings with new choices and defaults
            const settings = game.settings.get(
              "dimensional-weather",
              "settings"
            );
            settings.terrain = defaultTerrain;
            settings.season = defaultSeason;
            await game.settings.set(
              "dimensional-weather",
              "settings",
              settings
            );

            // Update the scene flags with the new terrain and season
            const scene = game.scenes.viewed;
            if (scene?.id) {
              const savedState =
                scene.getFlag("dimensional-weather", "weatherState") || {};
              await scene.setFlag("dimensional-weather", "weatherState", {
                ...savedState,
                terrain: defaultTerrain,
                season: defaultSeason,
              });
            }

            // Only load scene weather state without updating
            await game.dimWeather.loadSceneWeather();

            // Format the terrain name with all words capitalized
            const formattedTerrain = defaultTerrain
              .replace(/([A-Z])/g, " $1")
              .trim()
              .split(" ")
              .map(
                (word) =>
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              )
              .join(" ");

            // Format the season name
            const formattedSeason =
              game.dimWeather.settingsData.seasons[defaultSeason].name;

            return {
              content: `Campaign setting changed to ${setting.name}. Terrain set to ${formattedTerrain} and season to ${formattedSeason}.`,
              speaker: { alias: "Dimensional Weather" },
              whisper: [game.user.id],
            };
          } finally {
            // Always reset the chat command flag
            game.dimWeather.isChatCommand = false;
          }
        }

        // Only allow GMs to use other subcommands
        if (!game.user.isGM) {
          ui.notifications.warn("Only the GM can modify weather conditions.");
          await game.dimWeather.displayWeatherReport();
          return;
        }

        switch (subcommand) {
          case "terrain":
            if (args.length < 2) {
              ui.notifications.warn(
                "Please specify a terrain type. Use /weather help for available options."
              );
              return;
            }
            // Convert the terrain name to camelCase format
            const terrain = args
              .slice(1)
              .join(" ")
              .toLowerCase()
              .replace(/\s+(\w)/g, (match, letter) => letter.toUpperCase())
              .replace(/^(\w)/, (match, letter) => letter.toLowerCase());

            if (
              Object.keys(game.dimWeather.settingsData.terrains).includes(
                terrain
              )
            ) {
              // Get current settings
              const settings = game.settings.get(
                "dimensional-weather",
                "settings"
              );
              // Update terrain in settings
              settings.terrain = terrain;
              // Save updated settings
              await game.settings.set(
                "dimensional-weather",
                "settings",
                settings
              );
              // Initialize weather with new terrain
              await game.dimWeather.initWeather();
              return {
                content: `Terrain has been set to ${terrain
                  .replace(/([A-Z])/g, " $1")
                  .trim()}`,
                speaker: { alias: "Dimensional Weather" },
                whisper: [game.user.id],
              };
            } else {
              ui.notifications.warn(
                `Invalid terrain type: ${terrain}. Use /weather help for available options.`
              );
            }
            break;

          case "season":
            if (args.length < 2) {
              ui.notifications.warn(
                "Please specify a season. Use /weather season help for available options."
              );
              return;
            }

            // Check if Simple Calendar integration is enabled
            const settings = game.settings.get(
              "dimensional-weather",
              "settings"
            );
            if (settings.useSimpleCalendar) {
              return {
                content:
                  "Turn off Simple Calendar integration to manually change seasons.",
                speaker: { alias: "Dimensional Weather" },
                whisper: [game.user.id],
              };
            }

            // Join all arguments after "season" to handle multi-word season names
            const seasonName = args.slice(1).join(" ").toLowerCase();
            const seasonKey = Object.entries(
              game.dimWeather.settingsData.seasons
            ).find(([_, s]) => s.name.toLowerCase() === seasonName)?.[0];

            if (!seasonKey) {
              ui.notifications.warn(
                `Invalid season: ${seasonName}. Use /weather season help for available options.`
              );
              return;
            }

            // Get current settings
            const currentSettings = game.settings.get(
              "dimensional-weather",
              "settings"
            );
            // Update season in settings
            currentSettings.season = seasonKey;
            // Save updated settings
            await game.settings.set(
              "dimensional-weather",
              "settings",
              currentSettings
            );

            // Set the season
            await game.dimWeather.setSeason(seasonKey);

            // Format the season name
            const formattedSeason =
              game.dimWeather.settingsData.seasons[seasonKey].name;

            return {
              content: `Season has been set to ${formattedSeason}`,
              speaker: { alias: "Dimensional Weather" },
              whisper: [game.user.id],
            };

          case "update":
            await game.dimWeather.updateWeather(true);
            break;

          case "random":
            if (args.length < 2) {
              ui.notifications.warn("Please specify a value between 0 and 10.");
              return;
            }
            const value = parseInt(args[1]);
            if (isNaN(value) || value < 0 || value > 10) {
              ui.notifications.warn(
                "Variability must be a number between 0 and 10."
              );
              return;
            }
            const weatherSettings = game.settings.get(
              "dimensional-weather",
              "settings"
            );
            weatherSettings.variability = value;
            await game.settings.set(
              "dimensional-weather",
              "settings",
              weatherSettings
            );
            return {
              content: `Weather variability set to ${value}. Use /weather update to apply changes.`,
              speaker: { alias: "Dimensional Weather" },
              whisper: [game.user.id],
            };

          case "stats":
            const scene = game.scenes.viewed;
            const savedState = scene?.id
              ? scene.getFlag("dimensional-weather", "weatherState")
              : null;

            const stats = {
              campaign:
                game.dimWeather.settingsData?.name || "Unknown Campaign",
              temperature:
                savedState?.temperature ?? game.dimWeather.temperature,
              wind: savedState?.wind ?? game.dimWeather.wind,
              precipitation:
                savedState?.precipitation ?? game.dimWeather.precipitation,
              humidity: savedState?.humidity ?? game.dimWeather.humidity,
              variability: game.dimWeather.variability,
              terrain:
                savedState?.terrain ??
                game.settings.get("dimensional-weather", "terrain"),
              season: savedState?.season ?? game.dimWeather.getCurrentSeason(),
              scene: scene?.name ?? "No active scene",
            };

            return {
              content: `Weather Statistics (GM Only):\n${JSON.stringify(
                stats,
                null,
                2
              )}`,
              speaker: { alias: "Dimensional Weather" },
              whisper: [game.user.id],
            };

          case "forecast":
            const forecast = await game.dimWeather.displayForecast();
            return {
              content: forecast,
              speaker: { alias: "Dimensional Weather" },
            };

          case "help":
            if (!game.user.isGM) {
              ui.notifications.warn(
                "Only the GM can access the detailed help menu."
              );
              return {
                content:
                  "Basic commands:\n/weather - Show current weather\n/weather help - Show this help message",
                speaker: { alias: "Dimensional Weather" },
              };
            }
            return {
              content: game.dimWeather.getHelpText(),
              speaker: { alias: "Dimensional Weather" },
              whisper: [game.user.id],
            };

          case "settings":
            if (!game.user.isGM) {
              ui.notifications.warn("Only the GM can access weather settings.");
              return;
            }
            game.settings.sheet.render(true);
            return {
              content: "Opening Foundry settings panel...",
              speaker: { alias: "Dimensional Weather" },
              whisper: [game.user.id],
            };

          case "debug":
            if (!game.user.isGM) {
              ui.notifications.warn("Only the GM can toggle debug mode.");
              return;
            }
            // Toggle debug mode using the global setting
            const currentDebug = game.settings.get(
              "dimensional-weather",
              "debugTimePeriod"
            );
            await game.settings.set(
              "dimensional-weather",
              "debugTimePeriod",
              !currentDebug
            );
            return {
              content: `Time period debug logging ${
                !currentDebug ? "enabled" : "disabled"
              }.`,
              speaker: { alias: "Dimensional Weather" },
              whisper: [game.user.id],
            };

          case "terrains":
            const availableTerrains = Object.entries(
              game.dimWeather.settingsData.terrains
            )
              .map(([key, terrain]) => `${terrain.name} (${key})`)
              .join("\n");
            return {
              content: `Available Terrains for ${game.dimWeather.settingsData.name}:\n${availableTerrains}`,
              speaker: { alias: "Dimensional Weather" },
            };

          default:
            return "Invalid subcommand. Use /weather help for available options.";
        }
      } catch (error) {
        ui.notifications.error(
          "An error occurred while processing the weather command."
        );
      }
    },
    autocompleteCallback: (menu, alias, parameters) => {
      try {
        if (!game.dimWeather?.settingsData?.terrains) {
          return [
            game.chatCommands.createInfoElement(
              "Weather system not initialized. Please wait a moment and try again."
            ),
          ];
        }

        // Define available subcommands
        const subcommands = [
          { cmd: "terrain", desc: "Set the current terrain type" },
          { cmd: "campaign", desc: "Change campaign setting" },
          { cmd: "update", desc: "Force weather update" },
          { cmd: "random", desc: "Set weather variability (0-10)" },
          { cmd: "stats", desc: "Display weather statistics" },
          { cmd: "forecast", desc: "Show weather forecast" },
          { cmd: "season", desc: "Change current season" },
          { cmd: "settings", desc: "Open weather settings panel" },
          { cmd: "debug", desc: "Toggle time period debug logging" },
          { cmd: "help", desc: "Show weather command help" },
        ];

        // If no parameters, show all available commands
        if (!parameters || parameters === "") {
          if (!game.user.isGM) {
            return [
              game.chatCommands.createCommandElement(
                `${alias}`,
                "Display current weather conditions"
              ),
              game.chatCommands.createCommandElement(
                `${alias} help`,
                "Show weather command help"
              ),
            ];
          }
          return [
            game.chatCommands.createCommandElement(
              `${alias}`,
              "Display current weather conditions"
            ),
            ...subcommands.map((cmd) =>
              game.chatCommands.createCommandElement(
                `${alias} ${cmd.cmd}`,
                cmd.desc
              )
            ),
          ];
        }

        // Only show GM commands to GMs
        if (!game.user.isGM) {
          return [
            game.chatCommands.createInfoElement(
              "Only GMs can modify weather conditions."
            ),
          ];
        }

        const args = parameters.split(" ");

        // Handle terrain subcommand
        if (
          args[0] === "terrain" ||
          (args[0] && "terrain".startsWith(args[0]))
        ) {
          // If just "terrain" or partial match, show all terrains
          if (args.length === 1) {
            return Object.entries(game.dimWeather.settingsData.terrains)
              .map(([key, terrain]) => ({
                key,
                name: terrain.name || key.replace(/([A-Z])/g, " $1").trim(),
              }))
              .map(({ key, name }) =>
                game.chatCommands.createCommandElement(
                  `${alias} terrain ${name}`,
                  `Set terrain to ${name}`
                )
              );
          }
          // If we have a partial terrain name, filter matches
          if (args.length === 2) {
            const partial = args[1].toLowerCase();
            return Object.entries(game.dimWeather.settingsData.terrains)
              .map(([key, terrain]) => ({
                key,
                name: terrain.name || key.replace(/([A-Z])/g, " $1").trim(),
              }))
              .filter(({ name }) => name.toLowerCase().startsWith(partial))
              .map(({ key, name }) =>
                game.chatCommands.createCommandElement(
                  `${alias} terrain ${name}`,
                  `Set terrain to ${name}`
                )
              );
          }
        }

        // Handle season subcommand
        if (args[0] === "season" || (args[0] && "season".startsWith(args[0]))) {
          // If just "season" or partial match, show all seasons
          if (args.length === 1) {
            return Object.entries(game.dimWeather.settingsData.seasons)
              .map(([key, season]) => ({
                key,
                name: season.name || key.replace(/([A-Z])/g, " $1").trim(),
              }))
              .map(({ key, name }) =>
                game.chatCommands.createCommandElement(
                  `${alias} season ${name}`,
                  `Set season to ${name}`
                )
              );
          }
          // If we have a partial season name, filter matches
          if (args.length === 2) {
            const partial = args[1].toLowerCase();
            return Object.entries(game.dimWeather.settingsData.seasons)
              .map(([key, season]) => ({
                key,
                name: season.name || key.replace(/([A-Z])/g, " $1").trim(),
              }))
              .filter(({ name }) => name.toLowerCase().startsWith(partial))
              .map(({ key, name }) =>
                game.chatCommands.createCommandElement(
                  `${alias} season ${name}`,
                  `Set season to ${name}`
                )
              );
          }
        }

        // Handle setting subcommand
        if (
          args[0] === "campaign" ||
          (args[0] && "campaign".startsWith(args[0]))
        ) {
          if (!game.user.isGM) {
            return [
              game.chatCommands.createInfoElement(
                "Only GMs can change campaign settings."
              ),
            ];
          }

          // If just "campaign" or partial match, show all settings
          if (args.length === 1) {
            return game.dimWeather.settingsIndex.campaignSettings.map(
              (setting) =>
                game.chatCommands.createCommandElement(
                  `${alias} campaign ${setting.id}`,
                  `Change to ${setting.name} campaign setting`
                )
            );
          }

          // If we have a partial setting name, filter matches
          if (args.length === 2) {
            const partial = args[1].toLowerCase();
            return game.dimWeather.settingsIndex.campaignSettings
              .filter((setting) => setting.id.toLowerCase().startsWith(partial))
              .map((setting) =>
                game.chatCommands.createCommandElement(
                  `${alias} campaign ${setting.id}`,
                  `Change to ${setting.name} campaign setting`
                )
              );
          }
        }

        // Show matching subcommands based on partial input
        const partialCmd = args[0] || "";
        const matchingCommands = subcommands
          .filter(({ cmd }) => cmd.startsWith(partialCmd))
          .map((cmd) =>
            game.chatCommands.createCommandElement(
              `${alias} ${cmd.cmd}`,
              cmd.desc
            )
          );

        return matchingCommands.length > 0
          ? matchingCommands
          : [
              game.chatCommands.createInfoElement(
                "No matching commands found. Type /weather help for available options."
              ),
            ];
      } catch (error) {
        return [];
      }
    },
    closeOnComplete: true,
  });

  // Register the date command - GM only
  commands.register({
    name: "/date",
    module: "dimensional-weather",
    description: "Display calendar information (GM only)",
    icon: "<i class='fas fa-calendar'></i>",
    requiredRole: "GAMEMASTER",
    callback: async (chat, parameters, messageData) => {
      try {
        if (!game.dimWeather) {
          ui.notifications.warn(
            "Weather system not initialized. Please reload the module."
          );
          return;
        }
        const calendarInfo = await game.dimWeather.displayCalendarInfo();
        return {
          content: calendarInfo,
          speaker: { alias: "Dimensional Weather" },
          whisper: [game.user.id],
        };
      } catch (error) {
        ui.notifications.error(
          "An error occurred while displaying calendar information."
        );
      }
    },
    autocompleteCallback: (menu, alias, parameters) => {
      try {
        return [
          game.chatCommands.createInfoElement(
            "Display current calendar information."
          ),
        ];
      } catch (error) {
        return [];
      }
    },
    closeOnComplete: true,
  });
});

// Hook into Simple Calendar's time change event
Hooks.on("simple-calendar-time-change", async () => {
  // Wait for weather system to be initialized
  if (!game.dimWeather?.initialized) {
    return;
  }

  // Check if Simple Calendar is available and initialized
  if (!SimpleCalendar.api.currentDateTime) {
    console.warn(
      "Dimensional Weather | Simple Calendar API not fully initialized"
    );
    return;
  }

  const autoUpdate = game.settings.get("dimensional-weather", "autoUpdate");
  console.log("Dimensional Weather | Auto update:", autoUpdate);
  if (!autoUpdate) return;

  const updateFrequency = game.settings.get(
    "dimensional-weather",
    "updateFrequency"
  );
  console.log("Dimensional Weather | Update frequency:", updateFrequency);
  const scene = game.scenes.viewed;
  console.log("Dimensional Weather | Scene:", scene);
  if (!scene?.id) return;

  const savedState = scene.getFlag("dimensional-weather", "weatherState");
  const lastUpdateTime = savedState?.lastUpdate || 0;
  console.log("Dimensional Weather | Last update time:", lastUpdateTime);
  const currentTime = SimpleCalendar.api.timestamp();
  console.log("Dimensional Weather | Current time:", currentTime);
  const hoursSinceLastUpdate = (currentTime - lastUpdateTime) / 3600;
  console.log(
    "Dimensional Weather | Hours since last update:",
    hoursSinceLastUpdate
  );

  if (hoursSinceLastUpdate >= updateFrequency) {
    console.log("Dimensional Weather | Time-based weather update triggered");
    await game.dimWeather.updateWeather(true);
  }
});

// Hook into scene activation to load weather state and check for updates
Hooks.on("canvasReady", async () => {
  // Wait for weather system to be initialized
  if (!game.dimWeather?.initialized) {
    return;
  }

  // Check if Simple Calendar is available and initialized
  if (!SimpleCalendar?.api?.currentDateTime) {
    console.warn(
      "Dimensional Weather | Simple Calendar API not fully initialized"
    );
    return;
  }

  console.log(
    "Dimensional Weather | Scene activated, checking for saved weather state"
  );
  await game.dimWeather.loadSceneWeather();

  // Check if we need to update weather when scene is activated
  const autoUpdate = game.settings.get("dimensional-weather", "autoUpdate");
  if (autoUpdate) {
    const scene = game.scenes.viewed;
    if (scene?.id) {
      const savedState = scene.getFlag("dimensional-weather", "weatherState");
      const lastUpdateTime = savedState?.lastUpdate || 0;
      const currentTime = SimpleCalendar.api.timestamp();
      const updateFrequency = game.settings.get(
        "dimensional-weather",
        "updateFrequency"
      );
      const hoursSinceLastUpdate = (currentTime - lastUpdateTime) / 3600;

      if (hoursSinceLastUpdate >= updateFrequency) {
        console.log(
          "Dimensional Weather | Scene activation weather update triggered"
        );
        await game.dimWeather.updateWeather(true);
      }
    }
  }
});

// Hook into game time changes
Hooks.on("updateWorldTime", async (worldTime, dt) => {
  // Wait for weather system to be initialized
  if (!game.dimWeather?.initialized) {
    return;
  }

  // Check if Simple Calendar is available and initialized
  if (!SimpleCalendar?.api?.currentDateTime) {
    console.warn(
      "Dimensional Weather | Simple Calendar API not fully initialized"
    );
    return;
  }

  const autoUpdate = game.settings.get("dimensional-weather", "autoUpdate");
  if (!autoUpdate) return;

  const updateFrequency = game.settings.get(
    "dimensional-weather",
    "updateFrequency"
  );
  const scene = game.scenes.viewed;
  if (!scene?.id) return;

  const savedState = scene.getFlag("dimensional-weather", "weatherState");
  const lastUpdateTime = savedState?.lastUpdate || 0;
  const currentTime = SimpleCalendar.api.timestamp();
  const hoursSinceLastUpdate = (currentTime - lastUpdateTime) / 3600;

  if (hoursSinceLastUpdate >= updateFrequency) {
    console.log(
      "Dimensional Weather | Game-time based weather update triggered"
    );
    await game.dimWeather.updateWeather(true);
  }
});

// Add a hook to wait for Simple Calendar to be ready
Hooks.once("simple-calendar-ready", async () => {
  // Wait for weather system to be initialized
  if (!game.dimWeather?.initialized) {
    return;
  }

  console.log("Dimensional Weather | Simple Calendar is ready");
  await game.dimWeather.loadSceneWeather();
});
