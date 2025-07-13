/**
 * Dimensional Weather - Scene Manager
 * Centralized management of scene flags and state
 */

import { ErrorHandler } from "./utils.js";

export class SceneManager {
  /**
   * Module ID for flag management
   * @type {string}
   */
  static MODULE_ID = "dimensional-weather";

  /**
   * Get current weather state from viewed scene
   * @param {Scene} [scene] - Scene to get state from (uses viewed scene if not specified)
   * @returns {Object|null} Current weather state or null if not available
   */
  static getWeatherState(scene = null) {
    // If no scene is provided and no scene is being viewed, return null
    if (!scene && !game.scenes?.viewed) return null;

    const currentScene = scene || game.scenes.viewed;
    if (!currentScene?.id) return null;

    return currentScene.getFlag(this.MODULE_ID, "weatherState") || null;
  }

  /**
   * Update weather state for a scene
   * @param {Object} updates - State updates to apply
   * @param {Scene} [scene] - Scene to update (uses viewed scene if not specified)
   * @returns {Promise<boolean>} Success status
   */
  static async updateWeatherState(updates, scene = null) {
    try {
      const currentScene = scene || game.scenes.viewed;
      if (!currentScene?.id) {
        ErrorHandler.logAndNotify("No scene available to update", null, true);
        return false;
      }

      // Get current state
      const currentState = this.getWeatherState(currentScene) || {};

      // Create new state
      const newState = {
        ...currentState,
        ...updates,
        lastUpdate: Date.now(),
      };

      // Update scene flag
      await currentScene.setFlag(this.MODULE_ID, "weatherState", newState);
      return true;
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to update weather state", error);
      return false;
    }
  }

  /**
   * Update a specific attribute of the weather state
   * @param {string} attribute - Attribute to update
   * @param {any} value - New value
   * @param {Scene} [scene] - Scene to update (uses viewed scene if not specified)
   * @returns {Promise<boolean>} Success status
   */
  static async setWeatherAttribute(attribute, value, scene = null) {
    return this.updateWeatherState({ [attribute]: value }, scene);
  }

  /**
   * Reset weather state for a scene
   * @param {Scene} [scene] - Scene to reset (uses viewed scene if not specified)
   * @returns {Promise<boolean>} Success status
   */
  static async resetWeatherState(scene = null) {
    try {
      const currentScene = scene || game.scenes.viewed;
      if (!currentScene?.id) {
        ErrorHandler.logAndNotify("No scene available to reset", null, true);
        return false;
      }

      await currentScene.unsetFlag(this.MODULE_ID, "weatherState");
      return true;
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to reset weather state", error);
      return false;
    }
  }

  /**
   * Initialize weather state for a new scene
   * @param {Scene} scene - Scene to initialize
   * @param {Object} initialState - Initial weather state values
   * @returns {Promise<boolean>} Success status
   */
  static async initializeWeatherState(scene, initialState) {
    try {
      if (!scene?.id) {
        ErrorHandler.logAndNotify(
          "No scene provided to initialize",
          null,
          true
        );
        return false;
      }

      // Check if state already exists
      const existingState = scene.getFlag(this.MODULE_ID, "weatherState");
      if (existingState) {
        console.log("Dimensional Weather | Scene already has weather state");
        return false;
      }

      // Add timestamp to initial state
      const stateWithTimestamp = {
        ...initialState,
        lastUpdate: Date.now(),
      };

      // Set scene flag
      await scene.setFlag(this.MODULE_ID, "weatherState", stateWithTimestamp);
      return true;
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to initialize weather state", error);
      return false;
    }
  }

  /**
   * Check if weather update is needed based on time
   * @param {Object} weatherState - Current weather state
   * @param {number} updateFrequency - Update frequency in hours
   * @returns {boolean} Whether an update is needed
   */
  static isUpdateNeeded(weatherState, updateFrequency) {
    if (!weatherState?.lastUpdate) return true;

    const lastUpdateTime = weatherState.lastUpdate;
    const currentTime = window.DSC
      ? new Date().getTime()
      : Date.now();
    const hoursSinceLastUpdate = (currentTime - lastUpdateTime) / 3600;

    return hoursSinceLastUpdate >= updateFrequency;
  }
}
