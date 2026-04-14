# THE KEEPERS - History of Israel Screenplay

**Feature film screenplay based on `src/data/series/history-of-israel.ts`**

## Source Material

This screenplay is a direct adaptation of the 6 lessons in the History of Israel series from the Parable/University educational platform:

1. **Day 1:** The Land Between Empires
2. **Day 2:** The Portable Nation  
3. **Day 3:** The Network Effect
4. **Day 4:** The Shadow Ministers
5. **Day 5:** The Dual Crown
6. **Day 6:** The Invisible Hand

**Source file:** `packages/web/src/data/series/history-of-israel.ts`

## Files in This Directory

- **THE_KEEPERS.fountain** - Complete 120-page feature film screenplay (Fountain format)
- **README.md** - Full project overview and market analysis
- **TREATMENT.md** - Extended story treatment with scene-by-scene breakdown
- **CHARACTER_BIOS.md** - Detailed character profiles and casting suggestions
- **PROJECT_SUMMARY.md** - Executive summary
- **SCREENPLAY_README.md** - This file (integration notes)

## How the Lessons Are Integrated

Each lesson from the TypeScript file becomes a teaching moment in the screenplay:

### Act One: The Archives (Lessons 1-3)
- **Lesson 1** → Opening sequence in main chamber (geography maps)
- **Lesson 2** → Scroll chamber scene (portable nation concept)
- **Lesson 3** → Map room scene (network visualization)

### Act Two: Power Dynamics (Lessons 4-5)
- **Lesson 4** → Portrait gallery scene (shadow ministers through history)
- **Lesson 5** → Manuscript room scene (dual crown paradox)

### Act Three: Resolution (Lesson 6)
- **Lesson 6** → Darkest chamber scene (invisible hand philosophy)
- Final confrontation applies all 6 lessons to modern crisis

## Story Wrapper

To make the educational content cinematic, the screenplay adds:

**Modern Thriller Element:**
- Rogue Keeper Benjamin Weiss threatens to expose the network
- Mossad operative David Cohen seeks to weaponize the archives  
- Ezra must choose between three paths for the knowledge

**Structure:**
- Educational content (6 lessons) = Act One
- Modern crisis = Act Two
- Resolution applying lessons = Act Three

**All philosophical content from the original lessons is preserved** in Miriam's dialogue and Ezra's journey.

## Expansion Potential

If additional lessons are added to `history-of-israel.ts`:

- **Lessons 7-12** → THE KEEPERS: NETWORK (sequel)
- **Lessons 13-18** → THE KEEPERS: LEGACY (third film)
- **Full 42 lessons** → Limited series format (14-21 episodes)

The current screenplay works as a complete standalone film with the 6 existing lessons.

## Format Notes

**Fountain (.fountain)** is a plain-text screenplay format:
- Human-readable as plain text
- Converts to industry-standard PDF
- Compatible with Final Draft, Highland, WriterDuet
- Open-source and future-proof

**Convert to PDF:** https://fountain.io/

## Integration with Parable/University

This screenplay lives in the same repo as the source material:

```
university/
├── packages/
│   └── web/
│       └── src/
│           └── data/
│               └── series/
│                   └── history-of-israel.ts  ← Source lessons
└── screenplay/
    └── history-of-israel/
        └── THE_KEEPERS.fountain  ← Film adaptation
```

**Benefits:**
- Single source of truth (lessons in TypeScript)
- Screenplay stays synced with lesson updates
- Version control tracks both together
- Shared git history

## Development Workflow

If you update the lessons in `history-of-israel.ts`:

1. Edit the TypeScript lesson file
2. Rebuild the screenplay to incorporate new lessons
3. Commit both changes together
4. Deploy lesson updates + screenplay updates as a unit

## Rights & Attribution

- **Original lessons:** Parable/University platform
- **Screenplay adaptation:** April 13, 2026
- **Format:** Feature film (theatrical or streaming)
- **Status:** Production-ready

---

**Related Projects:**
- Live platform: https://accomplished-happiness-production-0647.up.railway.app/
- GitHub: https://github.com/camptracker/university
- Series page: `/series/history-of-israel`

**Tagline:** *"The greatest power is the one that remains forever unseen."*
