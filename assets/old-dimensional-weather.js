/**
 * Dimensional Weather System for FoundryVTT v12.331
 * Based on: https://whatwouldconando.blogspot.com/2017/04/dimensional-weather.html
 */

class DimensionalWeather {
  constructor(options = {}) {
    // Initialize weather dimensions with default or provided values
    this.temperature = options.temperature || 0; // -10 to 10 scale
    this.wind = options.wind || 0; // -10 to 10 scale
    this.precipitation = options.precipitation || 0; // -10 to 10 scale
    this.humidity = options.humidity || 0; // -10 to 10 scale
    this.variability = options.variability || 5; // 0 to 10 scale

    // For hex map weather system
    this.useHexMap = options.useHexMap || false;
    this.currentHexPosition = options.currentHexPosition || { q: 0, r: 0 }; // Axial coordinates, center of the map
    this.currentWeatherType = "normal"; // Default weather type

    // Athas hex map weather types and their effects
    this.athasHexWeather = {
      hot: {
        name: "Hot",
        color: "#f9e076", // yellow
        description: "The scorching sun beats down relentlessly.",
        effects: "Double water consumption during the day.",
        gameEffects: {
          waterConsumption: 2,
          temperature: 7,
        },
      },
      windy: {
        name: "Windy",
        color: "#b3b3b3", // gray
        description: "Strong winds whip across the barren landscape.",
        effects: "Penalty to ranged attacks.",
        gameEffects: {
          rangedAttacks: -5,
          wind: 7,
        },
      },
      sandstorm: {
        name: "Sandstorm",
        color: "#e67e22", // orange
        description: "A wall of sand obscures vision and scours exposed skin.",
        effects: "Cannot see past 5 feet.",
        gameEffects: {
          visibility: "heavily obscured",
          perceptionChecks: -10,
          wind: 9,
          humidity: -8,
        },
      },
      deadlyHot: {
        name: "Deadly Hot",
        color: "#e74c3c", // red
        description:
          "The heat is unbearable, threatening to cook anyone exposed to it.",
        effects: "Quintuple water consumption during the day.",
        gameEffects: {
          waterConsumption: 5,
          exhaustion: true,
          temperature: 10,
        },
      },
      overcast: {
        name: "Overcast",
        color: "#2a9d8f", // teal/green
        description: "Rare clouds provide some relief from the sun.",
        effects: "Bonus to hiding in shadows.",
        gameEffects: {
          stealthBonus: 2,
          temperature: 5,
        },
      },
      dryThunder: {
        name: "Dry Thunder",
        color: "#f9e076", // yellow (same as hot)
        description: "Lightning crackles across the sky, but no rain falls.",
        effects: "On critical miss, lightning strikes within 20 feet.",
        gameEffects: {
          specialEffect: "lightning",
          temperature: 6,
        },
      },
      cool: {
        name: "Cool",
        color: "#a8dadc", // light blue
        description: "A rare respite from the heat of Athas.",
        effects: "No changes.",
        gameEffects: {
          temperature: 3,
        },
      },
      normal: {
        name: "Normal",
        color: "#f9e076", // yellow (center of map)
        description: "Typical Athasian day.",
        effects: "Standard conditions for Athas.",
        gameEffects: {
          temperature: 6,
        },
      },
    };

    // Athas hex map layout (axial coordinates)
    // This represents the layout shown in the image
    // 0,0 is the center of the map
    this.athasHexMap = {
      // Center row
      "0,0": "normal",
      "1,0": "hot",
      "2,0": "hot",
      "3,0": "deadlyHot",
      "-1,0": "overcast",
      "-2,0": "overcast",
      "-3,0": "sandstorm",

      // Row above center
      "0,-1": "windy",
      "1,-1": "hot",
      "2,-1": "deadlyHot",
      "3,-1": "deadlyHot",
      "-1,-1": "overcast",
      "-2,-1": "overcast",
      "-3,-1": "sandstorm",

      // Row below center
      "0,1": "cool",
      "1,1": "hot",
      "2,1": "dryThunder",
      "3,1": "deadlyHot",
      "-1,1": "windy",
      "-2,1": "sandstorm",
      "-3,1": "sandstorm",

      // Two rows above center
      "0,-2": "windy",
      "1,-2": "windy",
      "2,-2": "hot",
      "-1,-2": "overcast",
      "-2,-2": "overcast",

      // Two rows below center
      "0,2": "dryThunder",
      "1,2": "dryThunder",
      "2,2": "dryThunder",
      "-1,2": "windy",
      "-2,2": "sandstorm",

      // Three rows above center
      "0,-3": "overcast",
      "1,-3": "windy",
      "-1,-3": "overcast",

      // Three rows below center
      "0,3": "dryThunder",
      "1,3": "deadlyHot",
      "-1,3": "windy",
    };

    // Climate presets
    this.climates = {
      // Standard climates
      temperate: {
        temperature: 0,
        wind: 0,
        precipitation: 0,
        humidity: 0,
        variability: 5,
      },
      desert: {
        temperature: 7,
        wind: 3,
        precipitation: -8,
        humidity: -7,
        variability: 8,
      },
      tundra: {
        temperature: -8,
        wind: 5,
        precipitation: -5,
        humidity: -2,
        variability: 3,
      },
      tropical: {
        temperature: 8,
        wind: 2,
        precipitation: 8,
        humidity: 8,
        variability: 2,
      },
      coastal: {
        temperature: 2,
        wind: 6,
        precipitation: 3,
        humidity: 6,
        variability: 7,
      },
      mountain: {
        temperature: -5,
        wind: 8,
        precipitation: 4,
        humidity: 0,
        variability: 9,
      },
      swamp: {
        temperature: 4,
        wind: -3,
        precipitation: 7,
        humidity: 9,
        variability: 2,
      },

      // Dark Sun specific climates (based on hex map)
      // All temperatures adjusted for Athas's extreme heat - minimum 9-10 for most terrains
      rockyBadlands: {
        temperature: 9,
        wind: 6,
        precipitation: -9,
        humidity: -8,
        variability: 6,
      },
      saltFlats: {
        temperature: 10,
        wind: 4,
        precipitation: -10,
        humidity: -9,
        variability: 3,
      },
      stonyBarrens: {
        temperature: 9,
        wind: 5,
        precipitation: -8,
        humidity: -7,
        variability: 5,
      },
      scrubPlains: {
        temperature: 8,
        wind: 3,
        precipitation: -7,
        humidity: -6,
        variability: 4,
      },
      verdantBelt: {
        temperature: 7,
        wind: 2,
        precipitation: -4,
        humidity: -3,
        variability: 6,
      }, // Slightly cooler due to vegetation
      ruggedSavanna: {
        temperature: 8,
        wind: 4,
        precipitation: -6,
        humidity: -5,
        variability: 7,
      },
      sandyWastes: {
        temperature: 10,
        wind: 8,
        precipitation: -10,
        humidity: -10,
        variability: 10,
      }, // Hottest regions
      windyDunes: {
        temperature: 10,
        wind: 10,
        precipitation: -9,
        humidity: -8,
        variability: 8,
      },
      seaOfSilt: {
        temperature: 10,
        wind: 7,
        precipitation: -9,
        humidity: -4,
        variability: 9,
      },
      obsidianPlains: {
        temperature: 10,
        wind: 4,
        precipitation: -10,
        humidity: -10,
        variability: 4,
      }, // Obsidian absorbs heat
      ashStorm: {
        temperature: 10,
        wind: 9,
        precipitation: -8,
        humidity: -7,
        variability: 10,
      },
      crackledPlains: {
        temperature: 9,
        wind: 5,
        precipitation: -7,
        humidity: -9,
        variability: 6,
      },
      glassPlateau: {
        temperature: 10,
        wind: 4,
        precipitation: -10,
        humidity: -9,
        variability: 3,
      },
    };

    // Weather condition descriptions
    this.temperatureDescriptions = {
      "-10": "Frigid, deathly cold",
      "-9": "Bitterly cold",
      "-8": "Extremely cold",
      "-7": "Freezing",
      "-6": "Very cold",
      "-5": "Quite cold",
      "-4": "Cold",
      "-3": "Chilly",
      "-2": "Cool",
      "-1": "Mild",
      "0": "Comfortable",
      "1": "Pleasant",
      "2": "Warm",
      "3": "Quite warm",
      "4": "Very warm",
      "5": "Hot",
      "6": "Very hot",
      "7": "Sweltering",
      "8": "Extremely hot (100°F)",
      "9": "Scorching (115°F)",
      "10": "Unbearably hot (130°F+)",
    };

    // Dark Sun specific temperature descriptions (used when in Dark Sun climate)
    this.darkSunTemperatureDescriptions = {
      "-10": "Freezing by Athasian standards",
      "-9": "Bitterly cold for Athas",
      "-8": "Extremely cold for Athas",
      "-7": "Abnormally cold",
      "-6": "Very cold night",
      "-5": "Cold night",
      "-4": "Chilly night",
      "-3": "Cool night",
      "-2": "Mild night",
      "-1": "Pleasant night",
      "0": "Comfortable night",
      "1": "Warm night",
      "2": "Normal night",
      "3": "Cool morning",
      "4": "Mild morning",
      "5": "Warm morning",
      "6": "Hot morning (90°F)",
      "7": "Midday heat (95°F)",
      "8": "Hot afternoon (105°F)",
      "9": "Scorching afternoon (120°F)",
      "10": "Deadly heat (135°F+)",
    };

    this.windDescriptions = {
      "-10": "Dead still, suffocating",
      "-9": "Almost no air movement",
      "-8": "Very still",
      "-7": "Still",
      "-6": "Barely any breeze",
      "-5": "Light occasional breeze",
      "-4": "Slight breeze",
      "-3": "Gentle breeze",
      "-2": "Mild breeze",
      "-1": "Moderate breeze",
      "0": "Normal wind",
      "1": "Steady breeze",
      "2": "Moderate wind",
      "3": "Blowing wind",
      "4": "Strong breeze",
      "5": "Strong wind",
      "6": "Very strong wind",
      "7": "High wind",
      "8": "Gale force winds",
      "9": "Storm winds",
      "10": "Hurricane force winds",
    };

    this.precipitationDescriptions = {
      "-10": "Clear skies, not a cloud",
      "-9": "Crystal clear",
      "-8": "Very clear",
      "-7": "Clear",
      "-6": "Mostly clear",
      "-5": "Partly cloudy",
      "-4": "Scattered clouds",
      "-3": "Cloudy patches",
      "-2": "Partly overcast",
      "-1": "Mostly cloudy",
      "0": "Overcast",
      "1": "Light mist",
      "2": "Mist or fog",
      "3": "Light drizzle",
      "4": "Steady drizzle",
      "5": "Light rain/snow",
      "6": "Steady rain/snow",
      "7": "Heavy rain/snow",
      "8": "Downpour/blizzard",
      "9": "Torrential rain/severe blizzard",
      "10": "Deluge/whiteout conditions",
    };

    this.humidityDescriptions = {
      "-10": "Bone dry, parched",
      "-9": "Extremely dry",
      "-8": "Very dry",
      "-7": "Quite dry",
      "-6": "Dry",
      "-5": "Somewhat dry",
      "-4": "Slightly dry",
      "-3": "A bit dry",
      "-2": "Normal dryness",
      "-1": "Slightly moist",
      "0": "Comfortable humidity",
      "1": "Slightly humid",
      "2": "A bit humid",
      "3": "Moderately humid",
      "4": "Humid",
      "5": "Quite humid",
      "6": "Very humid",
      "7": "High humidity",
      "8": "Very high humidity",
      "9": "Extremely humid",
      "10": "Oppressively humid",
    };

    // Seasons influence
    this.seasons = {
      spring: {
        temperature: 2,
        wind: 3,
        precipitation: 4,
        humidity: 3,
        variability: 7,
      },
      summer: {
        temperature: 7,
        wind: 0,
        precipitation: 1,
        humidity: 5,
        variability: 3,
      },
      fall: {
        temperature: 0,
        wind: 4,
        precipitation: 3,
        humidity: 2,
        variability: 5,
      },
      winter: {
        temperature: -7,
        wind: 2,
        precipitation: 2,
        humidity: -2,
        variability: 4,
      },

      // Dark Sun specific seasons - adjusted for extreme heat
      highSun: {
        temperature: 10,
        wind: 4,
        precipitation: -10,
        humidity: -8,
        variability: 9,
      }, // Brutally hot season
      sunDescending: {
        temperature: 8,
        wind: 5,
        precipitation: -7,
        humidity: -7,
        variability: 7,
      }, // Transitional period (cooling)
      sunAscending: {
        temperature: 9,
        wind: 6,
        precipitation: -8,
        humidity: -6,
        variability: 8,
      }, // Transitional period (warming)
    };
  }

  static initialize() {
    // Create instance and store on game object first
    game.dimWeather = new DimensionalWeather();

    // Register settings in FoundryVTT
    this._registerSettings();

    // Register event hooks for time tracking and chat commands
    this._registerHooks();

    // Initialize weather based on stored settings
    this._initializeWeather();

    // Check for Simple Calendar integration
    this._initializeSimpleCalendarIntegration();

    console.log("Dimensional Weather | Initialized");
  }

  static _registerSettings() {
    // Add setting for world type (Dark Sun or Traditional)
    game.settings.register("dimensional-weather", "worldType", {
      name: "World Type",
      hint:
        "Choose between Dark Sun (Athas) or Traditional fantasy setting. This affects available climates and seasons.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        darkSun: "Dark Sun (Athas)",
        traditional: "Traditional Fantasy",
      },
      default: "darkSun",
      onChange: (value) => {
        // Update climate and season settings to match the world type
        game.dimWeather.updateWorldTypeSettings(value);
      },
    });

    // Define climate choices based on world type
    const getDarkSunClimates = () => {
      return {
        // Dark Sun specific climates
        rockyBadlands: "Rocky Badlands",
        saltFlats: "Salt Flats",
        stonyBarrens: "Stony Barrens",
        scrubPlains: "Scrub Plains",
        verdantBelt: "Verdant Belt",
        ruggedSavanna: "Rugged Savanna",
        sandyWastes: "Sandy Wastes",
        windyDunes: "Windy Dunes",
        seaOfSilt: "Sea of Silt",
        obsidianPlains: "Obsidian Plains",
        ashStorm: "Ash Storm",
        crackledPlains: "Crackled Plains",
        glassPlateau: "Glass Plateau",
      };
    };

    const getTraditionalClimates = () => {
      return {
        // Traditional climates
        temperate: "Temperate",
        desert: "Desert",
        tundra: "Tundra",
        tropical: "Tropical",
        coastal: "Coastal",
        mountain: "Mountain",
        swamp: "Swamp",
      };
    };

    // Get climate choices based on current world type
    const getClimateChoices = () => {
      try {
        const worldType = game.settings.get("dimensional-weather", "worldType");
        return worldType === "darkSun"
          ? getDarkSunClimates()
          : getTraditionalClimates();
      } catch (error) {
        console.error("Error getting climate choices:", error);
        return getDarkSunClimates(); // Default to Dark Sun climates
      }
    };

    game.settings.register("dimensional-weather", "climate", {
      name: "Climate Type",
      hint: "The predominant climate of the region",
      scope: "world",
      config: true,
      type: String,
      choices: getClimateChoices(),
      default: "scrubPlains", // Default to a common Dark Sun terrain
      onChange: (value) => game.dimWeather.setClimate(value),
    });

    // Add setting for Simple Calendar integration
    game.settings.register("dimensional-weather", "useSimpleCalendar", {
      name: "Use Simple Calendar Integration",
      hint:
        "Automatically set the season based on the current date in Simple Calendar. Requires the Simple Calendar module.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      onChange: (value) => {
        if (value && game.modules.get("simple-calendar")?.active) {
          game.dimWeather.updateSeasonFromSimpleCalendar();
        }
      },
    });

    // Add setting for Calendar of Tyr configuration
    game.settings.register("dimensional-weather", "calendarOfTyrConfig", {
      name: "Calendar of Tyr Configuration",
      hint:
        "Configuration for mapping Simple Calendar months to Dark Sun seasons",
      scope: "world",
      config: false,
      type: Object,
      default: {
        // Default mapping for Calendar of Tyr
        // Month index to season mapping (0-indexed)
        0: "highSun", // Dominary (High Sun)
        1: "highSun", // Sedulous (High Sun)
        2: "sunDescending", // Fortuary (Sun Descending)
        3: "sunDescending", // Macro (Sun Descending)
        4: "sunDescending", // Dessalia (Sun Descending)
        5: "sunDescending", // Fifthover (Sun Descending)
        6: "sunDescending", // Hexameron (Sun Descending)
        7: "sunAscending", // Morrow (Sun Ascending)
        8: "sunAscending", // Octavus (Sun Ascending)
        9: "sunAscending", // Assalia (Sun Ascending)
        10: "sunAscending", // Thaumast (Sun Ascending)
        11: "sunAscending", // Anabasis (Sun Ascending)
      },
    });

    // Define season choices based on world type
    const getDarkSunSeasons = () => {
      return {
        // Dark Sun specific seasons
        highSun: "High Sun",
        sunDescending: "Sun Descending",
        sunAscending: "Sun Ascending",
      };
    };

    const getTraditionalSeasons = () => {
      return {
        // Traditional seasons
        spring: "Spring",
        summer: "Summer",
        fall: "Fall/Autumn",
        winter: "Winter",
      };
    };

    // Get season choices based on current world type
    const getSeasonChoices = () => {
      try {
        const worldType = game.settings.get("dimensional-weather", "worldType");
        return worldType === "darkSun"
          ? getDarkSunSeasons()
          : getTraditionalSeasons();
      } catch (error) {
        console.error("Error getting season choices:", error);
        return getDarkSunSeasons(); // Default to Dark Sun seasons
      }
    };

    // Get default season based on world type
    const getDefaultSeason = () => {
      try {
        const worldType = game.settings.get("dimensional-weather", "worldType");
        return worldType === "darkSun" ? "highSun" : "summer";
      } catch (error) {
        console.error("Error getting default season:", error);
        return "highSun"; // Default to Dark Sun season
      }
    };

    game.settings.register("dimensional-weather", "season", {
      name: "Current Season",
      hint: "The current season affects weather patterns",
      scope: "world",
      config: true,
      type: String,
      choices: getSeasonChoices(),
      default: getDefaultSeason(),
      onChange: (value) => game.dimWeather.setSeason(value),
    });

    // Add setting for using hex map weather system
    game.settings.register("dimensional-weather", "useHexMap", {
      name: "Use Hex Map Weather (Athas)",
      hint:
        "Use the hex map weather system instead of the dimensional system. This is designed for Dark Sun's Athas setting.",
      scope: "world",
      config: true, // Always show, but we'll handle visibility in the UI
      type: Boolean,
      default: false,
      onChange: (value) => {
        game.dimWeather.useHexMap = value;
        // If turning on hex map, initialize the hex position
        if (value) {
          game.dimWeather.currentHexPosition = { q: 0, r: 0 };
          game.dimWeather.currentWeatherType = "normal";
          game.dimWeather.updateHexMapWeather(true);
        } else {
          // If turning off, update using dimensional system
          game.dimWeather.updateWeather(true);
        }
      },
    });

    // Store the current hex position
    game.settings.register("dimensional-weather", "currentHexPosition", {
      scope: "world",
      config: false,
      type: Object,
      default: { q: 0, r: 0 },
    });

    // Store the current weather type from hex map
    game.settings.register("dimensional-weather", "currentWeatherType", {
      scope: "world",
      config: false,
      type: String,
      default: "normal",
    });

    game.settings.register("dimensional-weather", "updateInterval", {
      name: "Weather Update Interval",
      hint: "How many in-game hours between weather changes",
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

    // Store the weather dimensions
    for (let dimension of [
      "temperature",
      "wind",
      "precipitation",
      "humidity",
      "variability",
    ]) {
      game.settings.register("dimensional-weather", dimension, {
        name: dimension.charAt(0).toUpperCase() + dimension.slice(1),
        scope: "world",
        config: false,
        type: Number,
        default: dimension === "variability" ? 5 : 0,
      });
    }

    // Store the last update time
    game.settings.register("dimensional-weather", "lastUpdateTime", {
      scope: "world",
      config: false,
      type: Number,
      default: 0,
    });

    // Register the module's main toggle
    game.settings.register("dimensional-weather", "enabled", {
      name: "Enable Dimensional Weather",
      hint: "Enables the dynamic weather system",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
    });

    // Register time of day setting
    game.settings.register("dimensional-weather", "timeOfDay", {
      name: "Time of Day",
      hint: "The current time of day affects temperature in Dark Sun settings.",
      scope: "world",
      config: true,
      type: String,
      choices: {
        earlyMorning: "Early Morning",
        midMorning: "Mid Morning",
        noon: "Noon",
        afternoon: "Afternoon",
        evening: "Evening",
        night: "Night",
        lateNight: "Late Night",
      },
      default: "noon",
      onChange: (value) => {
        game.dimWeather.updateWeatherForTimeOfDay(value);
      },
    });
  }

  static _registerHooks() {
    // Set up time-based weather updates
    Hooks.on("updateWorldTime", (worldTime) => {
      if (!game.settings.get("dimensional-weather", "enabled")) return;

      const updateInterval = game.settings.get(
        "dimensional-weather",
        "updateInterval"
      );
      const lastUpdateTime = game.settings.get(
        "dimensional-weather",
        "lastUpdateTime"
      );

      // Convert to hours
      const currentHours = worldTime / 3600;
      const lastUpdateHours = lastUpdateTime / 3600;

      // Check if enough time has passed for an update
      if (currentHours - lastUpdateHours >= updateInterval) {
        // Use the appropriate update method based on settings
        if (game.settings.get("dimensional-weather", "useHexMap")) {
          game.dimWeather.updateHexMapWeather();
        } else {
          game.dimWeather.updateWeather();
        }
        game.settings.set("dimensional-weather", "lastUpdateTime", worldTime);
      }
    });

    // Listen for Simple Calendar date changes if integration is enabled
    if (game.settings.get("dimensional-weather", "useSimpleCalendar")) {
      Hooks.on("simple-calendar-date-time-change", (data) => {
        // Update season based on new date
        game.dimWeather.updateSeasonFromSimpleCalendar();
      });
    }

    // Register chat commands
    Hooks.on("chatMessage", (chatLog, content, chatData) => {
      // Check if the message starts with /weather
      if (content.startsWith("/weather")) {
        const args = content.split(" ").slice(1);

        // Handle /weather with no arguments
        if (args.length === 0) {
          game.dimWeather.displayWeatherReport();
          return false;
        }

        // Handle /weather update
        if (args[0] === "update") {
          game.dimWeather.updateWeather(true);
          return false;
        }

        // Handle /weather hex [1-6]
        if (args[0] === "hex" && args.length > 1) {
          const direction = parseInt(args[1]);
          if (direction >= 1 && direction <= 6) {
            game.dimWeather.moveHexMapWeather(direction, true);
            return false;
          }
        }

        // Handle /weather set [dimension] [value]
        if (args[0] === "set" && args.length > 2) {
          const dimension = args[1];
          const value = parseInt(args[2]);

          if (isNaN(value) || value < -10 || value > 10) {
            ChatMessage.create({
              content:
                "<p>Invalid value. Please provide a number between -10 and 10.</p>",
              speaker: ChatMessage.getSpeaker(),
            });
            return false;
          }

          if (dimension === "temperature") {
            game.dimWeather.temperature = value;
            game.settings.set("dimensional-weather", "temperature", value);
          } else if (dimension === "wind") {
            game.dimWeather.wind = value;
            game.settings.set("dimensional-weather", "wind", value);
          } else if (dimension === "precipitation") {
            game.dimWeather.precipitation = value;
            game.settings.set("dimensional-weather", "precipitation", value);
          } else if (dimension === "humidity") {
            game.dimWeather.humidity = value;
            game.settings.set("dimensional-weather", "humidity", value);
          } else if (dimension === "variability") {
            game.dimWeather.variability = value;
            game.settings.set("dimensional-weather", "variability", value);
          } else {
            ChatMessage.create({
              content:
                "<p>Invalid dimension. Available dimensions: temperature, wind, precipitation, humidity, variability</p>",
              speaker: ChatMessage.getSpeaker(),
            });
            return false;
          }

          game.dimWeather.displayWeatherReport();
          return false;
        }

        // Handle /weather climate [climate-type]
        if (args[0] === "climate" && args.length > 1) {
          const climate = args[1];
          const worldType = game.settings.get(
            "dimensional-weather",
            "worldType"
          );

          let validClimates;
          if (worldType === "darkSun") {
            validClimates = Object.keys(game.dimWeather.climates).filter((c) =>
              game.dimWeather.isDarkSunClimate(c)
            );
          } else {
            validClimates = Object.keys(game.dimWeather.climates).filter(
              (c) => !game.dimWeather.isDarkSunClimate(c)
            );
          }

          if (!validClimates.includes(climate)) {
            ChatMessage.create({
              content: `<p>Invalid climate. Available climates: ${validClimates.join(
                ", "
              )}</p>`,
              speaker: ChatMessage.getSpeaker(),
            });
            return false;
          }

          game.settings.set("dimensional-weather", "climate", climate);
          game.dimWeather.updateWeather(true);
          return false;
        }

        // Handle /weather season [season-type]
        if (args[0] === "season" && args.length > 1) {
          const season = args[1];
          const worldType = game.settings.get(
            "dimensional-weather",
            "worldType"
          );

          let validSeasons;
          if (worldType === "darkSun") {
            validSeasons = ["highSun", "sunDescending", "sunAscending"];
          } else {
            validSeasons = ["spring", "summer", "fall", "winter"];
          }

          if (!validSeasons.includes(season)) {
            ChatMessage.create({
              content: `<p>Invalid season. Available seasons: ${validSeasons.join(
                ", "
              )}</p>`,
              speaker: ChatMessage.getSpeaker(),
            });
            return false;
          }

          game.settings.set("dimensional-weather", "season", season);
          game.dimWeather.updateWeather(true);
          return false;
        }

        // Handle /weather time [time-of-day]
        if (args[0] === "time" && args.length > 1) {
          const timeOfDay = args[1];
          const validTimes = {
            earlyMorning: "Early Morning",
            midMorning: "Mid Morning",
            noon: "Noon",
            afternoon: "Afternoon",
            evening: "Evening",
            night: "Night",
            lateNight: "Late Night",
          };

          if (!Object.keys(validTimes).includes(timeOfDay)) {
            const validTimesList = Object.keys(validTimes)
              .map((t) => `${t} (${validTimes[t]})`)
              .join(", ");
            ChatMessage.create({
              content: `<p>Invalid time of day. Available times: ${validTimesList}</p>`,
              speaker: ChatMessage.getSpeaker(),
            });
            return false;
          }

          game.settings.set("dimensional-weather", "timeOfDay", timeOfDay);
          game.dimWeather.updateWeatherForTimeOfDay(timeOfDay);

          ChatMessage.create({
            content: `<p>Time of day set to ${validTimes[timeOfDay]}.</p>`,
            speaker: ChatMessage.getSpeaker(),
          });

          return false;
        }

        // If we get here, the command was not recognized
        ChatMessage.create({
          content: `<p>Available commands:</p>
                   <p>/weather - Display current weather</p>
                   <p>/weather update - Force weather update</p>
                   <p>/weather hex [1-6] - Move hex map weather</p>
                   <p>/weather set [dimension] [value] - Set weather dimension</p>
                   <p>/weather climate [climate-type] - Set climate</p>
                   <p>/weather season [season-type] - Set season</p>
                   <p>/weather time [time-of-day] - Set time of day</p>`,
          speaker: ChatMessage.getSpeaker(),
        });

        return false;
      }

      return true;
    });

    // Add weather controls to the UI
    Hooks.on("getSceneControlButtons", (controls) => {
      if (!game.settings.get("dimensional-weather", "enabled")) return;

      const useHexMap = game.settings.get("dimensional-weather", "useHexMap");

      const weatherTools = [
        {
          name: "check",
          title: "Check Weather",
          icon: "fa-solid fa-eye",
          onClick: () => game.dimWeather.displayWeatherReport(),
          button: true,
        },
        {
          name: "update",
          title: "Update Weather",
          icon: "fa-solid fa-arrows-rotate",
          onClick: () => {
            if (useHexMap) {
              game.dimWeather.updateHexMapWeather(true);
            } else {
              game.dimWeather.updateWeather(true);
            }
          },
          button: true,
        },
      ];

      // Add hex map specific controls if hex map is enabled
      if (useHexMap) {
        for (let i = 1; i <= 6; i++) {
          weatherTools.push({
            name: `hex-${i}`,
            title: `Move Direction ${i}`,
            icon: `fa-solid fa-${i}`,
            onClick: () => game.dimWeather.moveHexMapWeather(i, true),
            button: true,
          });
        }

        // Add hex map visualization
        weatherTools.push({
          name: "hexmap",
          title: "Show Hex Map",
          icon: "fa-solid fa-map",
          onClick: () => game.dimWeather.showHexMapDialog(),
          button: true,
        });
      }

      controls.push({
        name: "weather",
        title: "Weather Controls",
        icon: "fa-solid fa-cloud-sun",
        layer: "controls",
        visible: game.user.isGM,
        tools: weatherTools,
        activeTool: "check",
      });
    });
  }

  static _initializeWeather() {
    // Load saved weather dimensions from settings
    for (let dimension of [
      "temperature",
      "wind",
      "precipitation",
      "humidity",
      "variability",
    ]) {
      game.dimWeather[dimension] = game.settings.get(
        "dimensional-weather",
        dimension
      );
    }

    // Initialize hex map weather if enabled
    if (game.settings.get("dimensional-weather", "useHexMap")) {
      game.dimWeather.useHexMap = true;
      game.dimWeather.updateHexMapWeather();
    }

    // Initialize time of day if not already set
    if (!game.settings.get("dimensional-weather", "timeOfDay")) {
      // Default to noon
      game.settings.set("dimensional-weather", "timeOfDay", "noon");
    }

    // Initialize Simple Calendar integration if enabled
    if (game.settings.get("dimensional-weather", "useSimpleCalendar")) {
      this._initializeSimpleCalendarIntegration();
    }

    console.log("Dimensional Weather | Weather system initialized");
  }

  setClimate(climateType) {
    const climate = this.climates[climateType];
    if (!climate) return;

    // Apply climate base values but keep current variability
    this.temperature = climate.temperature;
    this.wind = climate.wind;
    this.precipitation = climate.precipitation;
    this.humidity = climate.humidity;
    this.variability = climate.variability;

    // Update settings
    for (let dim of [
      "temperature",
      "wind",
      "precipitation",
      "humidity",
      "variability",
    ]) {
      game.settings.set("dimensional-weather", dim, this[dim]);
    }

    // Generate new weather based on this climate
    this.updateWeather();
  }

  setSeason(seasonType) {
    // Store the season setting
    game.settings.set("dimensional-weather", "season", seasonType);

    // Update weather to reflect season influence
    this.updateWeather();
  }

  updateWeather(forced = false) {
    // Load current values from settings
    for (let dimension of [
      "temperature",
      "wind",
      "precipitation",
      "humidity",
      "variability",
    ]) {
      this[dimension] = game.settings.get("dimensional-weather", dimension);
    }

    // Get climate and season influences
    const climate = this.climates[
      game.settings.get("dimensional-weather", "climate")
    ];
    const season = this.seasons[
      game.settings.get("dimensional-weather", "season")
    ];

    // Calculate variability based on climate, season, and current conditions
    const effectiveVariability = Math.floor(
      (this.variability + climate.variability + season.variability) / 3
    );

    // Update each dimension
    for (let dimension of [
      "temperature",
      "wind",
      "precipitation",
      "humidity",
    ]) {
      // Calculate the baseline tendency from climate and season
      const climatePull = (climate[dimension] - this[dimension]) / 5;
      const seasonPull = (season[dimension] - this[dimension]) / 8;

      // Calculate random change based on variability
      const randomChange = (Math.random() * 2 - 1) * (effectiveVariability / 5);

      // Apply changes
      let newValue = this[dimension] + climatePull + seasonPull + randomChange;

      // Ensure value stays within bounds
      newValue = Math.max(-10, Math.min(10, newValue));

      // Round to nearest integer
      this[dimension] = Math.round(newValue);

      // Save to settings
      game.settings.set("dimensional-weather", dimension, this[dimension]);
    }

    // Special rules for precipitation
    // If humidity is very low, precipitation will tend to drop
    if (this.humidity < -5 && this.precipitation > 0) {
      this.precipitation = Math.max(
        -10,
        this.precipitation - 1 - Math.floor(Math.random() * 2)
      );
      game.settings.set(
        "dimensional-weather",
        "precipitation",
        this.precipitation
      );
    }

    // If temperature is extremely cold, precipitation is more likely to be snow
    const isSnow = this.temperature < -3 && this.precipitation > 3;

    // Apply time of day effects for Dark Sun settings
    if (game.settings.get("dimensional-weather", "worldType") === "darkSun") {
      const timeOfDay = game.settings.get("dimensional-weather", "timeOfDay");
      this.updateWeatherForTimeOfDay(timeOfDay);
    }

    // Display weather to chat if forced or on regular update
    if (forced) {
      this.displayWeatherReport();
    } else {
      // Notify only on significant changes
      const significantChange = this.precipitation >= 5 || this.wind >= 6;
      if (significantChange) {
        this.displayWeatherReport();
      }
    }

    // Emit hook for other modules to react to weather changes
    Hooks.callAll("weatherChanged", {
      temperature: this.temperature,
      wind: this.wind,
      precipitation: this.precipitation,
      humidity: this.humidity,
      variability: this.variability,
    });

    // Return the current weather state
    return {
      temperature: this.temperature,
      wind: this.wind,
      precipitation: this.precipitation,
      humidity: this.humidity,
      variability: this.variability,
    };
  }

  // Helper method to check if a climate is from Dark Sun
  isDarkSunClimate(climate) {
    return (
      climate.includes("rocky") ||
      climate.includes("salt") ||
      climate.includes("stony") ||
      climate.includes("scrub") ||
      climate.includes("verdant") ||
      climate.includes("rugged") ||
      climate.includes("sandy") ||
      climate.includes("windy") ||
      climate.includes("silt") ||
      climate.includes("obsidian") ||
      climate.includes("ash") ||
      climate.includes("crackled") ||
      climate.includes("glass")
    );
  }

  getWeatherDescription() {
    // Get the current climate type
    const currentClimate = game.settings.get("dimensional-weather", "climate");
    const isDarkSun = this.isDarkSunClimate(currentClimate);

    // Format dimensional values to strings, using Dark Sun descriptions if appropriate
    const tempDesc = isDarkSun
      ? this.darkSunTemperatureDescriptions[this.temperature.toString()]
      : this.temperatureDescriptions[this.temperature.toString()];
    const windDesc = this.windDescriptions[this.wind.toString()];
    const precipDesc = this.precipitationDescriptions[
      this.precipitation.toString()
    ];
    const humidDesc = this.humidityDescriptions[this.humidity.toString()];

    // Determine precipitation type based on temperature and setting
    let precipType = "rain";
    if (isDarkSun) {
      precipType = "rain"; // Dark Sun rarely has snow, even when cold
    } else {
      if (this.temperature < -3) precipType = "snow";
      else if (this.temperature < 0) precipType = "sleet";
    }

    // Replace generic "rain/snow" with appropriate type in precipitation description
    const formattedPrecipDesc =
      this.precipitation > 3
        ? precipDesc.replace("rain/snow", precipType)
        : precipDesc;

    // Determine special weather conditions
    let specialConditions = [];

    // Dark Sun specific conditions
    if (isDarkSun) {
      // Silt storms in Sea of Silt
      if (currentClimate === "seaOfSilt" && this.wind > 6) {
        specialConditions.push(
          "with choking clouds of silt reducing visibility"
        );
      }

      // Glass storms in Glass Plateau
      if (currentClimate === "glassPlateau" && this.wind > 5) {
        specialConditions.push(
          "with deadly shards of glass carried by the wind"
        );
      }

      // Ash storms
      if (
        (currentClimate === "ashStorm" ||
          currentClimate === "obsidianPlains") &&
        this.wind > 5
      ) {
        specialConditions.push(
          "with hot ash reducing visibility and burning exposed skin"
        );
      }

      // Dust devils in sandy regions
      if (
        (currentClimate === "sandyWastes" || currentClimate === "windyDunes") &&
        this.wind > 7 &&
        this.temperature > 7
      ) {
        specialConditions.push(
          "with swirling dust devils dancing across the landscape"
        );
      }

      // Heat mirages
      if (this.temperature > 8 && this.humidity < -6) {
        specialConditions.push("with shimmering heat mirages in the distance");
      }

      // Electrical storms (rare on Athas but spectacular)
      if (
        this.precipitation > 4 &&
        game.settings.get("dimensional-weather", "season") === "sunAscending"
      ) {
        specialConditions.push(
          "with crackling lightning illuminating the sky in brilliant purple and blue"
        );
      }
    } else {
      // Standard conditions for non-Dark Sun settings

      // Thunderstorm conditions
      if (this.precipitation > 6 && this.wind > 4 && this.humidity > 3) {
        specialConditions.push("with thunder and lightning");
      }

      // Fog conditions
      if (this.humidity > 5 && this.wind < -3) {
        if (this.temperature < 0) {
          specialConditions.push("with freezing fog");
        } else {
          specialConditions.push("with patches of fog");
        }
      }
    }

    // Dust/sandstorm conditions (applies to both settings but more severe in Dark Sun)
    if (this.humidity < -5 && this.wind > 7) {
      if (isDarkSun) {
        specialConditions.push(
          "with a severe sandstorm reducing visibility to near zero"
        );
      } else {
        specialConditions.push("with blowing dust/sand reducing visibility");
      }
    }

    // Create summary description
    let summary = `The weather is ${tempDesc.toLowerCase()}, ${windDesc.toLowerCase()}, and ${formattedPrecipDesc.toLowerCase()}.`;

    // Add humidity only if notable
    if (this.humidity < -5 || this.humidity > 5) {
      summary += ` The air is ${humidDesc.toLowerCase()}.`;
    }

    // Add special conditions
    if (specialConditions.length > 0) {
      summary += ` Conditions are ${specialConditions.join(" and ")}.`;
    }

    return summary;
  }

  displayWeatherReport() {
    // If using hex map, use the hex map weather report
    if (this.useHexMap) {
      this.displayHexMapWeatherReport();
      return;
    }

    // Otherwise use the dimensional weather report
    const weather = this.getWeatherDescription();

    // Get the current climate type
    const currentClimate = game.settings.get("dimensional-weather", "climate");
    const isDarkSun = this.isDarkSunClimate(currentClimate);

    // Get current time of day for Dark Sun
    const timeOfDay = game.settings.get("dimensional-weather", "timeOfDay");
    const timeNames = {
      earlyMorning: "Early Morning",
      midMorning: "Mid Morning",
      noon: "Noon",
      afternoon: "Afternoon",
      evening: "Evening",
      night: "Night",
      lateNight: "Late Night",
    };

    // Format temperature for additional info
    let tempValue;
    if (isDarkSun) {
      // Dark Sun temperature descriptors (generally much hotter)
      if (this.temperature <= 0) tempValue = "cold for Athas";
      else if (this.temperature <= 4) tempValue = "mild for Athas";
      else if (this.temperature <= 7) tempValue = "typical Athasian heat";
      else if (this.temperature <= 9) tempValue = "searing";
      else tempValue = "deadly";
    } else {
      // Standard temperature descriptors
      if (this.temperature <= -5) tempValue = "below freezing";
      else if (this.temperature <= 0) tempValue = "near freezing";
      else if (this.temperature <= 5) tempValue = "moderate";
      else tempValue = "hot";
    }

    // Get game effects
    const effects = this.calculateGameEffects();

    // Create chat message with weather report
    ChatMessage.create({
      content: `
        <div class="weather-report ${isDarkSun ? "dark-sun" : ""}">
          <h3><i class="fa-solid fa-${
            isDarkSun ? "sun" : "cloud-sun"
          }"></i> Weather Report</h3>
          <div class="weather-description">${weather}</div>
          <div class="weather-details">
            <div class="weather-dimensions">
              <span>Temperature: ${this.temperature} (${tempValue})</span>
              <span>Wind: ${this.wind}</span>
              <span>Precipitation: ${this.precipitation}</span>
              <span>Humidity: ${this.humidity}</span>
            </div>
            <div class="weather-context">
              <span>Climate: ${game.settings.get(
                "dimensional-weather",
                "climate"
              )}</span>
              <span>Season: ${game.settings.get(
                "dimensional-weather",
                "season"
              )}</span>
              ${
                isDarkSun
                  ? `<span>Time of Day: ${timeNames[timeOfDay]}</span>`
                  : ""
              }
            </div>
            ${
              isDarkSun
                ? `
              <div class="weather-effects">
                <h4>Survival Effects:</h4>
                <ul>
                  ${
                    this.temperature >= 10
                      ? "<li>Characters must make a DC 20 Constitution saving throw every hour or gain one level of exhaustion (130°F+)</li>"
                      : ""
                  }
              ${
                this.temperature === 9
                  ? "<li>Characters must make a DC 15 Constitution saving throw every hour or gain one level of exhaustion (120°F)</li>"
                  : ""
              }
              ${
                this.temperature === 8
                  ? "<li>Characters must make a DC 10 Constitution saving throw every 2 hours or gain one level of exhaustion (105°F)</li>"
                  : ""
              }
              ${
                this.temperature >= 6 && this.temperature < 8
                  ? "<li>Unacclimated characters must make a DC 10 Constitution check after 4 hours of activity (90-100°F)</li>"
                  : ""
              }
                  ${
                    this.wind > 7
                      ? "<li>Visibility reduced to 30 feet during sandstorms</li>"
                      : ""
                  }
                  ${
                    this.wind > 9
                      ? "<li>Ranged attacks impossible, movement halved</li>"
                      : ""
                  }
                  ${
                    this.humidity < -8
                      ? "<li>Water consumption doubled</li>"
                      : ""
                  }
                  ${
                    currentClimate === "glassPlateau" && this.wind > 6
                      ? "<li>Glass storms deal 1d6 slashing damage per round to unprotected characters</li>"
                      : ""
                  }
                  ${
                    timeOfDay === "afternoon" && this.temperature >= 8
                      ? "<li>Afternoon heat increases water consumption by 50%</li>"
                      : ""
                  }
                  ${
                    (timeOfDay === "night" || timeOfDay === "lateNight") &&
                    this.temperature <= 0
                      ? "<li>Cold night requires warm clothing or shelter</li>"
                      : ""
                  }
                </ul>
              </div>
            `
                : `<div class="weather-effects">
              <h4>Game Effects:</h4>
              <ul>
                ${
                  effects.visibility !== "normal"
                    ? `<li>Visibility: ${effects.visibility}</li>`
                    : ""
                }
                ${
                  effects.movement !== "normal"
                    ? `<li>Movement: ${effects.movement} terrain</li>`
                    : ""
                }
                ${
                  effects.rangedAttacks !== 0
                    ? `<li>Ranged Attacks: ${effects.rangedAttacks} penalty</li>`
                    : ""
                }
                ${
                  effects.perceptionChecks !== 0
                    ? `<li>Perception Checks: ${effects.perceptionChecks} penalty</li>`
                    : ""
                }
                ${
                  effects.exhaustion
                    ? "<li>Risk of exhaustion for unprotected characters</li>"
                    : ""
                }
              </ul>
            </div>`
            }
          </div>
        </div>
      `,
      speaker: {
        alias: isDarkSun ? "Athasian Weather System" : "Weather System",
      },
    });
  }

  calculateGameEffects() {
    // Get the current climate type
    const currentClimate = game.settings.get("dimensional-weather", "climate");
    const isDarkSun = this.isDarkSunClimate(currentClimate);

    // Return game mechanical effects based on current weather
    const effects = {
      visibility: "normal",
      movement: "normal",
      rangedAttacks: 0,
      perceptionChecks: 0,
      survivalChecks: 0,
      exhaustion: false,
      waterConsumption: 1, // Multiplier for water consumption
      damage: 0, // Direct damage from environment
    };

    if (isDarkSun) {
      // Dark Sun specific effects

      // Basic temperature effects (Dark Sun has more severe temperature effects)
      if (this.temperature >= 10) {
        effects.exhaustion = true;
        effects.survivalChecks += 10; // Extremely hard survival checks
        effects.waterConsumption = 3; // Triple water consumption
      } else if (this.temperature >= 8) {
        effects.exhaustion = true;
        effects.survivalChecks += 5;
        effects.waterConsumption = 2; // Double water consumption
      } else if (this.temperature >= 6) {
        effects.survivalChecks += 2;
        effects.waterConsumption = 1.5; // 50% more water consumption
      }

      // Wind effects in Dark Sun
      if (this.wind >= 9) {
        effects.visibility = "heavily obscured";
        effects.perceptionChecks -= 10;
        effects.rangedAttacks -= 10; // E`ffectively impossible
        effects.movement = "difficult";
      } else if (this.wind >= 7) {
        effects.visibility = "lightly obscured";
        effects.perceptionChecks -= 5;
        effects.rangedAttacks -= 5;
      } else if (this.wind >= 5) {
        effects.rangedAttacks -= 2;
      }

      // Special terrain effects
      if (currentClimate === "glassPlateau" && this.wind >= 6) {
        effects.damage = Math.floor((this.wind - 5) / 2); // 1d6 damage for strong glass storms
      }

      if (currentClimate === "seaOfSilt" && this.wind >= 5) {
        effects.visibility = "heavily obscured";
        effects.perceptionChecks -= 8;
      }

      if (currentClimate === "saltFlats" && this.temperature >= 9) {
        effects.waterConsumption += 0.5; // Additional water loss due to salt
      }

      // Extremely arid conditions
      if (this.humidity <= -8) {
        effects.waterConsumption += 0.5;
      }
    } else {
      // Standard climate effects

      // Visibility effects
      if (this.precipitation >= 7) {
        effects.visibility = "heavily obscured";
        effects.perceptionChecks -= 5;
      } else if (this.precipitation >= 4) {
        effects.visibility = "lightly obscured";
        effects.perceptionChecks -= 2;
      }

      // Fog effects
      if (this.humidity > 5 && this.wind < -3) {
        effects.visibility = "heavily obscured";
        effects.perceptionChecks -= 5;
      }

      // Wind effects on ranged attacks
      if (this.wind >= 8) {
        effects.rangedAttacks -= 4;
        effects.movement = "difficult";
      } else if (this.wind >= 6) {
        effects.rangedAttacks -= 2;
      }

      // Temperature effects
      if (this.temperature <= -7 || this.temperature >= 8) {
        effects.exhaustion = true;
        effects.survivalChecks += 5; // Harder survival checks
      } else if (this.temperature <= -5 || this.temperature >= 6) {
        effects.survivalChecks += 2;
      }

      // Movement through snow
      if (this.temperature < -3 && this.precipitation > 5) {
        effects.movement = "difficult";
      }
    }

    return effects;
  }

  // New method for hex map weather updates
  updateHexMapWeather(forced = false) {
    // Check if hex map is enabled
    if (!this.useHexMap) return;

    // Load current position and weather type
    this.currentHexPosition = game.settings.get(
      "dimensional-weather",
      "currentHexPosition"
    );
    this.currentWeatherType = game.settings.get(
      "dimensional-weather",
      "currentWeatherType"
    );

    // Roll for direction (1-6)
    const direction = Math.floor(Math.random() * 6) + 1;

    // Move in that direction
    this.moveHexMapWeather(direction, forced);
  }

  // Method to move in a specific direction on the hex map
  moveHexMapWeather(direction, forced = false) {
    // Convert direction (1-6) to axial coordinate changes
    // Direction mapping:
    // 1: Northeast (+1, -1)
    // 2: East (+1, 0)
    // 3: Southeast (0, +1)
    // 4: Southwest (-1, +1)
    // 5: West (-1, 0)
    // 6: Northwest (0, -1)
    const directionMap = {
      1: { q: 1, r: -1 },
      2: { q: 1, r: 0 },
      3: { q: 0, r: 1 },
      4: { q: -1, r: 1 },
      5: { q: -1, r: 0 },
      6: { q: 0, r: -1 },
    };

    // Get the coordinate change
    const change = directionMap[direction];

    // Calculate new position
    let newPosition = {
      q: this.currentHexPosition.q + change.q,
      r: this.currentHexPosition.r + change.r,
    };

    // Check if the new position is on the map
    const newKey = `${newPosition.q},${newPosition.r}`;
    if (!this.athasHexMap[newKey]) {
      // If not on map, find closest valid direction
      // Try each direction in order of proximity to the original direction
      const orderedDirections = this.getOrderedDirections(direction);

      for (const dir of orderedDirections) {
        const altChange = directionMap[dir];
        const altPosition = {
          q: this.currentHexPosition.q + altChange.q,
          r: this.currentHexPosition.r + altChange.r,
        };
        const altKey = `${altPosition.q},${altPosition.r}`;

        if (this.athasHexMap[altKey]) {
          newPosition = altPosition;
          break;
        }
      }

      // If still not on map (corner case), don't move
      const finalKey = `${newPosition.q},${newPosition.r}`;
      if (!this.athasHexMap[finalKey]) {
        newPosition = this.currentHexPosition;
      }
    }

    // Update position and weather type
    this.currentHexPosition = newPosition;
    const posKey = `${newPosition.q},${newPosition.r}`;
    this.currentWeatherType = this.athasHexMap[posKey] || "normal";

    // Save to settings
    game.settings.set(
      "dimensional-weather",
      "currentHexPosition",
      this.currentHexPosition
    );
    game.settings.set(
      "dimensional-weather",
      "currentWeatherType",
      this.currentWeatherType
    );

    // Update dimensional values based on hex weather
    const weatherData = this.athasHexWeather[this.currentWeatherType];
    if (weatherData && weatherData.gameEffects) {
      // Set temperature if defined
      if (weatherData.gameEffects.temperature !== undefined) {
        this.temperature = weatherData.gameEffects.temperature;
        game.settings.set(
          "dimensional-weather",
          "temperature",
          this.temperature
        );
      }

      // Set wind if defined
      if (weatherData.gameEffects.wind !== undefined) {
        this.wind = weatherData.gameEffects.wind;
        game.settings.set("dimensional-weather", "wind", this.wind);
      }

      // Set humidity if defined
      if (weatherData.gameEffects.humidity !== undefined) {
        this.humidity = weatherData.gameEffects.humidity;
        game.settings.set("dimensional-weather", "humidity", this.humidity);
      }
    }

    // Display weather report if forced or significant change
    if (forced) {
      this.displayHexMapWeatherReport();
    } else {
      // Check if the weather type is significant
      const significantWeather = [
        "sandstorm",
        "deadlyHot",
        "dryThunder",
      ].includes(this.currentWeatherType);
      if (significantWeather) {
        this.displayHexMapWeatherReport();
      }
    }

    // Emit hook for other modules
    Hooks.callAll("weatherChanged", {
      hexMapWeather: true,
      weatherType: this.currentWeatherType,
      position: this.currentHexPosition,
      temperature: this.temperature,
      wind: this.wind,
      humidity: this.humidity,
    });

    return {
      weatherType: this.currentWeatherType,
      position: this.currentHexPosition,
    };
  }

  // Helper method to get directions in order of proximity to original direction
  getOrderedDirections(originalDirection) {
    // For each direction, define the order of alternative directions
    // based on proximity (clockwise and counterclockwise)
    const directionProximity = {
      1: [2, 6, 3, 5, 4],
      2: [1, 3, 6, 4, 5],
      3: [2, 4, 1, 5, 6],
      4: [3, 5, 2, 6, 1],
      5: [4, 6, 3, 1, 2],
      6: [1, 5, 2, 4, 3],
    };

    return directionProximity[originalDirection];
  }

  // Display hex map weather report
  displayHexMapWeatherReport() {
    // Get the current weather data
    const weatherData = this.athasHexWeather[this.currentWeatherType];

    if (!weatherData) {
      ui.notifications.error("Unknown weather type.");
      return;
    }

    // Create chat message with hex map weather report
    ChatMessage.create({
      content: `
        <div class="weather-report dark-sun">
          <h3><i class="fa-solid fa-sun"></i> Athas Weather Report</h3>
          <div class="weather-description" style="border-left: 4px solid ${
            weatherData.color
          }; padding-left: 10px;">
            <strong>${weatherData.name}</strong>: ${weatherData.description}
          </div>
          <div class="weather-details">
            <div class="weather-effects">
              <h4>Effects:</h4>
              <p>${weatherData.effects}</p>
            </div>
            <div class="weather-position">
              <p>Position on Hex Map: (${this.currentHexPosition.q}, ${
        this.currentHexPosition.r
      })</p>
              <p>Last Direction: ${this.lastDirection || "N/A"}</p>
            </div>
          </div>
        </div>
      `,
      speaker: {
        alias: "Athasian Weather System",
      },
    });
  }

  // Show hex map dialog
  showHexMapDialog() {
    // Create a dialog showing the hex map
    const hexMapHtml = this.generateHexMapHtml();

    new Dialog({
      title: "Athas Weather Hex Map",
      content: hexMapHtml,
      buttons: {
        close: {
          label: "Close",
        },
      },
      width: 600,
      height: 700,
    }).render(true);
  }

  // Generate HTML for hex map visualization
  generateHexMapHtml() {
    // Create SVG for hex map
    let svg = `
      <style>
        .hex-map-container {
          width: 100%;
          height: 500px;
          overflow: auto;
          position: relative;
        }
        .hex {
          stroke: #333;
          stroke-width: 1;
        }
        .hex-current {
          stroke: #fff;
          stroke-width: 3;
        }
        .hex-label {
          font-size: 10px;
          fill: #000;
          text-anchor: middle;
          pointer-events: none;
        }
        .hex-legend {
          display: flex;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          margin-right: 15px;
          margin-bottom: 5px;
        }
        .legend-color {
          width: 20px;
          height: 20px;
          margin-right: 5px;
          border: 1px solid #333;
        }
        .directions {
          margin-top: 15px;
          text-align: center;
        }
        .direction-buttons {
          display: flex;
          justify-content: center;
          margin-top: 10px;
        }
        .direction-button {
          margin: 0 5px;
          padding: 5px 10px;
          background: #4e4a4e;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        }
        .direction-button:hover {
          background: #6b6b6b;
        }
      </style>
      <div class="hex-map-container">
        <svg width="800" height="800" viewBox="-400 -400 800 800">
    `;

    // Constants for hex drawing
    const hexSize = 40;
    const hexWidth = hexSize * 2;
    const hexHeight = Math.sqrt(3) * hexSize;

    // Draw each hex
    for (const [key, weatherType] of Object.entries(this.athasHexMap)) {
      const [q, r] = key.split(",").map(Number);

      // Convert axial coordinates to pixel coordinates
      const x = ((hexSize * 3) / 2) * q;
      const y = hexSize * Math.sqrt(3) * (r + q / 2);

      // Get weather data
      const weatherData = this.athasHexWeather[weatherType];
      if (!weatherData) continue;

      // Create hex path
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = ((2 * Math.PI) / 6) * i;
        const px = x + hexSize * Math.cos(angle);
        const py = y + hexSize * Math.sin(angle);
        points.push(`${px},${py}`);
      }

      // Check if this is the current position
      const isCurrent =
        q === this.currentHexPosition.q && r === this.currentHexPosition.r;
      const hexClass = isCurrent ? "hex hex-current" : "hex";

      // Add hex to SVG
      svg += `
        <polygon 
          class="${hexClass}" 
          points="${points.join(" ")}" 
          fill="${weatherData.color}" 
          data-q="${q}" 
          data-r="${r}"
          data-weather="${weatherType}"
        />
        <text class="hex-label" x="${x}" y="${y + 5}">${weatherData.name}</text>
      `;
    }

    // Close SVG
    svg += `</svg></div>`;

    // Add legend
    svg += `<div class="hex-legend">`;
    for (const [type, data] of Object.entries(this.athasHexWeather)) {
      svg += `
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${data.color}"></div>
          <div>${data.name}</div>
        </div>
      `;
    }
    svg += `</div>`;

    // Add directions guide
    svg += `
      <div class="directions">
        <p>Roll a d6 or click a direction to move:</p>
        <div class="direction-buttons">
          <button class="direction-button" data-direction="1">1 (NE)</button>
          <button class="direction-button" data-direction="2">2 (E)</button>
          <button class="direction-button" data-direction="3">3 (SE)</button>
          <button class="direction-button" data-direction="4">4 (SW)</button>
          <button class="direction-button" data-direction="5">5 (W)</button>
          <button class="direction-button" data-direction="6">6 (NW)</button>
        </div>
      </div>
    `;

    // Add JavaScript for interactivity
    svg += `
      <script>
        document.querySelectorAll('.direction-button').forEach(button => {
          button.addEventListener('click', event => {
            const direction = event.target.dataset.direction;
            game.dimWeather.moveHexMapWeather(parseInt(direction), true);
            // Close dialog after a short delay
            setTimeout(() => {
              document.querySelector('.dialog .close').click();
            }, 500);
          });
        });
      </script>
    `;

    return svg;
  }

  static _initializeSimpleCalendarIntegration() {
    // Check if Simple Calendar is active
    if (!game.modules.get("simple-calendar")?.active) {
      console.log("Dimensional Weather | Simple Calendar module not active");
      return;
    }

    // Check if integration is enabled
    if (!game.settings.get("dimensional-weather", "useSimpleCalendar")) {
      console.log("Dimensional Weather | Simple Calendar integration disabled");
      return;
    }

    console.log(
      "Dimensional Weather | Initializing Simple Calendar integration"
    );

    try {
      // Detect calendar type and set world type accordingly
      game.dimWeather.detectCalendarTypeAndSetWorldType();

      // Update season based on current date
      game.dimWeather.updateSeasonFromSimpleCalendar();

      // Register hooks for date changes
      Hooks.on("simple-calendar.dateChanged", () => {
        console.log(
          "Dimensional Weather | Simple Calendar date changed, updating season"
        );
        game.dimWeather.updateSeasonFromSimpleCalendar();
      });

      // Register hooks for time changes
      Hooks.on("simple-calendar.timeChanged", () => {
        console.log(
          "Dimensional Weather | Simple Calendar time changed, updating time of day"
        );
        try {
          const sc = game.modules.get("simple-calendar").api;
          if (!sc) return;

          const currentTime = sc.getCurrentTime();
          if (currentTime) {
            const hour = currentTime.hour;

            // Map hour to time of day
            let timeOfDay = "noon";
            if (hour >= 4 && hour < 8) {
              timeOfDay = "earlyMorning";
            } else if (hour >= 8 && hour < 11) {
              timeOfDay = "midMorning";
            } else if (hour >= 11 && hour < 14) {
              timeOfDay = "noon";
            } else if (hour >= 14 && hour < 17) {
              timeOfDay = "afternoon";
            } else if (hour >= 17 && hour < 20) {
              timeOfDay = "evening";
            } else if (hour >= 20 && hour < 24) {
              timeOfDay = "night";
            } else {
              // 0-4
              timeOfDay = "lateNight";
            }

            // Set time of day
            game.settings.set("dimensional-weather", "timeOfDay", timeOfDay);
            game.dimWeather.updateWeatherForTimeOfDay(timeOfDay);
          }
        } catch (error) {
          console.error(
            "Dimensional Weather | Error updating time of day:",
            error
          );
        }
      });
    } catch (error) {
      console.error(
        "Dimensional Weather | Error initializing Simple Calendar integration:",
        error
      );
    }
  }

  // Method to detect calendar type from Simple Calendar and set world type
  detectCalendarTypeAndSetWorldType() {
    // Check if Simple Calendar is active
    if (!game.modules.get("simple-calendar")?.active) {
      console.warn(
        "Dimensional Weather | Simple Calendar module is not active."
      );
      return;
    }

    // Get Simple Calendar API
    const sc = game.modules.get("simple-calendar").api;
    if (!sc) {
      console.warn(
        "Dimensional Weather | Could not access Simple Calendar API."
      );
      return;
    }

    try {
      // Get current calendar name
      const currentCalendar = sc.getCurrentCalendar();
      if (!currentCalendar) {
        console.warn(
          "Dimensional Weather | Could not get current calendar from Simple Calendar."
        );
        return;
      }

      const calendarName = currentCalendar.name.toLowerCase();
      console.log(`Dimensional Weather | Detected calendar: ${calendarName}`);

      // Get current world type
      const currentWorldType = game.settings.get(
        "dimensional-weather",
        "worldType"
      );

      // Determine world type based on calendar name
      let worldType = currentWorldType;

      // Check for Dark Sun calendars
      if (
        calendarName.includes("tyr") ||
        calendarName.includes("athas") ||
        calendarName.includes("dark sun")
      ) {
        worldType = "darkSun";
      }
      // Check for traditional calendars
      else if (calendarName.includes("azthir-terra")) {
        worldType = "traditional";
      }
      // If no match in name, check month names for Dark Sun
      else {
        // Get all months
        const months = sc.getAllMonths();
        const darkSunMonthNames = [
          "high sun",
          "descending",
          "ascending",
          "sorrow",
          "plenty",
        ];

        // Check if any month names match Dark Sun month names
        const hasDarkSunMonths = months.some((month) =>
          darkSunMonthNames.some((dsMonth) =>
            month.name.toLowerCase().includes(dsMonth)
          )
        );

        if (hasDarkSunMonths) {
          worldType = "darkSun";
        }
      }

      // Update world type if it changed
      if (worldType !== currentWorldType) {
        game.settings.set("dimensional-weather", "worldType", worldType);
        console.log(
          `Dimensional Weather | World type set to ${worldType} based on calendar ${calendarName}`
        );
        ui.notifications.info(
          `Weather system detected ${
            worldType === "darkSun" ? "Dark Sun" : "Traditional"
          } calendar and updated settings accordingly.`
        );
      }

      return worldType;
    } catch (error) {
      console.error(
        "Dimensional Weather | Error detecting calendar type:",
        error
      );
      return null;
    }
  }

  // Method to update season based on Simple Calendar date
  updateSeasonFromSimpleCalendar() {
    // Check if Simple Calendar is active
    if (!game.modules.get("simple-calendar")?.active) {
      console.warn(
        "Dimensional Weather | Simple Calendar module is not active."
      );
      return;
    }

    // Get Simple Calendar API
    const sc = game.modules.get("simple-calendar").api;
    if (!sc) {
      console.warn(
        "Dimensional Weather | Could not access Simple Calendar API."
      );
      return;
    }

    // First detect calendar type and set world type
    this.detectCalendarTypeAndSetWorldType();

    // Get current season from Simple Calendar if available
    let season = null;
    let seasonName = "";

    try {
      const seasonData = sc.getCurrentSeason();
      if (seasonData) {
        seasonName = seasonData.name.toLowerCase();
        console.log(
          `Dimensional Weather | Simple Calendar season: ${seasonName}`
        );
      }
    } catch (error) {
      console.error(
        "Dimensional Weather | Error getting season from Simple Calendar:",
        error
      );
    }

    // Get current time from Simple Calendar
    try {
      const currentTime = sc.getCurrentTime();
      if (currentTime) {
        const hour = currentTime.hour;

        // Map hour to time of day
        let timeOfDay = "noon";
        if (hour >= 4 && hour < 8) {
          timeOfDay = "earlyMorning";
        } else if (hour >= 8 && hour < 11) {
          timeOfDay = "midMorning";
        } else if (hour >= 11 && hour < 14) {
          timeOfDay = "noon";
        } else if (hour >= 14 && hour < 17) {
          timeOfDay = "afternoon";
        } else if (hour >= 17 && hour < 20) {
          timeOfDay = "evening";
        } else if (hour >= 20 && hour < 24) {
          timeOfDay = "night";
        } else {
          // 0-4
          timeOfDay = "lateNight";
        }

        // Set time of day
        game.settings.set("dimensional-weather", "timeOfDay", timeOfDay);
        console.log(
          `Dimensional Weather | Time of day set to ${timeOfDay} based on hour ${hour}`
        );
      }
    } catch (error) {
      console.error(
        "Dimensional Weather | Error getting time from Simple Calendar:",
        error
      );
    }

    // Determine season based on world type
    const worldType = game.settings.get("dimensional-weather", "worldType");

    if (worldType === "darkSun") {
      // For Dark Sun, map season based on keywords or month
      if (seasonName) {
        if (seasonName.includes("high") || seasonName.includes("summer")) {
          season = "highSun";
        } else if (
          seasonName.includes("descend") ||
          seasonName.includes("fall") ||
          seasonName.includes("autumn")
        ) {
          season = "sunDescending";
        } else if (
          seasonName.includes("ascend") ||
          seasonName.includes("spring")
        ) {
          season = "sunAscending";
        }
      }

      // If no season was determined from name, use month index
      if (!season) {
        try {
          const currentMonth = sc.getCurrentMonth();
          if (currentMonth) {
            const monthIndex = currentMonth.numericRepresentation;
            const totalMonths = sc.getAllMonths().length;

            // Use Calendar of Tyr configuration if available
            if (
              this.calendarOfTyrConfig &&
              this.calendarOfTyrConfig[monthIndex]
            ) {
              season = this.calendarOfTyrConfig[monthIndex];
            } else {
              // Fallback mapping based on month index
              if (
                monthIndex >= Math.floor(totalMonths * 0.75) ||
                monthIndex < Math.floor(totalMonths * 0.25)
              ) {
                season = "highSun";
              } else if (
                monthIndex >= Math.floor(totalMonths * 0.25) &&
                monthIndex < Math.floor(totalMonths * 0.5)
              ) {
                season = "sunDescending";
              } else {
                season = "sunAscending";
              }
            }
          }
        } catch (error) {
          console.error(
            "Dimensional Weather | Error getting month from Simple Calendar:",
            error
          );
        }
      }
    } else {
      // For traditional settings, map season based on keywords or month
      if (seasonName) {
        if (seasonName.includes("summer")) {
          season = "summer";
        } else if (
          seasonName.includes("fall") ||
          seasonName.includes("autumn")
        ) {
          season = "fall";
        } else if (seasonName.includes("winter")) {
          season = "winter";
        } else if (seasonName.includes("spring")) {
          season = "spring";
        }
      }

      // If no season was determined from name, use month index
      if (!season) {
        try {
          const currentMonth = sc.getCurrentMonth();
          if (currentMonth) {
            const monthIndex = currentMonth.numericRepresentation;
            const totalMonths = sc.getAllMonths().length;

            // Simple mapping based on quarter of the year
            if (
              monthIndex >= Math.floor(totalMonths * 0.75) ||
              monthIndex < Math.floor(totalMonths * 0.25)
            ) {
              season = "winter";
            } else if (
              monthIndex >= Math.floor(totalMonths * 0.25) &&
              monthIndex < Math.floor(totalMonths * 0.5)
            ) {
              season = "spring";
            } else if (
              monthIndex >= Math.floor(totalMonths * 0.5) &&
              monthIndex < Math.floor(totalMonths * 0.75)
            ) {
              season = "summer";
            } else {
              season = "fall";
            }
          }
        } catch (error) {
          console.error(
            "Dimensional Weather | Error getting month from Simple Calendar:",
            error
          );
        }
      }
    }

    // Set the season if one was determined
    if (season) {
      game.settings.set("dimensional-weather", "season", season);
      console.log(
        `Dimensional Weather | Season set to ${season} based on Simple Calendar`
      );

      // Update weather
      game.dimWeather.updateWeather();

      // Notify user
      ui.notifications.info(
        `Weather season updated to ${season} based on current date in ${
          sc.getCurrentCalendar().name
        }.`
      );
    }
  }

  // Method to update settings based on world type
  updateWorldTypeSettings(worldType) {
    // Get current climate and season
    const currentClimate = game.settings.get("dimensional-weather", "climate");
    const currentSeason = game.settings.get("dimensional-weather", "season");

    // Check if current climate is valid for the new world type
    let newClimate = currentClimate;
    let newSeason = currentSeason;

    if (worldType === "darkSun") {
      // If switching to Dark Sun, set appropriate defaults if current values aren't valid
      if (!this.isDarkSunClimate(currentClimate)) {
        // Map traditional climates to Dark Sun equivalents
        const climateMap = {
          temperate: "scrubPlains",
          desert: "sandyWastes",
          tundra: "saltFlats",
          tropical: "verdantBelt",
          coastal: "seaOfSilt",
          mountain: "rockyBadlands",
          swamp: "verdantBelt",
        };

        newClimate = climateMap[currentClimate] || "scrubPlains";
      }

      // Map traditional seasons to Dark Sun seasons
      const seasonMap = {
        spring: "sunAscending",
        summer: "highSun",
        fall: "sunDescending",
        winter: "sunDescending",
      };

      if (seasonMap[currentSeason]) {
        newSeason = seasonMap[currentSeason];
      }
    } else {
      // If switching to traditional, set appropriate defaults
      if (this.isDarkSunClimate(currentClimate)) {
        // Map Dark Sun climates to traditional equivalents
        const climateMap = {
          rockyBadlands: "mountain",
          saltFlats: "desert",
          stonyBarrens: "desert",
          scrubPlains: "temperate",
          verdantBelt: "tropical",
          ruggedSavanna: "temperate",
          sandyWastes: "desert",
          windyDunes: "desert",
          seaOfSilt: "coastal",
          obsidianPlains: "desert",
          ashStorm: "mountain",
          crackledPlains: "desert",
          glassPlateau: "desert",
        };

        newClimate = climateMap[currentClimate] || "temperate";
      }

      // Map Dark Sun seasons to traditional seasons
      const seasonMap = {
        highSun: "summer",
        sunDescending: "fall",
        sunAscending: "spring",
      };

      if (seasonMap[currentSeason]) {
        newSeason = seasonMap[currentSeason];
      }
    }

    // Update climate and season if they changed
    if (newClimate !== currentClimate) {
      game.settings.set("dimensional-weather", "climate", newClimate);
    }

    if (newSeason !== currentSeason) {
      game.settings.set("dimensional-weather", "season", newSeason);
    }

    // If switching to traditional, disable hex map
    if (worldType === "traditional" && this.useHexMap) {
      game.settings.set("dimensional-weather", "useHexMap", false);
    }

    // Update weather to reflect new settings
    this.setClimate(newClimate);
    this.setSeason(newSeason);

    // Refresh the settings menu if it's open
    if (game.settings.sheet && game.settings.sheet.rendered) {
      game.settings.sheet.close();
      game.settings.sheet.render(true);
    }

    // Notify user
    ui.notifications.info(
      `Weather system updated to ${
        worldType === "darkSun" ? "Dark Sun" : "Traditional"
      } setting.`
    );
  }

  // Add a new method to update weather based on time of day
  updateWeatherForTimeOfDay(timeOfDay) {
    // Only apply significant time-of-day effects for Dark Sun
    if (game.settings.get("dimensional-weather", "worldType") !== "darkSun") {
      return;
    }

    // Get current temperature
    const currentTemp = this.temperature;

    // Get base temperature from climate and season
    const climate = this.climates[
      game.settings.get("dimensional-weather", "climate")
    ];
    const season = this.seasons[
      game.settings.get("dimensional-weather", "season")
    ];
    const baseTemp = Math.floor((climate.temperature + season.temperature) / 2);

    // Apply time of day modifiers
    let tempModifier = 0;
    let description = "";

    switch (timeOfDay) {
      case "earlyMorning":
        tempModifier = -4; // Much cooler in early morning
        description =
          "The cool morning air provides a brief respite from Athas's heat.";
        break;
      case "midMorning":
        tempModifier = 0; // Warming up
        description = "The temperature rises as the crimson sun climbs higher.";
        break;
      case "noon":
        tempModifier = 2; // Hot
        description = "The sun reaches its zenith, beating down mercilessly.";
        break;
      case "afternoon":
        tempModifier = 3; // Hottest part of day
        description =
          "The afternoon heat is brutal, with temperatures at their peak.";
        break;
      case "evening":
        tempModifier = -1; // Starting to cool
        description = "The temperature begins to drop as the sun descends.";
        break;
      case "night":
        tempModifier = -5; // Much cooler
        description = "The night brings a dramatic drop in temperature.";
        break;
      case "lateNight":
        tempModifier = -7; // Coldest part of night
        description =
          "In the depths of night, the temperature plummets to its lowest point.";
        break;
    }

    // Calculate new temperature
    let newTemp = baseTemp + tempModifier;

    // Ensure it stays within bounds
    newTemp = Math.max(-10, Math.min(10, newTemp));

    // Update temperature
    this.temperature = newTemp;
    game.settings.set("dimensional-weather", "temperature", newTemp);

    // Notify user
    ui.notifications.info(
      `Time of day updated to ${timeOfDay}. ${description}`
    );

    // Update weather report
    this.displayWeatherReport();

    return {
      temperature: this.temperature,
      timeOfDay: timeOfDay,
      description: description,
    };
  }
}

// Register the module initialization hook
Hooks.once("init", () => {
  console.log("Dimensional Weather | Initializing module");
});

// Initialize the module when Foundry is ready
Hooks.once("ready", () => {
  DimensionalWeather.initialize();
});
