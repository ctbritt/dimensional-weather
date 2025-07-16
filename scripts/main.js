/**
 * Dimensional Weather - Main Module
 * Entry point for the Dimensional Weather system
 */

import { Settings } from "./settings.js";
import { DimensionalWeatherAPI } from "./api.js";
import { ErrorHandler, DebugLogger } from "./utils.js";
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
    DebugLogger.info("Module initialized successfully");
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
  // Skip automatic scene handling in manual-only mode
  if (Settings.getSetting("manualOnly")) return;

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
  try {
    // Skip automatic time-based updates in manual-only mode
    if (Settings.getSetting("manualOnly")) return;
    if (!initialized) {
      console.warn(
        `${MODULE_TITLE} | Module not initialized, skipping time-based update`
      );
      return;
    }

    if (!Settings.getSetting("autoUpdate")) {
      DebugLogger.log(
        "weather",
        "Auto-update disabled, skipping time-based update"
      );
      return;
    }

    const scene = game.scenes.viewed;
    if (!scene?.id) {
      console.warn(
        `${MODULE_TITLE} | No active scene, skipping time-based update`
      );
      return;
    }

    const weatherState = SceneManager.getWeatherState(scene);
    if (!weatherState) {
      console.warn(
        `${MODULE_TITLE} | No weather state found for scene, initializing...`
      );
      await handleSceneWeather(true);
      return;
    }

    const updateFrequency = Settings.getSetting("updateFrequency");
    const lastUpdate = weatherState.lastUpdate || 0;
    const currentTime = Date.now();
    const hoursSinceLastUpdate = (currentTime - lastUpdate) / (1000 * 60 * 60);

    if (Settings.getSetting("debugTimePeriod")) {
      DebugLogger.log("weather", "Time check", {
        lastUpdate: new Date(lastUpdate).toLocaleString(),
        currentTime: new Date(currentTime).toLocaleString(),
        hoursSinceLastUpdate,
        updateFrequency,
        needsUpdate: hoursSinceLastUpdate >= updateFrequency,
      });
    }

    if (hoursSinceLastUpdate >= updateFrequency) {
      DebugLogger.log(
        "weather",
        `Time-based weather update triggered (${hoursSinceLastUpdate.toFixed(
          1
        )} hours since last update)`
      );
      await game.dimWeather.updateWeather();
      await game.dimWeather.displayWeather();
    }
  } catch (error) {
    ErrorHandler.logAndNotify("Error in time-based update", error);
  }
}

// Initialize on init
Hooks.once("init", async () => {
  await initializeModule();

  // Set up periodic check for weather updates
  setInterval(async () => {
    if (game.ready && initialized) {
      await checkTimeBasedUpdate();
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
});

// Initialize on ready (in case init was missed)
Hooks.once("ready", initializeModule);

// Handle canvas ready
Hooks.on("canvasReady", () => handleSceneWeather());

// Handle world time changes
Hooks.on("updateWorldTime", checkTimeBasedUpdate);

// Handle Simple Calendar time changes
Hooks.on("simpleCalendar.dateTimeChange", async (dateTime) => {
  if (!initialized || !Settings.getSetting("useSimpleCalendar")) return;

  try {
    DebugLogger.log(
      "weather",
      "Simple Calendar time change detected",
      dateTime
    );
    await checkTimeBasedUpdate();
  } catch (error) {
    ErrorHandler.logAndNotify(
      "Error handling Simple Calendar time change",
      error
    );
  }
});

// Handle Simple Calendar season changes
Hooks.on("simpleCalendar.seasonChange", async (season) => {
  if (!initialized || !Settings.getSetting("useSimpleCalendar")) return;

  try {
    DebugLogger.log(
      "weather",
      "Simple Calendar season change detected",
      season
    );
    await handleSceneWeather(true);
  } catch (error) {
    ErrorHandler.logAndNotify(
      "Error handling Simple Calendar season change",
      error
    );
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
