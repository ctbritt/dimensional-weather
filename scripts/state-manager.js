/**
 * Dimensional Weather - State Manager
 * Centralized management of weather state and data
 */

import { Settings } from "./settings.js";
import { SceneManager } from "./scene-manager.js";
import { ErrorHandler } from "./utils.js";

export class StateManager {
  /**
   * Create a new State Manager
   */
  constructor() {
    this.settingsData = null;
    this.currentWeather = null;
    this.listeners = new Set();
    this.cache = {
      terrains: new Map(),
      seasons: new Map(),
      timeModifiers: new Map()
    };
  }

  /**
   * Initialize the state manager
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Load settings data
      const campaignId = Settings.getCurrentCampaign();
      this.settingsData = await Settings.loadCampaignSetting(campaignId);
      
      // Cache current weather state
      this.refreshCurrentWeather();
      
      return true;
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to initialize state manager", error);
      return false;
    }
  }

  /**
   * Refresh current weather state from active scene
   * @returns {Object|null} Current weather state
   */
  refreshCurrentWeather() {
    this.currentWeather = SceneManager.getWeatherState();
    return this.currentWeather;
  }

  /**
   * Get current weather state
   * @returns {Object|null} Current weather state
   */
  getCurrentWeather() {
    return this.currentWeather || this.refreshCurrentWeather();
  }

  /**
   * Update current campaign settings data
   * @param {string} campaignId - Campaign ID to load
   * @returns {Promise<boolean>} Success status
   */
  async updateCampaignSetting(campaignId) {
    try {
      // Load new settings data
      const newSettingsData = await Settings.loadCampaignSetting(campaignId);
      if (!newSettingsData) {
        throw new Error(`Campaign setting not found: ${campaignId}`);
      }
      
      // Update settings data
      this.settingsData = newSettingsData;
      
      // Clear caches
      this.clearCaches();
      
      // Notify listeners
      this._notifyListeners({ type: 'campaignChange', campaignId });
      
      return true;
    } catch (error) {
      ErrorHandler.logAndNotify(`Error updating campaign setting: ${campaignId}`, error);
      return false;
    }
  }

  /**
   * Add a state change listener
   * @param {Function} callback - Callback function
   * @returns {Function} Function to remove listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of a state change
   * @private
   * @param {Object} event - Event data
   */
  _notifyListeners(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Dimensional Weather | Error in state listener:", error);
      }
    }
  }

  /**
   * Get terrain data by key
   * @param {string} key - Terrain key
   * @returns {Object|null} Terrain data
   */
  getTerrain(key) {
    // Check cache first
    if (this.cache.terrains.has(key)) {
      return this.cache.terrains.get(key);
    }
    
    // Get from settings data
    const terrain = this.settingsData?.terrains?.[key];
    if (terrain) {
      this.cache.terrains.set(key, terrain);
    }
    
    return terrain || null;
  }

  /**
   * Get season data by key
   * @param {string} key - Season key
   * @returns {Object|null} Season data
   */
  getSeason(key) {
    // Check cache first
    if (this.cache.seasons.has(key)) {
      return this.cache.seasons.get(key);
    }
    
    // Get from settings data
    const season = this.settingsData?.seasons?.[key];
    if (season) {
      this.cache.seasons.set(key, season);
    }
    
    return season || null;
  }

  /**
   * Get time modifiers for a time period
   * @param {string} timePeriod - Time period name
   * @returns {Object} Time modifiers
   */
  getTimeModifiers(timePeriod) {
    // Check cache first
    if (this.cache.timeModifiers.has(timePeriod)) {
      return this.cache.timeModifiers.get(timePeriod);
    }
    
    // Get from settings data
    const modifiers = this.settingsData?.timeModifiers?.[timePeriod] || {
      temperature: 0,
      wind: 0,
      precipitation: 0,
      humidity: 0
    };
    
    // Cache the result
    this.cache.timeModifiers.set(timePeriod, modifiers);
    
    return modifiers;
  }

  /**
   * Get default terrain
   * @returns {string} Default terrain key
   */
  getDefaultTerrain() {
    return this.settingsData?.defaultTerrain || Object.keys(this.settingsData?.terrains || {})[0];
  }

  /**
   * Get default season
   * @returns {string} Default season key
   */
  getDefaultSeason() {
    return Object.keys(this.settingsData?.seasons || {})[0];
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.cache.terrains.clear();
    this.cache.seasons.clear();
    this.cache.timeModifiers.clear();
  }

  /**
   * Get weather stats
   * @returns {Object} Weather stats
   */
  getWeatherStats() {
    const weatherState = this.getCurrentWeather();
    if (!weatherState) {
      return { initialized: true, weatherAvailable: false };
    }

    const campaignName = this.settingsData?.name || "Unknown Campaign";
    const terrainData = this.getTerrain(weatherState.terrain);
    const terrainName = terrainData?.name || weatherState.terrain;
    const seasonData = this.getSeason(weatherState.season);
    const seasonName = seasonData?.name || weatherState.season;

    return {
      initialized: true,
      weatherAvailable: true,
      campaign: campaignName,
      temperature: weatherState.temperature,
      wind: weatherState.wind,
      precipitation: weatherState.precipitation,
      humidity: weatherState.humidity,
      variability: Settings.getSetting("variability"),
      terrain: terrainName,
      season: seasonName,
      lastUpdate: weatherState.lastUpdate,
      scene: game.scenes.viewed?.name || "No active scene",
    };
  }
}