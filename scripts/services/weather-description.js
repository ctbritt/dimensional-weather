/**
 * Weather Description Service
 * Handles generation of rich weather descriptions using OpenAI API
 */

import { ErrorHandler } from "../utils.js";

export class WeatherDescriptionService {
  /**
   * Create a new weather description service
   * @param {string} apiKey - OpenAI API key
   */
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.lastCallTime = 0;
    this.RATE_LIMIT_MS = 5000; // 5 seconds between API calls
    this.MODEL = "gpt-4o-mini"; // Default model to use
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
    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.MODEL,
            messages: [
              {
                role: "system",
                content:
                  "You are a weather system for a D&D setting. Generate very concise, atmospheric descriptions (2-3 sentences max) focusing on the most critical environmental effects and immediate survival concerns. Be direct and avoid flowery language.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 150,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `OpenAI API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.choices?.[0]?.message?.content) {
        throw new Error("Unexpected API response format");
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      throw new Error(`OpenAI API call failed: ${error.message}`);
    }
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
