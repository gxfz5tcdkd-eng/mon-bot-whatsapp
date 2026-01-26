const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function connectToWhatsApp() {
    // 1. Gestion de la session (dossier local)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    // 2. Récupération du numéro depuis Render
    const myNumber = process.env.MY_NUMBER; 

    if (!myNumber) {
        console.error("❌ ERREUR : Tu n'as pas configuré la variable MY_NUMBER sur Render !");
        process.exit(1);
    }

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // 3. Demande du Pairing Code (8 chiffres)
    if (!sock.authState.creds.registered) {
        console.log(`Log : Tentative de connexion pour le numéro : ${myNumber}`);
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(myNumber);
                console.log(`\n======================================`);
                console.log(`👉 TON CODE DE CONNEXION : ${code}`);
                console.log(`======================================\n`);
            } catch (err) {
                console.error("Erreur lors de la demande du code :", err);
            }
        }, 5000); // On attend 5 secondes pour être sûr que le socket est prêt
    }

    // 4. Gestion de la connexion
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ BOT CONNECTÉ ET PRÊT !');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 5. Réponse simple (Ping -> Pong)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
        
        if (text.toLowerCase() === 'ping') {
            await sock.sendMessage(m.key.remoteJid, { text: 'Pong! 🏓' }, { quoted: m });
        }
    });
}

connectToWhatsApp();