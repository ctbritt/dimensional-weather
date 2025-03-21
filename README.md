# Dimensional Weather for Dark Sun

A dynamic weather system for Foundry VTT, providing a modular system for developing your own climes, terrains, and atmospheric phenomenon.

## Description

This module adds a comprehensive weather system to your campaign, featuring:
- Terrain-specific weather patterns
- Survival rules based on conditions
- Private GM commands for weather management

## Features

### Weather Dimensions
- Temperature
- Wind
- Humidity
- Precipitation

### Terrain Types
Your terrain types can be specific to your campaign. For example, if using the Dark Sun campaign, you would have:
- Boulder Fields
- Dust Sinks
- Mountains
- Mudflats
- Rocky Badlands
- Salt Flats
- Salt Marshes
- Sandy Wastes
- Scrub Plains
- Stony Barrens
- Verdant Belt
- Sea of Silt
- Ringing Mountains
- Forest Ridge

### Commands
- `/weather` - Display current weather (available to all)
- `/weather terrain [type]` - Change terrain type (GM only)
- `/weather update` - Force weather update (GM only)
- `/weather stats` - Display weather statistics (GM only)
- `/weather forecast` - Show weather forecast (GM only)
- `/weather random [0-10]` - Set weather variability (GM only)
- `/date` - Show calendar information

## Installation

1. Copy this URL: `[your manifest URL]`
2. In Foundry VTT, go to Add-on Modules
3. Click "Install Module"
4. Paste the manifest URL and click Install

## Usage

1. Enable the module in your world's module settings
2. Use `/weather` to check current conditions
3. GMs can use additional commands to manage the weather system

## Dependencies
- [Chat Commands Library](https://gitlab.com/woodentavern/foundryvtt-chat-command-lib)
- [About Time](https://github.com/LeafWulf/about-time)
- [Simple Calendar](https://github.com/vigoren/foundryvtt-simple-calendar)
- [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper)


## License

This module is licensed under the MIT License. See the LICENSE file for details.
