# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Campaign Settings Index Generation
- `node scripts/generate-campaign-settings-index.js` - Regenerate campaign_settings/index.json after adding/modifying campaign settings files

## Architecture Overview

This is a FoundryVTT module that implements a comprehensive weather system with modular campaign settings. The core architecture consists of:

### Core Systems
- **Weather Engine** (`scripts/weather-engine.js`) - Main calculation engine for weather generation
- **Weather Calculator** (`scripts/weather-calculator.js`) - Mathematical operations for weather dimensions
- **State Manager** (`scripts/state-manager.js`) - Persists weather state across scenes and sessions
- **Scene Manager** (`scripts/scene-manager.js`) - Manages per-scene weather configurations

### User Interface & Integration
- **UI Controller** (`scripts/ui-controller.js`) - Handles weather display and user interactions
- **Command System** (`scripts/command-system.js`) - Implements chat commands (/weather, /date)
- **API** (`scripts/api.js`) - Public API for other modules to interact with weather system
- **Settings** (`scripts/settings.js`) - Module configuration and campaign selection

### Weather Data Model
The system uses a 4-dimensional weather model:
- **Temperature** (-10 to +10): Cold to Hot
- **Wind** (-10 to +10): Dead Calm to Hurricane  
- **Precipitation** (-10 to +10): Drought to Monsoon
- **Humidity** (-10 to +10): Arid to Rainforest

### Campaign Settings Structure
- Campaign definitions stored in `campaign_settings/` directory as JSON files
- Each campaign defines terrains, seasons, time modifiers, and survival rules
- `campaign_settings/index.json` lists available campaigns (auto-generated)
- Template available at `templates/settings_template.json`

### Key Dependencies
- Chat Commands Library (_chatcommands) - Required for /weather and /date commands
- Dark Sun Calendar (dark-sun-calendar) - Required for calendar integration
- libWrapper (lib-wrapper) - Required for Foundry API hooks

### Module Entry Point
`scripts/main.js` initializes all systems and registers the global `game.dimWeather` API object.

### Services
- **Weather Description Service** (`scripts/services/weather-description.js`) - Optional AI-powered weather descriptions via OpenAI API

## Key Implementation Notes

- Weather updates automatically based on time progression from Dark Sun Calendar module
- Each scene can have independent weather settings and state
- Weather calculations use base terrain values + seasonal modifiers + time-of-day modifiers + random variability
- All weather state is persisted using Foundry's game settings system
- The system provides survival rule integration based on weather extremes
- Dark Sun Calendar integration uses `window.DSC` API for date/time/season information