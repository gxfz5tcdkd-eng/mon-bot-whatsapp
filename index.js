const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

// 1. Petit serveur pour que Render ne redémarre pas le bot
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot WhatsApp est en ligne !');
}).listen(process.env.PORT || 10000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        // On utilise un nom de navigateur standard
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // 2. Demande du Pairing Code (On attend que ce soit stable)
    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.MY_NUMBER;
        if (phoneNumber) {
            console.log(`[LOG] Préparation du code pour : ${phoneNumber}`);
            // On attend 10 secondes pour laisser la connexion se stabiliser
            await delay(10000);
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n======================================`);
                console.log(`👉 TON CODE : ${code}`);
                console.log(`======================================\n`);
            } catch (error) {
                console.error("[ERREUR] Impossible de générer le code :", error.message);
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`[INFO] Connexion fermée (Raison: ${reason})`);
            
            // Si ce n'est pas une déconnexion manuelle, on relance après 5s
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Tentative de reconnexion dans 5 secondes...");
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ LE BOT EST BIEN CONNECTÉ !');
        }
    });

    // Réponse simple pour tester
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
        if (text.toLowerCase() === 'ping') {
            await sock.sendMessage(m.key.remoteJid, { text: 'Pong! 🏓' }, { quoted: m });
        }
    });
}

// Lancement
startBot().catch(err => console.error("Erreur critique :", err));