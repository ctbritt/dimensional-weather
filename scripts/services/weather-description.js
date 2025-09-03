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
      if (!result || !String(result).trim()) {
        return this._getBasicDescription(conditions);
      }
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

    const buildBody = (maxTokens) => {
      return {
        model,
        messages: [
          { role: "system", content: "You are a weather system for the Dark Sun D&D setting. Generate very concise, atmospheric descriptions (2-3 sentences max) focusing on the most critical environmental effects and immediate survival concerns. Give your responses in the style of the Wanderer from the Wanderer's Chronicle." },
          { role: "user", content: prompt },
        ],
        // Use Chat Completions-compatible parameter
        max_tokens: maxTokens,
      };
    };

    const callOnce = async (body) => {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${errorData.error?.message || resp.statusText}`);
      }
      const data = await resp.json();
      let contentText = null;
      let finishReason = null;

      if (Array.isArray(data?.choices) && data.choices.length > 0) {
        const choice = data.choices[0];
        finishReason = choice?.finish_reason || null;

        if (typeof choice?.message?.content === "string") {
          contentText = choice.message.content;
        }

        if (!contentText && Array.isArray(choice?.message?.content)) {
          const parts = choice.message.content;
          const texts = parts
            .map((p) => {
              if (typeof p === "string") return p;
              if (p && typeof p === "object") {
                if (typeof p.text === "string") return p.text;
                if (typeof p.content === "string") return p.content;
              }
              return null;
            })
            .filter(Boolean);
          if (texts.length) contentText = texts.join("\n");
        }

        if (!contentText && typeof choice?.text === "string") {
          contentText = choice.text;
        }
      }

      // Fallback for Responses API style
      if (!contentText && typeof data?.output_text === "string" && data.output_text.trim()) {
        contentText = data.output_text.trim();
      }

      return { contentText: contentText ? String(contentText).trim() : "", finishReason };
    };

    // First attempt
    const initialTokens = 300;
    let { contentText, finishReason } = await callOnce(buildBody(initialTokens));

    // Retry once if empty content or length-capped
    if (!contentText || finishReason === "length") {
      const retryTokens = initialTokens + 200; // give more budget
      const retry = await callOnce(buildBody(retryTokens));
      contentText = retry.contentText || contentText;
      finishReason = retry.finishReason || finishReason;
    }

    // If still empty, return empty string so caller can gracefully fallback
    if (!contentText) return "";
    return contentText;
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
