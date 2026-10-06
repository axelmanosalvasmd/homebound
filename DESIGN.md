# HOMEBOUND design

## Promise

The victory is bringing your crew home, not merely emptying the bomb bay. The aircraft is a shared place with competing responsibilities. Jobs are stations, not character classes.

## Decisions (station rework)

- The aircraft is a B-17G at roughly 1:1 scale, nose to tail: glazed nose (bombardier, chin turret, navigator), raised flight deck, top turret, bomb-bay catwalk, radio room, ball turret, staggered waist guns, tail gunner. The walkable width follows the cabin.
- Every station is played in first person. No side panels: gauges, the chart and the sight are in the world; the HUD is the intercom, an interaction prompt and a key-help line.
- Nine positions for up to four players. Guns have their real fields of fire, so the crew chooses which flanks to cover.
- Navigation is a skill: no position marker, wind drift, a Germany-inspired map (England, Channel, occupied Netherlands, the Rhine, a Ruhr-style flak belt) and a decoy yard. The chart and the terrain are painted from one data file.
- Bombing accuracy comes from the predicted impact point, wind included.
- Damage is fixed by walking to it. Anyone can repair.

## Visual language

Gunmetal panels, khaki hairline borders, brass accents, Barlow Semi Condensed headings and IBM Plex Mono instrumentation. Background #151b1b; ink #e7e1d1; brass #d1b777; red #e07861; green #94bb91. No neon, glossy cards or modern military HUD clutter. Procedural low-poly geometry, visible structural ribs and warm interior light. Touch interfaces retain the desktop station vocabulary.

## Risk / next playtest

- Can solo players handle the return turn while servicing failures?
- Are the station roles engaging without realistic flying or manual aim?
- Can players tell when a repair matters?
- Are failures too infrequent with a full competent crew?
- Does the conditional landing feel like an anticlimax? If yes, landing is the next playable vertical slice.
- There is no persistence. Only add a campaign after a crew enjoys one sortie.

## Known abstraction

Distances are compressed: the bomber cruises near 800 km/h so a round trip fits in 10-15 minutes, and the gauges show that honestly so navigation arithmetic works. Bombs fall on a vacuum trajectory. Fighters fly scripted approach-and-break passes, not flight models. Oxygen damage lowers crew health but does not incapacitate.
