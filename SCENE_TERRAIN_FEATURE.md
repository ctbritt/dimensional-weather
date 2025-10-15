# Scene-Specific Terrain Feature

## Overview

The Dimensional Weather module now supports **scene-specific terrain assignment**. This allows each scene to have its own terrain type, enabling automatic weather changes when switching between different locations (e.g., city scenes vs. mountain scenes).

## How It Works

### Scene Configuration UI

When configuring a scene (right-click scene → Configure), you'll find a new **"Scene Terrain"** dropdown in the Ambience tab:

- **Location**: Scene Configuration → Ambience tab → Basic Options → Scene Terrain dropdown
- **Tooltip**: Hover over the "Scene Terrain" label for usage instructions
- **Options**:
  - "None (Use Global Setting)" - Uses the module's global terrain setting
  - All available terrains from your current campaign (e.g., City, Mountains, Sandy Wastes, etc.)

### Automatic Terrain Switching

When you activate a scene with a specific terrain assigned:
1. The weather system automatically detects the scene's terrain
2. Weather initializes or updates to match that terrain
3. All `/weather` commands use the scene-specific terrain

### Priority System

The terrain resolution follows this priority:
1. **Scene-specific terrain** (set in Scene Config) - highest priority
2. **Global terrain setting** (module settings) - fallback
3. **Manual override** (via `/weather terrain` command) - updates scene's weather state

## Usage Examples

### Example 1: City and Mountain Scenes

**Setup:**
1. Create a scene called "Tyr - Market District"
   - Right-click → Configure → Ambience tab
   - Set "Weather Terrain" to "City"
   - Save

2. Create a scene called "Ringing Mountains Pass"
   - Right-click → Configure → Ambience tab
   - Set "Weather Terrain" to "Mountains"
   - Save

**Result:**
- Activate "Tyr - Market District" → Weather shows city conditions (reduced wind, moderate heat, crowds)
- Activate "Ringing Mountains Pass" → Weather automatically switches to mountain conditions (high winds, extreme temperature swings)
- No manual terrain switching needed!

### Example 2: Mixed Approach

You can mix scene-specific and global terrains:
- Assign specific terrains to important recurring locations (cities, dungeons, etc.)
- Leave wilderness/travel scenes set to "None"
- Change global terrain as party travels through different regions

## Slash Command Integration

Slash commands still work and interact with scene terrain:

### View Current Weather
```
/weather
```
Shows weather for the active scene's terrain (scene-specific or global)

### Manually Change Terrain
```
/weather terrain City
```
This updates the **active scene's** weather state terrain. If the scene had a specific terrain assigned, the manual command takes precedence until the scene is reloaded or terrain is changed again.

### View Available Terrains
```
/weather help
```
Lists all available terrains for the current campaign

## Technical Details

### Scene Flags
Scene-specific terrain is stored as a scene flag:
```javascript
scene.flags["dimensional-weather"]["terrain"] = "city" // or "" for global
```

### Weather State Storage
Each scene maintains its own weather state:
```javascript
scene.flags["dimensional-weather"]["weatherState"] = {
  temperature: 1,
  wind: -4,
  precipitation: -10,
  humidity: -3,
  terrain: "city",  // Current terrain in use
  season: "highSun",
  lastUpdate: 1234567890
}
```

### Terrain Change Detection
The system automatically detects when:
- A scene's terrain flag changes (e.g., you edit it in Scene Config)
- The global terrain changes (for scenes without specific terrain)
- Weather is reinitialized with new terrain baseline values

## Benefits

1. **Automatic Context Switching** - Weather matches location without manual commands
2. **Scene Persistence** - Each scene remembers its weather conditions
3. **Flexible Setup** - Mix scene-specific and global terrains as needed
4. **GM Friendly** - Set it once, works automatically thereafter
5. **Player Immersion** - Consistent weather per location enhances worldbuilding

## Migration from Previous Versions

Existing scenes without terrain assignments will continue to work normally using the global terrain setting. To add scene-specific terrains:

1. Open each scene's configuration
2. Set the "Weather Terrain" dropdown
3. Save

The weather will automatically reinitialize with the new terrain on next activation.

## API for Module Developers

Module developers can interact with scene-specific terrain:

```javascript
// Get terrain for a scene
const terrain = game.modules.get('dimensional-weather').api.SceneConfiguration.getSceneTerrain(scene);

// Set terrain for a scene
await game.modules.get('dimensional-weather').api.SceneConfiguration.setSceneTerrain(scene, "city");

// Get available terrain choices
const choices = await game.modules.get('dimensional-weather').api.SceneConfiguration.getTerrainChoices();
```

## Troubleshooting

**Q: I changed the scene terrain but weather didn't update**
A: Try running `/weather update` to force a weather refresh, or reactivate the scene.

**Q: My scene terrain dropdown is empty**
A: Ensure you have a valid campaign selected in module settings with terrain definitions.

**Q: Weather is using wrong terrain**
A: Check both:
1. Scene Configuration → Weather Terrain setting
2. Module Settings → Global terrain setting

**Q: Can I change terrain mid-session?**
A: Yes! Edit the scene configuration, change the terrain, and run `/weather update` to apply immediately.

## Implementation Files

The following files were modified/created for this feature:

- **NEW**: `scripts/scene-config.js` - Scene configuration UI and terrain management
- **MODIFIED**: `scripts/main.js` - Registers scene configuration hooks
- **MODIFIED**: `scripts/weather-engine.js` - Checks scene-specific terrain on init/update
- **MODIFIED**: `module.json` - Includes new scene-config.js module

## Future Enhancements

Potential future additions:
- Scene-specific season overrides
- Weather presets per scene
- Import/export scene weather configurations
- Weather synchronization between linked scenes
