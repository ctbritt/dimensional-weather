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
    // Initialize weather dimensions with default values or provided options
    this.temperature = options.temperature ?? 0; // scale: -10 to 10
    this.wind = options.wind ?? 0;
    this.precipitation = options.precipitation ?? 0;
    this.humidity = options.humidity ?? 0;
    this.variability = options.variability ?? 5; // How rapidly weather can change

    // Optionally use hex map mode (not fully implemented in this example)
    this.useHexMap =
      game.settings.get("dimensional-weather", "useHexMap") || false;
    this.currentHexPosition = { q: 0, r: 0 };
    this.currentWeatherType = "normal";

    // Define Dark Sun terrain presets
    this.terrains = {
      boulderFields: {
        temperature: 9,
        wind: 6,
        precipitation: -10,
        humidity: -10,
        variability: 6,
      },
      dustSinks: {
        temperature: 10,
        wind: 7,
        precipitation: -10,
        humidity: -5,
        variability: 8,
      },
      mountains: {
        temperature: 4,
        wind: 8,
        precipitation: -10,
        humidity: -5,
        variability: 9,
      },
      mudflats: {
        temperature: 8,
        wind: 3,
        precipitation: -5,
        humidity: 5,
        variability: 7,
      },
      rockyBadlands: {
        temperature: 9,
        wind: 6,
        precipitation: -10,
        humidity: -10,
        variability: 6,
      },
      saltFlats: {
        temperature: 10,
        wind: 4,
        precipitation: -10,
        humidity: -10,
        variability: 3,
      },
      saltMarshes: {
        temperature: 8,
        wind: 2,
        precipitation: -5,
        humidity: 5,
        variability: 5,
      },
      sandyWastes: {
        temperature: 10,
        wind: 8,
        precipitation: -10,
        humidity: -10,
        variability: 10,
      },
      scrubPlains: {
        temperature: 8,
        wind: 3,
        precipitation: -10,
        humidity: -5,
        variability: 4,
      },
      stonyBarrens: {
        temperature: 9,
        wind: 5,
        precipitation: -10,
        humidity: -10,
        variability: 5,
      },
      verdantBelt: {
        temperature: 7,
        wind: 2,
        precipitation: -5,
        humidity: 5,
        variability: 6,
      },
      seaOfSilt: {
        temperature: 10,
        wind: 7,
        precipitation: -10,
        humidity: -5,
        variability: 9,
      },
      ringingMountains: {
        temperature: 4,
        wind: 8,
        precipitation: -10,
        humidity: -5,
        variability: 9,
      },
      forestRidge: {
        temperature: 3,
        wind: -2,
        precipitation: 5,
        humidity: 10,
        variability: 7,
      },
      // ... add additional terrains here if needed ...
    };

    // Descriptions for weather dimensions (expanded for more granularity)
    this.temperatureDescriptions = {
      "-10":
        "Freezing (40° F) - The night air bites at exposed skin, a rare respite from the day's heat",
      "-9":
        "Very Cold (45° F) - The air is crisp and cold, a welcome relief from the usual heat",
      "-8":
        "Cold (50° F) - A cool breeze offers temporary relief from the desert's usual heat",
      "-7": "Cool (55° F) - The temperature is surprisingly mild for Athas",
      "-6":
        "Mildly Cool (60° F) - A pleasant temperature by Athasian standards",
      "-5": "Cold (65° F) - The air feels refreshingly cool",
      "-4": "Cool (70° F) - A comfortable temperature for travel",
      "-3": "Mildly Cool (75° F) - The heat is bearable",
      "-2": "Cool (80° F) - The temperature is moderate for Athas",
      "-1": "Mild (85° F) - The heat begins to intensify",
      "0": "Mild (90° F) - The sun's heat becomes noticeable",
      "1": "Warm (95° F) - The heat starts to become oppressive",
      "2": "Hot (100° F) - The sun's rays burn exposed skin",
      "3": "Very Hot (105° F) - The heat is intense and dangerous",
      "4": "Extremely Hot (110° F) - The air shimmers with heat",
      "5": "Hot (115° F) - The heat is nearly unbearable",
      "6": "Very Hot (120° F) - The air feels like a furnace",
      "7": "Extremely Hot (125° F) - The heat threatens to overwhelm",
      "8": "Scorching (130° F) - The heat is deadly to the unprepared",
      "9": "Deadly Hot (135° F) - The heat is life-threatening",
      "10":
        "Unbearable (140° F+) - The heat is lethal without immediate shelter",
    };
    this.windDescriptions = {
      "-10": "Dead Still - The air is eerily motionless",
      "-8": "Calm - A rare moment of stillness",
      "-6": "Light Air - Barely perceptible movement",
      "-4": "Light Breeze - A gentle wind",
      "-2": "Moderate Breeze - The wind begins to stir",
      "0": "Fresh Breeze - A soothing, gentle breeze",
      "2": "Strong Breeze - The wind carries stinging sand",
      "4": "Strong Wind - The wind howls",
      "6": "Gale Force - The wind is dangerous to travel in",
      "8": "Storm Force - This wind is dangerous to travel in",
      "10": "Hurricane Force - The deadly winds of Athas rage",
    };
    this.precipitationDescriptions = {
      "-10":
        "None - The sky is utterly devoid of clouds, as is typical for Athas",
      "-5": "None - A few wisps of cloud, an extremely rare sight on Athas",
      "-1": "None - Some clouds dot the sky, almost unheard of in this world",
      "0": "None - The sky is clear, as expected on Athas",
      "1": "Light - A miraculous light mist fills the air",
      "5": "Medium - A light rain falls from the sky, a rare event on Athas",
      "10":
        "Heavy - A miraculous rainstorm falls from the sky, a once-in-a-lifetime event",
    };
    this.humidityDescriptions = {
      "-10": "Extremely Dry - The air is almost completely devoid of moisture",
      "-5": "Very Dry - The air is extremely dry, as expected on Athas",
      "-1": "Dry - The air is very dry, normal for this world",
      "0": "Normal - Typical Athasian dryness, harsh by any other standard",
      "1": "Slightly Humid - A rare hint of moisture, almost refreshing",
      "5": "A little Humid - The air is feels almost like home",
      "10":
        "Very Humid - The air is very moist, sapping strength and making sweat drip down your face",
    };

    // Time-of-day temperature modifiers (further adjustments can be added)
    this.timeModifiers = {
      "Early Morning": { temperature: -2 },
      Noon: { temperature: +3 },
      Afternoon: { temperature: +4 },
      Night: { temperature: -1 },
      "Late Night": { temperature: -3 },
    };
  }

  /**
   * Register Foundry module settings. This includes terrain selection,
   * hex map toggle, and variability.
   */
  static registerSettings() {
    console.log("Dimensional Weather | Registering settings");

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

    // Toggle hex map mode (if used)
    game.settings.register("dimensional-weather", "useHexMap", {
      name: "Use Hex Map",
      hint: "Enable hex-based weather generation.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
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
  }

  /**
   * Initialize the weather system state from settings.
   * Sets the base weather dimensions from the chosen terrain.
   */
  initWeather() {
    const terrainKey = game.settings.get("dimensional-weather", "terrain");
    const terrain = this.terrains[terrainKey] || this.terrains["scrubPlains"];

    this.temperature = terrain.temperature;
    this.wind = terrain.wind;
    this.precipitation = terrain.precipitation;
    this.humidity = terrain.humidity;
    this.variability = game.settings.get("dimensional-weather", "variability");

    console.log("Dimensional Weather | Initialized with terrain:", terrainKey);
  }

  /**
   * Sets the current terrain and updates weather accordingly
   * @param {string} terrainKey - The key of the terrain to set
   */
  setTerrain(terrainKey) {
    if (!this.terrains[terrainKey]) {
      console.warn(`Dimensional Weather | Invalid terrain key: ${terrainKey}`);
      return;
    }

    console.log(`Dimensional Weather | Setting terrain to: ${terrainKey}`);
    const terrain = this.terrains[terrainKey];

    this.temperature = terrain.temperature;
    this.wind = terrain.wind;
    this.precipitation = terrain.precipitation;
    this.humidity = terrain.humidity;

    this.updateWeather(true);
  }

  /**
   * Updates the weather dimensions using a simple interpolation between the
   * current values and the terrain baseline. Optionally applies time-of-day modifiers.
   */
  updateWeather(forced = false) {
    const terrainKey = game.settings.get("dimensional-weather", "terrain");
    const terrain = this.terrains[terrainKey] || this.terrains["scrubPlains"];

    // Basic interpolation with a random factor based on variability.
    this.temperature = Math.round(
      (this.temperature + terrain.temperature) / 2 +
        ((Math.random() * 2 - 1) * this.variability) / 2
    );
    this.wind = Math.round(
      (this.wind + terrain.wind) / 2 +
        ((Math.random() * 2 - 1) * this.variability) / 2
    );
    this.precipitation = Math.round(
      (this.precipitation + terrain.precipitation) / 2 +
        ((Math.random() * 2 - 1) * this.variability) / 2
    );
    this.humidity = Math.round(
      (this.humidity + terrain.humidity) / 2 +
        ((Math.random() * 2 - 1) * this.variability) / 2
    );

    // Apply time-of-day modifier (if available via Simple Calendar)
    const timePeriod = this.getTimePeriod();
    const modifiers = this.timeModifiers[timePeriod] || {};
    if (typeof modifiers.temperature !== "undefined")
      this.temperature += modifiers.temperature;

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

    if (forced) this.displayWeatherReport();
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
    if (this.temperature >= 2) {
      survivalRules += `<li>Water consumption is doubled</li>
                       <li>Make Constitution saving throw every 4 hours or gain a level of exhaustion. The DC is 5 for the first hour and increases by 1 for each additional hour.</li>
                       <li>Creatures wearing medium or heavy armor, or who are clad in heavy clothing, have disadvantage on the saving throw. Creatures with resistance or immunity to fire damage automatically succeed on the saving throw, as do creatures naturally adapted to hot climates.</li>`;
    }

    // Wind-based rules
    if (this.wind >= 6) {
      survivalRules += `<li>Ranged attacks have disadvantage</li>
                       <li>Open flames are extinguished</li>
                       <li>Fog is dispersed</li>
                       <li>Flying creatures must land at the end of their turn or fall</li>`;
    }

    // Precipitation-based rules
    if (this.precipitation >= 3) {
      survivalRules += `<li>Area is lightly obscured</li>
                       <li>Disadvantage on Wisdom (Perception) checks that rely on sight</li>
                       <li>Open flames are extinguished</li>`;
    }

    // Add terrain-specific rules
    const currentTerrain = game.settings.get("dimensional-weather", "terrain");
    switch (currentTerrain) {
      case "boulderFields":
        survivalRules += `<li>Movement is Difficult terrain (costs 2 feet for every 1 foot of movement)</li>`;
        break;
      case "dustSinks":
        survivalRules += `<li>Movement is Difficult terrain (costs 2 feet for every 1 foot of movement)</li>
                         <li>Creatures can become trapped in deep dust (DC 15 Strength check to escape)</li>`;
        break;
      case "mountains":
      case "ringingMountains":
        survivalRules += `<li>Movement is Difficult terrain (costs 2 feet for every 1 foot of movement)</li>
                         <li>If above 10,000 feet, each hour of travel counts as 2 hours due to high altitude effects</li>
                         <li>Creatures can become acclimated after 30 days at this elevation</li>`;
        break;
      case "saltFlats":
        survivalRules += `<li>During the day, creatures without eye protection have disadvantage on Perception checks</li>`;
        break;
      case "sandyWastes":
        survivalRules += `<li>During the day, creatures without eye protection have disadvantage on Perception checks</li>`;
        break;
      case "mudflats":
      case "rockyBadlands":
        survivalRules += `<li>Movement is Difficult terrain (costs 2 feet for every 1 foot of movement)</li>`;
        break;
      case "stonyBarrens":
      case "scrubPlains":
      case "forestRidge":
      case "seaOfSilt":
        survivalRules += `<li>Movement is Difficult terrain (costs 2 feet for every 1 foot of movement)</li>`;
        break;
    }

    survivalRules += "</ul>";
    return survivalRules;
  }

  /**
   * Returns a narrative description of the current weather conditions.
   */
  async getWeatherDescription() {
    const tempDesc = this.temperatureDescriptions[this.temperature.toString()];
    const windDesc = this.windDescriptions[this.wind.toString()];
    const precipDesc = this.precipitationDescriptions[
      this.precipitation.toString()
    ];
    const humidDesc = this.humidityDescriptions[this.humidity.toString()];
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
          precipDesc
        );
      }
    }

    // Fallback to basic description if LLM is disabled
    return this.getBasicDescription(
      atmosphericDesc,
      tempDesc,
      windDesc,
      precipDesc
    );
  }

  /**
   * Returns a basic weather description without LLM enhancement
   */
  getBasicDescription(atmosphericDesc, tempDesc, windDesc, precipDesc) {
    let humidityDesc = "";

    // Humidity-based descriptions
    if (this.humidity < -8) {
      humidityDesc = this.humidityDescriptions["-10"];
    } else if (this.humidity < -5) {
      humidityDesc = this.humidityDescriptions["-5"];
    } else if (this.humidity < -1) {
      humidityDesc = this.humidityDescriptions["-1"];
    } else {
      humidityDesc = this.humidityDescriptions["0"];
    }

    // Precipitation-based descriptions
    if (this.precipitation > 3) {
      precipDesc = this.precipitationDescriptions["10"];
    } else if (this.precipitation > 0) {
      precipDesc = this.precipitationDescriptions["5"];
    } else if (this.precipitation > -5) {
      precipDesc = this.precipitationDescriptions["-5"];
    } else {
      precipDesc = this.precipitationDescriptions["-10"];
    }

    // Format the weather conditions with bold text
    const weatherDesc = `${atmosphericDesc}
<p><strong>Heat:</strong> ${tempDesc}</p>
<p><strong>Wind:</strong> ${windDesc}</p>
<p><strong>Humidity:</strong> ${humidityDesc}</p>
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
      this.terrains[currentTerrain] || this.terrains["scrubPlains"];

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
Hooks.once("init", () => {
  console.log("Dimensional Weather | Init hook called");
  DimensionalWeather.registerSettings();
});

// Register chat commands
Hooks.on("chatCommandsReady", (commands) => {
  console.log("Dimensional Weather | Registering chat commands");

  // Register the main weather command - available to all players
  commands.register({
    name: "/weather",
    module: "dimensional-weather",
    aliases: ["/w"],
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

        // Only allow GMs to use subcommands
        if (!game.user.isGM) {
          ui.notifications.warn("Only the GM can modify weather conditions.");
          await game.dimWeather.displayWeatherReport();
          return;
        }

        const args = parameters.split(" ");
        const subcommand = args[0]?.toLowerCase();

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

            if (Object.keys(game.dimWeather.terrains).includes(terrain)) {
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
        if (!parameters) {
          return [
            game.chatCommands.createInfoElement(
              "Display current weather conditions."
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
        if (args[0] === "terrain" && args.length === 2) {
          const partial = args[1].toLowerCase();
          const matches = Object.keys(game.dimWeather?.terrains || {})
            .map((key) => key.replace(/([A-Z])/g, " $1").trim())
            .map(
              (terrain) => terrain.charAt(0).toUpperCase() + terrain.slice(1)
            )
            .filter((terrain) => terrain.toLowerCase().startsWith(partial));

          return matches.map((terrain) =>
            game.chatCommands.createCommandElement(
              `${alias} terrain ${terrain}`,
              `Set terrain to ${terrain}`
            )
          );
        }

        // Show available subcommands for GMs
        const subcommands = [
          { cmd: "terrain", desc: "Set the current terrain type" },
          { cmd: "update", desc: "Force weather update" },
          { cmd: "random", desc: "Set weather variability (0-10)" },
          { cmd: "stats", desc: "Display weather statistics" },
          { cmd: "forecast", desc: "Show weather forecast" },
          { cmd: "help", desc: "Show weather command help" },
        ];

        return subcommands
          .filter((cmd) => cmd.cmd.startsWith(args[0] || ""))
          .map((cmd) =>
            game.chatCommands.createCommandElement(
              `${alias} ${cmd.cmd}`,
              cmd.desc
            )
          );
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
    aliases: ["/d"],
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
  ChatMessage.create({
    content: `<div class="weather-report">
                <h3>Weather Commands Help</h3>
                <ul>
                  <li><code>/weather</code> - Display current weather</li>
                  <li><code>/weather terrain [Terrain]</code> - Set the current terrain type</li>
                  <li><code>/weather update</code> - Force weather update</li>
                  <li><code>/weather stats</code> - Display weather statistics (GM only)</li>
                  <li><code>/weather forecast</code> - Show weather forecast (GM only)</li>
                  <li><code>/weather random [0-10]</code> - Set weather variability (GM only)</li>
                  <li><code>/date</code> - Show calendar information</li>
                </ul>
                <h4>Available Terrains:</h4>
                <ul>
                  <li>Boulder Fields</li>
                  <li>Dust Sinks</li>
                  <li>Mountains</li>
                  <li>Mudflats</li>
                  <li>Rocky Badlands</li>
                  <li>Salt Flats</li>
                  <li>Salt Marshes</li>
                  <li>Sandy Wastes</li>
                  <li>Scrub Plains</li>
                  <li>Stony Barrens</li>
                  <li>Verdant Belt</li>
                  <li>Sea of Silt</li>
                  <li>Ringing Mountains</li>
                  <li>Forest Ridge</li>
                </ul>
              </div>`,
    speaker: { alias: "Dimensional Weather" },
  });
}

// Create and initialize the weather system
Hooks.once("ready", () => {
  console.log("Dimensional Weather | Ready hook called");
  game.dimWeather = new DimensionalWeather();
  game.dimWeather.initWeather();
  game.dimWeather.updateWeather();
  console.log("Dimensional Weather | Module initialized");
});
