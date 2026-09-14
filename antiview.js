/**
 * Anti-Delete Message Handler
 * Captures and stores deleted messages in private chat
 * Feature: /antiview on/off to enable/disable
 */

const fs = require('fs');
const path = require('path');

// Store user settings in a JSON file
const settingsFile = path.join(process.cwd(), 'antiview_settings.json');

// Load settings from file
const loadSettings = () => {
    try {
        if (fs.existsSync(settingsFile)) {
            return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        }
    } catch (error) {
        console.log('Error loading settings:', error.message);
    }
    return {};
};

// Save settings to file
const saveSettings = (settings) => {
    try {
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.log('Error saving settings:', error.message);
    }
};

// Get user's antiview status
const getUserStatus = (userId) => {
    const settings = loadSettings();
    return settings[userId] || false;
};

// Set user's antiview status
const setUserStatus = (userId, status) => {
    const settings = loadSettings();
    settings[userId] = status;
    saveSettings(settings);
};

// Initialize anti-delete handler
const initAntiDelete = (socket, m, msg) => {
    const userId = m.sender;
    const isGroup = m.isGroup;
    
    // Handle /antiview command
    if (m.body.toLowerCase().startsWith('.antiview') || m.body.toLowerCase().startsWith('/antiview')) {
        const args = m.body.split(' ');
        const command = args[1]?.toLowerCase();
        
        if (command === 'on') {
            setUserStatus(userId, true);
            m.reply('✅ *Anti-Delete Enabled*\n\n🔒 Deleted messages will now be sent to your DM\n⚠️ This only works in private chats');
            return;
        } else if (command === 'off') {
            setUserStatus(userId, false);
            m.reply('❌ *Anti-Delete Disabled*\n\n🔒 Deleted messages will no longer be captured');
            return;
        } else {
            const status = getUserStatus(userId);
            m.reply(`📊 *Anti-Delete Status*\n\nCurrent Status: ${status ? '✅ ON' : '❌ OFF'}\n\n📝 Usage:\n.antiview on - Enable\n.antiview off - Disable`);
            return;
        }
    }
    
    // Capture revoked messages (deleted messages)
    if (msg.type === 'protocolMessage' && msg.protocolMessage?.type === 0) {
        // Check if user has antiview enabled
        if (!getUserStatus(userId)) {
            return; // Feature disabled for this user
        }
        
        // Don't process in groups
        if (isGroup) {
            return;
        }
        
        // Get the deleted message key
        const key = msg.protocolMessage?.key;
        if (!key) return;
        
        // Construct notification message
        const deletedInfo = `🗑️ *Message Deleted by @${m.sender.split('@')[0]}*\n\n`;
        const messageId = `ID: ${key.id}\n`;
        const timestamp = `Time: ${new Date(m.messageTimestamp * 1000).toLocaleString()}\n`;
        const status = `✅ Anti-Delete Captured This\n\n`;
        
        try {
            // Send to user's private chat only
            socket.sendMessage(userId, {
                text: deletedInfo + messageId + timestamp + status + '━━━━━━━━━━━━━━━━━━\n\n💡 This message was deleted. Your Anti-Delete feature captured it.',
            });
        } catch (error) {
            console.log('Error sending anti-delete message:', error.message);
        }
    }
};

// Listen for message revoke event
const setupRevokeListener = (socket) => {
    // This handles when messages are deleted
    socket.ev.on('messages.update', (update) => {
        update.forEach(({ key, update }) => {
            if (update.messageStubType === 1 || update.message?.protocolMessage?.type === 0) {
                // Message was deleted/revoked
                const userId = key.participant || key.remoteJid;
                
                if (!getUserStatus(userId)) {
                    return; // User has this feature disabled
                }
                
                // Don't send to groups
                if (key.remoteJid.endsWith('@g.us')) {
                    return;
                }
                
                try {
                    socket.sendMessage(userId, {
                        text: `🗑️ *Message Deleted*\n\n` +
                              `From: @${key.participant?.split('@')[0] || 'Unknown'}\n` +
                              `Time: ${new Date().toLocaleString()}\n\n` +
                              `✅ Anti-Delete Captured This Deletion`,
                    });
                } catch (error) {
                    console.log('Error in revoke listener:', error.message);
                }
            }
        });
    });
};

// Export functions
module.exports = {
    initAntiDelete,
    setupRevokeListener,
    getUserStatus,
    setUserStatus,
    loadSettings,
    saveSettings
};
