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

1. Create a crew or join a six-character crew code. Invite up to three friends. Host starts the sortie; late joins are supported.
2. WASD walks; drag the scene to look; E uses/leaves a nearby station. Bottom shortcuts physically walk down the aisle to the selected station, then click Use.
3. Pilot: bank to change heading, then level to hold course. Pitch changes altitude. Controls hold when pilot leaves, making solo station switching possible. No autonomous AI crew.
4. Navigator: fly heading 090°, altitude strictly between 2500 and 3500 m, bank under 5°, and build 12 seconds of stable solution once in the attack phase. Release within the 65-second attack window.
5. Engineer: prioritize fire, leaks, then engines/power/oxygen. Actions have a three-second cooldown. Hull cannot be repaired in flight. Engine patches cap at 85%.
6. Gunner: fire bursts against fighter threats before impact. Aim is assisted, not an aiming simulation. Ammo is limited.
7. Return: turn to 270°, descend, then land when distance ≤0.5 km, altitude ≤400 m, throttle ≤50%, bank <8°. Landing itself is a condition-gated action, not runway physics.
8. Aborting can save the crew. Bailout ends the sortie for everyone. Fuel exhaustion or loss of all engines causes ditching. Structural failure loses the aircraft.

Desktop recommended. Mobile layout and station-walk shortcuts are provided. Use external voice chat; built-in intercom is preset text calls. Engine sound is opt-in.

## Implemented

- Procedural 3D interior, cockpit, four stations, visible other crew members, countryside, clouds, engine propellers and an approaching fighter.
- Server-authoritative 10 Hz simulation, four-player capped isolated rooms, station exclusivity, server-side walking speed, bounded controls, rate and payload limits, origin checks, dead-socket cleanup.
- One airborne mission: outbound, attack, return, debrief; partial success and replay.
- Fuel leaks, port-engine fires, electrical/oxygen damage, flak, fighters, limited repairs and ammo.
- Multiple system consequences: fire damages engine/hull, leaks consume fuel, engine damage reduces speed, low electricity drifts bank. Oxygen affects displayed internal crew health at high altitude, but incapacitation is not implemented.
- Font is optionally loaded from Google Fonts, with local fallbacks. Three.js is served locally from npm.

## Deliberately not implemented

Takeoff; realistic aerodynamics or collision physics; manual turret aiming; individual injuries/incapacitation; voice chat; navigation by landmarks; multiple missions; aircraft customization; persistent scars/upgrades; campaign progression; reconnect-seat recovery; public matchmaking; production authentication/abuse protection.

Rooms are in memory and disappear when the last player leaves or the server restarts. Replay resets aircraft condition. No public GitHub repository or public tunnel was created.

## Verification

```sh
npm test
npx playwright install chromium
# start npm start separately
node browser-test.js
# for private deployed preview:
URL=http://100.122.62.101:8790 node browser-test.js
```

Tests cover mission phases, roles and cooldowns, cap/isolation with real WebSockets, malformed station names, replay reset, and 20 seeded full sorties driven only by crew actions and simulation ticks. Browser tests use two independent clients, all four stations, bailout/replay, and a mobile viewport. Screenshots go to `artifacts/`.

Testing note: the original live 2D canvas route map caused a compositor/screenshot hang in headless Chromium with SwiftShader. The final map uses SVG; the same browser interaction test then completed. Keep SVG for lightweight HUD maps so they do not require an additional canvas rendering context alongside Three.js.

## Files

- `game.js`: authoritative pure simulation
- `server.js`: allowlisted assets, rooms and WebSocket transport
- `public/app.js`: procedural scene, controls and HUD
- `test/`: unit/integration/sortie tests
- `browser-test.js`: Playwright interaction checks
- `DESIGN.md`: MVP boundaries and visual language

## The question this MVP answers

Does physically sharing a damage-prone aircraft, with more jobs than crew available, produce interesting cooperation? This version is an experiment, not a production foundation. Human playtest verdict: pending.
