# Dimensional Weather for FoundryVTT

A dynamic weather system for Foundry VTT, providing a modular system for developing your own climes, terrains, and atmospheric phenomenon.

## Description

This module adds a comprehensive weather system to your campaign, featuring:
- Modular campaign settings system
- Terrain-specific weather patterns with **scene-level terrain assignment**
- Seasonal weather variations
- Survival rules based on conditions
- Private GM commands for weather management
- Optional AI-powered weather descriptions (OpenAI **and** Anthropic Claude support)
- Comprehensive API for other module developers and scripting
- Advanced scene and state management
- Performance-optimized weather calculations with caching

## How the Weather System Works
The Dimensional Weather system was inspired by the hex flower power described at [Goblin's Henchman](https://goblinshenchman.wordpress.com/hex-power-flower/). It uses a dynamic, multi-dimensional approach to weather generation that combines:
- Base terrain conditions
- Time of day effects
- Random variability
- Special rules and effects

### Weather Dimensions

Each terrain has four primary dimensions that determine its weather, with -10 being one extreme and 10 being the other.

1. **Temperature** (-10 to +10 - Cold to Hot)
   - Example: A desert terrain might have a base temperature of +5 (Very Hot)
   - At noon, it might get a +2 modifier (Even Hotter!)
   - With variability, it could range from +4 to +8

2. **Wind** (-10 to +10 - Dead Calm to Hurricane)
   - Example: Mountain terrain might have a base wind of +3
   - High variability could create gusts from +1 to +5
   - At wind +6 or higher, ranged attacks have disadvantage

3. **Precipitation** (-10 to +10 - Drought to Monsoon)
   - Example: Forest terrain might have base precipitation of 0
   - Negative values represent clear skies
   - Values above +3 trigger visibility penalties

4. **Humidity** (-10 to +10 - Arid to Rainforest)
   - Example: Coastal terrain might have base humidity of +2
   - Desert terrain might have -5
   - Affects how temperature feels and survival rules

### Example: Weather Generation

Let's see how weather is generated for a Scrub Plains terrain (from my Dark Sun Campaign), which corresponds roughly to savannah:

1. **Base Conditions**
   ```json
   {
     "temperature": 2,
     "wind": 1,
     "precipitation": -2,
     "humidity": -1,
     "variability": 3
   }
   ```

2. **Time Modifiers**
   - Early Morning: temperature -2
   - Noon: temperature +2
   - Night: temperature -1

3. **Weather Update**
   - System takes current values
   - Applies time of day modifiers
   - Adds random variation based on variability setting
   - Clamps final values between -10 and +10

4. **Survival Rules**
   These are determined by your campaign. I'm using the [extreme heat](https://www.dndbeyond.com/sources/dnd/dmg-2024/dms-toolbox#ExtremeHeat), [extreme cold](https://www.dndbeyond.com/sources/dnd/dmg-2024/dms-toolbox#ExtremeCold), [strong winds](https://www.dndbeyond.com/sources/dnd/dmg-2024/dms-toolbox#ExtremeHeat), and [heavy precipitation](https://www.dndbeyond.com/sources/dnd/dmg-2024/dms-toolbox#HeavyPrecipitation) from the Dungeon's Masters Guide, but you can use whatever rules you want. 

   For example:
   - Temperature ≥ 2: Double water consumption
   - Wind ≥ 6: Ranged attack penalties
   - Precipitation ≥ 3: Visibility penalties

These thresholds are determined by a setting json file ([see below](#makin-it-rain)). In this example, a wind score of more than 5 corresponds to a Strong Wind, as governed by the DMG. 

### Example: Weather Report

```
Current Weather - Scrub Plains
Temperature: Hot (4) - Water consumption doubled
Wind: Light breeze (1)
Precipitation: Clear skies (-2)
Humidity: Dry (-1)

Survival Rules:
- Water consumption is doubled
- Constitution save DC 5 every 4 hours
- Disadvantage if wearing medium/heavy armor
```

### Dynamic Changes

The weather system gradually changes over time:
1. Each update moves values toward terrain baseline
2. Random variation adds unpredictability
3. Time of day automatically affects conditions
4. GMs can force updates or change variability

### Scene-Specific Terrain Assignment

Each scene can have its own terrain type:
1. Open Scene Configuration → Ambience → Basic Options
2. Select a terrain from the "Scene Terrain" dropdown
3. Leave as "None" to use the global terrain setting
4. Weather automatically switches when you change scenes

This allows you to have:
- Desert weather in outdoor scenes
- City weather in urban scenes
- Different terrains for different regions of your world

### AI Integration (Optional)

The module supports **two AI providers** for generating atmospheric weather descriptions:

#### OpenAI Support
- **Recommended Models:**
  - `gpt-4o-mini` (Default) - Fast, cost-effective, great creative output
  - `gpt-4o` - Faster, excellent for real-time generation
  - `gpt-5-mini` - Higher quality, slower, more expensive
- **Setup:** Add your OpenAI API key in module settings

#### Anthropic Claude Support
- **Recommended Models:**
  - `claude-haiku-4` - Fastest, most cost-effective
  - `claude-sonnet-4` - Balanced speed and quality
  - `claude-sonnet-4-5` - Highest quality creative writing
- **Setup:** Add your Anthropic API key in module settings
- Uses the `anthropic-dangerous-direct-browser-access` header for browser-based API calls

When AI descriptions are enabled:
1. System combines all weather factors
2. Generates atmospheric descriptions in the style of your setting
3. Focuses on survival-relevant information
4. Updates descriptions based on time of day
5. Choose between OpenAI or Anthropic based on your preference

### Chat Commands
Available chat commands:

- `/weather` - Display current weather (available to all)
- `/weather terrain [type]` - Change terrain type (GM only)
- `/weather season [name]` - Change current season (GM only)
- `/weather update` - Force weather update (GM only)
- `/weather stats` - Display weather statistics (GM only)
- `/weather forecast` - Show weather forecast (GM only)
- `/weather random [0-10]` - Set weather variability (GM only)
- `/date` - Show calendar information

## Why Bother?
Doesn't Simple Weather do this much more simply? Good point! And it does, yes. But I found that it wasn't getting quite hot and brutal enough for my Dark Sun Campaign. Topping out at 110° F in the summer in the desert? Pshaw. 

So, I started looking around for solutions, found [this weather system](https://arena.athas.org/t/athasian-6-dimensional-weather-chart/2640) and then went down a rabbit hole. Full disclosure: I made **heavy** use of AI in developing this, so if that's not your jam, I totally get it. 

## Makin' it Rain
If you'd like to create your own weather effects -- maybe you're not on a post-apocalyptic desert world -- You should look over the `templates/settings_template.json` file. It is a template for describing the terrains and four dimensions of the weather on scales of -10 to 10. 

## Tips for Creating Settings

1. **Consider Your Setting's Climate:**
   - What's the normal temperature range?
   - How often does it rain?
   - Are there extreme weather conditions?

2. **Balance the Numbers:**
   - Base values (-10 to +10) should reflect relative conditions
   - Consider how time modifiers will affect the final values
   - Higher variability means more random weather changes

3. **Write Descriptive Text:**
   - Make descriptions vivid but concise
   - Include mechanical effects where relevant
   - Consider how weather affects gameplay

4. **Test Your Settings:**
   - Try different combinations of terrain and time
   - Check if the weather variations make sense
   - Ensure rules are clear and playable

## Example Values

### Desert Setting
- Temperature: Higher base values (5 to 10)
- Wind: Variable (-5 to 10)
- Precipitation: Very low (-10 to -5)
- Humidity: Low (-8 to -3)

### Tropical Setting
- Temperature: Moderate to high (2 to 8)
- Wind: Variable (-5 to 10)
- Precipitation: High (0 to 10)
- Humidity: High (5 to 10)

### Arctic Setting
- Temperature: Very low (-10 to -5)
- Wind: High (0 to 10)
- Precipitation: Moderate (-5 to 5)
- Humidity: Low (-5 to 0)

### File Structure
Create a new JSON file in the `campaign_settings` directory with the following structure:

```json
{
    "name": "Your Setting Name",
    "description": "Brief description of your setting's weather system",
    "version": "1.0",
    "seasons": {
        "spring": {
            "name": "Spring",
            "description": "A season of renewal and moderate weather.",
            "modifiers": {
                "temperature": 1,
                "wind": 1,
                "precipitation": 2,
                "humidity": 1,
                "variability": 2
            }
        },
        "summer": {
            "name": "Summer",
            "description": "The hottest season with increased humidity and potential for storms.",
            "modifiers": {
                "temperature": 3,
                "wind": 0,
                "precipitation": 1,
                "humidity": 2,
                "variability": 1
            }
        },
        "autumn": {
            "name": "Autumn",
            "description": "Cooling temperatures and increased wind bring changing weather patterns.",
            "modifiers": {
                "temperature": -1,
                "wind": 2,
                "precipitation": 1,
                "humidity": 0,
                "variability": 3
            }
        },
        "winter": {
            "name": "Winter",
            "description": "Cold temperatures and potential for snow and ice.",
            "modifiers": {
                "temperature": -3,
                "wind": 1,
                "precipitation": 0,
                "humidity": -1,
                "variability": 2
            }
        }
    },
    "weatherDimensions": {
        "temperature": {
            "descriptions": {
                "-10": "Extreme cold (0°F or lower)",
                "-5": "Very cold (20°F)",
                "-2": "Cold (35°F)",
                "0": "Cool (50°F)",
                "2": "Warm (70°F)",
                "5": "Hot (85°F)",
                "8": "Very hot (95°F)",
                "10": "Extreme heat (100°F or higher)"
            },
            "rules": [
                {
                    "extremeHeat": 10,
                    "description": "Extreme Heat",
                    "effect": "DC 5 Constitution save each hour (increases by 1 per hour) or gain 1 Exhaustion level. Creatures wearing Medium/Heavy armor have Disadvantage. Creatures with Fire Resistance/Immunity automatically succeed."
                },
                {
                    "extremeCold": -10,
                    "description": "Extreme Cold",
                    "effect": "DC 10 Constitution save each hour or gain 1 Exhaustion level. Creatures with Cold Resistance/Immunity automatically succeed."
                }
            ]
        },
        "wind": {
         "descriptions": {
            etc. 
         },
         "rules": [
            {
                    "strongWind": 2,
                    "description": "Strong Wind",
                    "effect": "A strong wind imposes Disadvantage on ranged attack rolls with weapons. It also extinguishes open flames and disperses fog. A flying creature in a strong wind must land at the end of its turn or fall. A strong wind in a desert can create a sandstorm that imposes Disadvantage on Wisdom (Perception) checks."
                }
         ]
        }
        // ... other dimensions
    },
    "timeModifiers": {
        "Early Morning": { "temperature": -2 },
        "Noon": { "temperature": 2 }
    },
    "terrains": {
        "arctic": {
            "name": "Arctic Tundra",
            "description": "Frozen wasteland with permafrost and sparse vegetation. Extreme cold and strong winds are common.",
            "temperature": -8,
            "wind": 3,
            "precipitation": -5,
            "humidity": -2,
            "variability": 2,
            "rules": [
                "Movement is Difficult terrain in deep snow"
            ]
        },
        // ... other terrains
    }
}
```

### Adding Your Setting
1. Place your JSON file (e.g. `mySetting.json`) into the `campaign_settings` directory.
2. In `campaign_settings/index.json`, add an entry to the `campaignSettings` array:
   ```json
   {
     "id": "mySetting",
     "name": "My Custom Setting",
     "path": "mySetting.json"
   }
   ```
3. Restart Foundry; the module reads `index.json` on load and will detect your new setting.
4. Select your custom setting in the module settings or via `/weather terrain ...`.

### Updating the Campaign Index

If you add new campaign setting JSON files to the `campaign_settings` directory or modify the `name` in existing ones, you need to update the `campaign_settings/index.json` file. This index file is used to populate the campaign selection dropdown in the module settings.

There's a helpful Node.js script to automate this process:

**Steps:**

1.  **Navigate to the Module Directory:** Open your terminal or command prompt and change the directory to the root of the `dimensional-weather` module:
    ```bash
    cd /path/to/your/foundryuserdata/Data/modules/dimensional-weather
    ```
    *(Replace `/path/to/your/foundryuserdata` with the actual path on your system)*

2.  **Run the Indexing Script:** Execute the following command:
    ```bash
    node scripts/generate-campaign-settings-index.js
    ```

3.  **Verification:** The script will scan the `campaign_settings` directory, read the `id` and `name` from each valid JSON file (excluding `index.json`), sort them alphabetically by name, and overwrite `campaign_settings/index.json` with the updated list. You should see a confirmation message in the terminal indicating how many entries were added.

That's it! The module settings will now reflect any changes you've made to the available campaign settings.

## API for Module Developers

The module provides a comprehensive API accessible via `game.dimWeather`:

### Weather Operations
```javascript
// Display current weather
await game.dimWeather.displayWeather();

// Force weather update
await game.dimWeather.updateWeather();

// Generate and display forecast
await game.dimWeather.displayForecast();
```

### Configuration
```javascript
// Change terrain (global or scene-specific via UI)
await game.dimWeather.setTerrain("desert");

// Change season
await game.dimWeather.setSeason("summer");

// Set variability (0-10)
await game.dimWeather.setVariability(7);

// Switch campaign setting
await game.dimWeather.updateCampaignSetting("athas");
```

### Information & Stats
```javascript
// Get current weather statistics
const stats = game.dimWeather.getWeatherStats();
console.log(stats);
/* Returns:
{
  initialized: true,
  weatherAvailable: true,
  campaign: "Athas",
  temperature: 5,
  wind: 3,
  precipitation: -8,
  humidity: -2,
  variability: 5,
  terrain: "Desert",
  season: "High Sun",
  lastUpdate: 1234567890,
  scene: "Scene Name"
}
*/

// Get current time period
const period = game.dimWeather.getTimePeriod(); // "Morning", "Noon", etc.

// Get help text
const help = game.dimWeather.getHelpText();
```

### Debug Controls
```javascript
// Toggle specific debug category
await game.dimWeather.toggleDebug("weather"); // Toggle on/off
await game.dimWeather.toggleDebug("time", true); // Explicitly enable

// Check debug status
const debugStatus = game.dimWeather.getDebugStatus();
// Returns: { weather: true, time: false, timePeriod: false, settings: false }

// Enable/disable all debug logging
await game.dimWeather.enableAllDebug();
await game.dimWeather.disableAllDebug();
```

**Debug Categories:**
- `weather` - Weather calculation and update logs
- `time` - Time utility function logs
- `timePeriod` - Time period calculation logs
- `settings` - Settings loading and management logs

### Utility Methods
```javascript
// Clear all caches
game.dimWeather.clearCaches();

// Display help in chat
await game.dimWeather.displayHelp();
```

### Complete API Reference

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `updateWeather()` | - | `Promise<boolean>` | Force weather update |
| `displayWeather()` | - | `Promise<boolean>` | Display weather in chat |
| `displayForecast()` | - | `Promise<string>` | Display forecast |
| `setTerrain(key)` | terrain key | `Promise<boolean>` | Change terrain |
| `setSeason(key)` | season key | `Promise<boolean>` | Change season |
| `setVariability(value)` | 0-10 | `Promise<boolean>` | Set randomness |
| `updateCampaignSetting(id)` | campaign id | `Promise<boolean>` | Switch campaign |
| `getWeatherStats()` | - | `Object` | Get weather data |
| `getTimePeriod()` | - | `string` | Get time period |
| `toggleDebug(category, enabled)` | category, boolean | `Promise<boolean>` | Toggle debug |
| `getDebugStatus()` | - | `Object` | Get debug status |
| `enableAllDebug()` | - | `Promise<void>` | Enable all debug |
| `disableAllDebug()` | - | `Promise<void>` | Disable all debug |
| `clearCaches()` | - | `void` | Clear all caches |

## Installation

1. Copy this URL: `https://github.com/ctbritt/dimensional-weather/releases/latest/download/module.json`
2. In Foundry VTT, go to Add-on Modules
3. Click "Install Module"
4. Paste the manifest URL and click Install

## To Do:
- [x] Enable custom styles for each campaign setting. In theory, Greyhawk current weather should not look the same as Athas current weather. 
- [ ] Create interface for building and editing custom json climate files.

- [x] Mask OpenAI key
- [x] Develop API for other module developers
- [x] Implement advanced scene and state management
- [x] Add performance optimizations and caching

## Dependencies
- [Chat Commands Library](https://gitlab.com/woodentavern/foundryvtt-chat-command-lib)
- [Seasons and Stars](https://github.com/rayners/fvtt-seasons-and-stars)
- [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper)

## License

This module is licensed under the MIT License. See the LICENSE file for details.

