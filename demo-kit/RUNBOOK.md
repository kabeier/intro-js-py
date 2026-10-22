# Live demo runbook: JavaScript and Python, code along

**The story:** both lectures are code along. Students type every file in **their own VS Code** and run it **through Docker** in **their own terminal**, as the lesson sets up: `docker build -t js-fundamentals -f Dockerfile.node .` then `docker run --rm --init js-fundamentals node <file>` (Python: `py-fundamentals`, `python3`). Rebuild after every edit. You present from the slides: each code slide is a real editor (Monaco, the editor inside VS Code) with a terminal you type commands into, and the code really runs. No app, no Claude prompt.
- **Lecture 1 (JS & Python Fundamentals):** why both, runtimes, variables, primitive types, lists/objects/dicts, mutable vs immutable. Folder: `fundamentals/`.
- **Lecture 2 (Functional Programming):** comparisons, if/else, loops, while, functions and return, arrow/lambda, filter/sort/map. Folder: `functional/`.

## The codepad (every "Code along" slide)

It's **Monaco, the editor inside VS Code**, plus a terminal you type into. Work in it exactly like VS Code:

| Do | How |
|---|---|
| Type code | Click in the editor. Autocomplete, hovers, Ctrl+/ comments, Ctrl+Z, multi-cursor all work |
| Save | **Ctrl+S**. ● on the tab = unsaved. **The terminal runs the saved file**, like real VS Code (show this once: it's the #1 student bug) |
| Run | Click the terminal under the file, type `node file.js` or `python3 file.py`, Enter. Or the **▶ Run** button on the tab, or **Ctrl+Enter** in the editor (saves + runs) |
| Stop a program | Click the terminal, **Ctrl+C** (auto-stops after 20 s if you forget) |
| Terminal extras | ↑ ↓ history · Tab completes file names · `ls`, `cat file`, `clear`, `python3 --version` |
| Leave the editor | **Esc**, so → / ← change slides again (keys typed in the terminal never change slides) |
| Backup: prepared code | **N** types the next prepared chunk (and saves). **R** types `node …` / `python3 …` into each terminal and runs. **All** = finished code, **Reset** = start over |
| Presenter window (**P**) | Shows the next prepared chunk + Type next / Run / Show all / Reset buttons |

- **Type from your notes:** every code slide's presenter notes (**P**) have a **TYPE THIS** block: each chunk in order, with its file. The slide editor does **not** auto-indent or auto-close brackets, so typing it exactly as written (spaces included) comes out exactly right. Enter is always a new line; **Tab** accepts an autocomplete suggestion. Click a block once to select it all, if you'd rather copy and paste. (Tell students: *their* VS Code adds the closing `}` and the indent for them.)
- **Real output:** JavaScript runs in the browser and prints like Node. Python is real CPython 3.12 (Pyodide). Every slide's code was checked against real `node` and `python3`.
- **Needs internet the first time:** Monaco (~3 MB) and Python (~10 MB) come from a CDN, then the browser caches them. Without internet, a simpler built-in editor appears, and Python shows the recorded output for the slide's code.
- **Earlier files exist:** in the terminal, `node example.js` works on any later slide, like real files in the folder.

## Setup (once, before Lecture 1)

```bash
docker --version
docker pull node:18-alpine && docker pull python:3.11-slim
```
- Open both decks in **Chrome** once with internet on, so the editor and Python are cached.
- Have the **Code Lab** page open in a tab: students copy the Dockerfiles and commands from there.
- Know where the finished files are: `demo-kit/fundamentals/` and `demo-kit/functional/` (each with its two Dockerfiles).

### The practice `docker` in the slides
- `docker build` reads the slide's Dockerfile and takes a **snapshot** of the files (COPY). `docker run --rm --init <image> node|python3 <file>` runs that snapshot. Program output and exit codes were checked against real Docker for every code slide.
- It behaves like real Docker on purpose: run before building → "pull access denied"; edit without rebuilding → the old output; a new file without rebuilding → "Cannot find module '/app/…'"; an unchanged rebuild → `CACHED [3/3] COPY . .`.
- The build shows Docker's key lines only; real terminals print more (and pull the base image the first time).
- **--init:** tested on real Docker: without it, Ctrl+C can't stop Node in a container (Node is process #1). The slides copy that too.

## Dry run (the night before), then reset

1. Present each deck with **P**. On each code slide press **N** through every chunk and **R** to run.
2. In parallel, type the same files in your own VS Code once: that's what students will be doing, and it's slower.
3. Reset: **Reset** on each code slide (or just reload the page). Delete your practice folders.

## Lecture 1 in class (JS & Python Fundamentals)

| Slide (~min) | Where | Do | Say |
|---|---|---|---|
| 1 (0) | Deck | Press **T**. VS Code + terminal open | "You'll type every line today." |
| 2 (1) | Deck | Ask for 3 differences | "Same idea, two spellings." |
| 3–4 (3–5) | Deck | Why both, runtime diagram | "Both are interpreted: a runtime reads your file line by line." |
| 5 (7) | Your terminal | `mkdir fundamentals`, `cd fundamentals`, `code .`, `docker --version`, `docker run --rm hello-world` | "Docker brings Node and Python." |
| 6 (9) | Deck | The two Dockerfiles (COPY . .), build + run, --init | "Build after every edit: COPY is a snapshot." |
| 7 (10) | Codepad | Type the line, Ctrl+S, `docker build …`, `docker run --rm --init … node example.js` (backup: N, N, R) | "Same two commands all day; ↑ repeats them." |
| 8 (13) | Deck | Labeled box | "Use `let` for now." |
| 9 (14) | Codepad | N N R, N N, N N R | "Same label, new contents." |
| 10 (18) | Codepad | 6 × N, R | "`true` vs `True`: the capital letter." |
| 11 (21) | Deck | Types table | "Yellow cells are where people trip." |
| 12 (22) | Activity page | 6 cards, Space reveals | "JS, PYTHON or BOTH in chat on go." |
| 13 (28) | Deck | Index vs key | "Counted from 0." |
| 14 (29) | Codepad | 6 × N, R | "Dot notation is JS only; brackets work in both." |
| 15 (34) | Codepad | 4 × N, R, ask "what will colors print?", N N R | "= doesn't copy a list." |
| 16 (37) | Deck | Mutable diagram | "Mutable is like a mutant." |
| 17 (39) | Deck | Homework | "Code Lab 1 on your own laptop." |

**Time check, Lecture 1:**
- **Not at the activity (slide 12) by ~min 24:** skip the Docker slide (7) next time / now; do slide 10's last pair with **All**.
- **Not at slide 14 by ~min 31:** shorten the activity to 4 cards; on slide 15 press **All** and run once.
- **Many students missing node or python:** don't install live. "Watch my screen. Code Lab 1 has a Docker one-liner and the Playground."

## Lecture 2 in class (Functional Programming)

| Slide (~min) | Where | Do | Say |
|---|---|---|---|
| 1 (0) | Deck | Press **T**. Students: `mkdir functional`, `cd functional`, `code .` | "Same two languages, new folder." |
| 2 (1) | Deck | Gym example | "You already think in if / else." |
| 3 (3) | Codepad | N N R, N N R | "In JS, always `===`." |
| 4 (6) | Codepad | N N R, N N R; then change `score` to 95 and Ctrl+Enter | "First true branch wins." |
| 5 (11) | Deck | Flow diagram | "Strictest check first." |
| 6 (13) | Codepad | N N R after each pair | "JS `of` = values, Python `in` = values." |
| 7 (18) | Codepad | Type or N/R; then delete `count++;`, Ctrl+S, run, **Ctrl+C** in the terminal | "Same Ctrl+C in your real terminal." Then Ctrl+Z, save |
| 8 (22) | Deck | Which-loop table | "The trap: JS `for…in` on a list." |
| 9 (23) | Activity page | 6 cards | "A, B or C in chat on go." |
| 10 (29) | Codepad | 4 × N, R ("what is result?"), N N (yellow line), R | "Printing is not returning." |
| 11 (33) | Deck | Function machine | "Parameters are placeholders; arguments are values." |
| 12 (34) | Codepad | N N R, N N R, N N R | "JS `.sort()` changes nums itself." |
| 13 (38) | Deck | Constructive vs destructive | "New list, or yours changed?" |
| 14 (39) | Deck | Homework | "Spec files check what you return." |

**Time check, Lecture 2:**
- **Not at the activity (slide 9) by ~min 25:** on slide 7 skip the infinite-loop demo and show the while loop with **All**.
- **Not at slide 12 by ~min 35:** press **All** on slide 12, run once, go to the homework.
- **Your codepad misbehaves:** reload the page (it resets every code slide) or present from `demo-kit/functional/` in your real VS Code.
