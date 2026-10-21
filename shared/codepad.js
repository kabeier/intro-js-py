// Codepad: VS Code on a slide. The editor is Monaco (the editor inside VS Code); the terminal under it is
// typeable and really runs code: `node file.js` (JavaScript in a Web Worker, printing like Node) and
// `python3 file.py` (real CPython via Pyodide). Like VS Code, the terminal runs the SAVED file: Ctrl+S saves.
//   N = type the next prepared chunk (optional) · R = type and run `node …` / `python3 …` in each terminal
//   In the editor: Ctrl+S save · Ctrl+Enter save + run · Esc leave (so N / R / arrows work again)
//   In the terminal: Enter run · ↑ ↓ history · Tab completes file names · Ctrl+C stops · Ctrl+L clears
// No internet for Monaco? It falls back to a simple built-in editor. Markup:
//   <div class="vscode" data-folder="fundamentals">
//     <script type="text/plain" data-file="hello.js" data-start>…initial text…</script>
//     <script type="text/plain" data-file="hello.js" data-step>…typed on N…</script>
//     <script type="text/plain" data-file="hello.py" data-step data-mode="set">…replaces the file…</script>
//     <script type="text/plain" data-file="hello.py" data-expect>…recorded output (offline fallback)…</script>
//   </div>
(() => {
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'
  const MONACO = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/'
  const isPresenter = new URLSearchParams(location.search).has('presenter')
  const chan = new BroadcastChannel('codepad:' + location.pathname)
  const KEEP_LINES = 400
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const langOf = (f) => (f.endsWith('.py') ? 'py' : 'js')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  if (isPresenter) return presenterControls()

  // ---------- Node-style console.log formatting (runs inside the JS worker) ----------
  function nodeInspect(v) {
    const ident = /^[A-Za-z_$][\w$]*$/
    const quote = (s) => {
      const q = !s.includes("'") ? "'" : !s.includes('"') ? '"' : !s.includes('`') ? '`' : "'"
      const body = s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').split(q).join('\\' + q)
      return q + body + q
    }
    const groupArray = (output, value, indent) => {
      let total = 0, maxLen = 0
      const lens = output.map((o) => { total += o.length + 2; if (o.length > maxLen) maxLen = o.length; return o.length })
      const actualMax = maxLen + 2
      if (actualMax * 3 + indent < 80 && (total / actualMax > 5 || maxLen <= 6)) {
        const averageBias = Math.sqrt(actualMax - total / output.length)
        const biasedMax = Math.max(actualMax - 3 - averageBias, 1)
        const columns = Math.min(Math.round(Math.sqrt(2.5 * biasedMax * output.length) / biasedMax), Math.floor((80 - indent) / actualMax), 12, 15)
        if (columns <= 1) return output
        const maxLine = []
        for (let i = 0; i < columns; i++) {
          let w = 0
          for (let j = i; j < output.length; j += columns) if (lens[j] > w) w = lens[j]
          maxLine.push(w + 2)
        }
        const numeric = value.every((x) => typeof x === 'number' || typeof x === 'bigint')
        const rows = []
        for (let i = 0; i < output.length; i += columns) {
          const max = Math.min(i + columns, output.length)
          let str = '', j = i
          for (; j < max - 1; j++) str += numeric ? `${output[j]}, `.padStart(maxLine[j - i], ' ') : `${output[j]}, `.padEnd(maxLine[j - i], ' ')
          str += numeric ? output[j].padStart(maxLine[j - i] - 2, ' ') : output[j]
          rows.push(str)
        }
        return rows
      }
      return output
    }
    const reduce = (output, open, close, indent, isArray, value) => {
      const entries = output.length
      if (isArray && entries > 6) output = groupArray(output, value, indent)
      if (entries === output.length) {
        const start = output.length + indent + open.length + 10
        let len = output.length + start, fits = len + output.length <= 80
        for (const o of output) { if (!fits) break; len += o.length; if (len > 80) fits = false }
        if (fits && !output.join(', ').includes('\n')) return `${open} ${output.join(', ')} ${close}`
      }
      const ind = '\n' + ' '.repeat(indent)
      return `${open}${ind}  ${output.join(`,${ind}  `)}${ind}${close}`
    }
    const fmt = (x, depth, indent, seen) => {
      if (x === null) return 'null'
      const t = typeof x
      if (t === 'string') return depth === 0 ? x : quote(x)
      if (t === 'number') return Object.is(x, -0) ? '-0' : String(x)
      if (t === 'bigint') return x + 'n'
      if (t === 'boolean' || t === 'undefined') return String(x)
      if (t === 'symbol') return x.toString()
      if (t === 'function') {
        const src = Function.prototype.toString.call(x)
        if (/^class\b/.test(src)) return `[class ${x.name || '(anonymous)'}]`
        return x.name ? `[Function: ${x.name}]` : '[Function (anonymous)]'
      }
      if (seen.includes(x)) return '[Circular *1]'
      if (x instanceof Error) return x.stack || String(x)
      if (x instanceof Date) return isNaN(x) ? 'Invalid Date' : x.toISOString()
      const next = [...seen, x]
      const child = (y) => fmt(y, depth + 1, indent + 2, next)
      if (Array.isArray(x)) {
        if (depth > 2) return '[Array]'
        if (!x.length) return '[]'
        const out = []
        let holes = 0
        const flush = () => { if (holes) { out.push(`<${holes} empty item${holes > 1 ? 's' : ''}>`); holes = 0 } }
        for (let i = 0; i < x.length && out.length < 100; i++) { if (!(i in x)) { holes++; continue } flush(); out.push(child(x[i])) }
        flush()
        if (x.length > 100) out.push(`... ${x.length - 100} more items`)
        return reduce(out, '[', ']', indent, true, x)
      }
      if (x instanceof Set) {
        if (depth > 2) return '[Set]'
        if (!x.size) return 'Set(0) {}'
        return reduce([...x].map(child), `Set(${x.size}) {`, '}', indent, true, [...x])
      }
      if (x instanceof Map) {
        if (depth > 2) return '[Map]'
        if (!x.size) return 'Map(0) {}'
        return reduce([...x].map(([k, v]) => `${child(k)} => ${child(v)}`), `Map(${x.size}) {`, '}', indent, false)
      }
      const proto = Object.getPrototypeOf(x)
      const name = proto === null ? '[Object: null prototype]' : proto.constructor && proto.constructor.name !== 'Object' ? proto.constructor.name : ''
      if (depth > 2) return name && proto !== null ? `[${name}]` : '[Object]'
      const keys = Object.keys(x)
      if (!keys.length) return name ? `${name} {}` : '{}'
      const out = keys.map((k) => `${ident.test(k) ? k : quote(k)}: ${child(x[k])}`)
      return reduce(out, name ? `${name} {` : '{', '}', indent, false)
    }
    return fmt(v, 0, 0, [])
  }


  // Output streams out in small batches, so an endless loop scrolls (like a real terminal) without freezing the slides.
  const STREAM = `
    let batch = [], last = 0, dropped = 0;
    const flush = () => { if (batch.length || dropped) postMessage({ t: 'lines', a: batch, dropped }); batch = []; dropped = 0; last = Date.now(); };
    const emit = (cls, s) => {
      if (batch.length < 80) batch.push([cls, s]); else dropped++;
      if (Date.now() - last > 40) flush();
    };`

  const JS_WORKER = `
    const inspect = ${nodeInspect.toString()};
    ${STREAM}
    const out = (cls, args) => emit(cls, args.map((a) => typeof a === 'string' ? a : inspect(a)).join(' '));
    const con = { log: (...a) => out('out', a), info: (...a) => out('out', a), debug: (...a) => out('out', a),
                  warn: (...a) => out('err', a), error: (...a) => out('err', a) };
    onmessage = (e) => {
      try { new Function('console', e.data.code)(con); flush(); postMessage({ t: 'done' }); }
      catch (err) {
        flush();
        const m = /<anonymous>:(\\d+):(\\d+)/.exec(err && err.stack || '');
        postMessage({ t: 'exc', name: err && err.name || 'Error', message: err && err.message || String(err),
                      line: m ? +m[1] - 2 : null, col: m ? +m[2] : null });
      }
    };`

  const PY_WORKER = `
    importScripts('${PYODIDE}pyodide.js');
    ${STREAM}
    let py;
    const buf = { out: '', err: '' }, dec = { out: new TextDecoder(), err: new TextDecoder() };
    const writer = (t) => (bytes) => {
      buf[t] += dec[t].decode(bytes, { stream: true });
      let i;
      while ((i = buf[t].indexOf('\\n')) >= 0) { emit(t, buf[t].slice(0, i)); buf[t] = buf[t].slice(i + 1); }
      return bytes.length;
    };
    const ready = (async () => {
      py = await loadPyodide({ indexURL: '${PYODIDE}' });
      py.setStdout({ write: writer('out') });
      py.setStderr({ write: writer('err') });
      py.runPython(\`
import sys, os, traceback, linecache
os.chdir('/home/pyodide')
def __cp_run(fname):
    try:
        with open(fname) as fh:
            src = fh.read()
        linecache.checkcache(fname)
        exec(compile(src, fname, 'exec'), {'__name__': '__main__', '__file__': fname})
    except SystemExit:
        pass
    except BaseException as e:
        tb = e.__traceback__
        while tb is not None and tb.tb_frame.f_code.co_filename != fname:
            tb = tb.tb_next
        sys.stdout.flush()
        sys.stderr.write(''.join(traceback.format_exception(type(e), e, tb)))
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
\`);
      postMessage({ t: 'ready', v: py.runPython('import sys; sys.version.split()[0]') });
    })().catch((e) => postMessage({ t: 'loadfail', s: String(e) }));
    onmessage = async (e) => {
      await ready;
      py.FS.writeFile('/home/pyodide/' + e.data.file, e.data.code);
      py.globals.get('__cp_run')(e.data.file);
      for (const t of ['out', 'err']) if (buf[t]) { emit(t, buf[t]); buf[t] = ''; }
      flush();
      postMessage({ t: 'done' });
    };`

  // ---------- Python worker (one, kept warm; restarted after Ctrl+C) ----------
  const pyState = { worker: null, ready: false, failed: false, version: '', listeners: new Set() }
  function startPython() {
    pyState.ready = false; pyState.failed = false
    pyState.worker = new Worker(URL.createObjectURL(new Blob([PY_WORKER], { type: 'text/javascript' })))
    pyState.worker.onmessage = (e) => {
      if (e.data.t === 'ready') { pyState.ready = true; pyState.version = e.data.v }
      else if (e.data.t === 'loadfail') pyState.failed = true
      pyState.listeners.forEach((fn) => fn(e.data))
      pads.forEach((p) => p.drawStatus())
    }
    pyState.worker.onerror = () => { if (pyState.ready) return; pyState.failed = true; pyState.listeners.forEach((fn) => fn({ t: 'loadfail' })); pads.forEach((p) => p.drawStatus()) }
    setTimeout(() => { if (!pyState.ready) { pyState.failed = true; pyState.listeners.forEach((fn) => fn({ t: 'loadfail' })); pads.forEach((p) => p.drawStatus()) } }, 45000)
  }

  // Run one program. sink = { lines([[cls, text]], dropped), done() }. Returns { stop() }.
  function runJs(code, file, sink) {
    const w = new Worker(URL.createObjectURL(new Blob([JS_WORKER], { type: 'text/javascript' })))
    let over = false
    const finish = (extra) => { if (over) return; over = true; clearTimeout(guard); if (extra) sink.lines(extra); sink.done(); setTimeout(() => w.terminate(), 1500) }
    const guard = setTimeout(() => { w.terminate(); finish([['err', '^C'], ['sys', 'Stopped after 20 seconds: a loop that never ends? Press Ctrl+C to stop a program.']]) }, 20000)
    w.onmessage = ({ data: d }) => {
      if (over) return
      if (d.t === 'lines') sink.lines(d.a, d.dropped)
      else if (d.t === 'done') finish()
      else if (d.t === 'exc') {
        const src = code.split('\n'), out = []
        if (d.line && src[d.line - 1] !== undefined) {
          out.push(['err', `/home/student/${sink.folder}/${file}:${d.line}`], ['err', src[d.line - 1]])
          if (d.col) out.push(['err', ' '.repeat(d.col - 1) + '^'])
          out.push(['err', ''])
        }
        out.push(['err', `${d.name}: ${d.message}`])
        if (d.line) out.push(['err', `    at /home/student/${sink.folder}/${file}:${d.line}${d.col ? ':' + d.col : ''}`])
        finish(out)
      }
    }
    w.postMessage({ code })
    return { stop: () => { if (over) return; w.terminate(); finish([['err', '^C']]) } }
  }

  function runPy(code, file, sink, recorded) {
    let over = false
    const fn = (d) => {
      if (over) return
      if (d.t === 'lines') sink.lines(d.a, d.dropped)
      else if (d.t === 'done') finish()
      else if (d.t === 'loadfail') fallback()
    }
    const finish = (extra) => { if (over) return; over = true; clearTimeout(guard); pyState.listeners.delete(fn); if (extra) sink.lines(extra); sink.done() }
    const fallback = () => {
      if (recorded !== undefined) finish([...recorded.split('\n').map((s) => ['out', s]), ['sys', '(recorded output: Python could not load here. Is the internet on?)']])
      else finish([['sys', 'Python could not load (no internet?). Run it in your own terminal instead.']])
    }
    const restart = () => { pyState.worker.terminate(); startPython() }
    const guard = setTimeout(() => { if (!over) { restart(); finish([['err', '^C'], ['sys', 'Stopped after 20 seconds: a loop that never ends? Press Ctrl+C to stop a program.']]) } }, 20000 + (pyState.ready ? 0 : 30000))
    if (pyState.failed) { fallback(); return { stop() {} } }
    if (!pyState.ready) sink.lines([['sys', 'Starting Python…']])
    pyState.listeners.add(fn)
    pyState.worker.postMessage({ file, code })
    return { stop: () => { if (over) return; restart(); finish([['err', '^CTraceback (most recent call last):'], ['err', '  …'], ['err', 'KeyboardInterrupt']]) } }
  }
  // ---------- Syntax highlighting ----------
  const words = (s) => new Set(s.split(' '))
  const LANG = {
    js: {
      re: /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\[\s\S])*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([()[\]{}])|([\s\S])/g,
      kw: words('let const var function class new typeof instanceof true false null undefined this in of void delete async await'),
      ctl: words('if else for while do return break continue switch case default try catch finally throw'),
      cls: words('console Math Object JSON Array Number String Boolean Set Map Date Error Promise'),
      defkw: 'function', indent: '  ', opens: /[{[(]\s*$/,
    },
    py: {
      re: /(#[^\n]*)|((?:\b[fFrRbB]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?))|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([()[\]{}])|([\s\S])/g,
      kw: words('def lambda True False None and or not is class global nonlocal'),
      ctl: words('if elif else for in while return break continue pass del import from as try except finally raise with yield'),
      cls: words(''),
      defkw: 'def', indent: '    ', opens: /[:{[(]\s*$/,
    },
  }
  function highlight(src, lang) {
    const L = LANG[lang]
    let html = '', depth = 0, prevWord = '', m
    L.re.lastIndex = 0
    while ((m = L.re.exec(src))) {
      const [tok, com, str, num, word, br] = m
      if (com) html += `<span class="t-com">${esc(com)}</span>`
      else if (str) html += `<span class="t-str">${esc(str)}</span>`
      else if (num) html += `<span class="t-num">${num}</span>`
      else if (word) {
        const after = src.slice(L.re.lastIndex).match(/^\s*(.)/)?.[1]
        const before = src.slice(0, m.index).match(/(\S)\s*$/)?.[1]
        let c = 't-var'
        if (L.kw.has(word)) c = 't-kw'
        else if (L.ctl.has(word)) c = 't-ctl'
        else if (prevWord === L.defkw || after === '(') c = 't-fn'
        else if (before !== '.' && L.cls.has(word)) c = 't-cls'
        html += `<span class="${c}">${word}</span>`
        prevWord = word
        continue
      } else if (br) {
        if ('([{'.includes(br)) html += `<span class="t-b${depth++ % 3}">${br}</span>`
        else { depth = Math.max(depth - 1, 0); html += `<span class="t-b${depth % 3}">${br}</span>` }
      } else html += esc(tok)
      if (!/^\s+$/.test(tok)) prevWord = ''
    }
    return html
  }


  // ---------- Monaco (loaded once, from the CDN) ----------
  let monacoPromise = null
  function loadMonaco() {
    if (monacoPromise) return monacoPromise
    monacoPromise = new Promise((resolve) => {
      const give = (m) => { clearTimeout(timer); resolve(m) }
      const timer = setTimeout(() => give(null), 20000)
      window.MonacoEnvironment = { getWorkerUrl: () => URL.createObjectURL(new Blob([`self.MonacoEnvironment={baseUrl:'${MONACO}'};importScripts('${MONACO}vs/base/worker/workerMain.js');`], { type: 'text/javascript' })) }
      const s = document.createElement('script')
      s.src = MONACO + 'vs/loader.js'
      s.onerror = () => give(null)
      s.onload = () => {
        window.require.config({ paths: { vs: MONACO + 'vs' } })
        window.require(['vs/editor/editor.main'], async () => {
          const m = window.monaco
          m.editor.defineTheme('cp-dark', { base: 'vs-dark', inherit: true, rules: [], colors: {
            'editor.background': '#1f1f1f', 'editor.lineHighlightBackground': '#2a2d2e', 'editor.lineHighlightBorder': '#2a2d2e',
            'editorLineNumber.foreground': '#6e7681', 'editorLineNumber.activeForeground': '#cccccc' } })
          m.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false })
          try { await document.fonts.load('18px "JetBrains Mono"') } catch {}
          m.editor.remeasureFonts()
          give(m)
        }, () => give(null))
      }
      document.head.append(s)
    })
    return monacoPromise
  }

  // ---------- Two editor kinds with one small API ----------
  function monacoEditor(m, host, file, text, uri, hooks) {
    const model = m.editor.createModel(text, langOf(file) === 'py' ? 'python' : 'javascript', m.Uri.parse(uri))
    model.updateOptions({ tabSize: langOf(file) === 'py' ? 4 : 2, indentSize: langOf(file) === 'py' ? 4 : 2, insertSpaces: true })
    const ed = m.editor.create(host, {
      model, theme: 'cp-dark', automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false,
      fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontLigatures: false, fontSize: 18, lineHeight: 26,
      tabSize: langOf(file) === 'py' ? 4 : 2, insertSpaces: true, detectIndentation: false, renderWhitespace: 'none',
      padding: { top: 6, bottom: 6 }, overviewRulerLanes: 0, hideCursorInOverviewRuler: true,
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, alwaysConsumeMouseWheel: false },
      bracketPairColorization: { enabled: true }, guides: { bracketPairs: false, indentation: true },
      'semanticHighlighting.enabled': true, stickyScroll: { enabled: false }, contextmenu: true,
    })
    ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => hooks.save())
    ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => hooks.run())
    ed.addCommand(m.KeyCode.Escape, () => document.activeElement?.blur(), '!suggestWidgetVisible && !findWidgetVisible && !parameterHintsVisible')
    model.onDidChangeContent(() => hooks.change())
    ed.onDidChangeCursorPosition(() => hooks.cursor())
    ed.onDidFocusEditorText(() => hooks.focus(true))
    ed.onDidBlurEditorText(() => hooks.focus(false))
    let deco = null
    return {
      kind: 'monaco',
      get value() { return model.getValue() },
      set value(v) { if (model.getValue() !== v) model.setValue(v) },
      append(s) {
        const end = model.getFullModelRange().getEndPosition()
        model.pushEditOperations([], [{ range: new m.Range(end.lineNumber, end.column, end.lineNumber, end.column), text: s }], () => null)
        const e2 = model.getFullModelRange().getEndPosition()
        ed.setPosition(e2); ed.revealLine(e2.lineNumber)
      },
      flash(lines) {
        deco?.clear()
        deco = ed.createDecorationsCollection(lines.map((l) => ({ range: new m.Range(l, 1, l, 1), options: { isWholeLine: true, className: 'ln-flash-m' } })))
        if (lines.length) ed.revealLineInCenterIfOutsideViewport(lines[0])
        if (ed.getContentHeight() <= ed.getLayoutInfo().height) ed.setScrollTop(0)
        setTimeout(() => deco?.clear(), 3000)
      },
      focus() { ed.focus() },
      get focused() { return ed.hasTextFocus() },
      line() { return ed.getPosition()?.lineNumber || 1 },
      col() { return ed.getPosition()?.column || 1 },
      setFont(size, lh) { ed.updateOptions({ fontSize: size, lineHeight: lh }) },
      top() { ed.setScrollTop(0) },
    }
  }

  function simpleEditor(host, file, text, hooks) {
    const lang = langOf(file), L = LANG[lang]
    host.innerHTML = '<div class="vs-gutter"></div><div class="vs-wrap"><pre class="vs-hl"></pre><textarea class="vs-ta" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div>'
    host.classList.add('simple')
    const ta = host.querySelector('.vs-ta'), hl = host.querySelector('.vs-hl'), gutter = host.querySelector('.vs-gutter')
    let flashSet = null, caret = false
    ta.value = text
    const curLine = () => ta.value.slice(0, ta.selectionStart).split('\n').length
    function render() {
      let h = highlight(ta.value, lang)
      if (flashSet) h = h.split('\n').map((l, k) => (flashSet.has(k + 1) ? `<span class="ln-flash">${l || ' '}</span>` : l)).join('\n')
      if (caret) h += '<span class="vs-caret"></span>'
      hl.innerHTML = h + '\n'
      const n = ta.value.replace(/\n$/, '').split('\n').length
      const cur = document.activeElement === ta ? curLine() : -1
      gutter.innerHTML = Array.from({ length: Math.max(n, 1) }, (_, k) => `<div${k + 1 === cur ? ' class="on"' : ''}>${k + 1}</div>`).join('')
    }
    const follow = (line) => {
      const lh = parseFloat(getComputedStyle(host).getPropertyValue('--vs-lh')) || 26
      const top = (line - 1) * lh
      if (top + 2 * lh > host.scrollTop + host.clientHeight) host.scrollTop = top + 2 * lh - host.clientHeight
      else if (top < host.scrollTop) host.scrollTop = Math.max(0, top - lh)
    }
    ta.addEventListener('input', () => { render(); follow(curLine()); hooks.change() })
    ta.addEventListener('keyup', () => { render(); hooks.cursor() })
    ta.addEventListener('click', () => { render(); hooks.cursor() })
    ta.addEventListener('focus', () => { render(); hooks.focus(true) })
    ta.addEventListener('blur', () => { render(); hooks.focus(false) })
    ta.addEventListener('keydown', (k) => {
      if (k.key === 'Escape') { ta.blur(); return }
      if ((k.ctrlKey || k.metaKey) && k.key.toLowerCase() === 's') { k.preventDefault(); hooks.save(); return }
      if (k.key === 'Enter' && (k.ctrlKey || k.metaKey)) { k.preventDefault(); hooks.run(); return }
      if (k.key === 'Tab') { k.preventDefault(); document.execCommand('insertText', false, L.indent); return }
      if (k.key === 'Enter') {
        k.preventDefault()
        const cur = ta.value.slice(0, ta.selectionStart).split('\n').pop()
        let ind = cur.match(/^\s*/)[0]
        if (L.opens.test(cur)) ind += L.indent
        document.execCommand('insertText', false, '\n' + ind)
      }
    })
    render()
    return {
      kind: 'simple',
      get value() { return ta.value },
      set value(v) { ta.value = v; render() },
      append(s) { ta.value += s; caret = true; render(); follow(ta.value.split('\n').length); clearTimeout(this._c); this._c = setTimeout(() => { caret = false; render() }, 400) },
      flash(lines) { flashSet = new Set(lines); render(); if (lines.length) follow(lines[0]); setTimeout(() => { flashSet = null; render() }, 3000) },
      focus() { ta.focus() },
      get focused() { return document.activeElement === ta },
      line: curLine,
      col() { return ta.selectionStart - ta.value.lastIndexOf('\n', ta.selectionStart - 1) },
      setFont(size, lh) { host.style.setProperty('--vs-font', size + 'px'); host.style.setProperty('--vs-lh', lh + 'px') },
      top() { host.scrollTop = 0 },
    }
  }

  // ---------- A terminal you can type in ----------
  function makeShell(term, pad) {
    term.innerHTML = '<div class="tout"></div><div class="tprompt"><span class="ps">$&nbsp;</span><input class="tin" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="terminal"></div>'
    term.tabIndex = -1
    const outEl = term.querySelector('.tout'), promptEl = term.querySelector('.tprompt'), input = term.querySelector('.tin')
    const history = []
    let hIdx = 0, running = null, typing = false
    const print = (cls, text) => {
      const d = document.createElement('div'); d.className = cls; d.textContent = text; outEl.append(d)
      while (outEl.childElementCount > KEEP_LINES) outEl.firstChild.remove()
    }
    const scroll = () => { term.scrollTop = term.scrollHeight }
    const shell = {
      print, lines: () => [...outEl.children].map((d) => d.textContent),
      clear() { outEl.innerHTML = '' },
      get busy() { return !!running || typing },
      async exec(line) {
        line = line.trim()
        input.value = ''
        print('cmd', line)
        if (line) { history.push(line); hIdx = history.length }
        const [cmd, ...args] = line.split(/\s+/).filter(Boolean)
        const file = args.find((a) => !a.startsWith('-'))
        const sys = (s) => print('sys', s)
        if (!cmd) return scroll()
        if (cmd === 'clear') return shell.clear()
        if (cmd === 'ls') { print('out', pad.files().join('  ')); return scroll() }
        if (cmd === 'pwd') { print('out', `/home/student/${pad.folder}`); return scroll() }
        if (cmd === 'echo') { print('out', args.join(' ').replace(/^["']|["']$/g, '')); return scroll() }
        if (cmd === 'cat') { const t = pad.fsRead(file); t === undefined ? print('err', `cat: ${file}: No such file or directory`) : t.replace(/\n$/, '').split('\n').forEach((l) => print('out', l)); return scroll() }
        if (['cd', 'mkdir', 'code', 'touch'].includes(cmd)) { sys(`(This practice terminal stays in ${pad.folder}/. Create files in the editor.)`); return scroll() }
        const isNode = cmd === 'node', isPy = ['python3', 'python', 'py'].includes(cmd)
        if (!isNode && !isPy) { print('err', `bash: ${cmd}: command not found`); return scroll() }
        if (args.includes('--version') || args.includes('-V') || args.includes('-v')) {
          if (isPy && pyState.ready) print('out', `Python ${pyState.version}`)
          else sys(isPy ? 'Python is still loading…' : 'This terminal runs JavaScript inside your browser. Check your real Node version in your own terminal.')
          return scroll()
        }
        if (!file) { sys(`Interactive ${isNode ? 'Node' : 'Python'} isn't available here. Run a file: ${cmd} <file>`); return scroll() }
        const code = pad.fsRead(file)
        if (code === undefined) {
          if (isNode) { print('err', 'node:internal/modules/cjs/loader:1228'); print('err', '  throw err;'); print('err', '  ^'); print('err', ''); print('err', `Error: Cannot find module '/home/student/${pad.folder}/${file}'`) }
          else print('err', `${cmd}: can't open file '/home/student/${pad.folder}/${file}': [Errno 2] No such file or directory`)
          return scroll()
        }
        promptEl.style.display = 'none'
        term.focus({ preventScroll: true })
        await new Promise((resolve) => {
          const sink = {
            folder: pad.folder,
            lines(a) { a.forEach(([c, s]) => print(c, s)); scroll() },
            done() { running = null; resolve() },
          }
          running = isNode ? runJs(code, file, sink) : runPy(code, file, sink, pad.recorded(file, code))
        })
        promptEl.style.display = ''
        scroll()
        if (term.contains(document.activeElement)) input.focus({ preventScroll: true })
      },
      async typeAndRun(line) {
        if (running || typing) return
        typing = true
        input.value = ''
        for (const ch of line) { input.value += ch; await sleep(18) }
        await sleep(120)
        typing = false
        await shell.exec(line)
      },
      stop() { if (running) running.stop() },
      focus() { input.focus({ preventScroll: true }) },
    }
    term.addEventListener('click', () => { if (!running && !window.getSelection()?.toString()) input.focus({ preventScroll: true }) })
    term.addEventListener('keydown', (k) => {
      if (k.ctrlKey && (k.key === 'c' || k.key === 'C') && (running || !input.value || window.getSelection()?.toString() === '')) {
        if (running) { k.preventDefault(); running.stop(); return }
        if (document.activeElement === input) { k.preventDefault(); print('cmd', input.value + '^C'); input.value = ''; scroll(); return }
      }
      if (k.ctrlKey && (k.key === 'l' || k.key === 'L')) { k.preventDefault(); shell.clear() }
      k.stopPropagation() // keys typed in the terminal never change slides
    })
    input.addEventListener('keydown', (k) => {
      if (k.key === 'Enter') { k.preventDefault(); shell.exec(input.value) }
      else if (k.key === 'ArrowUp') { k.preventDefault(); if (hIdx > 0) input.value = history[--hIdx] }
      else if (k.key === 'ArrowDown') { k.preventDefault(); hIdx = Math.min(hIdx + 1, history.length); input.value = history[hIdx] || '' }
      else if (k.key === 'Tab') {
        k.preventDefault()
        const parts = input.value.split(' '), last = parts.pop()
        const hits = pad.files().filter((f) => f.startsWith(last))
        if (hits.length === 1) input.value = [...parts, hits[0]].join(' ') + ' '
        else if (hits.length > 1) {
          let common = hits[0]
          for (const h of hits) while (!h.startsWith(common)) common = common.slice(0, -1)
          if (common.length > last.length) input.value = [...parts, common].join(' ')
          else { print('cmd', input.value); print('out', hits.join('  ')); scroll() }
        }
      } else if (k.key === 'Escape') input.blur()
    })
    return shell
  }

  // ---------- Building one pad ----------
  const pads = []
  const allFiles = [] // every file in the deck, in order (for the explorer)
  document.querySelectorAll('.vscode').forEach((root, k) => {
    root.querySelectorAll('script[data-file]').forEach((s) => { if (!allFiles.includes(s.dataset.file)) allFiles.push(s.dataset.file) })
    pads.push(makePad(root, [...allFiles], k))
  })

  function makePad(root, filesSoFar, padIndex) {
    const scripts = [...root.querySelectorAll('script[type="text/plain"][data-file]')]
    const clean = (s) => s.textContent.replace(/^\n/, '').replace(/\s+$/, '') + '\n'
    const names = [...new Set(scripts.map((s) => s.dataset.file))]
    const steps = scripts.filter((s) => s.hasAttribute('data-step')).map((s) => ({ file: s.dataset.file, text: clean(s), mode: s.dataset.mode || 'append' }))
    const start = {}, expect = {}
    names.forEach((n) => { start[n] = '' })
    scripts.filter((s) => s.hasAttribute('data-start')).forEach((s) => (start[s.dataset.file] = clean(s)))
    scripts.filter((s) => s.hasAttribute('data-expect')).forEach((s) => (expect[s.dataset.file] = s.textContent.replace(/^\n/, '').replace(/\n$/, '')))
    scripts.forEach((s) => s.remove())
    const folder = root.dataset.folder || 'project'
    const extra = (root.dataset.extraFiles || '').split(' ').filter(Boolean)
    const explorerFiles = [...filesSoFar.filter((f) => !names.includes(f)), ...extra, ...names]
      .filter((f, k, a) => a.indexOf(f) === k).sort((a, b) => a.localeCompare(b))
    const fileIcon = (f) => f.endsWith('.py') ? '<span class="ficon py">py</span>' : f.endsWith('.js') ? '<span class="ficon js">JS</span>' : '<span class="ficon">≡</span>'

    root.innerHTML = `
      <div class="vs-title"><div class="dots"><i></i><i></i><i></i></div><div class="name">${esc(folder)} · Visual Studio Code</div></div>
      <div class="vs-main">
        <div class="vs-act">
          <svg class="on" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>
          <svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 4-6 3-11 6"/></svg>
          <svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><path d="M15 4h5v5"/></svg>
        </div>
        <div class="vs-exp"><div class="h">EXPLORER</div><div class="folder">⌄ ${esc(folder.toUpperCase())}</div>
          ${explorerFiles.map((f) => `<div class="f${names.includes(f) ? ' cur' : ''}" data-f="${esc(f)}">${fileIcon(f)}${esc(f)}</div>`).join('')}</div>
        <div class="vs-groups">${names.map((n) => `
          <div class="vs-group" data-f="${esc(n)}">
            <div class="vs-tabs"><div class="vs-tab">${fileIcon(n)}${esc(n)}<span class="x" title="● = not saved yet (Ctrl+S)">×</span></div>
              <button type="button" class="vs-run" title="Save and run this file in its terminal (Ctrl+Enter)"><svg viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z"/></svg>Run</button></div>
            <div class="vs-crumb">${esc(folder)} › ${esc(n)}</div>
            <div class="vs-code"></div>
          </div>`).join('')}</div>
      </div>
      <div class="vs-panel">
        <div class="vs-ptabs"><span>PROBLEMS</span><span>OUTPUT</span><span>DEBUG CONSOLE</span><span class="on">TERMINAL</span><span class="note"></span></div>
        <div class="vs-terms">${names.map((n) => `<div class="vs-term" data-f="${esc(n)}"></div>`).join('')}</div>
      </div>
      <div class="vs-status"><span class="hint"></span><span class="stepinfo"></span>
        <div class="r"><span class="pos"></span><span class="lang"></span><span class="pystat"></span>
          <button type="button" class="b-next" title="Type the next prepared chunk (N)">Type next ▸</button>
          <button type="button" class="b-runall" title="Run every file in its terminal (R)">Run ▸</button>
          <button type="button" class="b-all" title="Show the finished code">All</button>
          <button type="button" class="b-reset" title="Back to the start of this slide">Reset</button></div></div>`

    const $ = (s) => root.querySelector(s)
    const ed = {}
    let stepIdx = 0, typing = null, focused = null, built = null, touched = false
    const saved = { ...start }
    const pad = {}

    names.forEach((n) => {
      const g = root.querySelector(`.vs-group[data-f="${CSS.escape(n)}"]`)
      ed[n] = { name: n, lang: langOf(n), g, host: g.querySelector('.vs-code'), tab: g.querySelector('.vs-tab .x'), editor: null,
                shell: makeShell(root.querySelector(`.vs-term[data-f="${CSS.escape(n)}"]`), pad) }
    })

    const valueOf = (n) => (ed[n].editor ? ed[n].editor.value : start[n])
    const markDirty = () => names.forEach((n) => { const d = valueOf(n) !== saved[n]; ed[n].tab.textContent = d ? '●' : '×'; ed[n].tab.classList.toggle('dirty', d) })
    const save = (n) => { saved[n] = valueOf(n); touched = true; markDirty() }

    function build() {
      if (built) return built
      built = (async () => {
        fit()
        const m = await loadMonaco()
        names.forEach((n) => {
          const e = ed[n]
          const hooks = { save: () => save(n), run: () => { save(n); e.shell.typeAndRun(runCmd(n)) }, change: () => { touched = true; markDirty() }, cursor: drawStatus, focus: (on) => { if (on) focused = e; else if (focused === e) focused = null; drawStatus() } }
          e.editor = m ? monacoEditor(m, e.host, n, start[n], `file:///pad${padIndex}/${folder}/${n}`, hooks) : simpleEditor(e.host, n, start[n], hooks)
          if (fitted) e.editor.setFont(fitted.font, fitted.lh)
        })
        root.classList.add(m ? 'monaco' : 'simple')
        drawStatus()
      })()
      return built
    }

    const runCmd = (n) => (langOf(n) === 'py' ? `python3 ${n}` : `node ${n}`)

    function drawStatus() {
      const busy = !built
      $('.hint').textContent = focused ? `Editing ${focused.name} · Ctrl+S save · Ctrl+Enter run · Esc leave` : busy ? 'Loading the editor…' : 'N type next · R run · click the code or the terminal to type'
      $('.stepinfo').textContent = steps.length ? `Step ${Math.min(stepIdx, steps.length)} of ${steps.length}` : ''
      const e = focused || ed[steps[Math.max(0, Math.min(stepIdx - 1, steps.length - 1))]?.file] || ed[names[0]]
      $('.pos').textContent = focused?.editor ? `Ln ${focused.editor.line()}, Col ${focused.editor.col()}` : ''
      $('.lang').textContent = e?.lang === 'py' ? 'Python' : 'JavaScript'
      const py = $('.pystat'), hasPy = names.some((n) => langOf(n) === 'py')
      py.className = 'pystat ' + (pyState.ready ? 'ready' : pyState.failed ? 'off' : 'loading')
      py.textContent = !hasPy ? '' : pyState.ready ? `Python ${pyState.version}` : pyState.failed ? 'Python offline: recorded output' : 'Python loading…'
      $('.vs-ptabs .note').textContent = names.length > 1 ? 'split terminal: one per file' : ''
      $('.b-next').disabled = stepIdx >= steps.length && !typing
      broadcast()
    }

    function finishTyping() {
      if (!typing) return
      const t = typing; typing = null
      clearInterval(t.timer)
      t.e.editor.value = t.target
      save(t.e.name); drawStatus()
    }

    async function next() {
      await build()
      if (typing) return finishTyping()
      const st = steps[stepIdx]
      if (!st) return
      stepIdx++
      const e = ed[st.file]
      if (st.mode === 'set') {
        const before = e.editor.value.split('\n')
        e.editor.value = st.text
        const lines = st.text.split('\n').map((l, k) => (l !== before[k] && l.trim() ? k + 1 : 0)).filter(Boolean)
        e.editor.flash(lines); save(st.file)
        return drawStatus()
      }
      const base = e.editor.value.replace(/\n*$/, '')
      if (e.editor.value !== base) e.editor.value = base
      const target = (base ? base + '\n\n' : '') + st.text
      let pos = base.length
      typing = { e, target, timer: null }
      typing.timer = setInterval(() => {
        let end = pos, n = 2
        while (n-- > 0 && end < target.length) {
          end++
          while (end < target.length && target[end - 1] === '\n' && target[end] === ' ') end++
          while (end < target.length && target[end] === ' ' && target[end - 1] === ' ') end++
        }
        e.editor.append(target.slice(pos, end)); pos = end
        if (pos >= target.length) finishTyping()
      }, 30)
      drawStatus()
    }

    async function showAll() {
      await build()
      finishTyping()
      while (stepIdx < steps.length) {
        const st = steps[stepIdx++], e = ed[st.file]
        if (st.mode === 'set') e.editor.value = st.text
        else { const b = e.editor.value.replace(/\n*$/, ''); e.editor.value = (b ? b + '\n\n' : '') + st.text }
      }
      names.forEach(save); drawStatus()
    }

    async function reset() {
      await build()
      finishTyping(); stepIdx = 0
      names.forEach((n) => { const e = ed[n]; e.shell.stop(); e.editor.value = start[n]; e.editor.top(); e.shell.clear(); saved[n] = start[n] })
      touched = false; markDirty(); drawStatus()
    }

    const finalText = (n) => {
      let t = start[n]
      steps.forEach((st) => { if (st.file !== n) return; if (st.mode === 'set') t = st.text; else { const b = t.replace(/\n*$/, ''); t = (b ? b + '\n\n' : '') + st.text } })
      return t
    }

    async function run(n) { await build(); finishTyping(); await ed[n].shell.exec(runCmd(n)) }
    async function runAll() {
      await build(); finishTyping()
      if (focused) document.activeElement?.blur()
      await Promise.all(names.map(async (n, k) => { await sleep(k * 150); await ed[n].shell.typeAndRun(runCmd(n)) }))
    }

    // Size the font and terminal so this slide's longest file and its output both fit (slides only)
    let fitted = null
    function fit() {
      if (fitted || !steps.length || !root.offsetHeight) return
      const lines = Math.max(...names.map((n) => finalText(n).split('\n').length)) // Monaco shows the empty last line too
      const outLines = Math.max(+(root.dataset.termLines || 7), ...names.map((n) => (expect[n] ?? '').split('\n').length + 2))
      const crumbs = [...root.querySelectorAll('.vs-crumb')]
      const crumbH = crumbs[0].offsetHeight
      const total = ed[names[0]].host.clientHeight + root.querySelector('.vs-panel').offsetHeight + crumbH
      let lh = 26, tlh = 22
      for (; lh > 18; lh--) {
        tlh = Math.min(22, Math.max(18, Math.round(lh * 0.85)))
        if (lines * lh + 28 + outLines * tlh + 46 + (lh >= 24 ? crumbH : 0) <= total) break // 28 = padding + a sideways scrollbar
      }
      fitted = { lh, font: Math.round(lh * 0.69) }
      root.style.setProperty('--vs-lh', lh + 'px')
      root.style.setProperty('--vs-font', fitted.font + 'px')
      root.style.setProperty('--vs-tlh', tlh + 'px')
      root.style.setProperty('--vs-tfont', Math.round(tlh * 0.73) + 'px')
      root.style.setProperty('--vs-term', outLines * tlh + 46 + 'px')
      root.style.setProperty('--vs-padb', '12px')
      if (lh < 24) crumbs.forEach((c) => (c.style.display = 'none'))
      names.forEach((n) => ed[n].editor?.setFont(fitted.font, fitted.lh))
    }

    names.forEach((n) => { ed[n].g.querySelector('.vs-run').onclick = async (ev) => { ev.currentTarget.blur(); await build(); save(n); ed[n].shell.typeAndRun(runCmd(n)) } })
    $('.b-next').onclick = (ev) => { ev.currentTarget.blur(); next() }
    $('.b-runall').onclick = (ev) => { ev.currentTarget.blur(); runAll() }
    $('.b-all').onclick = (ev) => { ev.currentTarget.blur(); showAll() }
    $('.b-reset').onclick = (ev) => { ev.currentTarget.blur(); reset() }

    function broadcast() {
      if (root.closest('.slide') && !root.closest('.slide').classList.contains('active')) return
      const st = steps[stepIdx]
      chan.postMessage({ t: 'state', has: true, step: Math.min(stepIdx, steps.length), total: steps.length, file: st?.file || null, next: st ? st.text : null })
    }

    Object.assign(pad, {
      saveFocused: () => { if (focused) save(focused.name) },
      root, names, ed, expect, folder, fit, build, next, showAll, reset, run, runAll, drawStatus, broadcast, finalText,
      get stepIdx() { return stepIdx }, steps,
      text: (n) => valueOf(n),
      terminal: (n) => ed[n].shell.lines().join('\n'),
      files: () => explorerFiles,
      // what a terminal "sees" on disk: this slide's saved files; earlier slides' files as they ended
      fsRead(f) {
        if (names.includes(f)) return saved[f]
        for (let k = padIndex - 1; k >= 0; k--) { const p = pads[k]; if (p.names.includes(f)) return p.savedOrFinal(f) }
        return explorerFiles.includes(f) ? '' : undefined
      },
      savedOrFinal: (f) => (touched ? saved[f] : finalText(f)),
      recorded: (f, code) => (code === finalText(f) ? expect[f] : undefined),
    })
    markDirty(); drawStatus()
    return pad
  }

  // ---------- Keys, slide changes, presenter link ----------
  const activePad = () => pads.find((p) => !p.root.closest('.slide') || p.root.closest('.slide').classList.contains('active'))
  addEventListener('keydown', (k) => {
    const p = activePad(); if (!p) return
    if ((k.ctrlKey || k.metaKey) && k.key.toLowerCase() === 's') { k.preventDefault(); p.saveFocused(); return }  // VS Code's save, not the browser's
    if (k.target.closest && k.target.closest('input, textarea, select, .vs-term')) return
    if (k.ctrlKey || k.metaKey || k.altKey) return
    if (k.key === 'n' || k.key === 'N') { k.preventDefault(); p.next() }
    else if (k.key === 'r' || k.key === 'R') { k.preventDefault(); p.runAll() }
  }, true)
  const sendState = () => { const p = activePad(); if (p) { p.fit(); p.build(); p.broadcast() } else chan.postMessage({ t: 'state', has: false }) }
  new MutationObserver(sendState).observe(document.querySelector('.stage') || document.body, { attributes: true, subtree: true, attributeFilter: ['class'] })
  chan.onmessage = ({ data: d }) => {
    if (d.t === 'hello') sendState()
    if (d.t === 'cmd') { const p = activePad(); if (!p) return; ({ next: p.next, run: p.runAll, all: p.showAll, reset: p.reset })[d.c]?.() }
  }
  if (pads.some((p) => p.names.some((n) => langOf(n) === 'py'))) startPython()
  if (pads.length) loadMonaco()
  const first = activePad(); if (first) { first.fit(); first.build() }
  window.Codepad = { pads, py: pyState, nodeInspect, loadMonaco }

  // ---------- Presenter window: buttons + a peek at the next chunk ----------
  function presenterControls() {
    const side = document.querySelector('.pv .side')
    if (!side) return
    const box = document.createElement('div')
    box.className = 'padbox'
    box.innerHTML = `<div class="meta">CODEPAD (N type next · R run)</div><div class="info"></div><pre></pre>
      <div class="row"><button data-c="next" style="background:#13795b;color:#fff">Type next</button><button data-c="run" style="background:#2552c9;color:#fff">Run</button></div>
      <div class="row" style="margin-top:8px"><button data-c="all">Show all</button><button data-c="reset">Reset</button></div>`
    side.insertBefore(box, side.querySelector('.next'))
    box.querySelectorAll('button').forEach((b) => (b.onclick = () => chan.postMessage({ t: 'cmd', c: b.dataset.c })))
    chan.onmessage = ({ data: d }) => {
      if (d.t !== 'state') return
      box.classList.toggle('on', d.has)
      if (!d.has) return
      box.querySelector('.info').textContent = d.next ? `Step ${d.step + 1} of ${d.total} → ${d.file}` : `All ${d.total} steps typed. Press R to run.`
      box.querySelector('pre').textContent = d.next || ''
      box.querySelector('pre').style.display = d.next ? '' : 'none'
    }
    addEventListener('keydown', (k) => {
      if (k.key === 'n' || k.key === 'N') chan.postMessage({ t: 'cmd', c: 'next' })
      if (k.key === 'r' || k.key === 'R') chan.postMessage({ t: 'cmd', c: 'run' })
    })
    chan.postMessage({ t: 'hello' })
  }
})()
