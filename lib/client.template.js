window.__ModuleLoader__.load({
  id: 'dsh-pet-luotianyi',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useRef = React.useRef

    var SPRITE = '__SPRITE_DATA_URI__'
    var LS_POS = 'dsh-pet-luotianyi:pos'
    var LS_NAME = 'dsh-pet-luotianyi:name'
    var PET_W = 132
    var PET_H = 168

    var LINES = {
      greet: ['你来啦，天依一直等你哦。', '嘿嘿，是想天依了吗？', '今天也要元气满满！'],
      pat: ['呜…好舒服，再摸摸嘛。', '嘻嘻，天依最喜欢这样啦。', '喵～啊不对，天依不是猫啦。'],
      feed: ['哇，是给天依的好吃的吗？', '好吃！天依还要！', '吃饱了唱歌会更好听哦。'],
      sleep: ['晚安～天依睡啦。', '呼噜…呼噜…', '陪你一起睡吧。'],
      wake: ['天依醒啦！', '睡饱了，精神满满！'],
      idle: ['好无聊呀，陪天依说说话嘛。', '天依想唱歌给你听。', '在想阿绫她们呢…', '今晚一起看星星好不好？'],
    }

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
    function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi) }

    var CSS = [
      '#dsh-pet-luotianyi-root{position:fixed;z-index:2147483000;pointer-events:none;user-select:none;-webkit-user-select:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}',
      '.dsh-pet-luotianyi-box{position:relative;width:' + PET_W + 'px;pointer-events:auto}',
      '.dsh-pet-luotianyi-img{display:block;width:100%;height:auto;cursor:grab;transform-origin:50% 100%;-webkit-user-drag:none}',
      '.dsh-pet-luotianyi-shadow{position:absolute;left:16%;right:16%;bottom:-9px;height:11px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.30),rgba(0,0,0,0) 70%);transition:transform .2s ease,opacity .2s ease}',
      '.dsh-pet-luotianyi--idle .dsh-pet-luotianyi-img{animation:dsh-pet-luotianyi-idle 3.2s ease-in-out infinite}',
      '@keyframes dsh-pet-luotianyi-idle{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-7px) rotate(1.2deg)}}',
      '.dsh-pet-luotianyi--sleep .dsh-pet-luotianyi-img{animation:dsh-pet-luotianyi-sleep 3.6s ease-in-out infinite;filter:brightness(.82) saturate(.9)}',
      '.dsh-pet-luotianyi--sleep .dsh-pet-luotianyi-shadow{transform:scale(.9);opacity:.7}',
      '@keyframes dsh-pet-luotianyi-sleep{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(.985)}}',
      '.dsh-pet-luotianyi--happy .dsh-pet-luotianyi-img{animation:dsh-pet-luotianyi-happy .9s ease-out}',
      '.dsh-pet-luotianyi--happy .dsh-pet-luotianyi-shadow{transform:scale(1.15)}',
      '@keyframes dsh-pet-luotianyi-happy{0%{transform:translateY(0) scale(1,1)}18%{transform:translateY(-18px) scale(.95,1.07)}38%{transform:translateY(0) scale(1.06,.9)}55%{transform:translateY(-9px) scale(1)}72%{transform:translateY(0) scale(1.03,.96)}100%{transform:translateY(0) scale(1)}}',
      '.dsh-pet-luotianyi--drag .dsh-pet-luotianyi-img{animation:none;transform:scale(1.04,.96) rotate(-2deg);cursor:grabbing}',
      '.dsh-pet-luotianyi--drag .dsh-pet-luotianyi-shadow{transform:scale(.85);opacity:.6}',
      '.dsh-pet-luotianyi-bubble{position:absolute;bottom:104%;left:50%;transform:translateX(-50%);max-width:236px;background:#fff;color:#333;border-radius:14px;padding:8px 12px;font-size:13px;line-height:1.5;box-shadow:0 4px 18px rgba(0,0,0,.22);white-space:pre-wrap;word-break:break-word;pointer-events:auto;animation:dsh-pet-luotianyi-pop .18s ease-out}',
      '.dsh-pet-luotianyi-bubble:after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:8px solid transparent;border-top-color:#fff}',
      '@keyframes dsh-pet-luotianyi-pop{from{opacity:0;transform:translateX(-50%) translateY(8px) scale(.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}',
      '.dsh-pet-luotianyi-pill{position:absolute;bottom:104%;left:50%;transform:translateX(-50%);display:flex;gap:2px;background:#fff;border-radius:999px;padding:4px;box-shadow:0 4px 18px rgba(0,0,0,.22);pointer-events:auto;animation:dsh-pet-luotianyi-pop .18s ease-out;white-space:nowrap}',
      '.dsh-pet-luotianyi-pill button{font:inherit;font-size:12px;border:none;background:#f1f3f6;color:#333;border-radius:999px;padding:5px 9px;cursor:pointer;white-space:nowrap}',
      '.dsh-pet-luotianyi-pill button:hover{background:#e2e7ef}',
      '.dsh-pet-luotianyi-pill button.dsh-pet-luotianyi-x{background:transparent;color:#888;padding:5px 7px}',
      '.dsh-pet-luotianyi-zzz{position:absolute;bottom:88%;right:6%;font-size:16px;color:#8aa0c0;font-weight:700;letter-spacing:2px;pointer-events:none;animation:dsh-pet-luotianyi-zzz 2.4s ease-in-out infinite}',
      '@keyframes dsh-pet-luotianyi-zzz{0%{opacity:0;transform:translateY(4px)}40%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}',
      '.dsh-pet-luotianyi-particle{position:absolute;pointer-events:none;font-size:17px;line-height:1;animation:dsh-pet-luotianyi-rise 1.1s ease-out forwards}',
      '@keyframes dsh-pet-luotianyi-rise{0%{opacity:0;transform:translateY(0) scale(.6)}12%{opacity:1}100%{opacity:0;transform:translateY(-58px) translateX(var(--dx,0px)) scale(.7) rotate(var(--rot,0deg))}}',
      '.dsh-pet-luotianyi-chat{position:absolute;bottom:104%;right:-8px;width:248px;background:#fff;border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.3);overflow:hidden;pointer-events:auto;animation:dsh-pet-luotianyi-pop2 .18s ease-out;display:flex;flex-direction:column}',
      '@keyframes dsh-pet-luotianyi-pop2{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '.dsh-pet-luotianyi-chat-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f7f8fa;border-bottom:1px solid #eceef2;font-size:13px;font-weight:600;color:#333}',
      '.dsh-pet-luotianyi-chat-head button{border:none;background:transparent;color:#999;cursor:pointer;font-size:15px;line-height:1}',
      '.dsh-pet-luotianyi-chat-body{padding:8px 10px;max-height:170px;overflow-y:auto;display:flex;flex-direction:column;gap:6px}',
      '.dsh-pet-luotianyi-msg{max-width:85%;padding:6px 10px;border-radius:12px;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word}',
      '.dsh-pet-luotianyi-msg-user{align-self:flex-end;background:#4f6ef7;color:#fff;border-bottom-right-radius:4px}',
      '.dsh-pet-luotianyi-msg-ai{align-self:flex-start;background:#f1f3f6;color:#333;border-bottom-left-radius:4px}',
      '.dsh-pet-luotianyi-chat-foot{display:flex;gap:6px;padding:8px;border-top:1px solid #eceef2}',
      '.dsh-pet-luotianyi-chat-foot input{flex:1;border:1px solid #e2e6ee;border-radius:999px;padding:6px 12px;font-size:13px;outline:none}',
      '.dsh-pet-luotianyi-chat-foot button{border:none;background:#4f6ef7;color:#fff;border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer}',
      '.dsh-pet-luotianyi-chat-foot button:disabled{opacity:.5;cursor:default}',
    ].join('\n')

    function injectStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById('dsh-pet-luotianyi-style')) return
      var style = document.createElement('style')
      style.id = 'dsh-pet-luotianyi-style'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    function loadPos() {
      try {
        var raw = window.localStorage.getItem(LS_POS)
        if (raw) {
          var p = JSON.parse(raw)
          if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y }
        }
      } catch (_) {}
      return null
    }

    function Pet() {
      var [name, setName] = useState('洛天依')
      var [pos, setPos] = useState(null)
      var [mode, setMode] = useState('idle')
      var [bubble, setBubble] = useState(null)
      var [menuOpen, setMenuOpen] = useState(false)
      var [chatOpen, setChatOpen] = useState(false)
      var [msgs, setMsgs] = useState([])
      var [draft, setDraft] = useState('')
      var [chatBusy, setChatBusy] = useState(false)
      var [hearts, setHearts] = useState([])

      var bubbleTimer = useRef(null)
      var happyTimer = useRef(null)
      var preMode = useRef('idle')
      var drag = useRef(null)
      var chatBody = useRef(null)

      useEffect(function () {
        injectStyle()
        try {
          var saved = window.localStorage.getItem(LS_NAME)
          if (saved && saved.trim()) setName(saved.trim())
        } catch (_) {}
        var init = loadPos()
        if (!init) {
          init = {
            x: Math.max(8, window.innerWidth - PET_W - 28),
            y: Math.max(8, window.innerHeight - PET_H - 28),
          }
        }
        setPos(init)
        var t = window.setTimeout(function () {
          setBubble({ text: '你好呀，我是' + (name || '洛天依') + '～点我陪你玩吧！', key: Date.now() })
        }, 600)
        return function () {
          window.clearTimeout(t)
          if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
          if (happyTimer.current) window.clearTimeout(happyTimer.current)
        }
      }, [])

      useEffect(function () {
        if (chatBody.current) chatBody.current.scrollTop = chatBody.current.scrollHeight
      }, [msgs, chatBusy])

      function showBubble(text, ms) {
        setBubble({ text: text, key: Date.now() })
        if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
        bubbleTimer.current = window.setTimeout(function () { setBubble(null) }, ms || 2600)
      }

      function setHappy() {
        preMode.current = mode === 'sleep' ? 'sleep' : 'idle'
        setMode('happy')
        if (happyTimer.current) window.clearTimeout(happyTimer.current)
        happyTimer.current = window.setTimeout(function () { setMode(preMode.current) }, 900)
      }

      function burst(kind) {
        var chars = kind === 'feed' ? ['🍪', '🍰', '🍬', '⭐', '💖'] : ['💖', '✨', '💕', '⭐']
        var items = []
        for (var i = 0; i < 5; i++) {
          items.push({
            id: Date.now() + '-' + i,
            ch: chars[Math.floor(Math.random() * chars.length)],
            x: 18 + Math.random() * 62,
            y: 14 + Math.random() * 34,
            dx: -26 + Math.random() * 52,
            rot: -45 + Math.random() * 90,
          })
        }
        setHearts(items)
        window.setTimeout(function () { setHearts([]) }, 1150)
      }

      function closeMenu() { setMenuOpen(false) }

      function doPat() { closeMenu(); setHappy(); burst('pat'); showBubble(pick(LINES.pat), 2400) }
      function doFeed() { closeMenu(); setHappy(); burst('feed'); showBubble(pick(LINES.feed), 2400) }
      function doSleep() {
        closeMenu()
        if (mode === 'sleep') { setMode('idle'); showBubble(pick(LINES.wake), 2400) }
        else { setMode('sleep'); showBubble(pick(LINES.sleep), 2400) }
      }
      function doRename() {
        closeMenu()
        var n = window.prompt('给桌宠起个新名字：', name)
        if (n && n.trim()) {
          n = n.trim().slice(0, 12)
          setName(n)
          try { window.localStorage.setItem(LS_NAME, n) } catch (_) {}
          showBubble('我以后就叫「' + n + '」啦～', 2600)
        }
      }
      function openChat() { closeMenu(); setChatOpen(true) }

      function sendChat() {
        var t = draft.trim()
        if (!t || chatBusy) return
        setMsgs(function (m) { return m.concat([{ role: 'user', text: t }]) })
        setDraft('')
        setChatBusy(true)
        fetch('/dsh-pet-luotianyi/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: t, name: name }),
        })
          .then(function (r) { return r.json() })
          .then(function (d) {
            setMsgs(function (m) { return m.concat([{ role: 'ai', text: (d && d.reply) ? d.reply : '（没有回复）' }]) })
          })
          .catch(function (e) {
            setMsgs(function (m) { return m.concat([{ role: 'ai', text: '连接不上…' + e }]) })
          })
          .finally(function () { setChatBusy(false) })
      }

      function startDrag(e) {
        if (!pos) return
        drag.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y, moved: false, wasSleeping: mode === 'sleep' }
        setMode('drag')
        closeMenu()
        if (e.currentTarget && e.currentTarget.setPointerCapture) {
          try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
        }
      }

      function moveDrag(e) {
        if (!drag.current) return
        var dx = e.clientX - drag.current.ox
        var dy = e.clientY - drag.current.oy
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true
        if (!drag.current.moved) return
        setPos({
          x: clamp(dx, 0, Math.max(0, window.innerWidth - PET_W)),
          y: clamp(dy, 0, Math.max(0, window.innerHeight - PET_H)),
        })
      }

      function endDrag() {
        if (!drag.current) return
        var wasClick = !drag.current.moved
        var wasSleeping = drag.current.wasSleeping
        drag.current = null
        if (wasClick) {
          if (wasSleeping) { setMode('idle'); showBubble(pick(LINES.wake), 2400); return }
          setMode('idle')
          handleClick()
        } else {
          setMode(wasSleeping ? 'sleep' : 'idle')
          try {
            if (pos) window.localStorage.setItem(LS_POS, JSON.stringify(pos))
          } catch (_) {}
        }
      }

      function handleClick() {
        if (chatOpen) { setChatOpen(false); return }
        var open = !menuOpen
        setMenuOpen(open)
        if (open) showBubble(pick(LINES.greet), 2400)
      }

      // chat input key handling
      function onKey(e) {
        if (e.key === 'Enter') { e.preventDefault(); sendChat() }
        if (e.key === 'Escape') setChatOpen(false)
      }

      var rootStyle = { left: pos ? pos.x + 'px' : '-400px', top: pos ? pos.y + 'px' : '-400px' }

      var menuButtons = [
        { label: '抚摸', onClick: doPat },
        { label: '喂食', onClick: doFeed },
        { label: mode === 'sleep' ? '起床' : '睡觉', onClick: doSleep },
        { label: '聊天', onClick: openChat },
        { label: '改名', onClick: doRename },
      ]

      var children = []

      if (chatOpen) {
        children.push(h('div', { className: 'dsh-pet-luotianyi-chat' },
          h('div', { className: 'dsh-pet-luotianyi-chat-head' },
            h('span', null, '和 ' + name + ' 聊天'),
            h('button', { onClick: function () { setChatOpen(false) } }, '×')),
          h('div', { className: 'dsh-pet-luotianyi-chat-body', ref: chatBody },
            msgs.length === 0
              ? h('div', { className: 'dsh-pet-luotianyi-msg dsh-pet-luotianyi-msg-ai' }, '想和我说什么呀？')
              : null,
            msgs.map(function (m, i) {
              return h('div', { className: 'dsh-pet-luotianyi-msg ' + (m.role === 'user' ? 'dsh-pet-luotianyi-msg-user' : 'dsh-pet-luotianyi-msg-ai'), key: i }, m.text)
            }),
            chatBusy ? h('div', { className: 'dsh-pet-luotianyi-msg dsh-pet-luotianyi-msg-ai' }, '…正在想…') : null),
          h('div', { className: 'dsh-pet-luotianyi-chat-foot' },
            h('input', { value: draft, placeholder: '和' + name + '说句话…', onChange: function (e) { setDraft(e.target.value) }, onKeyDown: onKey }),
            h('button', { onClick: sendChat, disabled: chatBusy || !draft.trim() }, '发送'))))
      } else if (menuOpen) {
        children.push(h('div', { className: 'dsh-pet-luotianyi-pill' },
          menuButtons.map(function (b) {
            return h('button', { key: b.label, onClick: b.onClick }, b.label)
          }),
          h('button', { className: 'dsh-pet-luotianyi-x', onClick: closeMenu }, '×')))
      }

      if (bubble && !chatOpen) {
        children.push(h('div', { className: 'dsh-pet-luotianyi-bubble', key: 'bubble-' + bubble.key }, bubble.text))
      }

      if (mode === 'sleep') {
        children.push(h('div', { className: 'dsh-pet-luotianyi-zzz' }, 'z Z Z'))
      }

      hearts.forEach(function (p) {
        children.push(h('span', {
          className: 'dsh-pet-luotianyi-particle', key: p.id,
          style: { left: p.x + '%', top: p.y + '%', '--dx': p.dx + 'px', '--rot': p.rot + 'deg' },
        }, p.ch))
      })

      children.push(h('div', { className: 'dsh-pet-luotianyi-box' },
        h('div', { className: 'dsh-pet-luotianyi-shadow' }),
        h('img', {
          className: 'dsh-pet-luotianyi-img', src: SPRITE, alt: '桌宠', draggable: false,
          onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag,
        })))

      return h('div', { id: 'dsh-pet-luotianyi-root', className: 'dsh-pet-luotianyi-root dsh-pet-luotianyi--' + mode, style: rootStyle }, children)
    }

    exports.inject = ['slots']
    exports.apply = function (ctx) {
      ctx.effect(function () {
        return ctx.slots.inject('shell.overlay', function () {
          return ctx.slots.register({
            name: 'shell.overlay',
            id: 'dsh-pet-luotianyi',
            order: 500,
            label: function () { return '桌宠' },
          }, Pet)
        })
      }, 'dsh-pet-luotianyi: overlay')
    }

    return module.exports
  },
})
