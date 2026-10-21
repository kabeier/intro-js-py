// Codepad: a VS Code look-alike on a slide that types code for you and really runs it.
//   N = type the next prepared chunk · R = run every file on the slide · click into the code to type yourself
//   Ctrl+Enter (while typing) runs that file · Esc leaves the editor so N / R / arrows work again
// JavaScript runs in a Web Worker and prints like Node. Python runs on Pyodide (real CPython) in a worker.
// Markup:
//   <div class="vscode" data-folder="fundamentals">
//     <script type="text/plain" data-file="hello.js" data-start>…initial text…</script>
//     <script type="text/plain" data-file="hello.js" data-step>…typed on N…</script>
//     <script type="text/plain" data-file="hello.py" data-step data-mode="set">…replaces the file…</script>
//     <script type="text/plain" data-file="hello.py" data-expect>…recorded output (offline fallback)…</script>
//   </div>
(() => {
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'
  const isPresenter = new URLSearchParams(location.search).has('presenter')
  const chan = new BroadcastChannel('codepad:' + location.pathname)
  const LIMIT_LINES = 300
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const langOf = (f) => (f.endsWith('.py') ? 'py' : 'js')

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

  const JS_WORKER = `
    const inspect = ${nodeInspect.toString()};
    let lines = 0;
    const out = (t, args) => {
      lines++;
      if (lines === ${LIMIT_LINES} + 1) postMessage({ t: 'flood' });
      if (lines > ${LIMIT_LINES}) return;
      postMessage({ t, s: args.map((a) => typeof a === 'string' ? a : inspect(a)).join(' ') });
    };
    const con = { log: (...a) => out('out', a), info: (...a) => out('out', a), debug: (...a) => out('out', a),
                  warn: (...a) => out('err', a), error: (...a) => out('err', a) };
    onmessage = (e) => {
      try { new Function('console', e.data.code)(con); postMessage({ t: 'done' }); }
      catch (err) {
        const m = /<anonymous>:(\\d+):(\\d+)/.exec(err && err.stack || '');
        postMessage({ t: 'exc', name: err && err.name || 'Error', message: err && err.message || String(err),
                      line: m ? +m[1] - 2 : null, col: m ? +m[2] : null });
      }
    };`

  const PY_WORKER = `
    importScripts('${PYODIDE}pyodide.js');
    let py, lines = 0;
    const emit = (t, s) => {
      lines++;
      if (lines === ${LIMIT_LINES} + 1) postMessage({ t: 'flood' });
      if (lines > ${LIMIT_LINES}) return;
      postMessage({ t, s });
    };
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
      lines = 0;
      py.FS.writeFile('/home/pyodide/' + e.data.file, e.data.code);
      py.globals.get('__cp_run')(e.data.file);
      for (const t of ['out', 'err']) if (buf[t]) { emit(t, buf[t]); buf[t] = ''; }
      postMessage({ t: 'done' });
    };`

  // ---------- Python worker (one, kept warm) ----------
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
    pyState.worker.onerror = () => { pyState.failed = true; pads.forEach((p) => p.drawStatus()) }
    setTimeout(() => { if (!pyState.ready) { pyState.failed = true; pads.forEach((p) => p.drawStatus()) } }, 45000)
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

  // ---------- Building one pad ----------
  const pads = []
  const allFiles = [] // every file in the deck, in order (for the explorer)
  document.querySelectorAll('.vscode').forEach((root) => {
    root.querySelectorAll('script[data-file]').forEach((s) => { if (!allFiles.includes(s.dataset.file)) allFiles.push(s.dataset.file) })
    pads.push(makePad(root, [...allFiles]))
  })

  function makePad(root, filesSoFar) {
    const scripts = [...root.querySelectorAll('script[type="text/plain"][data-file]')]
    const clean = (s) => s.textContent.replace(/^\n/, '').replace(/\s+$/, '') + '\n'
    const names = [...new Set(scripts.map((s) => s.dataset.file))]
    const steps = scripts.filter((s) => s.hasAttribute('data-step')).map((s) => ({ file: s.dataset.file, text: clean(s), mode: s.dataset.mode || 'append' }))
    const start = {}, expect = {}
    names.forEach((n) => { start[n] = ''; })
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
          ${explorerFiles.map((f) => `<div class="f${names.includes(f) ? ' cur' : ''}">${fileIcon(f)}${esc(f)}</div>`).join('')}</div>
        <div class="vs-groups">${names.map((n) => `
          <div class="vs-group" data-f="${esc(n)}">
            <div class="vs-tabs"><div class="vs-tab">${fileIcon(n)}${esc(n)}<span class="x">×</span></div>
              <button type="button" class="vs-run" title="Run this file (Ctrl+Enter while typing)"><svg viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z"/></svg>Run</button></div>
            <div class="vs-crumb">${esc(folder)} › ${esc(n)}</div>
            <div class="vs-code"><div class="vs-gutter"></div><div class="vs-wrap"><pre class="vs-hl"></pre><textarea class="vs-ta" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${esc(n)} code"></textarea></div></div>
          </div>`).join('')}</div>
      </div>
      <div class="vs-panel">
        <div class="vs-ptabs"><span>PROBLEMS</span><span>OUTPUT</span><span>DEBUG CONSOLE</span><span class="on">TERMINAL</span><span class="note"></span></div>
        <div class="vs-terms">${names.map((n) => `<pre class="vs-term" data-f="${esc(n)}"></pre>`).join('')}</div>
      </div>
      <div class="vs-status"><span class="hint"></span><span class="stepinfo"></span>
        <div class="r"><span class="pos"></span><span class="lang"></span><span class="pystat"></span>
          <button type="button" class="b-next" title="Type the next chunk (N)">Type next ▸</button>
          <button type="button" class="b-runall" title="Run all files (R)">Run ▸</button>
          <button type="button" class="b-all" title="Show the finished code">All</button>
          <button type="button" class="b-reset" title="Back to the start of this slide">Reset</button></div></div>`

    const ed = {}
    names.forEach((n) => {
      const g = root.querySelector(`.vs-group[data-f="${CSS.escape(n)}"]`)
      ed[n] = { name: n, lang: langOf(n), text: start[n], g, ta: g.querySelector('.vs-ta'), hl: g.querySelector('.vs-hl'), gutter: g.querySelector('.vs-gutter'), code: g.querySelector('.vs-code'), term: root.querySelector(`.vs-term[data-f="${CSS.escape(n)}"]`), flash: null, caret: false }
    })
    let stepIdx = 0, typing = null, focused = null
    const $ = (s) => root.querySelector(s)

    function render(e) {
      const text = e.text
      let html = highlight(text, e.lang)
      if (e.flash) {
        const lines = html.split('\n')
        html = lines.map((l, k) => (e.flash.has(k) ? `<span class="ln-flash">${l || ' '}</span>` : l)).join('\n')
      }
      if (e.caret) html += '<span class="vs-caret"></span>'
      e.hl.innerHTML = html + '\n'
      if (e.ta.value !== text) e.ta.value = text
      const n = text.split('\n').length - (text.endsWith('\n') && !e.caret && focused !== e ? 1 : 0)
      const cur = curLine(e)
      e.gutter.innerHTML = Array.from({ length: Math.max(n, 1) }, (_, k) => `<div${k === cur ? ' class="on"' : ''}>${k + 1}</div>`).join('')
    }
    const curLine = (e) => (focused === e ? e.ta.value.slice(0, e.ta.selectionStart).split('\n').length - 1 : e.caret ? e.text.split('\n').length - 1 : -1)
    const follow = (e, line) => {
      const lh = parseFloat(getComputedStyle(e.code).getPropertyValue('--vs-lh')) || 26
      const top = line * lh, view = e.code.clientHeight
      if (top + 2 * lh > e.code.scrollTop + view) e.code.scrollTop = top + 2 * lh - view
      else if (top < e.code.scrollTop) e.code.scrollTop = Math.max(0, top - lh)
    }

    function drawStatus() {
      $('.hint').textContent = focused ? `Typing in ${focused.name} · Ctrl+Enter runs · Esc to leave` : 'N type next · R run · click the code to type'
      $('.stepinfo').textContent = steps.length ? `Step ${Math.min(stepIdx, steps.length)} of ${steps.length}` : ''
      const e = focused || ed[steps[Math.min(stepIdx, steps.length - 1)]?.file] || ed[names[0]]
      const ln = focused ? curLine(focused) + 1 : Math.max(1, (e?.text.replace(/\n$/, '').split('\n').length || 1))
      $('.pos').textContent = `Ln ${ln}`
      $('.lang').textContent = e?.lang === 'py' ? 'Python' : 'JavaScript'
      const py = $('.pystat')
      const hasPy = names.some((n) => langOf(n) === 'py')
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
      t.e.text = t.target; t.e.caret = false
      render(t.e); follow(t.e, t.e.text.split('\n').length - 1); drawStatus()
    }

    function next() {
      if (typing) return finishTyping()
      const st = steps[stepIdx]
      if (!st) return
      stepIdx++
      const e = ed[st.file]
      if (st.mode === 'set') {
        const before = e.text.split('\n')
        e.text = st.text
        e.flash = new Set(st.text.split('\n').map((l, k) => (l !== before[k] ? k : -1)).filter((k) => k >= 0 && st.text.split('\n')[k].trim()))
        render(e); setTimeout(() => { e.flash = null; render(e) }, 3000)
        const first = [...e.flash][0]; if (first !== undefined) follow(e, first)
        return drawStatus()
      }
      const base = e.text.replace(/\n*$/, '')
      const target = (base ? base + '\n\n' : '') + st.text
      let pos = base ? base.length + 2 : 0
      e.text = target.slice(0, pos); e.caret = true
      typing = { e, target, timer: null }
      typing.timer = setInterval(() => {
        let n = 2
        while (n-- > 0 && pos < target.length) {
          pos++
          while (pos < target.length && target[pos - 1] === '\n' && target[pos] === ' ') pos++ // indentation appears at once
          while (pos < target.length && target[pos] === ' ' && target[pos - 1] === ' ') pos++
        }
        e.text = target.slice(0, pos)
        render(e); follow(e, e.text.split('\n').length - 1)
        if (pos >= target.length) finishTyping()
      }, 32)
      drawStatus()
    }

    function showAll() {
      finishTyping()
      while (stepIdx < steps.length) {
        const st = steps[stepIdx++], e = ed[st.file]
        if (st.mode === 'set') e.text = st.text
        else { const base = e.text.replace(/\n*$/, ''); e.text = (base ? base + '\n\n' : '') + st.text }
      }
      names.forEach((n) => render(ed[n])); drawStatus()
    }

    function reset() {
      finishTyping(); stepIdx = 0
      names.forEach((n) => { const e = ed[n]; e.text = start[n]; e.flash = null; e.caret = false; e.term.innerHTML = ''; e.code.scrollTop = 0; render(e) })
      drawStatus()
    }

    const line = (e, cls, s) => { const d = document.createElement('div'); d.className = cls; d.textContent = s; e.term.append(d); e.term.scrollTop = e.term.scrollHeight }

    const finalText = (n) => {
      let t = start[n]
      steps.forEach((st) => { if (st.file !== n) return; if (st.mode === 'set') t = st.text; else { const b = t.replace(/\n*$/, ''); t = (b ? b + '\n\n' : '') + st.text } })
      return t
    }

    function run(n) {
      finishTyping()
      const e = ed[n]
      e.term.innerHTML = ''
      line(e, 'cmd', e.lang === 'py' ? `python3 ${n}` : `node ${n}`)
      const code = e.text
      return e.lang === 'py' ? runPy(e, code) : runJs(e, code)
    }

    function runJs(e, code) {
      return new Promise((resolve) => {
        const w = new Worker(URL.createObjectURL(new Blob([JS_WORKER], { type: 'text/javascript' })))
        let finished = false
        const stop = (msg) => { if (finished) return; finished = true; clearTimeout(timer); if (msg) { line(e, 'err', '^C'); line(e, 'sys', msg) } setTimeout(() => w.terminate(), msg ? 0 : 1500); resolve() }
        const timer = setTimeout(() => stop('Stopped after 3 seconds: a loop that never ends? In your terminal, Ctrl+C stops it.'), 3000)
        w.onmessage = ({ data: d }) => {
          if (d.t === 'out' || d.t === 'err') line(e, d.t === 'err' ? 'err' : 'out', d.s)
          else if (d.t === 'flood') stop(`Stopped after ${LIMIT_LINES} lines: a loop that never ends? In your terminal, Ctrl+C stops it.`)
          else if (d.t === 'done') stop()
          else if (d.t === 'exc') {
            const src = code.split('\n')
            if (d.line && src[d.line - 1] !== undefined) {
              line(e, 'err', `${e.name}:${d.line}`); line(e, 'err', src[d.line - 1])
              if (d.col) line(e, 'err', ' '.repeat(d.col - 1) + '^')
              line(e, 'err', '')
            }
            line(e, 'err', `${d.name}: ${d.message}`)
            if (d.line) line(e, 'err', `    at ${e.name}:${d.line}${d.col ? ':' + d.col : ''}`)
            stop()
          }
        }
        w.postMessage({ code })
      })
    }

    function runPy(e, code) {
      return new Promise((resolve) => {
        const recorded = () => {
          if (code === finalText(e.name) && expect[e.name] !== undefined) {
            expect[e.name].split('\n').forEach((s) => line(e, 'out', s))
            line(e, 'sys', '(recorded output: Python could not load here. Is the internet on?)')
          } else line(e, 'sys', 'Python could not load (no internet?). Run it in your own terminal instead.')
          resolve()
        }
        if (pyState.failed) return recorded()
        if (!pyState.ready) line(e, 'sys', 'Starting Python…')
        let timer = null, finished = false
        const done = (msg) => {
          if (finished) return; finished = true; clearTimeout(timer); pyState.listeners.delete(fn)
          if (msg) { line(e, 'err', '^C'); line(e, 'sys', msg); pyState.worker.terminate(); startPython() }
          resolve()
        }
        const fn = (d) => {
          if (d.t === 'ready') { e.term.querySelector('.sys')?.remove(); timer = setTimeout(() => done('Stopped after 5 seconds: a loop that never ends? In your terminal, Ctrl+C stops it.'), 5000) }
          else if (d.t === 'loadfail') { pyState.listeners.delete(fn); finished = true; recorded() }
          else if (d.t === 'out' || d.t === 'err') line(e, d.t, d.s)
          else if (d.t === 'flood') done(`Stopped after ${LIMIT_LINES} lines: a loop that never ends? In your terminal, Ctrl+C stops it.`)
          else if (d.t === 'done') done()
        }
        pyState.listeners.add(fn)
        if (pyState.ready) timer = setTimeout(() => done('Stopped after 5 seconds: a loop that never ends? In your terminal, Ctrl+C stops it.'), 5000)
        pyState.worker.postMessage({ file: e.name, code })
      })
    }

    async function runAll() { for (const n of names) await run(n) }

    // Size the font and terminal so this slide's longest file and its output both fit (slides only)
    let fitted = false
    function fit() {
      if (fitted || !steps.length || !root.offsetHeight) return
      const lines = Math.max(...names.map((n) => finalText(n).replace(/\n$/, '').split('\n').length))
      const outLines = Math.max(+(root.dataset.termLines || 7), ...names.map((n) => (expect[n] ?? '').split('\n').length + 1))
      const crumbs = [...root.querySelectorAll('.vs-crumb')]
      const crumbH = crumbs[0].offsetHeight
      const total = ed[names[0]].code.clientHeight + root.querySelector('.vs-panel').offsetHeight + crumbH
      let lh = 26, tlh = 22
      for (; lh > 18; lh--) {
        tlh = Math.min(22, Math.max(18, Math.round(lh * 0.85)))
        if (lines * lh + 16 + outLines * tlh + 46 + (lh >= 24 ? crumbH : 0) <= total) break
      }
      root.style.setProperty('--vs-lh', lh + 'px')
      root.style.setProperty('--vs-font', Math.round(lh * 0.69) + 'px')
      root.style.setProperty('--vs-tlh', tlh + 'px')
      root.style.setProperty('--vs-tfont', Math.round(tlh * 0.73) + 'px')
      root.style.setProperty('--vs-term', outLines * tlh + 46 + 'px')
      root.style.setProperty('--vs-padb', '12px')
      if (lh < 24) crumbs.forEach((c) => (c.style.display = 'none'))
      fitted = true
    }

    // Typing by hand
    names.forEach((n) => {
      const e = ed[n]
      e.ta.addEventListener('focus', () => { finishTyping(); focused = e; render(e); drawStatus() })
      e.ta.addEventListener('blur', () => { if (focused === e) focused = null; render(e); drawStatus() })
      e.ta.addEventListener('input', () => { e.text = e.ta.value; render(e); follow(e, curLine(e)); drawStatus() })
      e.ta.addEventListener('keyup', () => { render(e); drawStatus() })
      e.ta.addEventListener('click', () => { render(e); drawStatus() })
      e.ta.addEventListener('keydown', (k) => {
        const L = LANG[e.lang]
        if (k.key === 'Escape') { e.ta.blur(); return }
        if (k.key === 'Enter' && (k.ctrlKey || k.metaKey)) { k.preventDefault(); run(n); return }
        if (k.key === 'Tab') { k.preventDefault(); document.execCommand('insertText', false, L.indent); return }
        if (k.key === 'Enter') {
          k.preventDefault()
          const before = e.ta.value.slice(0, e.ta.selectionStart)
          const cur = before.split('\n').pop()
          let ind = cur.match(/^\s*/)[0]
          if (L.opens.test(cur)) ind += L.indent
          document.execCommand('insertText', false, '\n' + ind)
        }
      })
      g(e).querySelector('.vs-run').onclick = (ev) => { ev.currentTarget.blur(); run(n) }
    })
    function g(e) { return e.g }
    $('.b-next').onclick = (ev) => { ev.currentTarget.blur(); next() }
    $('.b-runall').onclick = (ev) => { ev.currentTarget.blur(); runAll() }
    $('.b-all').onclick = (ev) => { ev.currentTarget.blur(); showAll() }
    $('.b-reset').onclick = (ev) => { ev.currentTarget.blur(); reset() }

    function broadcast() {
      if (!root.closest('.slide')?.classList.contains('active') && root.closest('.slide')) return
      const st = steps[stepIdx]
      chan.postMessage({ t: 'state', has: true, step: Math.min(stepIdx, steps.length), total: steps.length, file: st?.file || null, next: st ? st.text : null, typing: !!typing })
    }

    names.forEach((n) => render(ed[n]))
    const pad = { root, names, ed, expect, fit, next, showAll, reset, run, runAll, drawStatus, broadcast, finalText, text: (n) => ed[n].text, terminal: (n) => [...ed[n].term.children].map((d) => d.textContent).join('\n'), get stepIdx() { return stepIdx }, steps }
    drawStatus()
    return pad
  }

  // ---------- Keys, slide changes, presenter link ----------
  const activePad = () => pads.find((p) => !p.root.closest('.slide') || p.root.closest('.slide').classList.contains('active'))
  addEventListener('keydown', (k) => {
    if (k.target.closest && k.target.closest('input, textarea, select')) return
    if (k.ctrlKey || k.metaKey || k.altKey) return
    const p = activePad(); if (!p) return
    if (k.key === 'n' || k.key === 'N') { k.preventDefault(); p.next() }
    else if (k.key === 'r' || k.key === 'R') { k.preventDefault(); p.runAll() }
  })
  const sendState = () => { const p = activePad(); if (p) { p.fit(); p.broadcast() } else chan.postMessage({ t: 'state', has: false }) }
  new MutationObserver(sendState).observe(document.querySelector('.stage') || document.body, { attributes: true, subtree: true, attributeFilter: ['class'] })
  chan.onmessage = ({ data: d }) => {
    if (d.t === 'hello') sendState()
    if (d.t === 'cmd') { const p = activePad(); if (!p) return; ({ next: p.next, run: p.runAll, all: p.showAll, reset: p.reset })[d.c]?.() }
  }
  activePad()?.fit()
  if (pads.some((p) => p.names.some((n) => langOf(n) === 'py'))) startPython()
  window.Codepad = { pads, py: pyState, nodeInspect }

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
