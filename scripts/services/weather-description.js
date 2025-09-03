/**
 * Weather Description Service
 * Handles generation of rich weather descriptions using OpenAI API
 */

import { ErrorHandler } from "../utils.js";
import { Settings } from "../settings.js";

export class WeatherDescriptionService {
  /**
   * Create a new weather description service (OpenAI only)
   * @param {Object} options - configuration
   * @param {string} options.apiKey - OpenAI API key
   * @param {string} options.model - OpenAI model name
   */
  constructor({ apiKey, model }) {
    this.apiKey = apiKey;
    this.model = model;
    this.lastCallTime = 0;
    this.RATE_LIMIT_MS = 5000; // 5 seconds between API calls
  }

  /**
   * Generate a weather description based on conditions
   * @param {Object} conditions - Weather conditions
   * @returns {Promise<string>} Generated description
   */
  async generateWeatherDescription(conditions) {
    if (!this.apiKey) {
      throw new Error("No OpenAI API key configured");
    }

    // Rate limiting
    const now = Date.now();
    const timeElapsed = now - this.lastCallTime;
    if (timeElapsed < this.RATE_LIMIT_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.RATE_LIMIT_MS - timeElapsed)
      );
    }

    try {
      const prompt = this._buildPrompt(conditions);
      const result = await this._callOpenAI(prompt);
      this.lastCallTime = Date.now();
      return result;
    } catch (error) {
      // Provide a graceful fallback
      console.error("Weather description generation failed:", error);
      return this._getBasicDescription(conditions);
    }
  }

  /**
   * Build prompt for OpenAI API
   * @private
   * @param {Object} conditions - Weather conditions
   * @returns {string} Generated prompt
   */
  _buildPrompt(conditions) {
    return `You are a weather system for the ${
      conditions.campaign || "D&D"
    } setting. Generate very concise, atmospheric descriptions (2-3 sentences max) focusing on the most critical environmental effects and immediate survival concerns. Be direct and avoid flowery language.
    Current conditions:
    - Terrain: ${conditions.terrain || "Unknown terrain"}
    - Temperature: ${conditions.tempDesc || "Normal temperature"}
    - Wind: ${conditions.windDesc || "Normal wind"}
    - Precipitation: ${conditions.precipDesc || "Clear skies"}
    - Humidity: ${conditions.humidDesc || "Normal humidity"}
    - Time of Day: ${conditions.timePeriod || "Unknown time"}
    
    Generate a brief, atmospheric description of these conditions. Focus on the most important environmental effects and survival considerations. Keep it concise and avoid repetition.`;
  }

  /**
   * Call OpenAI API
   * @private
   * @param {string} prompt - Prompt to send
   * @returns {Promise<string>} API response
   */
  async _callOpenAI(prompt) {
    const model = this.model || Settings.getSetting("openaiModel") || "gpt-4o-mini";
    const isGpt5 = /^gpt-5/i.test(model);

    const body = {
      model,
      messages: [
        { role: "system", content: "You are a weather system for the Dark Sun D&D setting. Generate very concise, atmospheric descriptions (2-3 sentences max) focusing on the most critical environmental effects and immediate survival concerns. Give your responses in the style of the Wanderer from the Wanderer's Chronicle." },
        { role: "user", content: prompt },
      ],
    };

    // Newer OpenAI models (e.g., gpt-5) use 'max_completion_tokens'
    if (isGpt5) {
      body.max_completion_tokens = 150;
    } else {
      body.max_tokens = 150;
      // Only set temperature for non-GPT-5 models
      body.temperature = 0.7;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let contentText = null;

    if (Array.isArray(data?.choices) && data.choices.length > 0) {
      const choice = data.choices[0];

      // chat/completions string content
      if (typeof choice?.message?.content === "string") {
        contentText = choice.message.content;
      }

      // chat/completions array content (some newer models)
      if (!contentText && Array.isArray(choice?.message?.content)) {
        const part = choice.message.content.find((p) => {
          if (p && typeof p === "object") {
            return p.type === "text" && (p.text || p.content);
          }
          return false;
        });
        contentText = part?.text || part?.content || null;
      }

      // fallback: some responses expose choice.text
      if (!contentText && typeof choice?.text === "string") {
        contentText = choice.text;
      }
    }

    if (!contentText) throw new Error("Unexpected OpenAI response format");
    return String(contentText).trim();
  }

  /**
   * Generate a basic description as fallback
   * @private
   * @param {Object} conditions - Weather conditions
   * @returns {string} Basic description
   */
  _getBasicDescription(conditions) {
    return `The ${conditions.terrain || "landscape"} unfolds before you. 
    The temperature is ${conditions.tempDesc || "sweltering"}, with 
    ${conditions.windDesc || "scratchy winds"} and 
    ${conditions.precipDesc || "hazy skies"}. 
    The air feels ${conditions.humidDesc || "dry and dusty"}.`;
  }
}
