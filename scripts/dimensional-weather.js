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
    this.temperature = 0;
    this.wind = 0;
    this.precipitation = 0;
    this.humidity = 0;
    this.variability = 5;
    this.initialized = false;
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

      // Get the selected campaign setting
      const selectedSetting =
        game.settings.get("dimensional-weather", "campaignSetting") ||
        "default";
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

      // Initialize weather after settings are loaded
      if (!this.initialized) {
        await this.initWeather();
        this.initialized = true;
      }
    } catch (error) {
      console.error("Dimensional Weather | Failed to load settings:", error);
      ui.notifications.error(
        "Failed to load weather settings. Check the console for details."
      );
      // Load default fallback values
      this.settingsData = {
        name: "Default Fallback",
        description: "Basic fallback weather system",
        weatherDimensions: {
          temperature: { descriptions: { "0": "Normal temperature" } },
          wind: { descriptions: { "0": "Normal wind" } },
          precipitation: { descriptions: { "0": "Clear skies" } },
          humidity: { descriptions: { "0": "Normal humidity" } },
        },
        terrains: {
          default: {
            name: "Default",
            description: "Default terrain",
            temperature: 0,
            wind: 0,
            precipitation: 0,
            humidity: 0,
            variability: 5,
            rules: [],
          },
        },
      };
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

    const terrainKey = game.settings.get("dimensional-weather", "terrain");
    const terrain =
      this.settingsData.terrains[terrainKey] ||
      Object.values(this.settingsData.terrains)[0];

    if (!terrain) {
      console.error("Dimensional Weather | No valid terrain found");
      return;
    }

    this.temperature = terrain.temperature;
    this.wind = terrain.wind;
    this.precipitation = terrain.precipitation;
    this.humidity = terrain.humidity;
    this.variability =
      game.settings.get("dimensional-weather", "variability") ?? 5;

    console.log("Dimensional Weather | Initialized with terrain:", terrainKey);
  }

  static async registerSettings() {
    console.log("Dimensional Weather | Registering settings");

    try {
      // Load the settings index first to populate the campaign setting choices
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

      // Register campaign setting choice
      game.settings.register("dimensional-weather", "campaignSetting", {
        name: "Campaign Setting",
        hint: "Choose which campaign setting to use for weather generation",
        scope: "world",
        config: true,
        type: String,
        choices: choices,
        default: "default",
        onChange: async (value) => {
          if (game.dimWeather) {
            await game.dimWeather.loadSettings();
            game.dimWeather.initWeather();
            ui.notifications.info(
              `Weather system changed to ${choices[value]}`
            );
          }
        },
      });

      // Register chat commands settings
      game.settings.register("dimensional-weather", "chatCommands", {
        name: "Chat Commands",
        hint: "Register weather chat commands",
        scope: "world",
        config: false,
        type: Object,
        default: {
          weather: {
            command: "weather",
            description: "Display or modify weather conditions",
            usage: "/weather [terrain|update|stats|random|help]",
          },
          forecast: {
            command: "forecast",
            description: "Display weather forecast",
            usage: "/forecast",
          },
          date: {
            command: "date",
            description: "Display calendar information",
            usage: "/date",
          },
        },
      });

      // Terrain type setting
      game.settings.register("dimensional-weather", "terrain", {
        name: "Terrain Type",
        hint:
          "The type of terrain in Athas for weather generation. Note: Time and season information is automatically retrieved from Simple Calendar.",
        scope: "world",
        config: true,
        type: String,
        choices: {
          boulderFields: "Boulder Fields",
          dustSinks: "Dust Sinks",
          forestRidge: "Forest Ridge",
          mountains: "Mountains",
          mudflats: "Mudflats",
          ringingMountains: "Ringing Mountains",
          rockyBadlands: "Rocky Badlands",
          saltFlats: "Salt Flats",
          saltMarshes: "Salt Marshes",
          sandyWastes: "Sandy Wastes",
          scrubPlains: "Scrub Plains",
          seaOfSilt: "Sea Of Silt",
          stonyBarrens: "Stony Barrens",
          verdantBelt: "Verdant Belt",
        },
        default: "scrubPlains",
        onChange: (value) => {
          if (game.dimWeather) {
            game.dimWeather.setTerrain(value);
          }
        },
      });

      // Variability control
      game.settings.register("dimensional-weather", "variability", {
        name: "Weather Variability",
        hint: "Higher values mean more rapid weather changes.",
        scope: "world",
        config: true,
        type: Number,
        default: 5,
        range: { min: 0, max: 10, step: 1 },
      });

      // LLM Settings
      game.settings.register("dimensional-weather", "useLLM", {
        name: "Use AI for Descriptions",
        hint:
          "Use an AI language model to generate more dynamic weather descriptions.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
      });

      game.settings.register("dimensional-weather", "llmProvider", {
        name: "AI Provider",
        hint: "Choose which AI service to use for descriptions.",
        scope: "world",
        config: true,
        type: String,
        choices: {
          openai: "OpenAI (ChatGPT)",
          anthropic: "Anthropic (Claude)",
          google: "Google (Gemini)",
        },
        default: "openai",
      });

      game.settings.register("dimensional-weather", "llmApiKey", {
        name: "AI API Key",
        hint: "Your API key for the chosen AI service.",
        scope: "world",
        config: true,
        type: String,
        default: "",
      });
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

  /**
   * Sets the current terrain and updates weather accordingly
   * @param {string} terrainKey - The key of the terrain to set
   */
  setTerrain(terrainKey) {
    if (!this.settingsData?.terrains) {
      console.error(
        "Dimensional Weather | Settings data or terrains not loaded"
      );
      ui.notifications.error(
        "Weather system settings not loaded. Please try reloading the page."
      );
      return;
    }

    if (!this.settingsData.terrains[terrainKey]) {
      console.warn(
        `Dimensional Weather | Invalid terrain key: ${terrainKey}, falling back to scrubPlains`
      );
      terrainKey = "scrubPlains";
    }

    console.log(`Dimensional Weather | Setting terrain to: ${terrainKey}`);
    const terrain = this.settingsData.terrains[terrainKey];

    if (!terrain) {
      console.error(
        "Dimensional Weather | No valid terrain found, using default values"
      );
      this.temperature = 0;
      this.wind = 0;
      this.precipitation = 0;
      this.humidity = 0;
      return;
    }

    this.temperature = terrain.temperature ?? 0;
    this.wind = terrain.wind ?? 0;
    this.precipitation = terrain.precipitation ?? 0;
    this.humidity = terrain.humidity ?? 0;

    this.updateWeather(true);
  }

  /**
   * Updates the weather dimensions using a simple interpolation between the
   * current values and the terrain baseline. Optionally applies time-of-day modifiers.
   */
  updateWeather(forced = false) {
    if (!this.settingsData?.terrains) {
      console.error(
        "Dimensional Weather | Settings data or terrains not loaded"
      );
      ui.notifications.error(
        "Weather system settings not loaded. Please try reloading the page."
      );
      return;
    }

    const terrainKey = game.settings.get("dimensional-weather", "terrain");
    let terrain = this.settingsData.terrains[terrainKey];

    // Fallback to scrubPlains if the terrain doesn't exist
    if (!terrain) {
      console.warn(
        `Dimensional Weather | Invalid terrain: ${terrainKey}, falling back to scrubPlains`
      );
      terrain = this.settingsData.terrains["scrubPlains"];
    }

    // If still no valid terrain, use default values
    if (!terrain) {
      console.error(
        "Dimensional Weather | No valid terrain found, using default values"
      );
      terrain = {
        temperature: 0,
        wind: 0,
        precipitation: 0,
        humidity: 0,
      };
    }

    // Basic interpolation with a random factor based on variability.
    this.temperature = Math.round(
      (this.temperature + (terrain.temperature ?? 0)) / 2 +
        ((Math.random() * 2 - 1) * this.variability) / 2
    );
    this.wind = Math.round(
      (this.wind + (terrain.wind ?? 0)) / 2 +
        ((Math.random() * 2 - 1) * this.variability) / 2
    );
    this.precipitation = Math.round(
      (this.precipitation + (terrain.precipitation ?? 0)) / 2 +
        ((Math.random() * 2 - 1) * this.variability) / 2
    );
    this.humidity = Math.round(
      (this.humidity + (terrain.humidity ?? 0)) / 2 +
        ((Math.random() * 2 - 1) * this.variability) / 2
    );

    // Apply time-of-day modifier (if available via Simple Calendar)
    const timePeriod = this.getTimePeriod();
    const modifiers = this.settingsData?.timeModifiers?.[timePeriod] || {};
    if (typeof modifiers.temperature !== "undefined") {
      this.temperature += modifiers.temperature;
    }

    // Clamp values within -10 and 10.
    this.temperature = Math.max(-10, Math.min(10, this.temperature));
    this.wind = Math.max(-10, Math.min(10, this.wind));
    this.precipitation = Math.max(-10, Math.min(10, this.precipitation));
    this.humidity = Math.max(-10, Math.min(10, this.humidity));

    console.log("Dimensional Weather | Unformatted Weather Report:", {
      temperature: this.temperature,
      wind: this.wind,
      precipitation: this.precipitation,
      humidity: this.humidity,
      terrain: terrainKey,
      timePeriod: timePeriod,
      modifiers: modifiers,
    });

    if (forced) {
      this.displayWeatherReport();
    }
  }

  /**
   * Determines the current time period based on Simple Calendar data.
   * Defaults to "Afternoon" if Simple Calendar is not available.
   */
  getTimePeriod() {
    if (SimpleCalendar?.api) {
      const { hour } = SimpleCalendar.api.currentDateTime();
      if (hour >= 4 && hour < 7) return "Early Morning";
      if (hour >= 7 && hour < 10) return "Noon";
      if (hour >= 10 && hour < 16) return "Afternoon";
      if (hour >= 16 && hour < 22) return "Night";
      return "Late Night";
    }
    return "Afternoon";
  }

  /**
   * Generates survival rules based on current weather conditions and terrain
   */
  getSurvivalRules() {
    let survivalRules = "<h4>Survival Rules:</h4><ul>";

    // Temperature-based rules
    if (this.settingsData?.weatherDimensions?.temperature?.rules) {
      const tempRules = this.settingsData.weatherDimensions.temperature.rules;
      // Check for extreme cold
      if (this.temperature <= -10 && tempRules["-10"]) {
        const rule = tempRules["-10"];
        survivalRules += `<li>${rule.effect}</li>`;
        if (rule.immunity) {
          survivalRules += `<li>${rule.immunity}</li>`;
        }
      }
      // Check for extreme heat
      if (this.temperature >= 2 && tempRules["2"]) {
        const rule = tempRules["2"];
        survivalRules += `<li>${rule.effect}</li>`;
        if (rule.disadvantage) {
          survivalRules += `<li>${rule.disadvantage}</li>`;
        }
        if (rule.immunity) {
          survivalRules += `<li>${rule.immunity}</li>`;
        }
      }
    }

    // Wind-based rules
    if (this.wind >= 6) {
      survivalRules += `<li>Ranged attacks have disadvantage</li>
                       <li>Open flames are extinguished</li>
                       <li>Fog is dispersed</li>
                       <li>Flying creatures must land at the end of their turn or fall</li>`;
    }

    // Precipitation-based rules
    if (this.settingsData?.weatherDimensions?.precipitation?.rules) {
      const precipRules = this.settingsData.weatherDimensions.precipitation
        .rules;
      if (this.precipitation >= 5 && precipRules["5"]) {
        const rule = precipRules["5"];
        survivalRules += `<li>${rule.effect}</li>`;
        if (rule.disadvantage) {
          survivalRules += `<li>${rule.disadvantage}</li>`;
        }
      }
    }

    // Add terrain-specific rules
    const currentTerrain = game.settings.get("dimensional-weather", "terrain");
    const terrain = this.settingsData?.terrains?.[currentTerrain];
    if (terrain?.rules) {
      terrain.rules.forEach((rule) => {
        survivalRules += `<li>${rule}</li>`;
      });
    }

    survivalRules += "</ul>";
    return survivalRules;
  }

  /**
   * Rounds a value down to the nearest even number within the -10 to 10 range
   * @private
   */
  _roundToEvenForDescription(value) {
    // First round down to nearest even number
    let rounded = Math.floor(value / 2) * 2;
    // Then clamp between -10 and 10
    rounded = Math.max(-10, Math.min(10, rounded));
    return rounded.toString();
  }

  /**
   * Returns a narrative description of the current weather conditions.
   */
  async getWeatherDescription() {
    if (!this.settingsData?.weatherDimensions) {
      console.warn("Dimensional Weather | Weather dimensions not loaded");
      return "Weather system is still initializing...";
    }

    const tempDesc =
      this.settingsData.weatherDimensions.temperature.descriptions[
        this.temperature.toString()
      ] || "Normal temperature";
    const windDesc =
      this.settingsData.weatherDimensions.wind.descriptions[
        this._roundToEvenForDescription(this.wind)
      ] || "Normal wind";
    const precipDesc =
      this.settingsData.weatherDimensions.precipitation.descriptions[
        this.precipitation.toString()
      ] || "Clear skies";
    const humidDesc =
      this.settingsData.weatherDimensions.humidity.descriptions[
        this.humidity.toString()
      ] || "Normal humidity";
    const currentTerrain = game.settings.get("dimensional-weather", "terrain");
    const timePeriod = this.getTimePeriod();

    // Get base terrain description
    let atmosphericDesc = "";
    switch (currentTerrain) {
      case "boulderFields":
        atmosphericDesc =
          "Jagged rocks and broken terrain stretch endlessly. Some are old lava flows long since cooled, while others are valleys choked with rockslides. Deep gulches and crevices crisscross the landscape, offering plenty of hiding places.";
        break;
      case "dustSinks":
        atmosphericDesc =
          "Windblown dust, ash, and silt accumulate in depressions, forming billowing clouds at the slightest breeze. The ground appears smooth but conceals treacherous depths.";
        break;
      case "forestRidge":
        atmosphericDesc =
          "A dense, dark forest provides rare relief from the sun. The air is thick with the scent of pine and the sound of wind through branches. Ancient trees rise from rocky ridges.";
        break;
      case "mountains":
        atmosphericDesc =
          "Bare, rocky peaks rise dramatically, offering little water or shelter. The exposed rock crumbles under the twin hammers of heat and cold, creating treacherous slopes of broken rock.";
        break;
      case "mudflats":
        atmosphericDesc =
          "Water seeps upward, saturating the land to create a soupy mess. Some areas are lush with vegetation, while others are hard, cracked clay that might not support a traveler's weight.";
        break;
      case "ringingMountains":
        atmosphericDesc =
          "Rugged peaks rise into the sky, their slopes covered in loose scree and jagged rocks.";
        break;
      case "rockyBadlands":
        atmosphericDesc =
          "Highly eroded mazes of sharp-edged ridges, winding canyons, and thorn-choked ravines stretch endlessly. Daunting escarpments force travelers into meandering courses.";
        break;
      case "saltFlats":
        atmosphericDesc =
          "Great flat plains encrusted with salt that is white, brown, or black stretch for miles. The ground crunches underfoot, and temperatures reach brutal extremes.";
        break;
      case "saltMarshes":
        atmosphericDesc =
          "Low grasses and reeds dot the landscape, with ankle-deep channels of briny water winding through. Tough stands of scrub and occasional trees rise above the vegetation.";
        break;
      case "sandyWastes":
        atmosphericDesc =
          "Vast stretches of yellow sand stretch to the horizon. Some areas are flat and still, while others feature great dunes that shift endlessly under the wind.";
        break;
      case "scrubPlains":
        atmosphericDesc =
          "Tough, dry grass punctuated by creosote bushes and tumbleweed dominates the ground. A few small trees are scattered across the landscape.";
        break;
      case "seaOfSilt":
        atmosphericDesc =
          "A vast expanse of fine, powdery silt. The wind stirs up clouds of dust.";
        break;
      case "stonyBarrens":
        atmosphericDesc =
          "Weathered plains covered with rocks ranging from pebbles to huge piles of standing boulders. Huge mesas and pointed buttes dot the landscape.";
        break;
      case "verdantBelt":
        atmosphericDesc =
          "A rare oasis of life in the desert. Ancient magic or underground springs sustain lush vegetation.";
        break;
      default:
        atmosphericDesc =
          "The landscape is harsh and unforgiving, with the sun blazing overhead.";
    }

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
    // Humidity-based descriptions
    if (this.humidity < -8) {
      humidDesc =
        this.settingsData.weatherDimensions.humidity.descriptions["-10"] ||
        "Very low humidity";
    } else if (this.humidity < -5) {
      humidDesc =
        this.settingsData.weatherDimensions.humidity.descriptions["-5"] ||
        "Low humidity";
    } else if (this.humidity < -1) {
      humidDesc =
        this.settingsData.weatherDimensions.humidity.descriptions["-1"] ||
        "Slightly low humidity";
    } else {
      humidDesc =
        this.settingsData.weatherDimensions.humidity.descriptions["0"] ||
        "Normal humidity";
    }

    // Precipitation-based descriptions
    if (this.precipitation > 3) {
      precipDesc =
        this.settingsData.weatherDimensions.precipitation.descriptions["10"] ||
        "Very high precipitation";
    } else if (this.precipitation > 0) {
      precipDesc =
        this.settingsData.weatherDimensions.precipitation.descriptions["5"] ||
        "High precipitation";
    } else if (this.precipitation > -5) {
      precipDesc =
        this.settingsData.weatherDimensions.precipitation.descriptions["-5"] ||
        "Moderate precipitation";
    } else {
      precipDesc =
        this.settingsData.weatherDimensions.precipitation.descriptions["-10"] ||
        "Very low precipitation";
    }

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
    const llmProvider = game.settings.get("dimensional-weather", "llmProvider");

    if (!apiKey) {
      throw new Error(
        "No API key configured. Please set your API key in the module settings."
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
          switch (llmProvider) {
            case "openai":
              return await this._callOpenAI(prompt, apiKey);
            case "anthropic":
              return await this._callAnthropic(prompt, apiKey);
            case "google":
              return await this._callGoogle(prompt, apiKey);
            default:
              throw new Error(`Unsupported LLM provider: ${llmProvider}`);
          }
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
   * Calls Anthropic's API (Claude)
   */
  async _callAnthropic(prompt, apiKey) {
    if (!apiKey) {
      throw new Error("Anthropic API key is required");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      proxy: true,
    });

    if (!response.ok) {
      let errorMessage = `Anthropic API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // If we can't parse the error response, use the status text
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    this._lastLLMCall = Date.now();
    return data.content[0].text.trim();
  }

  /**
   * Calls Google's API (Gemini)
   */
  async _callGoogle(prompt, apiKey) {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150,
          },
        }),
        proxy: true,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Google API error: ${error.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    this._lastLLMCall = Date.now();
    return data.candidates[0].content.parts[0].text.trim();
  }

  /**
   * Outputs the current weather report as a chat message.
   */
  async displayWeatherReport() {
    const description = await this.getWeatherDescription();
    const currentTerrain = game.settings.get("dimensional-weather", "terrain");
    const terrainDisplay = currentTerrain
      .replace(/([A-Z])/g, " $1")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    const chatCardText = `<div class="weather-report">
                  <h3>Current Weather</h3>
                  <p class="terrain-type">${terrainDisplay}</p>
                  <hr>
                  <p>${description}</p>
                </div>`;
    console.log("Dimensional Weather | Chat Card Text:", chatCardText);
    console.log("Dimensional Weather | Weather Stats:", {
      temperature: this.temperature,
      wind: this.wind,
      precipitation: this.precipitation,
      humidity: this.humidity,
      terrain: currentTerrain,
      timePeriod: this.getTimePeriod(),
      variability: this.variability,
    });
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
          terrain.temperature + (Math.random() * 2 - 1) * this.variability
        ),
        wind: Math.round(
          terrain.wind + (Math.random() * 2 - 1) * this.variability
        ),
        precipitation: Math.round(
          terrain.precipitation + (Math.random() * 2 - 1) * this.variability
        ),
        humidity: Math.round(
          terrain.humidity + (Math.random() * 2 - 1) * this.variability
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
}

// ===== Foundry Hook Registrations =====

// Register module settings during initialization.
Hooks.once("init", async () => {
  console.log("Dimensional Weather | Init hook called");
  console.log(
    "Dimensional Weather | Module directory:",
    game.modules.get("dimensional-weather")?.path
  );
  await DimensionalWeather.registerSettings();
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
        if (subcommand === "setting") {
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

          await game.settings.set(
            "dimensional-weather",
            "campaignSetting",
            setting.id
          );

          // Load the new settings to get the default terrain
          await game.dimWeather.loadSettings();

          // Set the terrain to the first terrain in the settings file
          const defaultTerrain = Object.keys(
            game.dimWeather.settingsData.terrains
          )[0];
          if (defaultTerrain) {
            await game.settings.set(
              "dimensional-weather",
              "terrain",
              defaultTerrain
            );
            await game.dimWeather.initWeather();
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

          return {
            content: `Campaign setting changed to ${setting.name}. Terrain set to default: ${formattedTerrain}`,
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
              await game.dimWeather.updateWeather(false);
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
            const stats = {
              temperature: game.dimWeather.temperature,
              wind: game.dimWeather.wind,
              precipitation: game.dimWeather.precipitation,
              humidity: game.dimWeather.humidity,
              variability: game.dimWeather.variability,
              terrain: game.settings.get("dimensional-weather", "terrain"),
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
            showWeatherHelp();
            break;

          default:
            showWeatherHelp();
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
          { cmd: "setting", desc: "Change campaign setting" },
          { cmd: "update", desc: "Force weather update" },
          { cmd: "random", desc: "Set weather variability (0-10)" },
          { cmd: "stats", desc: "Display weather statistics" },
          { cmd: "forecast", desc: "Show weather forecast" },
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

        // Handle setting subcommand
        if (
          args[0] === "setting" ||
          (args[0] && "setting".startsWith(args[0]))
        ) {
          if (!game.user.isGM) {
            return [
              game.chatCommands.createInfoElement(
                "Only GMs can change campaign settings."
              ),
            ];
          }

          // If just "setting" or partial match, show all settings
          if (args.length === 1) {
            return game.dimWeather.settingsIndex.campaignSettings.map(
              (setting) =>
                game.chatCommands.createCommandElement(
                  `${alias} setting ${setting.id}`,
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
                  `${alias} setting ${setting.id}`,
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

// Helper function to show weather help
function showWeatherHelp() {
  if (!game.dimWeather?.settingsData?.terrains) {
    ui.notifications.warn(
      "Weather system not initialized. Please wait a moment and try again."
    );
    return;
  }

  // Get terrain list from settings
  const terrainList = Object.entries(game.dimWeather.settingsData.terrains)
    .map(([key, terrain]) => {
      const name = terrain.name || key.replace(/([A-Z])/g, " $1").trim();
      const description = terrain.description ? `: ${terrain.description}` : "";
      return `<li>${name}${description}</li>`;
    })
    .join("\n");

  // Get settings list
  const settingsList = game.dimWeather.settingsIndex.campaignSettings
    .map((setting) => `<li>${setting.name}</li>`)
    .join("\n");

  ChatMessage.create({
    content: `<div class="weather-report">
                <h3>Weather Commands Help</h3>
                <ul>
                  <li><code>/weather</code> - Display current weather</li>
                  <li><code>/weather terrain [Terrain]</code> - Set the current terrain type</li>
                  <li><code>/weather setting [Setting]</code> - Change campaign setting (GM only)</li>
                  <li><code>/weather update</code> - Force weather update</li>
                  <li><code>/weather stats</code> - Display weather statistics (GM only)</li>
                  <li><code>/weather forecast</code> - Show weather forecast (GM only)</li>
                  <li><code>/weather random [0-10]</code> - Set weather variability (GM only)</li>
                  <li><code>/date</code> - Show calendar information</li>
                </ul>
                <h4>Available Campaign Settings:</h4>
                <ul>
                  ${settingsList}
                </ul>
                <h4>Available Terrains:</h4>
                <ul>
                  ${terrainList}
                </ul>
              </div>`,
    speaker: { alias: "Dimensional Weather" },
  });
}

// Create and initialize the weather system
Hooks.once("ready", async () => {
  console.log("Dimensional Weather | Ready hook called");
  game.dimWeather = new DimensionalWeather();
  await game.dimWeather.loadSettings();
  console.log(
    "Dimensional Weather | Module initialized with settings:",
    game.dimWeather.settingsData
  );
});
