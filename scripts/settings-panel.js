/**
 * Dimensional Weather - Settings Panel
 * Handles the custom settings panel UI
 */

import { Settings } from "./settings.js";
import { ErrorHandler } from "./utils.js";

export class SettingsPanel extends Application {
  constructor(options = {}) {
    super(options);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "dimensional-weather-settings",
      template: "modules/dimensional-weather/templates/settings.html",
      popOut: true,
      minimizable: true,
      resizable: true,
      title: "Dimensional Weather Settings",
      width: 600,
      height: 700,
    });
  }

  getData() {
    const settings = {
      useSimpleCalendar: Settings.getSetting("useSimpleCalendar"),
      autoUpdate: Settings.getSetting("autoUpdate"),
      updateFrequency: Settings.getSetting("updateFrequency"),
      terrain: Settings.getSetting("terrain"),
      season: Settings.getSetting("season"),
      variability: Settings.getSetting("variability"),
      useAI: Settings.getSetting("useAI"),
      apiKey: this._maskApiKey(Settings.getSetting("apiKey")),
    };

    // Get terrain choices from campaign settings
    const terrainChoices = {};
    const campaignSettings = Settings.getSetting("campaignSettings");
    if (campaignSettings?.terrains) {
      Object.entries(campaignSettings.terrains).forEach(([key, terrain]) => {
        terrainChoices[key] = terrain.name || key;
      });
    }

    // Get season choices from campaign settings
    const seasonChoices = {};
    if (campaignSettings?.seasons) {
      Object.entries(campaignSettings.seasons).forEach(([key, season]) => {
        seasonChoices[key] = season.name || key;
      });
    }

    return {
      settings,
      terrainChoices,
      seasonChoices,
    };
  }

  _maskApiKey(apiKey) {
    if (!apiKey) return "";
    return "••••••••••••••••";
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Handle tab navigation
    html.find(".tabs .item").click(this._onTabClick.bind(this));

    // Handle form submission
    html.find("form").submit(this._onSubmit.bind(this));

    // Handle preview weather button
    html.find(".preview-weather").click(this._onPreviewWeather.bind(this));

    // Handle range input updates
    html.find("input[type='range']").on("input", this._onRangeInput.bind(this));

    // Handle API key input
    html
      .find("input[name='apiKey']")
      .on("input", this._onApiKeyInput.bind(this));
  }

  _onTabClick(event) {
    event.preventDefault();
    const tab = event.currentTarget;
    const group = tab.dataset.group;
    const target = tab.dataset.tab;

    // Update active tab
    tab
      .closest(".tabs")
      .querySelectorAll(".item")
      .forEach((item) => {
        item.classList.remove("active");
      });
    tab.classList.add("active");

    // Show target content
    this.element.find(`.tab[data-group="${group}"]`).forEach((content) => {
      content.classList.remove("active");
    });
    this.element.find(`.tab[data-tab="${target}"]`).addClass("active");
  }

  async _onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      // Update settings
      await Settings.updateSetting(
        "useSimpleCalendar",
        formData.get("useSimpleCalendar") === "on"
      );
      await Settings.updateSetting(
        "autoUpdate",
        formData.get("autoUpdate") === "on"
      );
      await Settings.updateSetting(
        "updateFrequency",
        parseInt(formData.get("updateFrequency"))
      );
      await Settings.updateSetting("terrain", formData.get("terrain"));
      await Settings.updateSetting("season", formData.get("season"));
      await Settings.updateSetting(
        "variability",
        parseInt(formData.get("variability"))
      );
      await Settings.updateSetting("useAI", formData.get("useAI") === "on");
      await Settings.updateSetting("apiKey", formData.get("apiKey"));

      ui.notifications.info("Settings updated successfully");
      this.close();
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to update settings", error);
    }
  }

  async _onPreviewWeather(event) {
    event.preventDefault();
    try {
      await game.dimWeather?.displayWeather();
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to preview weather", error);
    }
  }

  _onRangeInput(event) {
    const input = event.currentTarget;
    const value = input.value;
    const valueDisplay = input.parentElement.querySelector(".range-value");
    if (valueDisplay) {
      valueDisplay.textContent = value;
    }
  }

  _onApiKeyInput(event) {
    const input = event.currentTarget;
    const value = input.value;
    // Only update if the value is not already masked
    if (value !== this._maskApiKey(value)) {
      input.value = this._maskApiKey(value);
    }
  }
}
