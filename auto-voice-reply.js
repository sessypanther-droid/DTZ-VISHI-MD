const axios = require('axios');
const fs = require('fs');
const path = require('path');
const gtts = require('node-gtts');

/**
 * Auto Voice Message Responder
 * Responds to "hi" or "හායි" with cute girl voice message
 */

const RESPONSE_TEXT = "හායි ලස්සන ලමයෝ කොහොමද ඔයාට";
const TRIGGER_WORDS = ['hi', 'hello', 'hey', 'හායි', 'hy'];

const generateVoiceMessage = async () => {
    try {
        const tempDir = path.join(process.cwd(), 'voice_temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const audioPath = path.join(tempDir, 'response_voice.mp3');

        return new Promise((resolve, reject) => {
            const tts = new gtts(RESPONSE_TEXT, 'si'); // Sinhala language
            
            tts.save(audioPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(audioPath);
                }
            });
        });
    } catch (error) {
        console.error('Voice generation error:', error);
        throw error;
    }
};

const isGreetingMessage = (messageText) => {
    const text = messageText.toLowerCase().trim();
    return TRIGGER_WORDS.some(word => text === word || text.includes(word));
};

const autoVoiceReply = async (conn, m) => {
    try {
        // Check if message is a greeting
        if (!isGreetingMessage(m.body)) {
            return;
        }

        // Check if it's a private message OR a mention in group
        const isPrivateMessage = !m.isGroup;
        const isTaggedInGroup = m.isGroup && m.mentionUser && m.mentionUser.includes(conn.user.id.split(':')[0] + '@s.whatsapp.net');

        if (!isPrivateMessage && !isTaggedInGroup) {
            return;
        }

        // Generate voice message
        const voicePath = await generateVoiceMessage();

        // Read the audio file
        const audioBuffer = fs.readFileSync(voicePath);

        // Send as PTT (Push-to-Talk / Voice Message)
        await conn.sendMessage(m.chat, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: true // This makes it a voice message
        }, { quoted: m });

        // Clean up temp file
        setTimeout(() => {
            try {
                fs.unlinkSync(voicePath);
            } catch (e) {}
        }, 1000);

    } catch (error) {
        console.error('Auto voice reply error:', error);
        // Silently fail - don't spam user with errors
    }
};

module.exports = {
    autoVoiceReply,
    generateVoiceMessage,
    isGreetingMessage,
    RESPONSE_TEXT
};
