<a href="https://www.buymeacoffee.com/weemaba">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="41" width="174">
</a>

# HA Hub for UlanziDeck

[![Available on Ulanzi Community Store](https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/docs/badges/ulanzi-community-store.svg)](https://ulanzicommunitystore.narlei.com)

> Bring your Home Assistant home into reach. Live state on every key,
> long-press to dial, multi-entity hubs, and a stylized HA logo reveal
> when you switch pages.

[![Version](https://img.shields.io/badge/version-0.11.13--beta-orange)](#)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![Status](https://img.shields.io/badge/status-beta-yellow)](#status)
[![Ulanzi SDK](https://img.shields.io/badge/Ulanzi%20SDK-v2.1.2-green)](https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK)

HA Hub is an open-source plugin for the **UlanziDeck D200 / D200X / Dial**
that turns the stream deck into a Home Assistant control surface. Every key
reflects HA state in real time over WebSocket; presses send service calls;
long-presses on lights, climate, covers, media players, and fans hand off
to a "Smart Dialer" encoder that adjusts brightness, temperature, volume —
whichever fits the entity. Aggregate keys watch sets of binary sensors and
pulse when something is active.

## Highlights

- **Live state**, no polling — HA's `state-changed` events drive every render
- **8 action types** covering toggles, scenes, services, sensors, encoders,
  and two more (Smart Toggle, Smart Dialer, Aggregate) that don't exist
  elsewhere
- **Long-press → Smart Dialer**: hold any light/climate/cover/media_player
  key for 700 ms, then turn the dial — works for every device with a single
  encoder
- **Pulse animations** with configurable color, speed, and trigger state
- **HA logo reveal** on page switch (per-tile flip or experimental
  coordinated puzzle reveal across all keys)
- **Test connection** button gives instant ✓ / ✖ feedback in the property
  inspector
- **Global URL + token** — configure once, every key inherits

## Action types

| Action | What it does |
|---|---|
| **HA Toggle** | Toggle switches, lights, plugs, fans, covers, media players, climate. Custom on/off text. Pulse when in a configured state. |
| **HA Smart Toggle** | Display state from one entity (e.g. `binary_sensor.washer_running`), tap toggles a different entity (e.g. `input_boolean.deferrable_wm_forced`). Optional ⚡ FORCED badge. |
| **HA Aggregate** | Watch a comma-separated list of entities, show "active count / total" on the key, pulse when count > 0. |
| **HA Scene** | Trigger scenes, scripts, automations. Confirmation flash. |
| **HA Service Call** | Invoke any HA service with custom JSON data — `notify.*`, `cover.set_position`, anything. |
| **HA Sensor** | Read-only display of any sensor with optional thresholds for warning colors. |
| **HA Encoder** | Rotary dial bound to one entity (brightness, volume, temperature, numeric). |
| **HA Smart Dialer** | Universal dial: long-press any HA Toggle / Smart Toggle on a light/climate/cover/media_player/fan, then rotate this dial to adjust the matching property. |

## Status

**0.11.13 beta.** Tested on UlanziDeck D200X with Home Assistant Core 2026.x
on a single home setup. Eight action types, ~20 SDK quirks worked through,
solid for daily use. Real-world testing on diverse setups is still in
progress — please report issues with reproduction steps.

## Installation

### Prerequisites

- **Ulanzi Studio 3.0.11** or later
  ([download](https://www.ulanzi.com/pages/ulanzi-app))
- **Home Assistant** instance reachable from the PC running Ulanzi Studio
- A **Long-lived access token** from HA: Profile → Security → Long-lived
  access tokens

### Install the plugin

1. Download the latest release zip from the
   [GitHub Releases](../../releases) page
2. Quit Ulanzi Studio fully (system tray → Exit, not just close window)
3. Copy the `com.ulanzi.hahub.ulanziPlugin` folder into:
   - **Windows**: `%APPDATA%\Ulanzi\UlanziDeck\Plugins\`
   - **macOS**: `~/Library/Application Support/Ulanzi/UlanziDeck/Plugins/`
4. Start Ulanzi Studio — the **HA Hub** action group appears in the action
   list

### First-time setup

1. Drag any HA Hub action onto a key
2. Click the key — the Property Inspector opens at the bottom
3. Enter your **HA URL** (use IP, e.g. `http://192.168.1.10:8123` —
   include the port!) and **Long-lived token**
4. Click **Test connection** — expect ✓ Connected — N entities
5. URL + token are saved globally; subsequent keys auto-fill these fields
6. Configure the action's entity, label, theme, etc.

## Smart Dialer pattern (the killer feature)

Place a **HA Smart Dialer** on one of the rotary encoders (the 3 dials
below the LCD keys on D200X). Then on any HA Toggle key with a
`light.*` / `climate.*` / `cover.*` / `media_player.*` / `fan.*` entity:

1. **Long-press** the key for 700 ms
2. The key turns cyan, pulses, shows the current value (e.g. `67%`)
3. Rotate the Smart Dialer to adjust — light dims, climate cools, etc.
4. Press the dial to toggle on/off
5. **Tap** the source key to confirm, or wait 15 s for auto-exit

One dial controls every dimmable / variable entity in your HA install.

## Aggregate + Folder pattern

For "is anything running?" indicators:

1. Place an **HA Aggregate** key with comma-separated entity IDs
   (e.g. four `binary_sensor.*_running` sensors)
2. Use Ulanzi Studio's built-in Folder feature to create a sub-page
3. Place individual **HA Smart Toggle** keys inside the folder, one per
   device

The Aggregate pulses when anything is active; the Folder lets you drill in.

> ℹ️ Ulanzi's plugin SDK does not currently let plugins navigate folders
> programmatically, so the Aggregate is purely visual. A
> [feature request](https://github.com/weemaba999/ha-hub-ulanzi/issues/1)
> is open with Ulanzi to add this.

## Configuration tips

- **Use IP, not `.local`** — `http://192.168.1.10:8123` is more reliable
  than `homeassistant.local`
- **Always include the port** (`:8123` is the HA default — leaving it off
  defaults to port 80 and fails)
- **One token, all keys** — global connection, only enter once
- **Friendly names** — the entity picker searches both `entity_id` and
  `friendly_name`, so typing "office" finds `switch.zb_plug_office`
- **CORS for Test connection** — if "Test connection" fails with a CORS
  error, add to your `configuration.yaml`:
  ```yaml
  http:
    cors_allowed_origins:
      - "null"
      - "file://"
  ```
  Then restart HA. Note this is only for the Test button, the runtime
  WebSocket connection works without CORS.

## Architecture

```
┌──────────────────┐    WebSocket     ┌──────────────────┐
│  Home Assistant  │ ←─────────────→  │  HA Hub plugin   │
│   (port 8123)    │   subscribe_     │  (Ulanzi Studio) │
└──────────────────┘   events         └──────────────────┘
                                              │ canvas-rendered icons
                                              ↓
                                       ┌──────────────────┐
                                       │  UlanziDeck D200X │
                                       │  (LCD keys + dial)│
                                       └──────────────────┘
```

One WebSocket connection serves all keys. State changes push to every
subscribed action. Service calls go through the same socket. REST is used
as fallback only.

## Trademark notice

Home Assistant is a registered trademark of the Open Home Foundation.
This plugin is **not affiliated with or endorsed by** Nabu Casa Inc. or
the Home Assistant project. The HA-style logo used in the reveal animation
is drawn from canvas primitives (a stylized house-with-antenna) — it is
intentionally not a 1:1 reproduction of the official Home Assistant logo,
to avoid trademark issues. The plugin uses HA's WebSocket API to interact
with HA in the user's home, which constitutes nominative use only.

UlanziDeck and Ulanzi Studio are trademarks of Ulanzi. This plugin uses the
official Ulanzi Plugin SDK and is distributed under the same AGPL-3.0
license as the SDK.

## Roadmap (post-1.0)

- Macro action — chains of actions with delays
- Custom JS code mode — programmable per-key state mapping
- Multi-action per key (tap / double-tap / long-press to different actions)
- Conditional visibility based on HA template
- Service autocomplete via HA `get_services` WebSocket call
- Localized UI (currently English; was Dutch in early development)

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[AGPL-3.0](LICENSE) — to match the Ulanzi SDK license. Forks and
modifications must publish source.

## Acknowledgments

- [UlanziDeck Plugin SDK](https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK)
- [Home Assistant WebSocket API](https://developers.home-assistant.io/docs/api/websocket)
- Built by Bart over a long pair-programming arc with Claude (Anthropic).
