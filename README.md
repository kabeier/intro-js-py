# JavaScript and Python

Lecture site for Code Platoon Phase I, **Fundamentals: JavaScript and Python**: the same ideas written in both languages, side by side. Code along: students type every file in their own VS Code and run it in their own terminal.

**Live site:** https://kabeier.github.io/intro-js-py/

## Lecture 1: JS & Python Fundamentals (~40 min, 17 slides)

- **Slides:** `lecture-1-js-python-fundamentals/slides.html`
- **Code lab:** `lecture-1-js-python-fundamentals/code-lab/`
- **Activity:** `lecture-1-js-python-fundamentals/activity-js-or-python/`

## Lecture 2: Functional Programming (~40 min, 14 slides)

- **Slides:** `lecture-2-functional-programming/slides.html`
- **Code lab:** `lecture-2-functional-programming/code-lab/`
- **Activity:** `lecture-2-functional-programming/activity-what-prints/`

## The codepad

`shared/codepad.js` + `shared/codepad.css`: VS Code on the code slides. The editor is **Monaco** (the editor inside VS Code, from jsDelivr); under each file is a terminal you type `node file.js` / `python3 file.py` into. JavaScript runs in a Web Worker and prints like Node; Python runs on Pyodide 0.27.7 (real CPython 3.12). Ctrl+S saves (the terminal runs the saved file), Ctrl+C stops a program. **N** / **R** type prepared chunks and commands as a backup. Offline it falls back to a simple editor. `playground/` is the same thing as a full page for students.

## Instructor kit

- `demo-kit/RUNBOOK.md`: codepad keys, per-slide Do/Say, time checks
- `demo-kit/prompts.md`: every file with its output, plus the homework's Claude prompt
- `demo-kit/fundamentals/` · `demo-kit/functional/`: the finished lecture folders

## Diagrams

`diagrams/*.png` with editable `.tldr` sources (open in tldraw.com).

## Deck keys

→ / Space next · ← back · **P** presenter window (notes + timer + codepad buttons) · **T** start/pause the clock · **O** overview · **F** fullscreen · **N** / **R** on code slides · click a diagram to zoom
