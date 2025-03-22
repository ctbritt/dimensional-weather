/**
 * Dimensional Weather Module
 * A clean, rearchitected weather system for FoundryVTT
 * for Athasian settings.
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
      // Register the main settings object
      game.settings.register("dimensional-weather", "settings", {
        name: "Weather Settings",
        scope: "world",
        config: false,
        type: Object,
        default: {
          campaign: "default",
          terrain: "plains",
          season: "summer",
          useSimpleCalendar: false,
          autoUpdate: true,
          updateFrequency: 6,
          variability: 5,
          useLLM: false,
          llmApiKey: "",
        },
      });

      // Register LLM settings
      game.settings.register("dimensional-weather", "useLLM", {
        name: "Use AI for Weather Descriptions",
        hint: "Enable AI-generated weather descriptions using OpenAI's API",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
      });

      game.settings.register("dimensional-weather", "llmApiKey", {
        name: "OpenAI API Key",
        hint: "Your OpenAI API key for generating weather descriptions",
        scope: "world",
        config: false,
        type: String,
        default: "",
      });

      // Register campaign settings data
      game.settings.register("dimensional-weather", "campaignSettings", {
        name: "Campaign Settings Data",
        scope: "world",
        config: false,
        type: Object,
        default: {},
      });

      // Register the settings menu
      game.settings.registerMenu("dimensional-weather", "weatherSettings", {
        name: "Weather Settings",
        label: "Weather Settings",
        icon: "fas fa-cloud-sun",
        type: DimensionalWeatherSettings,
        restricted: true,
      });

      // Load initial campaign settings
      await this.loadCampaignSettings();
    } catch (error) {
      console.error(
        "Dimensional Weather | Failed to register settings:",
        error
      );
      ui.notifications.error(
        "Failed to register weather settings. Check the console for details."
      );
    }
  }

  static async loadCampaignSettings() {
    try {
      // Initialize campaignSettings object
      let campaignSettings = {};

      // Load the settings index
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

      // Register campaign setting choice first
      game.settings.register("dimensional-weather", "campaignSetting", {
        name: "Campaign Setting",
        hint: "Select the campaign setting to use for weather rules",
        scope: "world",
        config: true,
        type: String,
        choices: choices,
        default: "default",
        onChange: async (value) => {
          try {
            // Fetch new settings data
            const settingsData = await DimensionalWeather.fetchSettingsData(
              value
            );
            if (!settingsData) {
              console.warn(
                `Dimensional Weather | Failed to load settings for ${value}`
              );
              return;
            }

            // Update the instance's settings data first
            if (game.dimWeather) {
              game.dimWeather.settingsData = settingsData;
              game.dimWeather.settingsIndex = value;
            }

            // Update terrain choices
            const terrainChoices = {};
            Object.entries(settingsData.terrains).forEach(([key, terrain]) => {
              terrainChoices[key] = terrain.name || key;
            });

            // Update season choices
            const seasonChoices = {};
            Object.entries(settingsData.seasons).forEach(([key, season]) => {
              seasonChoices[key] = season.name || key;
            });

            // Get the first available terrain and season from the new settings
            const defaultTerrain = Object.keys(terrainChoices)[0];
            const defaultSeason = Object.keys(seasonChoices)[0];

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

            // Update scene flags with new terrain and season
            const scene = game.scenes.viewed;
            if (scene?.id) {
              const savedState = scene.getFlag(
                "dimensional-weather",
                "weatherState"
              );
              if (savedState) {
                // Update with new default values
                await scene.setFlag("dimensional-weather", "weatherState", {
                  ...savedState,
                  terrain: defaultTerrain,
                  season: defaultSeason,
                });
              }
            }

            // Update the weather state
            if (game.dimWeather) {
              await game.dimWeather.loadSceneWeather();
            }

            // Force a UI update for the settings panel
            if (game.settings.sheet) {
              await game.settings.sheet.render(true);
            }

            ui.notifications.info(
              "Weather system updated with new campaign setting"
            );
          } catch (error) {
            console.error(
              "Dimensional Weather | Error updating campaign setting:",
              error
            );
            ui.notifications.error(
              "Failed to update campaign setting. Check the console for details."
            );
          }
        },
      });

      // Load the selected campaign setting to update choices
      const selectedSetting =
        game.settings.get("dimensional-weather", "campaignSetting") ||
        "default";
      const settingInfo = settingsIndex.campaignSettings.find(
        (s) => s.id === selectedSetting
      );
      if (settingInfo) {
        const response = await fetch(
          `/modules/dimensional-weather/campaign_settings/${settingInfo.path}`
        );
        if (!response.ok) return;
        const data = await response.json();
        campaignSettings[settingInfo.id] = data;
      }

      // Save campaign settings
      await game.settings.set(
        "dimensional-weather",
        "campaignSettings",
        campaignSettings
      );

      // Initialize settings if not already set
      const settings = game.settings.get("dimensional-weather", "settings");
      if (!settings.terrain || !settings.season) {
        const defaultCampaign = campaignSettings[settings.campaign];
        if (defaultCampaign) {
          settings.terrain = Object.keys(defaultCampaign.terrains)[0];
          settings.season = Object.keys(defaultCampaign.seasons)[0];
          await game.settings.set("dimensional-weather", "settings", settings);
        }
      }
    } catch (error) {
      console.error(
        "Dimensional Weather | Failed to load campaign settings:",
        error
      );
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
      const selectedSetting = settings.campaign || "default";
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
      console.log("Dimensional Weather | Loaded settings:", this.settingsData);

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
    const currentTime = SimpleCalendar?.api
      ? SimpleCalendar.api.currentDateTime().timestamp
      : Date.now();

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
      await scene.setFlag("dimensional-weather", "lastUpdateTime", currentTime);
      console.log(
        "Dimensional Weather | Saved weather state to scene:",
        scene.id,
        weatherState
      );
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
      lastUpdate: Date.now(),
      terrain: terrain,
      season: season,
    };

    await scene.setFlag("dimensional-weather", "weatherState", weatherState);
    await scene.setFlag("dimensional-weather", "lastUpdateTime", Date.now());

    console.log(
      "Dimensional Weather | Initialized with terrain:",
      terrain,
      "and season:",
      season
    );
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

    const savedState = scene.getFlag("dimensional-weather", "weatherState");
    const currentTime = SimpleCalendar?.api
      ? SimpleCalendar.api.currentDateTime().timestamp
      : Date.now();
    const lastUpdateTime =
      scene.getFlag("dimensional-weather", "lastUpdateTime") || 0;
    const hoursSinceLastUpdate =
      (currentTime - lastUpdateTime) / (1000 * 60 * 60);

    // If this is a forced update, we'll update regardless of time
    // If it's not forced, check if enough time has passed
    if (
      !forced &&
      hoursSinceLastUpdate <
        game.settings.get("dimensional-weather", "settings").updateFrequency
    ) {
      console.log(
        "Dimensional Weather | Skipping update - not enough time has passed"
      );
      return;
    }

    // Get current terrain and season from scene flags or settings
    const currentTerrain =
      savedState?.terrain ||
      game.settings.get("dimensional-weather", "settings").terrain;
    const currentSeason =
      savedState?.season ||
      game.settings.get("dimensional-weather", "settings").season;

    // Validate terrain exists
    if (!this.settingsData.terrains[currentTerrain]) {
      console.warn(
        `Dimensional Weather | Invalid terrain: ${currentTerrain}, falling back to first available terrain`
      );
      const defaultTerrain = Object.keys(this.settingsData.terrains)[0];
      await scene.setFlag("dimensional-weather", "weatherState", {
        ...savedState,
        terrain: defaultTerrain,
      });
      return;
    }

    const terrain = this.settingsData.terrains[currentTerrain];

    // Calculate new weather values
    const variability = game.settings.get("dimensional-weather", "settings")
      .variability;
    const temperature = Math.round(
      (terrain.temperature + (savedState?.temperature ?? terrain.temperature)) /
        2 +
        ((Math.random() * 2 - 1) * variability) / 2
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

    // Apply time-of-day modifier (if available via Simple Calendar)
    const timePeriod = this.getTimePeriod();
    const modifiers = this.settingsData?.timeModifiers?.[timePeriod] || {};
    const finalTemperature = temperature + (modifiers.temperature || 0);

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
    await scene.setFlag("dimensional-weather", "lastUpdateTime", currentTime);

    console.log("Dimensional Weather | Weather Updated:", {
      ...weatherState,
      timePeriod,
      modifiers,
    });

    if (forced) {
      this.displayWeatherReport();
    }
  }

  /**
   * Determines the current time period based on Simple Calendar data.
   */
  getTimePeriod() {
    if (!SimpleCalendar?.api) {
      console.warn(
        "Dimensional Weather | Simple Calendar not available for time period"
      );
      return "Unknown Time";
    }

    const { hour } = SimpleCalendar.api.currentDateTime();
    if (hour >= 4 && hour < 7) return "Early Morning";
    if (hour >= 7 && hour < 10) return "Noon";
    if (hour >= 10 && hour < 16) return "Afternoon";
    if (hour >= 16 && hour < 22) return "Night";
    return "Late Night";
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
    if (game.settings.get("dimensional-weather", "useLLM")) {
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
    const apiKey = game.settings.get("dimensional-weather", "llmApiKey");

    if (!apiKey) {
      throw new Error(
        "No OpenAI API key configured. Please set your API key in the module settings."
      );
    }

    // Rate limiting - only allow one request every 5 seconds
    if (this._lastLLMCall && Date.now() - this._lastLLMCall < 5000) {
      throw new Error(
        "Please wait a moment before requesting another weather description."
      );
    }

    try {
      // Add retry logic
      let lastError;
      for (let i = 0; i < 3; i++) {
        try {
          return await this._callOpenAI(prompt, apiKey);
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
        console.error("Dimensional Weather | OpenAI API Error:", errorData);
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

      this._lastLLMCall = Date.now();
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
    console.log("Dimensional Weather | Saved State:", savedState);
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
    const timeDisplay = this.getTimePeriod();
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
    const currentTerrain = game.settings.get("dimensional-weather", "terrain");
    const terrain =
      this.settingsData.terrains[currentTerrain] ||
      this.settingsData.terrains["scrubPlains"];

    // Generate 5 days of weather
    const forecast = [];
    for (let i = 0; i < 5; i++) {
      // Use the terrain as a base and add some randomness
      const dayWeather = {
        temperature: Math.round(
          terrain.temperature +
            (Math.random() * 2 - 1) *
              game.settings.get("dimensional-weather", "variability")
        ),
        wind: Math.round(
          terrain.wind +
            (Math.random() * 2 - 1) *
              game.settings.get("dimensional-weather", "variability")
        ),
        precipitation: Math.round(
          terrain.precipitation +
            (Math.random() * 2 - 1) *
              game.settings.get("dimensional-weather", "variability")
        ),
        humidity: Math.round(
          terrain.humidity +
            (Math.random() * 2 - 1) *
              game.settings.get("dimensional-weather", "variability")
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
    console.log("Dimensional Weather | Forecast Message:", forecastMessage);
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
      console.log("Dimensional Weather | Calendar Info:", calendarInfo);
      ChatMessage.create({
        content: calendarInfo,
        speaker: { alias: "Dimensional Weather" },
      });
    } else {
      ui.notifications.warn("Simple Calendar module is not active.");
    }
  }

  /**
   * Updates the current season
   * @param {string} season - The new season
   */
  async setSeason(season) {
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
    // Only try to get season from Simple Calendar if enabled
    if (
      game.settings.get("dimensional-weather", "settings").useSimpleCalendar &&
      SimpleCalendar?.api
    ) {
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
    // Only try to get season from Simple Calendar if enabled
    if (
      game.settings.get("dimensional-weather", "settings").useSimpleCalendar &&
      SimpleCalendar?.api
    ) {
      const currentSeason = SimpleCalendar.api.getCurrentSeason();
      if (currentSeason) {
        return currentSeason.name;
      }
    }

    // Get the current scene and its weather state
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

    // Get the season name from settings
    return (
      this.settingsData?.seasons?.[savedState.season]?.name || "Unknown Season"
    );
  }

  /**
   * Gets the current season description
   * @returns {string} The current season description
   */
  getSeasonDescription() {
    // Only try to get season from Simple Calendar if enabled
    if (
      game.settings.get("dimensional-weather", "settings").useSimpleCalendar &&
      SimpleCalendar?.api
    ) {
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
    const commands = game.settings.get("dimensional-weather", "chatCommands");
    const weatherCmd = commands.weather;
    const forecastCmd = commands.forecast;
    const dateCmd = commands.date;

    const helpText = `
Weather System Commands:
${weatherCmd.usage}
  terrain [name] - Change terrain type (GM only)
  season [name] - Change current season (GM only)
  update - Force weather update (GM only)
  stats - Show current weather statistics
  random - Generate random weather (GM only)
  help - Show this help message

${forecastCmd.usage} - Show weather forecast
${dateCmd.usage} - Show calendar information

Available Terrains:
${Object.entries(this.settingsData.terrains)
  .map(([_, t]) => `- ${t.name}`)
  .join("\n")}

Available Seasons:
${Object.entries(this.settingsData.seasons)
  .map(([_, s]) => `- ${s.name}`)
  .join("\n")}
`;

    return helpText;
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
}

class DimensionalWeatherSettings extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dimensional-weather-settings",
      title: "Dimensional Weather Settings",
      template: "modules/dimensional-weather/templates/settings.html",
      width: 600,
      height: 600,
      tabs: [
        {
          group: "primary-tabs",
          navSelector: ".tabs",
          contentSelector: ".content",
          initial: "general",
        },
      ],
      classes: ["dimensional-weather-settings"],
    });
  }

  async getData() {
    const settings = game.settings.get("dimensional-weather", "settings");
    const campaignSettings = game.settings.get(
      "dimensional-weather",
      "campaignSettings"
    );
    const currentCampaign = campaignSettings[settings.campaign];

    return {
      settings: settings,
      campaignChoices: Object.fromEntries(
        Object.entries(campaignSettings).map(([id, data]) => [id, data.name])
      ),
      terrainChoices: Object.fromEntries(
        Object.entries(currentCampaign?.terrains || {}).map(([id, terrain]) => [
          id,
          terrain.name || id.replace(/([A-Z])/g, " $1").trim(),
        ])
      ),
      seasonChoices: Object.fromEntries(
        Object.entries(currentCampaign?.seasons || {}).map(([id, season]) => [
          id,
          season.name || id.replace(/([A-Z])/g, " $1").trim(),
        ])
      ),
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Handle campaign setting changes
    html
      .find('select[name="campaign"]')
      .on("change", this._onCampaignChange.bind(this));

    // Handle Simple Calendar integration
    html
      .find('input[name="useSimpleCalendar"]')
      .on("change", this._onSimpleCalendarToggle.bind(this));

    // Handle preview button
    html
      .find(".preview-weather")
      .on("click", this._onPreviewWeather.bind(this));

    // Handle range input display
    html.find('input[type="range"]').on("input", this._onRangeInput.bind(this));
  }

  async _updateObject(event, formData) {
    const settings = game.settings.get("dimensional-weather", "settings");
    const updates = foundry.utils.expandObject(formData);
    const newSettings = foundry.utils.mergeObject(settings, updates);
    await game.settings.set("dimensional-weather", "settings", newSettings);

    // Refresh weather if auto-update is enabled
    if (newSettings.autoUpdate) {
      await game.dimWeather.updateWeather(true);
    }
  }

  async _onCampaignChange(event) {
    const campaign = event.target.value;
    const settings = game.settings.get("dimensional-weather", "settings");
    const campaignSettings = game.settings.get(
      "dimensional-weather",
      "campaignSettings"
    );
    const currentCampaign = campaignSettings[campaign];

    // Update terrain and season dropdowns
    const terrainSelect = this.element.find('select[name="terrain"]');
    const seasonSelect = this.element.find('select[name="season"]');

    terrainSelect.empty();
    seasonSelect.empty();

    Object.entries(currentCampaign.terrains).forEach(([id, name]) => {
      terrainSelect.append(`<option value="${id}">${name}</option>`);
    });

    Object.entries(currentCampaign.seasons).forEach(([id, name]) => {
      seasonSelect.append(`<option value="${id}">${name}</option>`);
    });

    // Set default values
    settings.campaign = campaign;
    settings.terrain = Object.keys(currentCampaign.terrains)[0];
    settings.season = Object.keys(currentCampaign.seasons)[0];

    await game.settings.set("dimensional-weather", "settings", settings);
    this.render();
  }

  _onSimpleCalendarToggle(event) {
    const seasonSelect = this.element.find('select[name="season"]');
    seasonSelect.prop("disabled", event.target.checked);
  }

  async _onPreviewWeather(event) {
    event.preventDefault();
    await game.dimWeather.updateWeather(true);
  }

  _onRangeInput(event) {
    const value = event.target.value;
    $(event.target).siblings(".range-value").text(value);
  }
}

// Register module settings during initialization.
Hooks.once("init", async () => {
  console.log("Dimensional Weather | Init hook called");
  console.log(
    "Dimensional Weather | Module directory:",
    game.modules.get("dimensional-weather")?.path
  );
});

// Create and initialize the weather system
Hooks.once("ready", async () => {
  console.log("Dimensional Weather | Ready hook called");

  try {
    // Register the main settings object
    game.settings.register("dimensional-weather", "settings", {
      name: "Weather Settings",
      scope: "world",
      config: false,
      type: Object,
      default: {
        campaign: "default",
        terrain: "plains",
        season: "summer",
        useSimpleCalendar: false,
        autoUpdate: true,
        updateFrequency: 6,
        variability: 5,
      },
    });

    // Register LLM settings
    game.settings.register("dimensional-weather", "useLLM", {
      name: "Use AI for Weather Descriptions",
      hint: "Enable AI-generated weather descriptions using OpenAI's API",
      scope: "world",
      config: false,
      type: Boolean,
      default: false,
    });

    game.settings.register("dimensional-weather", "llmApiKey", {
      name: "OpenAI API Key",
      hint: "Your OpenAI API key for generating weather descriptions",
      scope: "world",
      config: false,
      type: String,
      default: "",
    });

    // Register campaign settings data
    game.settings.register("dimensional-weather", "campaignSettings", {
      name: "Campaign Settings Data",
      scope: "world",
      config: false,
      type: Object,
      default: {},
    });

    // Register the settings menu
    game.settings.registerMenu("dimensional-weather", "weatherSettings", {
      name: "Weather Settings",
      label: "Weather Settings",
      icon: "fas fa-cloud-sun",
      type: DimensionalWeatherSettings,
      restricted: true,
    });

    // Load initial campaign settings
    await DimensionalWeather.loadCampaignSettings();

    // Then create and initialize the weather system
    game.dimWeather = new DimensionalWeather();
    await game.dimWeather.loadSettings();
    console.log(
      "Dimensional Weather | Module initialized with settings:",
      game.dimWeather.settingsData
    );
  } catch (error) {
    console.error("Dimensional Weather | Failed to register settings:", error);
    ui.notifications.error(
      "Failed to register weather settings. Check the console for details."
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
          await game.settings.set(
            "dimensional-weather",
            "campaignSetting",
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
          await game.settings.set(
            "dimensional-weather",
            "terrain",
            defaultTerrain
          );
          await game.settings.set(
            "dimensional-weather",
            "season",
            defaultSeason
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
              game.settings.set("dimensional-weather", "terrain", terrain);
              game.dimWeather.initWeather();
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
            if (game.settings.get("dimensional-weather", "useSimpleCalendar")) {
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
            game.dimWeather.setSeason(seasonKey);
            return game.dimWeather.getWeatherDescription();

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
            game.settings.set("dimensional-weather", "variability", value);
            game.dimWeather.variability = value;
            ui.notifications.info(`Weather variability set to ${value}`);
            break;

          case "stats":
            const scene = game.scenes.viewed;
            const savedState = scene?.id
              ? scene.getFlag("dimensional-weather", "weatherState")
              : null;

            const stats = {
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
              whisper: [game.user.id],
            };

          case "help":
            return game.dimWeather.getHelpText();

          default:
            return "Invalid subcommand. Use /weather help for available options.";
        }
      } catch (error) {
        console.error("Weather command error:", error);
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
        console.error("Weather autocomplete error:", error);
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
        console.error("Date command error:", error);
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
        console.error("Date autocomplete error:", error);
        return [];
      }
    },
    closeOnComplete: true,
  });
});

// Hook into Simple Calendar's time change event
Hooks.on("simple-calendar-time-change", async () => {
  if (game.dimWeather) {
    const updateFrequency = game.settings.get(
      "dimensional-weather",
      "updateFrequency"
    );
    const lastUpdateTime = game.settings.get(
      "dimensional-weather",
      "lastUpdateTime"
    );
    const currentTime = SimpleCalendar.api.currentDateTime().timestamp;
    const hoursSinceLastUpdate =
      (currentTime - lastUpdateTime) / (1000 * 60 * 60);

    if (hoursSinceLastUpdate >= updateFrequency) {
      console.log("Dimensional Weather | Time-based weather update triggered");
      await game.dimWeather.updateWeather(true);
    }
  }
});

// Hook into scene activation to load weather state
Hooks.on("canvasReady", async () => {
  if (game.dimWeather) {
    console.log(
      "Dimensional Weather | Scene activated, checking for saved weather state"
    );
    await game.dimWeather.loadSceneWeather();
  }
});
