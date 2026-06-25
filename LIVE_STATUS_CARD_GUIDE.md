# Live Status Card Guide 🎮

## Overview

The **Live Status Card** is a modern, real-time status display for your Minecraft server. It features a neon-styled design with automatic updates and comprehensive server information.

## Features

✨ **Modern Neon Design**
- Cyan/green neon border with glow effects
- Professional gradient overlays
- Responsive layout

📊 **Real-Time Information**
- Server status (Online/Offline)
- Player count with progress bar
- Server version
- IP address and port
- Performance metrics (Ping, TPS, Uptime)

🔄 **Automatic Updates**
- Configurable update intervals (1-60 minutes)
- Auto-rotating wallpapers
- Live timestamp

🎨 **Customization**
- Multiple card templates (Neon, Glass, Dark Mode)
- Custom wallpapers
- Flexible update intervals

## Setup Instructions

### Step 1: Configure Your Server

First, ensure your server is properly configured:

```
/server-setup
```

### Step 2: Create Live Status Card

Use the setup command to create a live status card:

```
/live-setup channel:<#channel> template:neon auto_wallpaper:true update_interval:1
```

**Parameters:**
- `channel` (Required): The Discord channel where the status card will be displayed
- `template` (Optional): Card design template
  - `neon` (Recommended) - Modern neon style
  - `glass` - Glass morphism style
  - `darkmode` - Dark theme
- `auto_wallpaper` (Optional): Enable automatic wallpaper rotation (default: true)
- `update_interval` (Optional): Update frequency in minutes, 1-60 (default: 1)

### Step 3: Manual Updates

To manually refresh the status card at any time:

```
/live-update
```

## Card Layout

The live status card displays:

```
┌─────────────────────────────────────────────────────────────┐
│ ● LIVE    ⊙ Up-to-date         ⊙ Updated 5 min ago         │
│                                                              │
│  [Server Icon]  CUBECRAFT          ┌─────────────────────┐ │
│  with glow       Server Name        │ ● ONLINE            │ │
│                                     │ The server is       │ │
│                                     │ running smoothly    │ │
│                  👥 Players: 875/5000│ and fully           │ │
│                  🎮 Version: 1.20-1.21│ operational.      │ │
│                  🌐 IP: play.cubecraft.net                 │ │
│                  [████████░░] 87%                           │ │
│                                                              │
│                  📊 Ping: 28ms  ⚡ TPS: 20.0  ✓ Uptime: 99.9%│
│                                                              │
│                           PROMCBOT LIVE • 14:32:45          │
└─────────────────────────────────────────────────────────────┘
```

## Neon Template Features

### Color Scheme
- **Primary**: Cyan (#00FFC8)
- **Accent**: Green (#00CC99)
- **Background**: Dark Navy (#0a0e1a)
- **Text**: White with transparency variations

### Visual Elements
- Neon glowing borders
- Gradient overlays
- Shadow effects for depth
- Rounded corners for modern look
- Status badges with color coding

### Status Indicators
- **Online**: Green neon (#00FFC8)
- **Offline**: Red (#FF5E5E)
- **Updating**: Cyan pulse effect

## Performance Metrics

The card displays three key metrics:

| Metric | Description | Example |
|--------|-------------|---------|
| **Ping** | Server response time | 28 ms |
| **TPS** | Ticks Per Second (server performance) | 20.0 |
| **Uptime** | Server availability percentage | 99.9% |

## Wallpaper Rotation

By default, the card rotates through a set of Minecraft-themed wallpapers every minute:

1. Forest shader pack
2. Pine forest scenery
3. Red Hat shader
4. Custom wallpaper 1
5. Custom wallpaper 2

To use a custom wallpaper, set it in your server configuration:

```
/server-setup wallpaper:<url>
```

## Troubleshooting

### Card Not Updating
- Check if the bot has permission to edit messages in the channel
- Verify the server configuration is correct
- Try running `/live-update` manually

### Icon Not Loading
- Ensure the server IP is correct
- Check if the server is reachable
- Verify the Minecraft server is running

### Wallpaper Not Showing
- Check if the image URL is accessible
- Ensure the image is in a supported format (PNG, JPG)
- Try disabling auto_wallpaper and setting a custom one

## Advanced Configuration

### Update Intervals

Set different update frequencies based on your needs:

- **1 minute** (default): Real-time updates, higher resource usage
- **5 minutes**: Balanced performance and freshness
- **15 minutes**: Low resource usage, less frequent updates
- **60 minutes**: Minimal updates, good for low-traffic servers

### Multiple Status Cards

You can create multiple status cards in different channels:

```
/live-setup channel:#status-java template:neon
/live-setup channel:#status-bedrock template:glass
```

## API Integration

The live status card uses the following APIs:

- **Server Status**: `api.mcsrvstat.us` - Minecraft server status
- **Server Icon**: `api.mcstatus.io` - Server icon retrieval
- **Player Skin**: `render.crafty.gg` - 3D player skin rendering

## Best Practices

1. **Channel Permissions**: Ensure the bot has full permissions in the status channel
2. **Update Interval**: Use 1-5 minutes for active servers, 15-60 for casual servers
3. **Wallpapers**: Use high-quality images for better appearance
4. **Backups**: Keep a backup of your status card configuration
5. **Monitoring**: Check the status card regularly for any issues

## Support

For issues or feature requests, please:

1. Check the troubleshooting section
2. Verify all configurations are correct
3. Contact the bot support team
4. Check the GitHub repository for updates

## Version History

### v1.0.0 (Current)
- Initial release of Live Status Card
- Neon, Glass, and Dark Mode templates
- Auto-rotating wallpapers
- Real-time performance metrics
- Configurable update intervals

---

**Last Updated**: June 2026
**Bot**: PROMCBOT
**Status**: Active & Maintained
