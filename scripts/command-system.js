/**
 * Dimensional Weather - Unified Command System
 * Provides a centralized way to handle all weather-related commands
 */

import { Settings } from "./settings.js";
import { ErrorHandler, DebugLogger } from "./utils.js";
import { SceneManager } from "./scene-manager.js";

export class WeatherCommandSystem {
  /**
   * Create a new Weather Command System
   * @param {DimensionalWeatherAPI} api - The API instance
   */
  constructor(api) {
    this.api = api;
    this.commands = new Map();
    this.defaultCommand = null;
  }

  /**
   * Register all commands with chat system and internal handlers
   */
  register() {
    // Register with chat command library if available
    this._registerWithChatCommandLib();
    
    // Register internal command handlers
    this._registerInternalCommands();
  }

  /**
   * Register with the Chat Commands library
   * @private
   */
  _registerWithChatCommandLib() {
    if (!game.chatCommands) {
      DebugLogger.warn("Chat Commands module not found, only slash commands will be available");
      return;
    }

    // Register weather command
    game.chatCommands.register({
      name: "weather",
      module: "dimensional-weather",
      description: "Display current weather conditions",
      icon: "<i class='fas fa-cloud-sun'></i>",
      requiredRole: "NONE",
      aliases: ["/weather", "weather"],
      callback: (chat, parameters, messageData) => 
        this._handleChatCommand(chat, parameters, messageData),
      autocompleteCallback: (menu, alias, parameters) =>
        this._autocompleteCommand(menu, alias, parameters),
      closeOnComplete: true,
    });

    // Register date command for GMs
    game.chatCommands.register({
      name: "date",
      module: "dimensional-weather",
      description: "Display calendar information (GM only)",
      icon: "<i class='fas fa-calendar'></i>",
      requiredRole: "GAMEMASTER",
      aliases: ["/date", "date"],
      callback: (chat, parameters, messageData) =>
        this._handleDateCommand(chat, parameters, messageData),
      autocompleteCallback: (menu, alias, parameters) => {
        return [
          game.chatCommands.createInfoElement(
            "Display current calendar information."
          ),
        ];
      },
      closeOnComplete: true,
    });

    DebugLogger.info("Chat commands registered");
  }

  /**
   * Register internal command handlers
   * @private
   */
  _registerInternalCommands() {
    // Default command - display current weather
    this.defaultCommand = async (args, options) => {
      await this.api.displayWeather();
      return this._createSuccessResponse("Weather displayed.");
    };

    // Register update command
    this._registerCommand("update", this._handleUpdateCommand.bind(this), {
      requiresGM: true,
      description: "Force a weather update",
    });

    // Register version command
    this._registerCommand("version", this._handleVersionCommand.bind(this), {
      description: "Display weather system version information",
    });

    // Register terrain command
    this._registerCommand("terrain", this._handleTerrainCommand.bind(this), {
      requiresGM: true,
      requiresArgs: true,
      validateArgs: (args) => {
        if (args.length < 2) {
          return "Please specify a terrain type. Use /weather help for available options.";
        }
        return true;
      },
      description: "Change the current terrain type",
    });

    // Register season command
    this._registerCommand("season", this._handleSeasonCommand.bind(this), {
      requiresGM: true,
      requiresArgs: true,
      validateArgs: (args) => {
        if (args.length < 2) {
          return "Please specify a season. Use /weather help for available options.";
        }
        return true;
      },
      description: "Change the current season",
    });

    // Register random command
    this._registerCommand("random", this._handleRandomCommand.bind(this), {
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
    });

    // Register stats command
    this._registerCommand("stats", this._handleStatsCommand.bind(this), {
      requiresGM: true,
      description: "Display weather statistics",
    });

    // Register forecast command
    this._registerCommand("forecast", this._handleForecastCommand.bind(this), {
      requiresGM: true,
      description: "Display weather forecast",
    });

    // Register calc command
    this._registerCommand("calc", this._handleCalcCommand.bind(this), {
      requiresGM: true,
      description: "Display weather calculation details",
    });

    // Register help command
    this._registerCommand("help", this._handleHelpCommand.bind(this), {
      description: "Display help information",
    });

    // Register settings command
    this._registerCommand("settings", this._handleSettingsCommand.bind(this), {
      requiresGM: true,
      description: "Open weather settings panel",
    });

    // Register debug command
    this._registerCommand("debug", this._handleDebugCommand.bind(this), {
      requiresGM: true,
      description: "Toggle time period debug logging",
    });

    // Register terrains command
    this._registerCommand("terrains", this._handleTerrainsCommand.bind(this), {
      description: "List available terrains",
    });

    DebugLogger.info("Internal commands registered");
  }

  /**
   * Register a command with validation
   * @private
   * @param {string} name - Command name
   * @param {Function} handler - Command handler function
   * @param {Object} options - Command options
   */
  _registerCommand(name, handler, options = {}) {
    this.commands.set(name, {
      handler,
      requiresGM: options.requiresGM || false,
      requiresArgs: options.requiresArgs || false,
      validateArgs: options.validateArgs || null,
      description: options.description || "",
    });
  }

  /**
   * Process a command from slash commands
   * @param {string} parameters - Command string (without /weather)
   * @returns {Promise<Object|void>} Command result
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

      return await this.handleCommand(subcommand, args);
    } catch (error) {
      ErrorHandler.logAndNotify("Error processing weather command", error);
      return this._createErrorResponse(
        "An error occurred while processing the weather command."
      );
    }
  }

  /**
   * Handle a command from any source
   * @param {string} command - Command name 
   * @param {string[]} args - Command arguments
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Command result
   */
  async handleCommand(command, args = [], options = {}) {
    try {
      // Ensure API is initialized
      if (!this.api.initialized) {
        await this.api.initialize();
      }

      // Check if the command exists
      const commandInfo = this.commands.get(command);
      if (!commandInfo) {
        if (this.defaultCommand) {
          return await this.defaultCommand(args, options);
        }
        return this._createErrorResponse(`Unknown command: ${command}`);
      }

      // Check if the command requires GM privileges
      if (commandInfo.requiresGM && !game.user.isGM) {
        ui.notifications.warn("Only the GM can use this command.");
        return this._createErrorResponse("Only the GM can use this command.");
      }

      // Check if the command requires arguments
      if (commandInfo.requiresArgs && (!args || args.length <= 1)) {
        return this._createErrorResponse(
          `Command '${command}' requires additional arguments.`
        );
      }

      // Validate arguments if a validator is provided
      if (commandInfo.validateArgs) {
        const validationResult = commandInfo.validateArgs(args);
        if (validationResult !== true) {
          return this._createErrorResponse(validationResult);
        }
      }

      // Execute the command handler
      return await commandInfo.handler(args, options);
    } catch (error) {
      ErrorHandler.logAndNotify(`Error processing command: ${command}`, error);
      return this._createErrorResponse(
        `An error occurred while processing the command: ${error.message}`
      );
    }
  }

  /**
   * Handle commands from chat
   * @private
   * @param {ChatMessage} chat - Chat message
   * @param {string} parameters - Command parameters
   * @param {Object} messageData - Message data
   * @returns {Promise<Object|void>} Message data or void
   */
  async _handleChatCommand(chat, parameters, messageData) {
    try {
      // If no parameters, just display current weather
      if (!parameters) {
        await this.api.displayWeather();
        return;
      }

      const args = parameters.split(" ");
      const subcommand = args[0]?.toLowerCase();

      // Version command is available to all users
      if (subcommand === "version" || subcommand === "v") {
        return await this._handleVersionCommand(args);
      }

      // Only allow GMs to use most commands
      if (!game.user.isGM && subcommand !== "help") {
        ui.notifications.warn("Only the GM can modify weather conditions.");
        await this.api.displayWeather();
        return;
      }

      return await this.handleCommand(subcommand, args, { fromChat: true });
    } catch (error) {
      ErrorHandler.logAndNotify("Error processing weather command", error);
      return this._createErrorResponse(
        "An error occurred while processing the weather command."
      );
    }
  }

  /**
   * Create a success response
   * @private
   * @param {string} content - Response content
   * @param {Object} options - Response options
   * @returns {Object} Response object
   */
  _createSuccessResponse(content, options = {}) {
    return {
      content,
      speaker: { alias: options.speaker || "Dimensional Weather" },
      whisper: options.whisper || null,
    };
  }

  /**
   * Create an error response
   * @private
   * @param {string} message - Error message
   * @param {Object} options - Response options
   * @returns {Object} Response object
   */
  _createErrorResponse(message, options = {}) {
    return {
      content: message,
      speaker: { alias: options.speaker || "Dimensional Weather" },
      whisper: options.whisper || [game.user.id],
    };
  }

  /**
   * Get all registered commands
   * @returns {Array} Array of command information
   */
  getCommands() {
    const result = [];
    for (const [name, info] of this.commands.entries()) {
      result.push({
        name,
        description: info.description,
        requiresGM: info.requiresGM,
        requiresArgs: info.requiresArgs,
      });
    }
    return result;
  }

  /**
   * Provide autocomplete suggestions for the /weather command
   * @private
   * @param {Object} menu - Autocomplete menu
   * @param {string} alias - Command alias
   * @param {string} parameters - Current parameters
   * @returns {Array} Autocomplete suggestions
   */
  _autocompleteCommand(menu, alias, parameters) {
    try {
      if (!this.api?.settingsData?.terrains) {
        return [
          game.chatCommands.createInfoElement(
            "Weather system not initialized. Please wait a moment and try again."
          ),
        ];
      }

      // Define available subcommands
      const subcommands = Array.from(this.commands.entries())
        .map(([cmd, info]) => ({
          cmd,
          desc: info.description,
          gmOnly: info.requiresGM
        }))
        .filter((cmd) => !cmd.gmOnly || game.user.isGM);

      // If no parameters, show all available commands
      if (!parameters || parameters === "") {
        return [
          game.chatCommands.createCommandElement(
            alias,
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
      if (args[0] === "terrain" || (args[0] && "terrain".startsWith(args[0]))) {
        return this._autocompleteTerrainCommand(alias, args);
      }

      // Handle season subcommand
      if (args[0] === "season" || (args[0] && "season".startsWith(args[0]))) {
        return this._autocompleteSeasonCommand(alias, args);
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
      console.error("Dimensional Weather | Error in autocomplete:", error);
      return [];
    }
  }

  /**
   * Provide autocomplete suggestions for the terrain subcommand
   * @private
   * @param {string} alias - Command alias
   * @param {string[]} args - Command arguments
   * @returns {Array} Autocomplete suggestions
   */
  _autocompleteTerrainCommand(alias, args) {
    // If just "terrain" or partial match, show all terrains
    if (args.length === 1) {
      return Object.entries(this.api.settingsData.terrains)
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
      return Object.entries(this.api.settingsData.terrains)
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

    return [];
  }

  /**
   * Provide autocomplete suggestions for the season subcommand
   * @private
   * @param {string} alias - Command alias
   * @param {string[]} args - Command arguments
   * @returns {Array} Autocomplete suggestions
   */
  _autocompleteSeasonCommand(alias, args) {
    // If just "season" or partial match, show all seasons
    if (args.length === 1) {
      return Object.entries(this.api.settingsData.seasons)
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
      return Object.entries(this.api.settingsData.seasons)
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

    return [];
  }

  /**
   * Handle the date command
   * @private
   * @param {ChatMessage} chat - Chat message
   * @param {string} parameters - Command parameters
   * @param {Object} messageData - Message data
   * @returns {Promise<Object|void>} Message data or void
   */
  async _handleDateCommand(chat, parameters, messageData) {
    try {
      if (!this.api.initialized) {
        await this.api.initialize();
      }

      const calendarInfo = this.api.ui.getCalendarInfo();

      return this._createSuccessResponse(calendarInfo, {
        whisper: [game.user.id],
      });
    } catch (error) {
      ErrorHandler.logAndNotify("Error displaying calendar information", error);
      return this._createErrorResponse(
        "An error occurred while displaying calendar information.",
        { whisper: [game.user.id] }
      );
    }
  }

  // Command handlers
  
  /**
   * Handle the update command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async _handleUpdateCommand(args) {
    await this.api.updateWeather();
    return this._createSuccessResponse("Weather updated.", {
      whisper: [game.user.id],
    });
  }

  /**
   * Handle the version command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async _handleVersionCommand(args) {
    if (!this.api.settingsData) {
      return this._createErrorResponse(
        "Weather system not initialized or settings not loaded."
      );
    }

    return this._createSuccessResponse(
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
   * Handle the terrain command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async _handleTerrainCommand(args) {
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

        return this._createSuccessResponse(
          `Terrain has been set to ${displayName}`,
          { whisper: [game.user.id] }
        );
      } else {
        return this._createErrorResponse(
          `Failed to set terrain to ${terrainInput}`,
          { whisper: [game.user.id] }
        );
      }
    } else {
      return this._createErrorResponse(
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
  async _handleSeasonCommand(args) {
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
      return this._createErrorResponse(
        `Invalid season: ${seasonName}. Use /weather help for available options.`,
        { whisper: [game.user.id] }
      );
    }

    const success = await this.api.setSeason(seasonKey);

    if (success) {
      // Format the season name
      const formattedSeason = this.api.settingsData.seasons[seasonKey].name;

      return this._createSuccessResponse(
        `Season has been set to ${formattedSeason}`,
        { whisper: [game.user.id] }
      );
    } else {
      return this._createErrorResponse(
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
  async _handleRandomCommand(args) {
    const value = parseInt(args[1]);
    const success = await this.api.setVariability(value);

    if (success) {
      return this._createSuccessResponse(
        `Weather variability set to ${value}. Use /weather update to apply changes.`,
        { whisper: [game.user.id] }
      );
    } else {
      return this._createErrorResponse(
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
  async _handleStatsCommand(args) {
    const scene = game.scenes.viewed;
    if (!scene?.id) {
      return this._createErrorResponse("No active scene.", {
        whisper: ChatMessage.getWhisperRecipients("GM"),
      });
    }

    const weatherState = scene.getFlag("dimensional-weather", "weatherState");
    if (!weatherState) {
      return this._createErrorResponse(
        "No weather state found for current scene.",
        { whisper: ChatMessage.getWhisperRecipients("GM") }
      );
    }

    const terrain = this.api.settingsData.terrains[weatherState.terrain];
    const season = this.api.settingsData.seasons[weatherState.season];

    return this._createSuccessResponse(
      `<div class="weather-report">
        <h3>SCENE WEATHER STATS</h3>
        <h4>Current State</h4>
        <ul>
          <li>Terrain: ${terrain.name}</li>
          <li>Season: ${season.name}</li>
          <li>Variability: ${weatherState.variability || Settings.getSetting("variability")}</li>
        </ul>
        <h4>Base Values</h4>
        <ul>
          <li>Temperature: ${terrain.temperature}</li>
          <li>Wind: ${terrain.wind}</li>
          <li>Precipitation: ${terrain.precipitation}</li>
          <li>Humidity: ${terrain.humidity}</li>
        </ul>
      </div>`,
      { whisper: ChatMessage.getWhisperRecipients("GM") }
    );
  }

  /**
   * Handle the forecast command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async _handleForecastCommand(args) {
    const forecast = await this.api.generateForecast();
    return this._createSuccessResponse(forecast, {
      whisper: ChatMessage.getWhisperRecipients("GM"),
    });
  }

  /**
   * Handle the calc command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async _handleCalcCommand(args) {
    const calc = this.api.engine.getLastCalculation();
    if (!calc) {
      return this._createErrorResponse(
        "No weather calculation data available.",
        { whisper: ChatMessage.getWhisperRecipients("GM") }
      );
    }

    const details = `<div class="weather-report">
      <h3>WEATHER CALCULATION DETAILS</h3>
      <h4>Base Values (${calc.terrain.name})</h4>
      <ul>
        <li>Temperature: ${calc.terrain.baseTemp}</li>
        <li>Wind: ${calc.terrain.baseWind}</li>
        <li>Precipitation: ${calc.terrain.basePrecip}</li>
        <li>Humidity: ${calc.terrain.baseHumid}</li>
      </ul>
      ${
        calc.previous
          ? `<h4>Previous Values</h4>
      <ul>
        <li>Temperature: ${calc.previous.temp}</li>
        <li>Wind: ${calc.previous.wind}</li>
        <li>Precipitation: ${calc.previous.precip}</li>
        <li>Humidity: ${calc.previous.humid}</li>
      </ul>`
          : ""
      }
      <h4>Random Factors (Variability: ${calc.variability})</h4>
      <ul>
        <li>Temperature: ${calc.randomFactors.temp.toFixed(2)}</li>
        <li>Wind: ${calc.randomFactors.wind.toFixed(2)}</li>
        <li>Precipitation: ${calc.randomFactors.precip.toFixed(2)}</li>
        <li>Humidity: ${calc.randomFactors.humid.toFixed(2)}</li>
      </ul>
      <h4>Time Modifiers (${calc.timePeriod})</h4>
      <ul>
        <li>Temperature: ${calc.timeModifiers.temperature || 0}</li>
        <li>Wind: ${calc.timeModifiers.wind || 0}</li>
        <li>Precipitation: ${calc.timeModifiers.precipitation || 0}</li>
        <li>Humidity: ${calc.timeModifiers.humidity || 0}</li>
      </ul>
      <h4>Season Modifiers (${calc.season})</h4>
      <ul>
        <li>Temperature: ${calc.seasonModifiers.temperature || 0}</li>
        <li>Wind: ${calc.seasonModifiers.wind || 0}</li>
        <li>Precipitation: ${calc.seasonModifiers.precipitation || 0}</li>
        <li>Humidity: ${calc.seasonModifiers.humidity || 0}</li>
      </ul>
      <h4>Intermediate Values (After Random)</h4>
      <ul>
        <li>Temperature: ${calc.intermediate.temp}</li>
        <li>Wind: ${calc.intermediate.wind}</li>
        <li>Precipitation: ${calc.intermediate.precip}</li>
        <li>Humidity: ${calc.intermediate.humid}</li>
      </ul>
      <h4>Final Values (After Modifiers)</h4>
      <ul>
        <li>Temperature: ${calc.final.temp}</li>
        <li>Wind: ${calc.final.wind}</li>
        <li>Precipitation: ${calc.final.precip}</li>
        <li>Humidity: ${calc.final.humid}</li>
      </ul>
    </div>`;

    return this._createSuccessResponse(details, {
      whisper: ChatMessage.getWhisperRecipients("GM"),
    });
  }

  /**
   * Handle the help command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async _handleHelpCommand(args) {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the GM can access the detailed help menu.");
      return this._createSuccessResponse(
        "Basic commands:\n/weather - Show current weather\n/weather help - Show this help message"
      );
    }

    return this._createSuccessResponse(this.api.getHelpText());
  }

  /**
   * Handle the settings command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async _handleSettingsCommand(args) {
    // Open settings with module filter
    const app = game.settings.menus.get("core.moduleSettings");
    if (app) {
      const options = { filterModule: "dimensional-weather" };
      app.render(true, options);
    } else {
      // Fallback to basic settings
      const settings = new SettingsConfig();
      settings.render(true);
    }

    return this._createSuccessResponse(
      "Opening weather settings panel...",
      { whisper: [game.user.id] }
    );
  }

  /**
   * Handle the debug command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async _handleDebugCommand(args) {
    // Toggle debug mode using the global setting
    const currentDebug = Settings.getSetting("debugTimePeriod");
    await Settings.updateSetting("debugTimePeriod", !currentDebug);

    return this._createSuccessResponse(
      `Time period debug logging ${!currentDebug ? "enabled" : "disabled"}.`,
      { whisper: [game.user.id] }
    );
  }

  /**
   * Handle the terrains command
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Command result
   */
  async _handleTerrainsCommand(args) {
    const terrains = Object.entries(this.api.settingsData.terrains)
      .map(([key, terrain]) => `${terrain.name} (${key})`)
      .join("\n");

    return this._createSuccessResponse(
      `Available Terrains for ${this.api.settingsData.name}:\n${terrains}`
    );
  }
}