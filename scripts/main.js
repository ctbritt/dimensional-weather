/**
 * Dimensional Weather - Main Module
 * Entry point for the Dimensional Weather system
 */

import { Settings } from "./settings.js";
import { DimensionalWeatherAPI } from "./api.js";
import { ChatCommands } from "./chat-commands.js";
import { ErrorHandler } from "./utils.js";
import { WeatherCommands } from "./weather-commands.js";

// Module constants
const MODULE_ID = "dimensional-weather";
const MODULE_TITLE = "Dimensional Weather";

// Module state
let weatherCommands;
let initialized = false;

/**
 * Initialize the module
 * @returns {Promise<void>}
 */
async function initializeModule() {
  if (initialized) return;

  try {
    // Register settings first
    await Settings.register(onCampaignChange);

    // Register global module API
    game.dimWeather = new DimensionalWeatherAPI();
    await game.dimWeather.initialize();

    // Initialize weather commands
    weatherCommands = new WeatherCommands(game.dimWeather);

    // Register chat commands
    const commands = new ChatCommands(game.dimWeather);
    commands.register();

    initialized = true;
    console.log(`${MODULE_TITLE} | Module initialized successfully`);
  } catch (error) {
    ErrorHandler.logAndNotify(
      `Failed to initialize ${MODULE_TITLE} module`,
      error
    );
  }
}

/**
 * Initialize or update weather for the current scene
 * @param {boolean} forceUpdate - Whether to force a weather update
 * @returns {Promise<void>}
 */
async function handleSceneWeather(forceUpdate = false) {
  if (!initialized) return;

  const scene = game.scenes.viewed;
  if (!scene?.id) return;

  try {
    // Initialize weather for the scene if needed
    await game.dimWeather.engine.initializeWeather(scene);

    // Update weather if auto-update is enabled or force update is requested
    if (forceUpdate || Settings.getSetting("autoUpdate")) {
      await game.dimWeather.updateWeather();
      await game.dimWeather.displayWeather();
    }
  } catch (error) {
    ErrorHandler.logAndNotify(
      `Failed to handle weather for scene`,
      error,
      true
    );
  }
}

/**
 * Check if weather update is needed based on time
 * @returns {Promise<void>}
 */
async function checkTimeBasedUpdate() {
  if (!initialized || !Settings.getSetting("autoUpdate")) return;

  const scene = game.scenes.viewed;
  if (!scene?.id) return;

  const weatherState = scene.getFlag(MODULE_ID, "weatherState");
  if (!weatherState) return;

  const updateFrequency = Settings.getSetting("updateFrequency");
  const lastUpdateTime = weatherState.lastUpdate || 0;
  const currentTime = SimpleCalendar?.api
    ? SimpleCalendar.api.timestamp()
    : Date.now();
  const hoursSinceLastUpdate = (currentTime - lastUpdateTime) / 3600;

  if (hoursSinceLastUpdate >= updateFrequency) {
    console.log(`${MODULE_TITLE} | Time-based weather update triggered`);
    await game.dimWeather.updateWeather();
    await game.dimWeather.displayWeather();
  }
}

// Initialize on init
Hooks.once("init", initializeModule);

// Initialize on ready (in case init was missed)
Hooks.once("ready", initializeModule);

// Handle canvas ready
Hooks.on("canvasReady", () => handleSceneWeather());

// Handle world time changes
Hooks.on("updateWorldTime", checkTimeBasedUpdate);

// Handle Simple Calendar ready
Hooks.once("simple-calendar-ready", () => handleSceneWeather());

// Handle Simple Calendar season changes
Hooks.on("simple-calendar.seasonChange", async (season) => {
  if (!initialized || !Settings.isSimpleCalendarEnabled()) return;

  const scene = game.scenes.viewed;
  if (!scene?.id) return;

  const weatherState = scene.getFlag(MODULE_ID, "weatherState");
  if (!weatherState) return;

  // Find matching season in campaign settings
  const matchingSeasonKey = Object.entries(
    game.dimWeather.engine.settingsData?.seasons || {}
  ).find(([_, s]) => s.name.toLowerCase() === season.name.toLowerCase())?.[0];

  if (matchingSeasonKey) {
    await scene.setFlag(MODULE_ID, "weatherState", {
      ...weatherState,
      season: matchingSeasonKey,
      lastUpdate: Date.now(),
    });

    await handleSceneWeather(true);
  }
});

// Handle chat messages
Hooks.on("chatMessage", (message, options, userId) => {
  if (!initialized) return true;

  const content = message.content || message;
  if (typeof content === "string" && content.startsWith("/weather")) {
    weatherCommands.processCommand(content.slice(8).trim());
    return false;
  }
  return true;
});

/**
 * Handle campaign setting changes
 * @param {string} value - New campaign setting
 */
async function onCampaignChange(value) {
  if (!game.ready || !game.dimWeather || game.dimWeather.isChatCommand) return;

  try {
    await game.dimWeather.updateCampaignSetting(value);
    ui.notifications.info(`Campaign setting updated to ${value}`);
  } catch (error) {
    ErrorHandler.logAndNotify("Failed to update campaign settings", error);
  }
}
