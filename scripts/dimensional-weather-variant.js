/**
 * Dimensional Weather - Main Entry Point
 * A modular weather system for FoundryVTT
 */

import { DimensionalWeatherSettings } from "./modules/settings.js";
import { DimensionalWeatherCore } from "./modules/weather.js";
import { DimensionalWeatherCalendar } from "./modules/calendar.js";
import { DimensionalWeatherTerrain } from "./modules/terrain.js";
import { DimensionalWeatherSeason } from "./modules/season.js";
import { DimensionalWeatherChat } from "./modules/chat.js";
import {
  safeFetch,
  updateSceneFlag,
  formatDisplayName,
} from "./modules/utils.js";

class DimensionalWeather {
  constructor() {
    this.settings = new DimensionalWeatherSettings();
    this.weather = new DimensionalWeatherCore(this);
    this.calendar = new DimensionalWeatherCalendar(this);
    this.terrain = new DimensionalWeatherTerrain(this);
    this.season = new DimensionalWeatherSeason(this);
    this.chat = new DimensionalWeatherChat(this);
  }

  /**
   * Initialize the module
   */
  async initialize() {
    // Register settings first
    this.settings.registerSettings();

    // Then load campaign settings
    await this.settings.loadCampaignSettings();

    // Initialize weather
    await this.weather.loadSettings();
    await this.weather.initWeather();
  }
}

// Initialize the module
Hooks.once("init", () => {
  game.dimWeather = new DimensionalWeather();
});

// Initialize after game is ready
Hooks.once("ready", async () => {
  if (game.dimWeather) {
    await game.dimWeather.initialize();
  }
});

// Register chat commands with Foundry's built-in system
Hooks.on("chatCommandsReady", (commands) => {
  if (game.dimWeather) {
    game.dimWeather.chat.registerCommands(commands);
  }
});

// Register chat commands with Chat Commander if available
Hooks.on("chatCommanderReady", (commands) => {
  if (game.dimWeather && game.modules.get("_chatcommands")?.active) {
    game.dimWeather.chat.registerCommands(commands);
  }
});
