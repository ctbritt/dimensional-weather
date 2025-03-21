# Dimensional Weather for FoundryVTT

A dynamic weather system for Foundry VTT, providing a modular system for developing your own climes, terrains, and atmospheric phenomenon.

## Description

This module adds a comprehensive weather system to your campaign, featuring:
- Terrain-specific weather patterns
- Survival rules based on conditions
- Private GM commands for weather management

## How it works

There are four weather dimensions and one terrain, so this is 5-dimensional weather calculations. 

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

The goal is to produce more or less "natural" weather changes without swinging wildly into situations you might get from mere random tables. (Heat wave followed by a cold snap, for example.)

Big swings can happen, it's just that they're less likely. 

You can rig the randomness by adjusting the "Random" slider in the module's settings.

### Chat Commands
There are robust chat commands. They are:

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


## How the Weather System Works

The Dimensional Weather system uses a dynamic, multi-dimensional approach to weather generation that combines:
- Base terrain conditions
- Time of day effects
- Random variability
- Special rules and effects

### Weather Dimensions

Each terrain has four primary dimensions that determine its weather:

1. **Temperature** (-10 to +10)
   - Example: A desert terrain might have a base temperature of +5
   - At noon, it might get a +2 modifier
   - With variability, it could range from +4 to +8

2. **Wind** (-10 to +10)
   - Example: Mountain terrain might have a base wind of +3
   - High variability could create gusts from +1 to +5
   - At wind +6 or higher, ranged attacks have disadvantage

3. **Precipitation** (-10 to +10)
   - Example: Forest terrain might have base precipitation of 0
   - Negative values represent clear skies
   - Values above +3 trigger visibility penalties

4. **Humidity** (-10 to +10)
   - Example: Coastal terrain might have base humidity of +2
   - Desert terrain might have -5
   - Affects how temperature feels and survival rules

### Example: Weather Generation

Let's see how weather is generated for a Scrub Plains terrain:

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
   - Temperature ≥ 2: Double water consumption
   - Wind ≥ 6: Ranged attack penalties
   - Precipitation ≥ 3: Visibility penalties

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

## Making it Rain
If you'd like to create your own weather effects -- maybe you're not on a post-apocalyptic desert world -- You should look over the `settings-template.json` file. It is a template for describing the terrains and four dimensions of the weather on scales of -10 to 10. 

Pop the file into the campaign_settings directory and then choose the locale using the dropdown menu in the settings panel. 

## File Structure

The settings file is a JSON document with the following main sections:

### Basic Metadata
```json
{
    "name": "Your Setting Name",
    "description": "Brief description of your setting's weather system",
    "version": "1.0"
}
```

### Weather Dimensions

The system uses four weather dimensions, each ranging from -10 to +10:
- Temperature
- Wind
- Precipitation
- Humidity

For each dimension, you define descriptions for key values. You don't need to define every number - the system will interpolate between defined values.

#### Temperature (-10 to +10)
- -10: Coldest possible conditions
- 0: Average temperature
- +10: Hottest possible conditions

Example: For a temperate setting, -10 might be 0°F, while for a desert setting, it might be 40°F.

#### Wind (-10 to +10)
- -10: Dead calm
- 0: Normal conditions
- +10: Hurricane force

#### Precipitation (-10 to +10)
- -10: Clear skies
- 0: Light rain/snow
- +10: Torrential downpour

#### Humidity (-10 to +10)
- -10: Bone dry
- 0: Normal humidity
- +10: Oppressively humid

### Time Modifiers

Time of day affects temperature. Define modifiers for:
- Early Morning
- Noon
- Afternoon
- Night
- Late Night

Example:
```json
"timeModifiers": {
    "Early Morning": { "temperature": -2 },
    "Noon": { "temperature": 2 }
}
```

### Terrains

Each terrain type needs:
- `name`: Display name
- `description`: Narrative description
- `temperature`: Base modifier (-10 to +10)
- `wind`: Base modifier (-10 to +10)
- `precipitation`: Base modifier (-10 to +10)
- `humidity`: Base modifier (-10 to +10)
- `variability`: How much weather varies (0-10)
- `rules`: Array of special rules

Example:
```json
"plains": {
    "name": "Plains",
    "description": "Open grasslands with rolling hills",
    "temperature": 0,
    "wind": 2,
    "precipitation": 0,
    "humidity": 0,
    "variability": 3,
    "rules": []
}
```

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

## Dependencies
- [Chat Commands Library](https://gitlab.com/woodentavern/foundryvtt-chat-command-lib)
- [About Time](https://github.com/LeafWulf/about-time)
- [Simple Calendar](https://github.com/vigoren/foundryvtt-simple-calendar)
- [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper)


## License

This module is licensed under the MIT License. See the LICENSE file for details.

