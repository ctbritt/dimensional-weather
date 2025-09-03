/**
 * Weather Description Service
 * Handles generation of rich weather descriptions using OpenAI API
 */

import { ErrorHandler } from "../utils.js";
import { Settings } from "../settings.js";

export class WeatherDescriptionService {
  /**
   * Create a new weather description service
   * @param {Object} options - Provider configuration
   * @param {string} options.provider - 'openai' | 'anthropic'
   * @param {string} options.apiKey - API key for selected provider
   * @param {string} options.model - Model name for provider
   */
  constructor({ provider, apiKey, model }) {
    this.provider = provider || Settings.getSetting("aiProvider") || "openai";
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
      throw new Error("No API key configured for AI provider");
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
      const result = await this._callAI(prompt);
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
  async _callAI(prompt) {
    if (this.provider === "anthropic") {
      return await this._callAnthropic(prompt);
    }
    return await this._callOpenAI(prompt);
  }

  async _callOpenAI(prompt) {
    const model = this.model || Settings.getSetting("openaiModel") || "gpt-4o-mini";
    const isGpt5 = /^gpt-5/i.test(model);

    const body = {
      model,
      messages: [
        { role: "system", content: "You are a weather system for a D&D setting. Generate very concise, atmospheric descriptions (2-3 sentences max) focusing on the most critical environmental effects and immediate survival concerns. Be direct and avoid flowery language." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    };

    // Newer OpenAI models (e.g., gpt-5) use 'max_completion_tokens'
    if (isGpt5) {
      body.max_completion_tokens = 150;
    } else {
      body.max_tokens = 150;
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
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Unexpected OpenAI response format");
    return content.trim();
  }

  async _callAnthropic(prompt) {
    const model = this.model || Settings.getSetting("anthropicModel") || "claude-sonnet-4-0";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        system: "You are a weather system for a TTRPG. Generate very concise, atmospheric descriptions (2-3 sentences) focusing on critical environmental effects and immediate survival concerns.",
        messages: [
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data?.content?.[0]?.text || data?.content?.[0]?.content || "";
    if (!content) throw new Error("Unexpected Anthropic response format");
    return String(content).trim();
  }

  /**
   * Generate a basic description as fallback
   * @private
   * @param {Object} conditions - Weather conditions
   * @returns {string} Basic description
   */
  _getBasicDescription(conditions) {
    return `The ${conditions.terrain || "landscape"} unfolds before you. 
    The temperature is ${conditions.tempDesc || "moderate"}, with 
    ${conditions.windDesc || "gentle winds"} and 
    ${conditions.precipDesc || "clear skies"}. 
    The air feels ${conditions.humidDesc || "comfortable"}.`;
  }
}
