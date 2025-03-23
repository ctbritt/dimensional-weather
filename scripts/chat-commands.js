/**
 * Dimensional Weather - Chat Commands
 * Handles registration and processing of chat commands
 */

import { ErrorHandler } from "./utils.js";
import { Settings } from "./settings.js";
import { SettingsPanel } from "./settings-panel.js";

export class ChatCommands {
  /**
   * Initialize chat commands
   * @param {DimensionalWeatherAPI} api - Main module API
   */
  constructor(api) {
    this.api = api;
  }

  /**
   * Register all chat commands
   */
  register() {
    if (!game.chatCommands) {
      console.warn(
        "Dimensional Weather | Chat Commands module not found, commands will not be registered"
      );
      return;
    }

    this._registerWeatherCommand();
    this._registerDateCommand();
  }

  /**
   * Register the main weather command
   * @private
   */
  _registerWeatherCommand() {
    game.chatCommands.register({
      name: "weather",
      module: "dimensional-weather",
      description: "Display current weather conditions",
      icon: "<i class='fas fa-cloud-sun'></i>",
      requiredRole: "NONE",
      aliases: ["/weather", "weather"],
      callback: (chat, parameters, messageData) =>
        this._handleWeatherCommand(chat, parameters, messageData),
      autocompleteCallback: (menu, alias, parameters) =>
        this._autocompleteWeatherCommand(menu, alias, parameters),
      closeOnComplete: true,
    });
  }

  /**
   * Register the date command
   * @private
   */
  _registerDateCommand() {
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
  }

  /**
   * Handle the /weather command
   * @private
   * @param {ChatMessage} chat - Chat message
   * @param {string} parameters - Command parameters
   * @param {Object} messageData - Message data
   * @returns {Promise<Object|void>} Message data or void
   */
  async _handleWeatherCommand(chat, parameters, messageData) {
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

      // Handle version command first since it's available to all users
      if (subcommand === "version" || subcommand === "v") {
        if (!this.api.settingsData) {
          return {
            content: "Weather system not initialized or settings not loaded.",
            speaker: { alias: "Dimensional Weather" },
          };
        }

        return {
          content: `Weather System Info:<br>
            Name: ${this.api.settingsData.name}<br>
            Description: ${this.api.settingsData.description}`,
          speaker: { alias: "Dimensional Weather" },
        };
      }

      // Handle campaign command - available to GMs only
      if (subcommand === "campaign") {
        return await this._handleCampaignCommand(args);
      }

      // Only allow GMs to use other subcommands
      if (!game.user.isGM) {
        ui.notifications.warn("Only the GM can modify weather conditions.");
        await this.api.displayWeather();
        return;
      }

      switch (subcommand) {
        case "terrain":
          return await this._handleTerrainCommand(args);

        case "season":
          return await this._handleSeasonCommand(args);

        case "update":
          await this.api.updateWeather();
          await this.api.displayWeather();
          break;

        case "random":
          return await this._handleRandomCommand(args);

        case "stats":
          return await this._handleStatsCommand();

        case "forecast":
          const forecast = await this.api.displayForecast();
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
            content: this.api.getHelpText(),
            speaker: { alias: "Dimensional Weather" },
          };

        case "settings":
          if (!game.user.isGM) {
            ui.notifications.warn("Only the GM can access weather settings.");
            return;
          }
          game.dimWeatherSettings.render(true);
          return {
            content: "Opening weather settings panel...",
            speaker: { alias: "Dimensional Weather" },
            whisper: [game.user.id],
          };

        case "debug":
          if (!game.user.isGM) {
            ui.notifications.warn("Only the GM can toggle debug mode.");
            return;
          }

          // Toggle debug mode using the global setting
          const currentDebug = Settings.getSetting("debugTimePeriod");
          await Settings.updateSetting("debugTimePeriod", !currentDebug);

          return {
            content: `Time period debug logging ${
              !currentDebug ? "enabled" : "disabled"
            }.`,
            speaker: { alias: "Dimensional Weather" },
            whisper: [game.user.id],
          };

        case "terrains":
          const terrains = Object.entries(this.api.settingsData.terrains)
            .map(([key, terrain]) => `${terrain.name} (${key})`)
            .join("\n");

          return {
            content: `Available Terrains for ${this.api.settingsData.name}:\n${terrains}`,
            speaker: { alias: "Dimensional Weather" },
          };

        default:
          return {
            content:
              "Invalid subcommand. Use /weather help for available options.",
            speaker: { alias: "Dimensional Weather" },
            whisper: [game.user.id],
          };
      }
    } catch (error) {
      ErrorHandler.logAndNotify("Error processing weather command", error);
      return {
        content: "An error occurred while processing the weather command.",
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
    }
  }

  /**
   * Handle the /date command
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

      return {
        content: calendarInfo,
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
    } catch (error) {
      ErrorHandler.logAndNotify("Error displaying calendar information", error);
      return {
        content: "An error occurred while displaying calendar information.",
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
    }
  }

  /**
   * Handle the campaign subcommand
   * @private
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Message data
   */
  async _handleCampaignCommand(args) {
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
    const settingsIndex = await Settings.loadSettingsIndex();

    if (!settingsIndex) {
      return {
        content: "Failed to load settings index.",
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
    }

    const setting = settingsIndex.campaignSettings.find(
      (s) => s.id.toLowerCase() === settingId
    );

    if (!setting) {
      ui.notifications.warn(
        `Invalid campaign setting: ${settingId}. Use /weather help for available options.`
      );
      return;
    }

    // Update the campaign setting
    this.api.isChatCommand = true;
    try {
      // Update the campaign setting
      const success = await this.api.updateCampaignSetting(setting.id);

      if (!success) {
        return {
          content: `Failed to update campaign setting to ${setting.name}.`,
          speaker: { alias: "Dimensional Weather" },
          whisper: [game.user.id],
        };
      }

      return {
        content: `Campaign setting changed to ${setting.name}.`,
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
    } finally {
      // Always reset the chat command flag
      this.api.isChatCommand = false;
    }
  }

  /**
   * Handle the terrain subcommand
   * @private
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Message data
   */
  async _handleTerrainCommand(args) {
    if (args.length < 2) {
      ui.notifications.warn(
        "Please specify a terrain type. Use /weather help for available options."
      );
      return;
    }

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

        return {
          content: `Terrain has been set to ${displayName}`,
          speaker: { alias: "Dimensional Weather" },
          whisper: [game.user.id],
        };
      } else {
        return {
          content: `Failed to set terrain to ${terrainInput}`,
          speaker: { alias: "Dimensional Weather" },
          whisper: [game.user.id],
        };
      }
    } else {
      ui.notifications.warn(
        `Invalid terrain type: ${terrainInput}. Use /weather help for available options.`
      );
      return {
        content: `Invalid terrain type: ${terrainInput}. Use /weather help for available options.`,
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
    }
  }

  /**
   * Handle the season subcommand
   * @private
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Message data
   */
  async _handleSeasonCommand(args) {
    if (args.length < 2) {
      ui.notifications.warn(
        "Please specify a season. Use /weather season help for available options."
      );
      return;
    }

    // Check if Simple Calendar integration is enabled
    if (Settings.isSimpleCalendarEnabled()) {
      return {
        content:
          "Turn off Simple Calendar integration to manually change seasons.",
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
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
      ui.notifications.warn(
        `Invalid season: ${seasonName}. Use /weather season help for available options.`
      );
      return;
    }

    const success = await this.api.setSeason(seasonKey);

    if (success) {
      // Format the season name
      const formattedSeason = this.api.settingsData.seasons[seasonKey].name;

      return {
        content: `Season has been set to ${formattedSeason}`,
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
    } else {
      return {
        content: `Failed to set season to ${seasonName}`,
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
    }
  }

  /**
   * Handle the random subcommand
   * @private
   * @param {string[]} args - Command arguments
   * @returns {Promise<Object>} Message data
   */
  async _handleRandomCommand(args) {
    if (args.length < 2) {
      ui.notifications.warn("Please specify a value between 0 and 10.");
      return;
    }

    const value = parseInt(args[1]);
    if (isNaN(value) || value < 0 || value > 10) {
      ui.notifications.warn("Variability must be a number between 0 and 10.");
      return;
    }

    const success = await this.api.setVariability(value);

    if (success) {
      return {
        content: `Weather variability set to ${value}. Use /weather update to apply changes.`,
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
    } else {
      return {
        content: `Failed to set variability to ${value}`,
        speaker: { alias: "Dimensional Weather" },
        whisper: [game.user.id],
      };
    }
  }

  /**
   * Handle the stats subcommand
   * @private
   * @returns {Promise<Object>} Message data
   */
  async _handleStatsCommand() {
    const stats = this.api.getWeatherStats();

    return {
      content: `Weather Statistics (GM Only):\n${JSON.stringify(
        stats,
        null,
        2
      )}`,
      speaker: { alias: "Dimensional Weather" },
      whisper: [game.user.id],
    };
  }

  /**
   * Provide autocomplete suggestions for the /weather command
   * @private
   * @param {Object} menu - Autocomplete menu
   * @param {string} alias - Command alias
   * @param {string} parameters - Current parameters
   * @returns {Array} Autocomplete suggestions
   */
  _autocompleteWeatherCommand(menu, alias, parameters) {
    try {
      if (!this.api?.settingsData?.terrains) {
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

      // Handle campaign subcommand
      if (
        args[0] === "campaign" ||
        (args[0] && "campaign".startsWith(args[0]))
      ) {
        return this._autocompleteCampaignCommand(alias, args);
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
   * Provide autocomplete suggestions for the campaign subcommand
   * @private
   * @param {string} alias - Command alias
   * @param {string[]} args - Command arguments
   * @returns {Promise<Array>} Autocomplete suggestions
   */
  async _autocompleteCampaignCommand(alias, args) {
    if (!game.user.isGM) {
      return [
        game.chatCommands.createInfoElement(
          "Only GMs can change campaign settings."
        ),
      ];
    }

    // Load settings index
    const settingsIndex = await Settings.loadSettingsIndex();

    if (!settingsIndex) {
      return [
        game.chatCommands.createInfoElement(
          "Failed to load campaign settings."
        ),
      ];
    }

    // If just "campaign" or partial match, show all settings
    if (args.length === 1) {
      return settingsIndex.campaignSettings.map((setting) =>
        game.chatCommands.createCommandElement(
          `${alias} campaign ${setting.id}`,
          `Change to ${setting.name} campaign setting`
        )
      );
    }

    // If we have a partial setting name, filter matches
    if (args.length === 2) {
      const partial = args[1].toLowerCase();
      return settingsIndex.campaignSettings
        .filter((setting) => setting.id.toLowerCase().startsWith(partial))
        .map((setting) =>
          game.chatCommands.createCommandElement(
            `${alias} campaign ${setting.id}`,
            `Change to ${setting.name} campaign setting`
          )
        );
    }

    return [];
  }
}
