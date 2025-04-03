# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- No formal build process or package manager
- Module loads directly into Foundry VTT via module.json

## Code Style Guidelines
- **Imports**: ES modules, group at top of file, named exports preferred
- **Formatting**: 2-space indentation, semicolons, double quotes for strings
- **Types**: Use JSDoc comments for parameters and return types
- **Naming**: UpperCamelCase for classes, camelCase for methods/variables
- **Error Handling**: Use try/catch and ErrorHandler.logAndNotify method
- **Classes**: Single responsibility, well-documented with JSDoc
- **Foundry VTT**: Access game objects via game.* API, use scene flags for state
- **File Organization**: 
  - main.js - Entry point, hooks registration 
  - api.js - Public API interface
  - settings.js - Module settings
  - Utility classes in utils.js
  
## Module Structure
- Modular architecture for weather simulation
- Use Scene flags for persistence
- Error handling via ErrorHandler.logAndNotify
- Centralized weather API via game.dimWeather