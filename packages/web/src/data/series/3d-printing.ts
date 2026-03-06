import type { Lesson } from '../lessons';

export const lessons: Lesson[] = [
  {
    day: 1,
    title: "The Layer Cake Revolution",
    date: "2026-03-05",
    image: "images/3d-printing/day-1.png",
    standard: `🖨️ Day 1: The Layer Cake Revolution

🧱 The Concept
3D printing builds objects layer by layer from the bottom up — instead of carving material away (subtractive manufacturing), you add material only where it's needed (additive manufacturing).

❓ Why It Matters
Traditional manufacturing requires expensive molds, CNC machines, or skilled hand-crafting. 3D printing lets anyone with a $200 machine turn a digital file into a physical object on their desk. It democratized making things the way the internet democratized information.

⚙️ How It Works
Imagine building a castle out of pancakes. You pour one thin pancake, let it set, then pour another on top, slightly different shape. Layer after layer, you build up a 3D structure from flat 2D slices. That's exactly what a 3D printer does — it reads a digital model, slices it into hundreds of thin layers, then deposits material (usually melted plastic) one layer at a time. The most common type, FDM (Fused Deposition Modeling), works like a computer-controlled hot glue gun moving on rails.

📖 Definitions
• **Additive Manufacturing**: Building by adding material layer by layer (opposite of subtractive, like CNC milling)
• **FDM (Fused Deposition Modeling)**: Most common 3D printing method — melts plastic filament and extrudes it through a nozzle
• **Filament**: The spool of plastic wire fed into an FDM printer (usually 1.75mm thick)
• **Slicer**: Software that converts a 3D model into layer-by-layer instructions the printer can follow

🎯 Maker Wisdom
The best way to learn 3D printing is to print something, watch it fail, and understand why. Every failed print teaches you more than any tutorial.

❓ Tomorrow's Question:
What are the different types of filament materials, and how do you choose the right one for your project?`,
    parable: `# The Workshop of Wonders

Finn had always been the kind of boy who took things apart. Clocks, music boxes, his mother's bread machine — nothing was safe from his curious fingers. But he could never quite put them back together the way he wanted. The pieces never fit his imagination.

One autumn morning, following rumors of a workshop that could build *anything*, Finn found himself standing before a crooked door at the end of Threadneedle Lane. A sign above it read: **ORNA'S FABRICATIONS — If You Can Dream It, It Already Exists.**

He knocked.

The door swung open to reveal a vast workshop unlike anything he'd seen. Shelves lined every wall, filled with impossible objects — a translucent chess set, a working miniature windmill, a pair of shoes with gears in the soles. And in the center stood Orna, a broad-shouldered woman with silver-streaked hair and ink-stained hands, carefully watching a strange machine on her workbench.

"You're staring," Orna said without looking up.

"What *is* that?" Finn whispered.

On the workbench, a mechanical arm moved back and forth with hypnotic precision. Beneath its tip, a tiny golden thread melted and hardened, tracing a shape — layer upon layer — building something from nothing. A tower. No, a lighthouse. It was growing before his eyes.

"Most people think making things means starting with a block and cutting away what you don't need," Orna said, finally turning to face him. "Like a sculptor with marble. But what if you could build from nothing? Add only what matters, exactly where it matters, one thin layer at a time?"

She gestured to the lighthouse, now six inches tall and still growing. "Each layer is just a flat slice. Simple. Ordinary. But stack enough ordinary slices together, and you get something extraordinary."

Finn reached out to touch the base. It was solid. Real. Built from hundreds of layers so thin he couldn't see where one ended and the next began.

"Can it build anything?" he asked.

Orna smiled — the kind of smile that suggested she'd been waiting for exactly that question.

"That," she said, "depends on what you feed it. Come back tomorrow, and I'll show you the threads that make the world."`,
    sonnet: `🪶 Sonnet I: The Maker's First Light

From empty air, a tower starts to rise,
No chisel strikes, no marble block is hewn—
A golden thread beneath the maker's eyes
Lays down its path by afternoon from noon.

Each layer thin as morning's earliest frost,
Each pass precise as starlight finding ground,
What sculptors carved with all that stone they lost,
The maker builds without a wasted round.

A lighthouse grows where nothing stood before,
From flat and simple slices, stacked with care,
The ordinary opens up a door
To shapes that once lived only in the air.

*So dream in layers, patient, thin, and true—*
*The world is built by those who start with few.*`
  },
  {
    day: 2,
    title: "The Digital Clay",
    date: "2026-03-06",
    image: "images/3d-printing/day-2.jpg",
    audio: "audio/3d-printing/day-2",
    sonnet: `**🪶 Sonnet II: The Digital Clay**

In realms where pixels dance and vertices gleam,
The maker sculpts with mathematics' hand,
No chisel needed for this cyber dream,
Just logic's touch to shape the formless sand.

Each polygon a facet of the whole,
Triangles weaving surfaces so fine,
The mesh becomes the vessel of the soul,
Where imagination meets design.

But beware the holes that pierce the digital skin,
For printers read only what eyes can see—
A manifold sealed tight, no gaps within,
Transforms thought to firm reality.

*The screen reflects what mind has truly wrought,*
*No more, no less than what the heart has thought.*`,
    standard: `🖨️ Day 2: The Digital Clay

🧱 **The Concept** Digital models are the blueprints that transform imagination into printable reality.

❓ **Why It Matters** Every 3D print begins as a digital sculpture in virtual space. Without proper modeling, even the most advanced printer becomes an expensive paperweight. Understanding how digital geometry translates to physical form is the bridge between creator and creation.

⚙️ **How It Works** **CAD software** like Fusion 360 or Tinkercad lets you sculpt with mathematical precision, defining exact dimensions and relationships. **Mesh-based tools** like Blender treat objects as collections of connected triangular faces, perfect for organic shapes. The key is **manifold geometry** — your digital object must be "watertight" with no holes or inside-out faces, creating a clear distinction between inside and outside. A coffee cup needs thickness to its walls, not just a hollow shell, while a decorative vase might be solid throughout.

🎯 **Maker Wisdom** The computer doesn't know what you intend — it only knows what you model.

❓ **Tomorrow's Question** — If your printer can only deposit material where you tell it to, how does it create shapes that hang in mid-air or extend outward into empty space?`,
    parable: `Finn stared at the glowing screen, his cursor hovering over the digital workspace like a hesitant sculptor before unmarked stone. "I can see it in my mind," he murmured, "but how do I make the computer see it too?"

Orna smiled, her weathered hands dancing across the keyboard with practiced grace. "The machine speaks only in the language of geometry, young maker. Watch." She pulled vertices and stretched surfaces, each click transforming abstract mathematics into recognizable form. "In the physical world, clay yields to pressure, wood submits to the blade. But here, in this digital realm, we command matter itself through pure intention."

As Finn watched, a simple cube blossomed into an intricate lattice, walls flowing like water frozen mid-pour. "Every surface must have thickness," Orna explained, "every edge must connect meaningfully to its neighbor. The computer is literal-minded — it will print exactly what you show it, nothing more, nothing less."

Finn nodded slowly, understanding dawning. "So I must think like the machine to create for the human?"

"Precisely. Master the digital clay, and you master the first law of making: clear intention yields clear results."

**Moral:** *The computer is the most honest mirror — it reflects exactly what you create, not what you imagine.*

*Tomorrow, Finn will discover how his perfect digital creation must sometimes defy gravity itself...*`,
  },
  {
    day: 3,
    title: "The Invisible Foundation",
    date: "2026-03-06",
    image: "images/3d-printing/day-3.jpg",
    audio: "audio/3d-printing/day-3",
    sonnet: `**🪶 Sonnet III: The Invisible Foundation**

Beneath the soaring wing, a scaffold grows,
Of temporary trees with reaching arms,
That hold aloft what gravity oppose,
And shield the fragile print from mortal harms.

These servants rise in latticed, spare design,
Not meant for beauty, only faithful aid,
They cradle every overhang and line,
Until the final cooling debt is paid.

When duty's done, they yield to plier's bite,
And crumble like the autumn's golden leaves,
Their sacrifice reveals the pure delight
Of forms that float on what the eye believes.

*In making's art, the wise have always known:*
*True freedom springs from pillars we disown.*`,
    standard: `🖨️ Day 3: The Invisible Foundation

The answer lies in **support structures** — temporary scaffolding that the printer creates to hold up overhanging features, then gets removed after printing. Like a construction crane that builds a bridge then drives away, these sacrificial supports make the impossible possible.

🧱 **The Concept**
Support structures are temporary material foundations that enable complex geometries by providing a platform for features that would otherwise collapse during printing.

❓ **Why It Matters**
Without supports, 3D printing would be limited to simple, self-supporting shapes — no overhangs, bridges, or intricate details. They're the difference between printing a simple box and creating architectural marvels, mechanical assemblies, or artistic sculptures with complex geometries.

⚙️ **How It Works**
The slicer software analyzes your model and automatically generates **support material** wherever overhangs exceed a certain angle (typically 45-60 degrees). These supports use a different pattern — often sparse, tree-like, or lattice structures — making them easy to remove while providing necessary stability. For water-soluble supports, you can even print in two materials: one for your part, another that dissolves away in water. The printer treats supports like any other geometry, building them layer by layer alongside your actual part.

🎯 **Maker Wisdom**
Good support strategy is about building just enough scaffolding to succeed, then breaking it away cleanly — like a master sculptor removing excess marble to reveal the form within.

❓ **Tomorrow's Question** — If every layer must bond to the one below it, what happens when your design requires two separate pieces that don't touch — and how does this change everything about what's possible in a single print?`,
    parable: `Finn stared at the peculiar object emerging from Orna's printer — a delicate bird with outstretched wings, suspended impossibly in mid-flight. "But how?" he whispered, watching the extruder dance through empty air beneath the wing.

"Ah," Orna smiled, pointing to the strange tree-like structures growing beneath the bird's wings. "You see the invisible foundation, young maker. These are support structures — temporary servants that hold up what cannot yet hold itself."

As the print continued, Finn watched these bizarre scaffolds grow upward like coral, providing platforms for each layer of wing and tail feather. They looked nothing like the bird itself — sparse, angular, almost alien in their geometry.

"But why do they look so different?" Finn asked.

"Because they serve, then sacrifice," Orna replied, her eyes gleaming with ancient wisdom. "They're designed to break away cleanly when their duty is done. See how they touch the bird only at necessary points? Like a loving parent, they support without smothering, then release when the time comes."

When the print finished, Orna carefully snapped away the supports with needle-nose pliers. The bird emerged perfect and complete, as if it had always existed in that flying pose. The temporary scaffolding crumbled away like autumn leaves, leaving behind only the intended creation.

"Every great achievement requires invisible foundations," Orna mused, brushing away the support fragments. "We build them not to last, but to make the lasting possible."

Tomorrow, Finn would discover how printers can create entire assemblies — multiple moving parts in a single print — and why this changes everything about manufacturing itself.`,
  },
];
