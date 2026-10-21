# Live demo runbook: JavaScript and Python, code along

**The story:** both lectures are code along. Students type every file in **their own VS Code** and run it in **their own terminal**. You present from the slides: the code slides are a built-in VS Code look-alike (the **codepad**) that types each chunk for you and really runs it. No app, no Claude prompt.
- **Lecture 1 (JS & Python Fundamentals):** why both, runtimes, variables, primitive types, lists/objects/dicts, mutable vs immutable. Folder: `fundamentals/`.
- **Lecture 2 (Functional Programming):** comparisons, if/else, loops, while, functions and return, arrow/lambda, filter/sort/map. Folder: `functional/`.

## The codepad (every "Code along" slide)

| Key / button | What it does |
|---|---|
| **N** (or "Type next") | Types the next chunk into the JS or Python file. Press N again while it types = finish instantly |
| **R** (or "Run") | Runs both files. Left terminal `$ node file.js`, right `$ python3 file.py` |
| **Run** on a tab | Runs just that file |
| Click into the code | Type yourself. **Ctrl+Enter** runs that file. **Esc** leaves the editor so N / R / arrows work again |
| **All** | Shows the finished code at once (if you're behind) |
| **Reset** | Back to the slide's start, terminals cleared |
| Presenter window (**P**) | Shows the **next chunk** before it's typed, plus Type next / Run / Show all / Reset buttons |

- **Real output:** JavaScript runs in the browser and prints like Node. Python is real CPython (3.12) loaded into the page. Every slide's output was checked against real `node` and `python3`.
- **Python needs internet the first time** (it downloads ~10 MB, then it's cached). Status bar says "Python 3.12.7" when ready. Offline, it shows the recorded output for the slide's code and says so.
- **Infinite loops are safe:** the codepad stops after 300 lines or a few seconds and says "^C … a loop that never ends?".
- **A line that changes** (functions slide) lights up yellow for 3 seconds.

## Setup (once, before Lecture 1)

```bash
node --version          # any v18+
python3 --version       # any 3.10+
docker pull node:18-alpine && docker pull python:3.11-slim     # for the Docker slide (L1 slide 7)
```
- Open both decks in **Chrome** once with internet on, so Python is cached.
- Have the **Code Lab** page open in a tab: students copy from there when they fall behind.
- Know where the finished files are: `demo-kit/fundamentals/` and `demo-kit/functional/`.

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
| 5 (7) | Your terminal | `mkdir fundamentals`, `cd fundamentals`, `code .`, both `--version`s | "Thumbs up when both print." |
| 6 (9) | Codepad | N, N, R | "Now type `node example.js` in yours." |
| 7 (11) | Your terminal | The two `docker build … -f …` + `docker run --rm …` | "Switch languages by switching the base image." |
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
| 7 (18) | Codepad | N N R, N N R; then delete `count++;`, R | "Ctrl+C in a real terminal." Then **Reset** |
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
