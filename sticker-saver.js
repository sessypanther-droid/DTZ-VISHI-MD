/**
 * Auto Sticker Saver
 * Automatically saves stickers to favorites that are not already saved
 */

const fs = require('fs');
const path = require('path');

// Store sticker data
const stickerFile = path.join(process.cwd(), 'saved_stickers.json');
const stickersDir = path.join(process.cwd(), 'stickers');

// Ensure stickers directory exists
if (!fs.existsSync(stickersDir)) {
    fs.mkdirSync(stickersDir, { recursive: true });
}

// Load saved stickers
const loadSavedStickers = () => {
    try {
        if (fs.existsSync(stickerFile)) {
            return JSON.parse(fs.readFileSync(stickerFile, 'utf-8'));
        }
    } catch (error) {
        console.log('Error loading stickers:', error.message);
    }
    return {};
};

// Save stickers data
const saveStickerData = (data) => {
    try {
        fs.writeFileSync(stickerFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving sticker data:', error.message);
    }
};

// Check if sticker is saved
const isStickerSaved = (stickerHash) => {
    const stickers = loadSavedStickers();
    return stickers[stickerHash] !== undefined;
};

// Save sticker to favorites
const saveStickerToFavorites = (stickerHash, stickerData) => {
    const stickers = loadSavedStickers();
    stickers[stickerHash] = {
        hash: stickerHash,
        savedAt: new Date().toISOString(),
        ...stickerData
    };
    saveStickerData(stickers);
};

// Get sticker statistics
const getStickerStats = () => {
    const stickers = loadSavedStickers();
    return {
        totalSaved: Object.keys(stickers).length,
        stickers: stickers,
        storageLocation: stickerFile
    };
};

// Auto save sticker
const autoSaveSticker = async (socket, m) => {
    try {
        // Check if message contains sticker
        if (m.type !== 'stickerMessage') {
            return false;
        }

        const userId = m.sender;
        const stickerHash = m.msg.fileSha256 ? Buffer.from(m.msg.fileSha256).toString('hex') : m.id;

        // Check if sticker is already saved
        if (isStickerSaved(stickerHash)) {
            return false; // Already saved
        }

        // Save sticker to favorites
        saveStickerToFavorites(stickerHash, {
            from: m.sender,
            fromUser: m.sender.split('@')[0],
            chat: m.chat,
            messageId: m.id,
            mimetype: m.msg.mimetype || 'image/webp'
        });

        console.log(`✅ Sticker auto-saved: ${stickerHash}`);
        return true;

    } catch (error) {
        console.log('Error auto-saving sticker:', error.message);
        return false;
    }
};

// Handle sticker saver commands
const handleStickerCommands = (m, socket) => {
    const userId = m.sender;
    const body = m.body.toLowerCase().trim();
    const args = body.split(' ');
    const command = args[0];

    // Enable auto sticker saver
    if (command === '.autostick' || command === '/autostick') {
        const action = args[1]?.toLowerCase();

        if (action === 'on') {
            // Enable auto sticker saving
            let settings = {};
            try {
                const settingsFile = path.join(process.cwd(), 'autostick_settings.json');
                if (fs.existsSync(settingsFile)) {
                    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
                }
                settings[userId] = true;
                fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
            } catch (error) {
                console.log('Error enabling auto sticker:', error.message);
            }

            m.reply(`✅ *Auto Sticker Saver Enabled*\n\n📌 All new stickers will be automatically saved to favorites\n\n💾 Use .stickerstats to check saved stickers`);
            return true;
        }

        if (action === 'off') {
            // Disable auto sticker saving
            let settings = {};
            try {
                const settingsFile = path.join(process.cwd(), 'autostick_settings.json');
                if (fs.existsSync(settingsFile)) {
                    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
                }
                settings[userId] = false;
                fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
            } catch (error) {
                console.log('Error disabling auto sticker:', error.message);
            }

            m.reply(`❌ *Auto Sticker Saver Disabled*\n\n📌 Stickers will no longer be auto-saved`);
            return true;
        }

        // Check status
        let isEnabled = false;
        try {
            const settingsFile = path.join(process.cwd(), 'autostick_settings.json');
            if (fs.existsSync(settingsFile)) {
                const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
                isEnabled = settings[userId] || false;
            }
        } catch (error) {
            console.log('Error reading auto sticker status:', error.message);
        }

        m.reply(`📊 *Auto Sticker Saver Status*\n\nCurrent: ${isEnabled ? '✅ ON' : '❌ OFF'}\n\n📝 Usage:\n.autostick on - Enable\n.autostick off - Disable`);
        return true;
    }

    // Save current sticker to favorites
    if (command === '.savestick' || command === '/savestick') {
        if (m.type !== 'stickerMessage' && !m.quoted?.type?.includes('sticker')) {
            m.reply(`❌ *Please reply to a sticker* or send a sticker with this command\n\n📝 Usage:\n.savestick - Reply to a sticker\nor send this command with a sticker`);
            return true;
        }

        const sticker = m.type === 'stickerMessage' ? m : m.quoted;
        const stickerHash = sticker.msg.fileSha256 ? Buffer.from(sticker.msg.fileSha256).toString('hex') : sticker.id;

        if (isStickerSaved(stickerHash)) {
            m.reply(`⚠️ *Sticker Already Saved*\n\nThis sticker is already in your favorites!`);
            return true;
        }

        saveStickerToFavorites(stickerHash, {
            from: sticker.sender,
            fromUser: sticker.sender.split('@')[0],
            chat: sticker.chat,
            messageId: sticker.id,
            savedManually: true
        });

        m.reply(`✅ *Sticker Saved!*\n\n📌 Sticker added to your favorites\n\n💾 Use .stickerstats to check all saved stickers`);
        return true;
    }

    // Show sticker statistics
    if (command === '.stickerstats' || command === '/stickerstats') {
        const stats = getStickerStats();
        let statsMsg = `📊 *Your Sticker Statistics*\n\n`;
        statsMsg += `💾 Total Saved Stickers: ${stats.totalSaved}\n\n`;

        if (stats.totalSaved > 0) {
            statsMsg += `📌 *Recent Stickers:*\n`;
            const recentStickers = Object.values(stats.stickers)
                .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
                .slice(0, 5);

            recentStickers.forEach((sticker, index) => {
                const date = new Date(sticker.savedAt).toLocaleDateString();
                const userName = sticker.fromUser || 'Unknown';
                statsMsg += `${index + 1}. From @${userName}\n   Saved: ${date}\n`;
            });

            statsMsg += `\n━━━━━━━━━━━━━━━━━━\n`;
            statsMsg += `📌 Commands:\n`;
            statsMsg += `  .autostick on/off - Toggle auto save\n`;
            statsMsg += `  .savestick - Manual save (reply to sticker)\n`;
            statsMsg += `  .clearsticks - Clear all saved stickers`;
        } else {
            statsMsg += `No stickers saved yet!\n\n`;
            statsMsg += `📌 Use .savestick to manually save stickers\n`;
            statsMsg += `or use .autostick on to auto-save new ones`;
        }

        m.reply(statsMsg);
        return true;
    }

    // Clear all saved stickers
    if (command === '.clearsticks' || command === '/clearsticks') {
        try {
            fs.writeFileSync(stickerFile, JSON.stringify({}, null, 2));
            m.reply(`✅ *All Saved Stickers Cleared*\n\n🗑️ Your sticker favorites have been cleared`);
            return true;
        } catch (error) {
            m.reply(`❌ Error clearing stickers: ${error.message}`);
            return true;
        }
    }

    // Show sticker commands help
    if (command === '.stickhelp' || command === '/stickhelp') {
        let helpMsg = `📌 *Sticker Saver Commands*\n\n`;
        helpMsg += `*Auto Sticker Saver:*\n`;
        helpMsg += `  .autostick on - Auto save all stickers\n`;
        helpMsg += `  .autostick off - Disable auto save\n`;
        helpMsg += `  .autostick - Check status\n\n`;
        helpMsg += `*Manual Sticker Save:*\n`;
        helpMsg += `  .savestick - Reply to a sticker to save\n\n`;
        helpMsg += `*Statistics & Management:*\n`;
        helpMsg += `  .stickerstats - View all saved stickers\n`;
        helpMsg += `  .clearsticks - Clear all saved stickers\n\n`;
        helpMsg += `*Help:*\n`;
        helpMsg += `  .stickhelp - Show this menu`;

        m.reply(helpMsg);
        return true;
    }

    return false;
};

// Check if auto sticker is enabled for user
const isAutoStickerEnabled = (userId) => {
    try {
        const settingsFile = path.join(process.cwd(), 'autostick_settings.json');
        if (fs.existsSync(settingsFile)) {
            const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
            return settings[userId] || false;
        }
    } catch (error) {
        console.log('Error checking auto sticker status:', error.message);
    }
    return false;
};

// Export functions
module.exports = {
    handleStickerCommands,
    autoSaveSticker,
    isStickerSaved,
    saveStickerToFavorites,
    getStickerStats,
    isAutoStickerEnabled,
    loadSavedStickers,
    saveStickerData
};
