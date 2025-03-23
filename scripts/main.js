/**
 * Dimensional Weather - Main Module
 * Entry point for the Dimensional Weather system
 */

import { Settings } from "./settings.js";
import { DimensionalWeatherAPI } from "./api.js";
import { ChatCommands } from "./chat-commands.js";
import { ErrorHandler } from "./utils.js";

// Module constants
const MODULE_ID = "dimensional-weather";
const MODULE_TITLE = "Dimensional Weather";

/**
 * Initialize the module when Foundry is ready
 */
Hooks.once("init", async () => {
  console.log(`${MODULE_TITLE} | Initializing module`);

  try {
    // Register settings first
    await Settings.register(onCampaignChange);

    // Register global module API
    game.dimWeather = new DimensionalWeatherAPI();

    console.log(`${MODULE_TITLE} | Module settings registered`);
  } catch (error) {
    ErrorHandler.logAndNotify(
      `Failed to initialize ${MODULE_TITLE} module`,
      error
    );
  }
});

/**
 * Initialize the module when Foundry is ready
 */
Hooks.once("ready", async () => {
  try {
    console.log(`${MODULE_TITLE} | Initializing weather system`);

    // Ensure the API is fully initialized
    await game.dimWeather.initialize();

    // Register chat commands
    const commands = new ChatCommands(game.dimWeather);
    commands.register();

    console.log(`${MODULE_TITLE} | Module initialized successfully`);
  } catch (error) {
    ErrorHandler.logAndNotify(
      `Failed to initialize ${MODULE_TITLE} module`,
      error
    );
  }
});

/**
 * Hook into chat commands
 */
Hooks.on("chatCommandsReady", () => {
  try {
    console.log(`${MODULE_TITLE} | Registering chat commands`);
    const commands = new ChatCommands(game.dimWeather);
    commands.register();
  } catch (error) {
    ErrorHandler.logAndNotify(
      `Failed to register ${MODULE_TITLE} chat commands`,
      error
    );
  }
});

/**
 * Hook into canvas ready to load weather state
 */
Hooks.on("canvasReady", async () => {
  // Wait for weather system to be initialized
  if (!game.dimWeather?.initialized) {
    return;
  }

  console.log(`${MODULE_TITLE} | Scene activated, checking for weather state`);

  try {
    // Initialize weather for the scene if needed
    const scene = game.scenes.viewed;
    if (scene?.id) {
      await game.dimWeather.engine.initializeWeather(scene);
    }

    // Check if we need to update weather when scene is activated
    const autoUpdate = Settings.getSetting("autoUpdate");
    if (autoUpdate) {
      await game.dimWeather.updateWeather();
    }
  } catch (error) {
    ErrorHandler.logAndNotify(
      `Failed to initialize weather for scene`,
      error,
      true
    );
  }
});

/**
 * Hook into Simple Calendar time changes
 */
Hooks.on("simple-calendar-time-change", async () => {
  // Ensure weather system and Simple Calendar are initialized
  if (!game.dimWeather?.initialized || !SimpleCalendar?.api?.currentDateTime) {
    return;
  }

  const autoUpdate = Settings.getSetting("autoUpdate");
  if (!autoUpdate) return;

  const updateFrequency = Settings.getSetting("updateFrequency");
  const scene = game.scenes.viewed;
  if (!scene?.id) return;

  const weatherState = scene.getFlag(MODULE_ID, "weatherState");
  const lastUpdateTime = weatherState?.lastUpdate || 0;
  const currentTime = SimpleCalendar.api.timestamp();
  const hoursSinceLastUpdate = (currentTime - lastUpdateTime) / 3600;

  if (hoursSinceLastUpdate >= updateFrequency) {
    console.log(`${MODULE_TITLE} | Time-based weather update triggered`);
    await game.dimWeather.updateWeather();
  }
});

/**
 * Hook into world time changes
 */
Hooks.on("updateWorldTime", async (worldTime, dt) => {
  // Ensure weather system is initialized
  if (!game.dimWeather?.initialized) {
    return;
  }

  const autoUpdate = Settings.getSetting("autoUpdate");
  if (!autoUpdate) return;

  const updateFrequency = Settings.getSetting("updateFrequency");
  const scene = game.scenes.viewed;
  if (!scene?.id) return;

  const weatherState = scene.getFlag(MODULE_ID, "weatherState");
  const lastUpdateTime = weatherState?.lastUpdate || 0;
  const currentTime = SimpleCalendar?.api
    ? SimpleCalendar.api.timestamp()
    : Date.now();
  const hoursSinceLastUpdate = (currentTime - lastUpdateTime) / 3600;

  if (hoursSinceLastUpdate >= updateFrequency) {
    console.log(`${MODULE_TITLE} | Game-time based weather update triggered`);
    await game.dimWeather.updateWeather();
  }
});

/**
 * Wait for Simple Calendar to be ready
 */
Hooks.once("simple-calendar-ready", async () => {
  // Wait for weather system to be initialized
  if (!game.dimWeather?.initialized) {
    return;
  }

  console.log(`${MODULE_TITLE} | Simple Calendar is ready`);

  try {
    // Initialize weather for the scene if needed
    const scene = game.scenes.viewed;
    if (scene?.id) {
      await game.dimWeather.engine.initializeWeather(scene);
    }
  } catch (error) {
    ErrorHandler.logAndNotify(
      `Failed to initialize weather with Simple Calendar`,
      error,
      true
    );
  }
});

/**
 * Handle campaign setting changes
 * @param {string} value - New campaign setting
 */
async function onCampaignChange(value) {
  try {
    // Skip all settings panel updates if this is a chat command change
    if (game.dimWeather?.isChatCommand) {
      return;
    }

    // Wait for game to be ready
    if (!game.ready || !game.dimWeather) return;

    // Update the campaign setting
    await game.dimWeather.updateCampaignSetting(value);

    ui.notifications.info(`Campaign setting updated to ${value}`);
  } catch (error) {
    ErrorHandler.logAndNotify("Failed to update campaign settings", error);
  }
}
