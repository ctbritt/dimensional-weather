/**
 * Dimensional Weather - Scene Configuration
 * Adds terrain selection to Scene Configuration dialog
 */

import { Settings } from "./settings.js";
import { ErrorHandler, DebugLogger } from "./utils.js";

export class SceneConfiguration {
  /**
   * Module ID for flag management
   * @type {string}
   */
  static MODULE_ID = "dimensional-weather";

  /**
   * Register hooks for scene configuration
   */
  static register() {
    console.log("Dimensional Weather | Registering SceneConfiguration hooks");
    Hooks.on("renderSceneConfig", this._onRenderSceneConfig.bind(this));
    console.log("Dimensional Weather | SceneConfiguration hooks registered");
  }

  /**
   * Get available terrains from campaign settings
   * @returns {Object} Terrain choices object for Foundry select
   */
  static async getTerrainChoices() {
    try {
      const campaignId = Settings.getCurrentCampaign();
      const settingsData = await Settings.loadCampaignSetting(campaignId);

      if (!settingsData?.terrains) {
        return { "": "None (Use Global Setting)" };
      }

      // Build choices object with empty option first
      const choices = {
        "": "None (Use Global Setting)"
      };

      // Add all terrains
      for (const [key, terrain] of Object.entries(settingsData.terrains)) {
        choices[key] = terrain.name || key;
      }

      return choices;
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to load terrain choices", error);
      return { "": "None (Use Global Setting)" };
    }
  }

  /**
   * Handle rendering of Scene Configuration dialog
   * @param {SceneConfig} app - The SceneConfig application
   * @param {jQuery} html - The rendered HTML
   * @param {Object} data - The data used to render the form
   */
  static async _onRenderSceneConfig(app, html, data) {
    try {
      console.log("Dimensional Weather | renderSceneConfig hook called", {
        hasObject: !!app.object,
        hasDocument: !!app.document,
        appKeys: Object.keys(app),
        dataKeys: Object.keys(data)
      });

      // In Foundry v13, the document might be at app.document instead of app.object
      const scene = app.document || app.object;

      // Verify we have a valid scene
      if (!scene || !scene.id) {
        console.warn("Dimensional Weather | No valid scene found in SceneConfig", {
          scene,
          hasScene: !!scene,
          hasId: scene?.id
        });
        return;
      }

      console.log("Dimensional Weather | Processing scene config for:", scene.name);

      // Ensure html is a jQuery object
      const $html = html instanceof jQuery ? html : $(html);
      console.log("Dimensional Weather | HTML type:", typeof html, "jQuery:", $html.length);

      // Debug: Let's see what tabs are available
      const allTabs = $html.find('.tab');
      console.log("Dimensional Weather | All tabs found:", allTabs.length, Array.from(allTabs).map(t => $(t).data('tab')));

      // Check for subtabs within ambience
      const ambienceSubtabs = $html.find('.tab[data-tab="ambience"] .tab');
      console.log("Dimensional Weather | Ambience subtabs:", ambienceSubtabs.length, Array.from(ambienceSubtabs).map(t => $(t).data('tab')));

      // Get current terrain from scene flag
      const currentTerrain = scene.getFlag(this.MODULE_ID, "terrain") || "";

      // Get terrain choices
      const terrainChoices = await this.getTerrainChoices();

      // Build select options HTML
      let optionsHtml = "";
      for (const [key, label] of Object.entries(terrainChoices)) {
        const selected = key === currentTerrain ? "selected" : "";
        optionsHtml += `<option value="${key}" ${selected}>${label}</option>`;
      }

      // Create the form group HTML
      const formGroupHtml = `
        <div class="form-group">
          <label>Weather Terrain</label>
          <select name="flags.${this.MODULE_ID}.terrain">
            ${optionsHtml}
          </select>
          <p class="notes">Select a terrain type for this scene's weather. Leave as "None" to use the global terrain setting.</p>
        </div>
      `;

      // Try to find the environment subtab (within ambience) first
      let targetTab = $html.find('.tab[data-tab="environment"]');
      console.log("Dimensional Weather | Environment subtab found:", targetTab.length, "visible:", targetTab.is(':visible'));

      // Fall back to ambience tab if environment not found
      if (targetTab.length === 0) {
        targetTab = $html.find('.tab[data-tab="ambience"]');
        console.log("Dimensional Weather | Using ambience tab instead");
      }

      console.log("Dimensional Weather | Target tab found:", targetTab.length, "visible:", targetTab.is(':visible'), "display:", targetTab.css('display'));

      if (targetTab.length > 0) {
        // Insert after the last form group in target tab
        const lastFormGroup = targetTab.find(".form-group").last();
        console.log("Dimensional Weather | Form groups in target tab:", targetTab.find(".form-group").length);
        console.log("Dimensional Weather | Last form group:", lastFormGroup.find('label').text());
        if (lastFormGroup.length > 0) {
          lastFormGroup.after(formGroupHtml);
          console.log("Dimensional Weather | Inserted after last form group");
        } else {
          targetTab.append(formGroupHtml);
          console.log("Dimensional Weather | Appended to target tab");
        }
      } else {
        // Fallback: insert before submit buttons
        console.log("Dimensional Weather | Ambience tab not found, using fallback");
        const footer = $html.find("footer.sheet-footer, button[type='submit']").first();
        if (footer.length > 0) {
          footer.before(formGroupHtml);
          console.log("Dimensional Weather | Inserted before footer");
        } else {
          // Last resort: append to form
          $html.find("form").append(formGroupHtml);
          console.log("Dimensional Weather | Appended to form");
        }
      }

      // Verify the element was actually added
      const addedSelect = $html.find(`select[name="flags.${this.MODULE_ID}.terrain"]`);
      console.log("Dimensional Weather | Verification - dropdown in DOM:", addedSelect.length > 0, "parent visible:", addedSelect.parent().is(':visible'));

      // Adjust the app height to accommodate new field
      app.setPosition({ height: "auto" });

      console.log("Dimensional Weather | Terrain dropdown added successfully");
      DebugLogger.log("weather", "Added terrain dropdown to Scene Config");
    } catch (error) {
      ErrorHandler.logAndNotify(
        "Failed to add terrain field to Scene Config",
        error
      );
    }
  }

  /**
   * Get terrain for a specific scene
   * @param {Scene} scene - The scene to check
   * @returns {string|null} Terrain key or null if using global setting
   */
  static getSceneTerrain(scene) {
    if (!scene?.id) return null;

    const terrain = scene.getFlag(this.MODULE_ID, "terrain");

    // Return null for empty string (use global setting)
    return terrain && terrain !== "" ? terrain : null;
  }

  /**
   * Set terrain for a specific scene
   * @param {Scene} scene - The scene to update
   * @param {string} terrain - Terrain key (empty string to use global setting)
   * @returns {Promise<boolean>} Success status
   */
  static async setSceneTerrain(scene, terrain) {
    try {
      if (!scene?.id) {
        ErrorHandler.logAndNotify("No scene provided", null, true);
        return false;
      }

      await scene.setFlag(this.MODULE_ID, "terrain", terrain || "");

      DebugLogger.log("weather", `Set terrain for scene ${scene.name} to ${terrain || "global"}`);
      return true;
    } catch (error) {
      ErrorHandler.logAndNotify("Failed to set scene terrain", error);
      return false;
    }
  }
}
