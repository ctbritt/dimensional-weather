# Dimensional Weather for FoundryVTT

A dynamic weather system for Foundry VTT, providing a modular system for developing your own climes, terrains, and atmospheric phenomenon.

## Description

This module adds a comprehensive weather system to your campaign, featuring:
- Modular campaign settings system
- Terrain-specific weather patterns
- Survival rules based on conditions
- Private GM commands for weather management
- Optional AI-powered weather descriptions

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

Let's see how weather is generated for a Scrub Plains terrain (from my Dark Sun Camapign), which corresponds roughly to savannah:

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
   These are determined by your camapign. I'm using the [extreme heat](https://www.dndbeyond.com/sources/dnd/dmg-2024/dms-toolbox#ExtremeHeat), [extreme cold](https://www.dndbeyond.com/sources/dnd/dmg-2024/dms-toolbox#ExtremeCold), [strong winds](https://www.dndbeyond.com/sources/dnd/dmg-2024/dms-toolbox#ExtremeHeat), and [heavy precipitation](https://www.dndbeyond.com/sources/dnd/dmg-2024/dms-toolbox#HeavyPrecipitation) from the Dungeon's Masters Guide, but you can use whatever rules you want. 

   For example:
   - Temperature ≥ 2: Double water consumption
   - Wind ≥ 6: Ranged attack penalties
   - Precipitation ≥ 3: Visibility penalties

These thresholds are determined by a setting json file (see below). In this example, a wind score of more than 5 corresponds to a Strong Wind, as governed by the DMG. 

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

### AI Integration (Optional)

When AI descriptions are enabled:
1. System combines all weather factors
2. Generates atmospheric descriptions
3. Focuses on survival-relevant information
4. Updates descriptions based on time of day

### Chat Commands
Available chat commands:

- `/weather` - Display current weather (available to all)
- `/weather campaign [setting]` - Change campaign setting (GM only)
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
If you'd like to create your own weather effects -- maybe you're not on a post-apocalyptic desert world -- You should look over the `settings-template.json` file. It is a template for describing the terrains and four dimensions of the weather on scales of -10 to 10. 

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
1. Place your JSON file in the `campaign_settings` directory. There are already two files there. One for Athas and one for a default, earth-like world.
2. The module will automatically detect and load your setting
3. Select your setting from the module settings or using the chat command

## Installation

1. Copy this URL: `[your manifest URL]`
2. In Foundry VTT, go to Add-on Modules
3. Click "Install Module"
4. Paste the manifest URL and click Install





## Dependencies
- [Chat Commands Library](https://gitlab.com/woodentavern/foundryvtt-chat-command-lib)
- [About Time](https://github.com/LeafWulf/about-time)
- [Simple Calendar](https://github.com/vigoren/foundryvtt-simple-calendar)
- [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper)


## License

This module is licensed under the MIT License. See the LICENSE file for details.

