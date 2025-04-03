/**
 * Dimensional Weather - Command Handler Framework
 * Provides a structured way to handle chat commands with reduced duplication
 */

import { ErrorHandler } from "./utils.js";

/**
 * Command Handler Framework
 * Provides a structured way to handle chat commands with reduced duplication
 */
export class CommandHandler {
  /**
   * Create a new Command Handler
   * @param {Object} api - The API instance
   */
  constructor(api) {
    this.api = api;
    this.commands = new Map();
    this.defaultCommand = null;
  }

  /**
   * Register a command handler
   * @param {string} name - Command name
   * @param {Function} handler - Command handler function
   * @param {Object} options - Command options
   * @param {boolean} options.requiresGM - Whether the command requires GM privileges
   * @param {boolean} options.requiresArgs - Whether the command requires arguments
   * @param {Function} options.validateArgs - Function to validate arguments
   * @param {string} options.description - Command description
   */
  registerCommand(name, handler, options = {}) {
    this.commands.set(name, {
      handler,
      requiresGM: options.requiresGM || false,
      requiresArgs: options.requiresArgs || false,
      validateArgs: options.validateArgs || null,
      description: options.description || "",
    });
  }

  /**
   * Register a default command handler for when no specific command is provided
   * @param {Function} handler - Default command handler function
   */
  registerDefaultCommand(handler) {
    this.defaultCommand = handler;
  }

  /**
   * Handle a command
   * @param {string} command - Command name
   * @param {string[]} args - Command arguments
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Command result
   */
  async handleCommand(command, args = [], options = {}) {
    try {
      // Check if the command exists
      const commandInfo = this.commands.get(command);
      if (!commandInfo) {
        if (this.defaultCommand) {
          return await this.defaultCommand(args, options);
        }
        return this.createErrorResponse(`Unknown command: ${command}`);
      }

      // Check if the command requires GM privileges
      if (commandInfo.requiresGM && !game.user.isGM) {
        ui.notifications.warn("Only the GM can use this command.");
        return this.createErrorResponse("Only the GM can use this command.");
      }

      // Check if the command requires arguments
      if (commandInfo.requiresArgs && (!args || args.length === 0)) {
        return this.createErrorResponse(
          `Command '${command}' requires arguments.`
        );
      }

      // Validate arguments if a validator is provided
      if (commandInfo.validateArgs) {
        const validationResult = commandInfo.validateArgs(args);
        if (validationResult !== true) {
          return this.createErrorResponse(validationResult);
        }
      }

      // Execute the command handler
      return await commandInfo.handler(args, options);
    } catch (error) {
      ErrorHandler.logAndNotify(`Error processing command: ${command}`, error);
      return this.createErrorResponse(
        `An error occurred while processing the command: ${error.message}`
      );
    }
  }

  /**
   * Create a success response
   * @param {string} content - Response content
   * @param {Object} options - Response options
   * @returns {Object} Response object
   */
  createSuccessResponse(content, options = {}) {
    return {
      content,
      speaker: { alias: options.speaker || "Dimensional Weather" },
      whisper: options.whisper || null,
    };
  }

  /**
   * Create an error response
   * @param {string} message - Error message
   * @param {Object} options - Response options
   * @returns {Object} Response object
   */
  createErrorResponse(message, options = {}) {
    return {
      content: message,
      speaker: { alias: options.speaker || "Dimensional Weather" },
      whisper: options.whisper || [game.user.id],
    };
  }

  /**
   * Get all registered commands
   * @returns {Array} Array of command information
   */
  getCommands() {
    const result = [];
    for (const [name, info] of this.commands.entries()) {
      result.push({
        name,
        description: info.description,
        requiresGM: info.requiresGM,
        requiresArgs: info.requiresArgs,
      });
    }
    return result;
  }
}
