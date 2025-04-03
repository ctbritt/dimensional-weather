/**
 * Dimensional Weather - Main Module
 * Entry point for the Dimensional Weather system
 */

import { Settings } from "./settings.js";
import { DimensionalWeatherAPI } from "./api.js";
import { ErrorHandler } from "./utils.js";
import { WeatherCommandSystem } from "./command-system.js";
import { SceneManager } from "./scene-manager.js";

// Module constants
const MODULE_ID = "dimensional-weather";
const MODULE_TITLE = "Dimensional Weather";

// Module state
let commandSystem;
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

    // Initialize unified command system
    commandSystem = new WeatherCommandSystem(game.dimWeather);
    commandSystem.register();

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
    // Check if weather state exists for the scene
    const weatherState = SceneManager.getWeatherState(scene);
    
    // Initialize weather if needed
    if (!weatherState) {
      await game.dimWeather.engine.initializeWeather(scene);
    }

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

  const weatherState = SceneManager.getWeatherState(scene);
  if (!weatherState) return;

  const updateFrequency = Settings.getSetting("updateFrequency");
  
  if (SceneManager.isUpdateNeeded(weatherState, updateFrequency)) {
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

  const weatherState = SceneManager.getWeatherState(scene);
  if (!weatherState) return;

  // Find matching season in campaign settings
  const matchingSeasonKey = Object.entries(
    game.dimWeather.engine.settingsData?.seasons || {}
  ).find(([_, s]) => s.name.toLowerCase() === season.name.toLowerCase())?.[0];

  if (matchingSeasonKey) {
    await SceneManager.setWeatherAttribute("season", matchingSeasonKey, scene);
    await handleSceneWeather(true);
  }
});

// Handle chat messages
Hooks.on("chatMessage", (message, options, userId) => {
  if (!initialized) return true;

  const content = message.content || message;
  if (typeof content === "string" && content.startsWith("/weather")) {
    commandSystem.processCommand(content.slice(8).trim());
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
