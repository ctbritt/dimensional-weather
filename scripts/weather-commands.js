/**
 * Dimensional Weather - Weather Command Handlers
 * Handles all weather-related commands using the command handler framework
 */

import { Settings } from "./settings.js";
import { CommandHandler } from "./command-handler.js";
import { ErrorHandler } from "./utils.js";

/**
 * Weather Command Handlers
 * Handles all weather-related commands using the command handler framework
 */
export class WeatherCommands {
  /**
   * Create a new Weather Commands instance
   * @param {Object} api - The API instance
   */
  constructor(api) {
    this.api = api;
    this.commandHandler = new CommandHandler(api);
    this.registerCommands();
  }

  /**
   * Register all weather commands
   * @private
   */
  registerCommands() {
    // Register default command (display current weather)
    this.commandHandler.registerDefaultCommand(async (args, options) => {
      await this.api.displayWeather();
      return this.commandHandler.createSuccessResponse("Weather displayed.");
    });

    // Register version command
    this.commandHandler.registerCommand(
      "version",
      this.handleVersionCommand.bind(this),
      {
        description: "Display weather system version information",
      }
    );

    // Register update command
    this.commandHandler.registerCommand(
      "update",
      this.handleUpdateCommand.bind(this),
      {
        requiresGM: true,
        description: "Force a weather update",
      }
    );

    // Register terrain command
    this.commandHandler.registerCommand(
      "terrain",
      this.handleTerrainCommand.bind(this),
      {
        requiresGM: true,
        requiresArgs: true,
        validateArgs: (args) => {
          if (args.length < 2) {
            return "Please specify a terrain type. Use /weather help for available options.";
          }
          return true;
        },
        description: "Change the current terrain type",
      }
    );

    // Register season command
    this.commandHandler.registerCommand(
      "season",
      this.handleSeasonCommand.bind(this),
      {
        requiresGM: true,
        requiresArgs: true,
        validateArgs: (args) => {
          if (args.length < 2) {
            return "Please specify a season. Use /weather help for available options.";
          }
          return true;
        },
        description: "Change the current season",
      }
    );

    // Register random command
    this.commandHandler.registerCommand(
      "random",
      this.handleRandomCommand.bind(this),
      {
        requiresGM: true,
        requiresArgs: true,
        validateArgs: (args) => {
          if (args.length < 2) {
            return "Please specify a value between 0 and 10.";
          }
          const value = parseInt(args[1]);
          if (isNaN(value) || value < 0 || value > 10) {
            return "Variability must be a number between 0 and 10.";
          }
          return true;
        },
        description: "Set weather variability (0-10)",
      }
    );

    // Register stats command
    this.commandHandler.registerCommand(
      "stats",
      this.handleStatsCommand.bind(this),
      {
        requiresGM: true,
        description: "Display weather statistics",
      }
    );

    // Register forecast command
    this.commandHandler.registerCommand(
      "forecast",
      this.handleForecastCommand.bind(this),
      {
        requiresGM: true,
        description: "Display weather forecast",
      }
    );

    // Register calc command
    this.commandHandler.registerCommand(
      "calc",
      this.handleCalcCommand.bind(this),
      {
        requiresGM: true,
        description: "Display weather calculation details",
      }
    );

    // Register help command
    this.commandHandler.registerCommand(
      "help",
      this.handleHelpCommand.bind(this),
      {
        description: "Display help information",
      }
    );

    // Register settings command
    this.commandHandler.registerCommand(
      "settings",
      this.handleSettingsCommand.bind(this),
      {
        requiresGM: true,
        description: "Open weather settings panel",
      }
    );

    // Register debug command
    this.commandHandler.registerCommand(
      "debug",
      this.handleDebugCommand.bind(this),
      {
        requiresGM: true,
        description: "Toggle time period debug logging",
      }
    );

    // Register terrains command
    this.commandHandler.registerCommand(
      "terrains",
      this.handleTerrainsCommand.bind(this),
      {
        description: "List available terrains",
      }
    );
  }

  /**
   * Handle the version command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleVersionCommand(args) {
    if (!this.api.settingsData) {
      return this.commandHandler.createErrorResponse(
        "Weather system not initialized or settings not loaded."
      );
    }

    return this.commandHandler.createSuccessResponse(
      `<div class="weather-report">
        <h3>Weather System Info</h3>
        <ul>
          <li>Name: ${this.api.settingsData.name}</li>
          <li>Description: ${this.api.settingsData.description}</li>
        </ul>
      </div>`
    );
  }

  /**
   * Handle the update command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleUpdateCommand(args) {
    await this.api.updateWeather();
    return this.commandHandler.createSuccessResponse("Weather updated.", {
      whisper: [game.user.id],
    });
  }

  /**
   * Handle the terrain command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleTerrainCommand(args) {
    // Convert the terrain name to camelCase format or find by display name
    const terrainInput = args.slice(1).join(" ").trim();

    // Try to match by display name first
    let matchedTerrain = null;
    for (const [key, terrain] of Object.entries(
      this.api.settingsData.terrains
    )) {
      if (terrain.name.toLowerCase() === terrainInput.toLowerCase()) {
        matchedTerrain = key;
        break;
      }
    }

    // If no match by display name, try camelCase conversion
    if (!matchedTerrain) {
      matchedTerrain = terrainInput
        .toLowerCase()
        .replace(/\s+(\w)/g, (match, letter) => letter.toUpperCase())
        .replace(/^(\w)/, (match, letter) => letter.toLowerCase());
    }

    if (this.api.settingsData.terrains[matchedTerrain]) {
      const success = await this.api.setTerrain(matchedTerrain);

      if (success) {
        const displayName =
          this.api.settingsData.terrains[matchedTerrain].name ||
          matchedTerrain.replace(/([A-Z])/g, " $1").trim();

        return this.commandHandler.createSuccessResponse(
          `Terrain has been set to ${displayName}`,
          { whisper: [game.user.id] }
        );
      } else {
        return this.commandHandler.createErrorResponse(
          `Failed to set terrain to ${terrainInput}`,
          { whisper: [game.user.id] }
        );
      }
    } else {
      return this.commandHandler.createErrorResponse(
        `Invalid terrain type: ${terrainInput}. Use /weather help for available options.`,
        { whisper: [game.user.id] }
      );
    }
  }

  /**
   * Handle the season command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleSeasonCommand(args) {
    // Check if Simple Calendar integration is enabled
    if (Settings.isSimpleCalendarEnabled()) {
      return this.commandHandler.createErrorResponse(
        "Turn off Simple Calendar integration to manually change seasons.",
        { whisper: [game.user.id] }
      );
    }

    // Join all arguments after "season" to handle multi-word season names
    const seasonName = args.slice(1).join(" ").toLowerCase();

    // Try to find season by name
    let seasonKey = null;
    for (const [key, season] of Object.entries(this.api.settingsData.seasons)) {
      if (season.name.toLowerCase() === seasonName) {
        seasonKey = key;
        break;
      }
    }

    // If not found by name, try to match the key directly
    if (!seasonKey) {
      for (const key of Object.keys(this.api.settingsData.seasons)) {
        if (key.toLowerCase() === seasonName) {
          seasonKey = key;
          break;
        }
      }
    }

    if (!seasonKey) {
      return this.commandHandler.createErrorResponse(
        `Invalid season: ${seasonName}. Use /weather help for available options.`,
        { whisper: [game.user.id] }
      );
    }

    const success = await this.api.setSeason(seasonKey);

    if (success) {
      // Format the season name
      const formattedSeason = this.api.settingsData.seasons[seasonKey].name;

      return this.commandHandler.createSuccessResponse(
        `Season has been set to ${formattedSeason}`,
        { whisper: [game.user.id] }
      );
    } else {
      return this.commandHandler.createErrorResponse(
        `Failed to set season to ${seasonName}`,
        { whisper: [game.user.id] }
      );
    }
  }

  /**
   * Handle the random command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleRandomCommand(args) {
    const value = parseInt(args[1]);
    const success = await this.api.setVariability(value);

    if (success) {
      return this.commandHandler.createSuccessResponse(
        `Weather variability set to ${value}. Use /weather update to apply changes.`,
        { whisper: [game.user.id] }
      );
    } else {
      return this.commandHandler.createErrorResponse(
        `Failed to set variability to ${value}`,
        { whisper: [game.user.id] }
      );
    }
  }

  /**
   * Handle the stats command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleStatsCommand(args) {
    const scene = game.scenes.viewed;
    if (!scene?.id) {
      return this.commandHandler.createErrorResponse("No active scene.", {
        whisper: ChatMessage.getWhisperRecipients("GM"),
      });
    }

    const weatherState = scene.getFlag("dimensional-weather", "weatherState");
    if (!weatherState) {
      return this.commandHandler.createErrorResponse(
        "No weather state found for current scene.",
        { whisper: ChatMessage.getWhisperRecipients("GM") }
      );
    }

    const terrain = this.api.settingsData.terrains[weatherState.terrain];
    const season = this.api.settingsData.seasons[weatherState.season];

    return this.commandHandler.createSuccessResponse(
      `<div class="weather-report"><h3>SCENE WEATHER STATS</h3><h4>Current State</h4><ul><li>Terrain: ${
        terrain.name
      }</li><li>Season: ${season.name}</li><li>Variability: ${
        weatherState.variability || 0
      }</li></ul><h4>Base Values</h4><ul><li>Temperature: ${
        terrain.temperature
      }</li><li>Wind: ${terrain.wind}</li><li>Precipitation: ${
        terrain.precipitation
      }</li><li>Humidity: ${terrain.humidity}</li></ul></div>`,
      { whisper: ChatMessage.getWhisperRecipients("GM") }
    );
  }

  /**
   * Handle the forecast command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleForecastCommand(args) {
    const forecast = await this.api.generateForecast();
    return this.commandHandler.createSuccessResponse(forecast, {
      whisper: ChatMessage.getWhisperRecipients("GM"),
    });
  }

  /**
   * Handle the calc command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleCalcCommand(args) {
    const calc = await this.api.engine.getLastCalculation();
    if (!calc) {
      return this.commandHandler.createErrorResponse(
        "No weather calculation data available.",
        { whisper: ChatMessage.getWhisperRecipients("GM") }
      );
    }

    const details = `<div class="weather-report"><h3>WEATHER CALCULATION DETAILS</h3><h4>Base Values (${
      calc.terrain.name
    })</h4><ul><li>Temperature: ${calc.terrain.baseTemp}</li><li>Wind: ${
      calc.terrain.baseWind
    }</li><li>Precipitation: ${calc.terrain.basePrecip}</li><li>Humidity: ${
      calc.terrain.baseHumid
    }</li></ul>${
      calc.previous
        ? `<h4>Previous Values</h4><ul><li>Temperature: ${calc.previous.temp}</li><li>Wind: ${calc.previous.wind}</li><li>Precipitation: ${calc.previous.precip}</li><li>Humidity: ${calc.previous.humid}</li></ul>`
        : ""
    }<h4>Random Factors (Variability: ${
      calc.variability
    })</h4><ul><li>Temperature: ${calc.randomFactors.temp.toFixed(
      2
    )}</li><li>Wind: ${calc.randomFactors.wind.toFixed(
      2
    )}</li><li>Precipitation: ${calc.randomFactors.precip.toFixed(
      2
    )}</li><li>Humidity: ${calc.randomFactors.humid.toFixed(
      2
    )}</li></ul><h4>Time Modifiers (${
      calc.timePeriod
    })</h4><ul><li>Temperature: ${
      calc.timeModifiers.temperature || 0
    }</li><li>Wind: ${calc.timeModifiers.wind || 0}</li><li>Precipitation: ${
      calc.timeModifiers.precipitation || 0
    }</li><li>Humidity: ${
      calc.timeModifiers.humidity || 0
    }</li></ul><h4>Season Modifiers (${calc.season})</h4><ul><li>Temperature: ${
      calc.seasonModifiers.temperature || 0
    }</li><li>Wind: ${calc.seasonModifiers.wind || 0}</li><li>Precipitation: ${
      calc.seasonModifiers.precipitation || 0
    }</li><li>Humidity: ${
      calc.seasonModifiers.humidity || 0
    }</li></ul><h4>Intermediate Values (After Random)</h4><ul><li>Temperature: ${
      calc.intermediate.temp
    }</li><li>Wind: ${calc.intermediate.wind}</li><li>Precipitation: ${
      calc.intermediate.precip
    }</li><li>Humidity: ${
      calc.intermediate.humid
    }</li></ul><h4>Final Values (After Modifiers)</h4><ul><li>Temperature: ${
      calc.final.temp
    }</li><li>Wind: ${calc.final.wind}</li><li>Precipitation: ${
      calc.final.precip
    }</li><li>Humidity: ${calc.final.humid}</li></ul></div>`;

    return this.commandHandler.createSuccessResponse(details, {
      whisper: ChatMessage.getWhisperRecipients("GM"),
    });
  }

  /**
   * Handle the help command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleHelpCommand(args) {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the GM can access the detailed help menu.");
      return this.commandHandler.createSuccessResponse(
        "Basic commands:\n/weather - Show current weather\n/weather help - Show this help message"
      );
    }

    return this.commandHandler.createSuccessResponse(this.api.getHelpText());
  }

  /**
   * Handle the settings command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleSettingsCommand(args) {
    // Open settings with module filter
    const app = new game.settings.menus.get("core.moduleSettings");
    if (app) {
      const options = { filterModule: "dimensional-weather" };
      app.render(true, options);
    } else {
      // Fallback to basic settings
      const settings = new SettingsConfig();
      settings.render(true);
    }

    return this.commandHandler.createSuccessResponse(
      "Opening weather settings panel...",
      { whisper: [game.user.id] }
    );
  }

  /**
   * Handle the debug command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleDebugCommand(args) {
    // Toggle debug mode using the global setting
    const currentDebug = Settings.getSetting("debugTimePeriod");
    await Settings.updateSetting("debugTimePeriod", !currentDebug);

    return this.commandHandler.createSuccessResponse(
      `Time period debug logging ${!currentDebug ? "enabled" : "disabled"}.`,
      { whisper: [game.user.id] }
    );
  }

  /**
   * Handle the terrains command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async handleTerrainsCommand(args) {
    const terrains = Object.entries(this.api.settingsData.terrains)
      .map(([key, terrain]) => `${terrain.name} (${key})`)
      .join("\n");

    return this.commandHandler.createSuccessResponse(
      `Available Terrains for ${this.api.settingsData.name}:\n${terrains}`
    );
  }

  /**
   * Process a weather command
   * @param {string} parameters - Command parameters
   * @returns {Promise<Object>} Command result
   */
  async processCommand(parameters) {
    try {
      if (!this.api.initialized) {
        await this.api.initialize();
      }

      // If no parameters, just display current weather
      if (!parameters) {
        await this.api.displayWeather();
        return;
      }

      const args = parameters.split(" ");
      const subcommand = args[0]?.toLowerCase();

      return await this.commandHandler.handleCommand(subcommand, args);
    } catch (error) {
      ErrorHandler.logAndNotify("Error processing weather command", error);
      return this.commandHandler.createErrorResponse(
        "An error occurred while processing the weather command."
      );
    }
  }
}
