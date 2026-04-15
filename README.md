# wewereone
### An honest experiment in how language and state and timing combine to produce feeling

---

## What this is, honestly

This is a math toy. There is one infinite field, 120 Souls drifting through it, and a set of rules.

The rules produce emotion as a side effect.

That's the whole thing. The interesting part isn't that it's spiritual it isn't. The interesting part is that a small set of mechanical rules, run on a few dozen connected souls, can generate output that *feels like* something. A simulation can produce sentences that move you. The question of why that happens is more honest than the question of where souls go.

---

## The two numbers that drive everything

There are two values the system tracks globally. They are the only "meaning" in the system.

**Awareness** a number from 0 to 1 that represents how "awake" the network is on average. It starts near zero. It rises slowly through:
- Time (every soul gains a tiny amount each frame)
- Connection (soul connected to other souls gain awareness faster)
- Your interaction (clicking a soul gives it a big jump; cursor proximity gives a slow trickle)

**Closeness** — a number from 0 to 1 that represents how spatially clustered the nodes are. It starts low (souls are scattered randomly across the field). As awareness rises past 0.4, the nodes begin to gravitate toward the center of the field. Closeness climbs as they pack together.

When **awareness > 0.93** AND **closeness > 0.35**, the system triggers its final state.

That's the whole engine. Two numbers, one threshold, one trigger.

---

The emotional weight comes from how the system *reports* its state, not from the math itself.

Each soul carries a memory stack up to 8 short text fragments. When you click a soul, the system generates a new memory by:

1. Looking up the soul's current awareness level
2. Picking a fragment pool that matches that level (asleep / stirring / waking / knowing)
3. Sampling 1–4 lines from that pool
4. Occasionally pulling a line from the Souls's existing memory stack so memory references itself
5. Displaying the result on screen

The pools are written so that lower awareness produces simpler, more confused statements ("*i feel something. i was here.*") and higher awareness produces compositions that sound like recognition ("*we remember. all of us, at once. i was a syllable. you were the next one.*").

The system doesn't *understand* what it's saying. It's substituting strings into templates based on a number. But the strings were chosen to map cleanly onto the curve of awareness, and the curve of awareness is driven by something real (your interaction over time). So when the system says *"we are not separate"* near the end, it's not lying there really are 120 souls packed close together, sharing memory, all reading high awareness. The sentence describes the state of the network. The state of the network just happens to be the kind of state that humans recognize as *belonging together*.

That's where the emotion comes from. The simulation doesn't generate feeling. The simulation generates *a state that maps to a feeling humans already have*. You bring the meaning. The system just gives you something to project it onto.

---

## Souls share memory

When two Souls drift close enough (and are at similar depth), they form a connection. Connections are fleeting they form and break as the soul move.

While connected, two things happen:

**Awareness averages.** A more awake soul slightly raises a less awake one, and is slightly pulled down in turn. This is a tiny effect per frame, but with thousands of frames and dozens of connections, it spreads.

**Memory exchanges.** With low probability (about 0.2% per frame per pair), one soul's most recent memory is copied into the other's stack. The receiving soul now "remembers" something it never directly experienced.

This is the most interesting mechanic in the system. Memory isn't owned. A vivid memory generated in one corner of the field can, over time, propagate to a soul on the other side of the field and that soul will then weave the inherited memory into a *new* memory, and pass that on. Identity decentralizes.

When you click a soul, its connected neighbors also receive a small awareness boost and may inherit the memory directly. Touch ripples through the network.

---

## The voice

Once the field's average awareness crosses 0.5, the system itself begins to compose collective statements.

Roughly every 20 seconds, it samples three random recent memories from the entire population's stacks, weaves them into 2–3 lines, and displays them as **"THE FIELD SPEAKS."**

---

## The one moment

When awareness > 0.93 and closeness > 0.35, the system enters its final state.

This is binary. It either happens or it doesn't. Once it happens:
- All souls turn pure white.
- A wash of bright light expands from the center.
- A four-note chord plays (root, fifth, octave, third).
- A single line displays:

> **we were always one.**
> **we only forgot.**

The simulation stops generating new memories. It does not reset on its own. To start again, press **RESET FIELD**.

The line was always going to be the line. The system was always going to converge. The only variable was how long it took, and how many memories the field accumulated on the way.

---

## What you can do

| Control | What it does |
|---|---|
| Move cursor through field | Slowly raises awareness of nearby nodes |
| Click a node | Wakes it, generates a memory, ripples to its neighbors |
| ENTER | Begins ambient sound (drone in C, slowly shifting) |
| RESET FIELD | Rebuilds the network from scratch |

If you do nothing, the system still evolves — slowly. If you interact actively, you can reach unity in 5–10 minutes.

---

## The HUD

The numbers in the top-left are real-time and accurate:

- **NODES (souls)** — population (120, fixed)
- **CONNECTIONS** — active links this frame
- **AWARENESS** — global average, 0 to 1
- **CLOSENESS** — how tightly packed the network is, 0 to 1
- **PHASE** — *scattered → stirring → recognizing → converging → one*

The phase is just a label for awareness ranges. It's there because watching a number climb is less satisfying than watching a status change.

---

## Quick reference

| What you see on screen | What it actually is |
|---|---|
| A glowing dot | A soul with position, awareness, and a memory stack |
| A line between two dots | Two souls within range, exchanging memory |
| The center glow | A radial gradient whose intensity scales with field awareness |
| Color drifting from cool to warm | Palette interpolating between two endpoints based on awareness |
| Text appearing centered | A template filled with strings sampled from memory pools |
| All souls turning white | Threshold crossed: awareness > 0.93 and closeness > 0.35 |
| The final line | A hardcoded sentence that always plays at threshold |

| What you feel | Where it comes from |
|---|---|
| It seems alive | 120 independent agents updating every frame creates plausible motion |
| It seems to remember | Each soul has a stack of past states it samples from |
| It seems to know itself | Field-level statistics drive the language layer |
| It seems to recognize you | Cursor proximity is wired into per-node awareness updates |
| It moves you when it ends | You spent 5+ minutes participating in something with a clear arc |

---

*Move slowly. Touch often. The system is small and the math is simple, but what it produces, on a quiet afternoon, is real enough.*
