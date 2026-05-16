const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')

const P = require('pino')
const QRCode = require('qrcode')

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

let sock
let latestQR = ''
let connectionStatus = 'Disconnected'
let pairingCode = ''

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    auth: state,
    browser: ['Kingsley-XMD', 'Chrome', '1.0.0']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update

    if (qr) {
      latestQR = await QRCode.toDataURL(qr)
    }

    if (connection === 'open') {
      connectionStatus = 'Connected'
      console.log('WhatsApp Connected')
    }

    if (connection === 'close') {
      connectionStatus = 'Disconnected'

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) {
        startBot()
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]

    if (!msg.message) return

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''

    const from = msg.key.remoteJid

    if (text.toLowerCase() === 'hi') {
      await sock.sendMessage(from, {
        text: 'Hello 👋 Welcome to Kingsley WhatsApp Bot'
      })
    }

    if (text.toLowerCase() === 'menu') {
      await sock.sendMessage(from, {
        text:
          '📋 MENU\n\n1. hi\n2. menu\n3. owner\n4. ping'
      })
    }

    if (text.toLowerCase() === 'owner') {
      await sock.sendMessage(from, {
        text: 'Bot Owner: KINGSLEY-XMD'
      })
    }

    if (text.toLowerCase() === 'ping') {
      await sock.sendMessage(from, {
        text: 'PONG ✅'
      })
    }
  })
}

startBot()

app.get('/', async (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>WhatsApp Automation Bot</title>
    <style>
      *{
        margin:0;
        padding:0;
        box-sizing:border-box;
        font-family:Arial;
      }

      body{
        background:#0f172a;
        color:white;
        padding:20px;
      }

      .container{
        max-width:900px;
        margin:auto;
      }

      .card{
        background:#1e293b;
        padding:20px;
        border-radius:15px;
        margin-top:20px;
      }

      h1{
        color:#25D366;
        margin-bottom:10px;
      }

      button{
        background:#25D366;
        color:white;
        border:none;
        padding:12px 20px;
        border-radius:10px;
        cursor:pointer;
        margin-top:10px;
      }

      input, textarea{
        width:100%;
        padding:12px;
        border-radius:10px;
        border:none;
        margin-top:10px;
      }

      img{
        width:300px;
        margin-top:20px;
      }

      .status{
        padding:10px;
        background:#334155;
        border-radius:10px;
        margin-top:10px;
      }

      footer{
        margin-top:40px;
        text-align:center;
        color:#94a3b8;
      }
    </style>
  </head>
  <body>

    <div class="container">
      <h1>WhatsApp Automation Dashboard</h1>

      <div class="card">
        <h2>Connection Status</h2>
        <div class="status">
          ${connectionStatus}
        </div>

        <h2 style="margin-top:20px">Scan QR Code</h2>

        ${latestQR ? `<img src="${latestQR}" />` : '<p>Waiting for QR...</p>'}
      </div>

      <div class="card">
        <h2>Send Message</h2>

        <form action="/send" method="POST">
          <input type="text" name="number" placeholder="233XXXXXXXXX" required />

          <textarea name="message" placeholder="Enter message" required></textarea>

          <button type="submit">Send Message</button>
        </form>
      </div>

      <div class="card">
        <h2>Bot Features</h2>

        <p>✅ Auto Reply</p>
        <p>✅ Dashboard</p>
        <p>✅ QR Login</p>
        <p>✅ Message Sender</p>
        <p>✅ Group Support</p>
      </div>

      <footer>
        Developed By KINGSLEY-XMD
      </footer>
    </div>

  </body>
  </html>
  `)
})

app.post('/send', async (req, res) => {
  try {
    const number = req.body.number + '@s.whatsapp.net'
    const message = req.body.message

    await sock.sendMessage(number, {
      text: message
    })

    res.send(`
      <h2>Message Sent Successfully ✅</h2>
      <a href="/">Go Back</a>
    `)
  } catch (err) {
    res.send(`
      <h2>Error Sending Message ❌</h2>
      <pre>${err}</pre>
      <a href="/">Go Back</a>
    `)
  }
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log('Server Running On Port ' + PORT)
})
