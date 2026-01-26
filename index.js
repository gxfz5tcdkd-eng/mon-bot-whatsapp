const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const myNumber = process.env.MY_NUMBER;

    if (!myNumber) {
        console.error("❌ ERREUR : Configure MY_NUMBER sur Render !");
        process.exit(1);
    }

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // --- GESTION DU PAIRING CODE AMÉLIORÉE ---
    if (!sock.authState.creds.registered) {
        console.log(`Log : Préparation de la demande pour : ${myNumber}`);
        
        // On attend 10 secondes au lieu de 5 pour laisser le temps au serveur de se stabiliser
        setTimeout(async () => {
            try {
                // On vérifie si on n'est pas déjà enregistré entre temps
                if (!sock.authState.creds.registered) {
                    const code = await sock.requestPairingCode(myNumber);
                    console.log(`\n======================================`);
                    console.log(`👉 TON CODE DE CONNEXION : ${code}`);
                    console.log(`======================================\n`);
                }
            } catch (err) {
                console.error("Erreur Pairing Code (on réessaie dans 10s...)");
                // Si ça rate, on relance la fonction après un court délai
                setTimeout(() => connectToWhatsApp(), 10000);
            }
        }, 10000); 
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("Connexion fermée, tentative de reconnexion...");
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ BOT CONNECTÉ ET OPÉRATIONNEL !');
        }
    });

    sock.ev.on('creds.update', saveCreds);

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