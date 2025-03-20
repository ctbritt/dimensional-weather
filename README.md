# Dimensional Weather for Dark Sun

A dynamic weather system for the Dark Sun setting, based on five dimensions: temperature, wind, precipitation, humidity, and variability.

## Description

Dimensional Weather is a FoundryVTT module that provides a comprehensive Athasian weather system for your Dark Sun campaigns. The weather is generated based on five dimensions:

1. **Temperature** - How hot or cold it is (usually very hot in Athas)
2. **Wind** - How strong the wind is blowing
3. **Precipitation** - How much precipitation is falling (rare in Athas)
4. **Humidity** - How dry the air is (typically very dry)
5. **Variability** - How quickly the weather changes

## Features

- **Authentic Dark Sun Weather**: Weather conditions that reflect the harsh, unforgiving environment of Athas
- **Terrain-Specific Climate Presets**: Different terrain types like Sandy Wastes, Glass Plateau, Sea of Silt, etc.
- **Automatic Integration with Simple Calendar**: Time and season are automatically retrieved from Simple Calendar
- **Customizable Weather Display**: Clean, thematic chat cards with terrain information and survival considerations
- **Easy-to-Use Commands**: Simple chat commands for checking and updating weather

## Installation

### Method 1: From FoundryVTT

1. In your FoundryVTT setup screen, go to the "Add-on Modules" tab
2. Click "Install Module"
3. Search for "Dimensional Weather for Dark Sun"
4. Click "Install"

### Method 2: Manual Installation

1. Download the latest release from the [Releases page](https://github.com/ctbritt/dimensional-weather/releases)
2. Extract the zip file
3. Copy the extracted folder to your FoundryVTT modules directory
4. Restart FoundryVTT
5. Enable the module in your world's module settings

## Usage

### Chat Commands

- `/weather` - Display current weather report
- `/weather update` - Force a weather update
- `/forecast` - Show weather forecast
- `/terrain` - Display current terrain and available options
- `/terrain [type]` - Change terrain type (e.g., `/terrain sandyWastes`)
- `/date` - Display current date and time

You can also access these commands through the weather button in the chat control bar.

## Dependencies

- [Simple Calendar](https://foundryvtt.com/packages/foundryvtt-simple-calendar) (Required) - Provides date and time information

## Recent Changes

- Improved thematic styling for Dark Sun setting
- Removed season and time display from the weather report for a cleaner interface
- Enhanced terrain-specific atmospheric descriptions and survival considerations
- Improved command handling and registration
- Added UI button in chat for easy access to weather commands

## Development and Distribution

### Versioning

This module uses semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR version for incompatible changes
- MINOR version for new functionality that is backwards-compatible
- PATCH version for backwards-compatible bug fixes

### Release Workflow

To create a new release:

1. Update code and commit changes
2. Create and push a new tag with the version number:
   ```
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. The GitHub Actions workflow will automatically:
   - Update the version in module.json
   - Create a zip file with all module files
   - Create a new GitHub release with the zip and module.json files

## License

This module is licensed under the MIT License. See the LICENSE file for details.
