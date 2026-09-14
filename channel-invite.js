/**
 * Auto-Channel Invite Handler
 * Automatically adds users who pair the bot to WhatsApp channels
 */

const fs = require('fs');
const path = require('path');

// Store invited users to avoid duplicate invites
const inviteFile = path.join(process.cwd(), 'invited_users.json');

// Load invited users
const loadInvitedUsers = () => {
    try {
        if (fs.existsSync(inviteFile)) {
            return JSON.parse(fs.readFileSync(inviteFile, 'utf-8'));
        }
    } catch (error) {
        console.log('Error loading invited users:', error.message);
    }
    return [];
};

// Save invited users
const saveInvitedUsers = (users) => {
    try {
        fs.writeFileSync(inviteFile, JSON.stringify(users, null, 2));
    } catch (error) {
        console.log('Error saving invited users:', error.message);
    }
};

// Check if user already invited
const isUserInvited = (userId) => {
    const invitedUsers = loadInvitedUsers();
    return invitedUsers.includes(userId);
};

// Add user to invited list
const addToInvited = (userId) => {
    const invitedUsers = loadInvitedUsers();
    if (!invitedUsers.includes(userId)) {
        invitedUsers.push(userId);
        saveInvitedUsers(invitedUsers);
        return true;
    }
    return false;
};

// Main channel invite handler
const inviteToChannels = async (socket, m, userId) => {
    try {
        // Check if user was already invited
        if (isUserInvited(userId)) {
            return; // Already invited, skip
        }

        // Add user to invited list
        addToInvited(userId);

        // Channel information
        const channels = [
            {
                name: '𝐃𝐎𝐑𝐀-𝐌𝐃 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 💀',
                link: 'https://whatsapp.com/channel/0029Vb8er599WtC2ktRDrj2h',
                description: 'Official Bot Updates & Announcements'
            },
            {
                name: '𝐑𝐔𝐁𝐈 𝐖𝐀𝐃𝐀𝐍 𝐀𝐍𝐃 𝐒𝐓𝐀𝐓𝐔𝐒 𝐕𝐄𝐃𝐈𝐎𝐒🩵',
                link: 'https://whatsapp.com/channel/0029VbE2F3sIiRok3H5zaX42',
                description: 'Latest Status Videos & Updates'
            }
        ];

        // Send invitation message to user
        let inviteMessage = `🎉 *Welcome to Dhora-MD Bot!*\n\n`;
        inviteMessage += `Thank you for using our bot! 💙\n\n`;
        inviteMessage += `📢 *Please Follow Our Channels:*\n\n`;

        channels.forEach((channel, index) => {
            inviteMessage += `${index + 1}. *${channel.name}*\n`;
            inviteMessage += `   📝 ${channel.description}\n`;
            inviteMessage += `   🔗 ${channel.link}\n\n`;
        });

        inviteMessage += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        inviteMessage += `✅ Stay Updated with Latest Features\n`;
        inviteMessage += `✅ Get Exclusive Tips & Tricks\n`;
        inviteMessage += `✅ Community Support & Help\n\n`;
        inviteMessage += `Thank you! 💙`;

        // Send to user's DM
        await socket.sendMessage(userId, {
            text: inviteMessage
        });

        console.log(`✅ Channel invitations sent to ${userId}`);

    } catch (error) {
        console.log('Error in channel invite:', error.message);
    }
};

// Initialize channel listener (runs after successful pairing)
const initChannelInvite = async (socket, userId) => {
    try {
        // Small delay to ensure connection is stable
        setTimeout(() => {
            inviteToChannels(socket, null, userId);
        }, 2000);
    } catch (error) {
        console.log('Error initializing channel invite:', error.message);
    }
};

// Get channel statistics
const getChannelStats = () => {
    const invitedUsers = loadInvitedUsers();
    return {
        totalUsersInvited: invitedUsers.length,
        users: invitedUsers,
        inviteFile: inviteFile
    };
};

// Reset invited users (admin only)
const resetInvitedUsers = () => {
    try {
        saveInvitedUsers([]);
        return true;
    } catch (error) {
        console.log('Error resetting invited users:', error.message);
        return false;
    }
};

// Export functions
module.exports = {
    inviteToChannels,
    initChannelInvite,
    isUserInvited,
    addToInvited,
    getChannelStats,
    resetInvitedUsers,
    loadInvitedUsers,
    saveInvitedUsers
};
