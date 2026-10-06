# HOMEBOUND

A playable greybox MVP of a first-person, cooperative WWII-inspired bomber crew game. Built for 1–4 players. Not a historically accurate flight simulator.

## Run

Requires Node 22+.

```sh
npm ci
npm start
```

Default listener: `127.0.0.1:8790`. Override `HOST` and `PORT` explicitly to expose a preview. Serve the actual backend, not the repository with a static server. There are no accounts and no saved games. Room codes are invitations, not strong authentication. The current deployed preview binds only to Tailscale.

Private preview: `http://100.122.62.101:8790` (device must be on the authorized tailnet). Service: `systemctl --user status homebound`.

## Play

Desktop with mouse and keyboard. Click the view to capture the mouse (Esc frees it). WASD walks the B-17G, E takes or leaves a crew position, holding E repairs damage you are standing at, and 1-4 send intercom calls. Use a voice call with your crew.

The host starts the sortie airborne over Ashby Green in England. The target is the Hammfeld marshalling yard in Germany, across the Channel, the occupied Dutch coast and the Rhine. There is no map marker: navigation is part of the challenge.

- **Pilot (flight deck):** A/D bank, W/S nose down/up, Shift/Ctrl throttle, Space levels the wings, G gear, hold B to bail out. Read the live panel: airspeed, altimeter, compass, artificial horizon, fuel, climb, four engines with fire lamps, gear lamp. Controls hold when the pilot leaves.
- **Navigator (nose table):** a period chart of the whole area, drawn from the same data as the terrain below. Click to pencil in a position fix, look at a destination and press C to call a course, distance and time over the intercom. The repeater shows compass, airspeed, altitude and clock. The forecast wind is 290° at 55 km/h; the real wind differs each sortie. Lindenau, 20 km south of Hammfeld, has a similar yard.
- **Bombardier (Norden sight):** a stabilised view of where the bombs will land, wind drift included. A/D make small corrections through the autopilot; Space releases. Accuracy decides target damage.
- **Gunners:** chin, top and ball turrets (powered, dead without electrics), left and right waist, tail. Each has its real field of fire. Mouse aims, hold the button to fire, right mouse zooms. Fighters attack from any clock position, high or low, and come round for a second pass.
- **Damage:** engine fires (fire bottles behind the pilots), fuel leaks (bomb bay transfer valves), electrics (radio room junction box), oxygen (waist regulators), and cabin fires where they burn. Anyone can repair; walk there and hold E. Flak covers towns and the target.
- **Landing:** gear down over the home field, below 400 m, throttle at 50% or less, wings nearly level.

Up to four crew, nine positions. A sortie takes roughly 10-15 minutes.

## Not implemented

Takeoff; realistic aerodynamics or collisions; individual injuries; voice chat; multiple missions; campaign progression; reconnect-seat recovery; public matchmaking; production authentication. Touch devices are not supported since the station rework. Rooms are in memory and disappear when the last player leaves or the server restarts.

## Verification

```sh
npm test
npx playwright install chromium-headless-shell
# start npm start separately
node browser-test.js
```

Tests cover station exclusivity and the walkable cabin, hand repairs, gun arcs and powered turrets, bomb-impact scoring, landing rules, chart marks, fighters attacking from several sides, real WebSockets, malformed input, and 20 seeded full sorties flown by a bot crew (wind-corrected navigation, a bombardier, one tail gunner, one repairer). The browser test drives two clients with the keyboard and screenshots to `artifacts/`. Headless Chromium renders on the CPU at a few frames per second, so its waits are long.

## Files

- `game.js`: authoritative pure simulation
- `public/map.js`: shared geography plus the chart and terrain painters
- `server.js`: allowlisted assets, rooms and WebSocket transport
- `public/app.js`: B-17G interior, terrain, fighters, first-person stations and HUD
- `test/`: unit/integration/sortie tests
- `browser-test.js`: Playwright interaction checks
- `DESIGN.md`: design decisions and visual language

## The question this MVP answers

Does physically sharing a damage-prone aircraft, with more jobs than crew available, produce interesting cooperation? This version is an experiment, not a production foundation. Human playtest verdict: pending.
