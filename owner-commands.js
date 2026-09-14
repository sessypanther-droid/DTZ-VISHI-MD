const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Owner Commands - Channel Management
 * Only bot owners can use these commands
 * Owners: +94763288949, +94702889906 (hidden from users)
 */

const OWNERS = [
    '94763288949@s.whatsapp.net',
    '94702889906@s.whatsapp.net'
];

// Store channel data
const channelDataFile = './channel-data.json';

const isOwner = (sender) => {
    return OWNERS.includes(sender);
};

const loadChannelData = () => {
    try {
        if (fs.existsSync(channelDataFile)) {
            return JSON.parse(fs.readFileSync(channelDataFile, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading channel data:', e);
    }
    return {};
};

const saveChannelData = (data) => {
    try {
        fs.writeFileSync(channelDataFile, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving channel data:', e);
    }
};

const ownerCommands = {
    /**
     * Restart bot server
     * Usage: .restart
     */
    restart: async (conn, m) => {
        if (!isOwner(m.sender)) {
            return await m.reply('❌ You are not authorized to use this command');
        }

        await m.reply('🔄 Restarting bot server...');

        try {
            await conn.end();
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        } catch (error) {
            return await m.reply(`❌ Error restarting: ${error.message}`);
        }
    },

    /**
     * Add channel with followers and reacts count
     * Usage: .addchannel https://whatsapp.com/channel/... 5000 1000
     * Usage: .addchannel <channel_link> <followers> <reacts>
     */
    addchannel: async (conn, m) => {
        if (!isOwner(m.sender)) {
            return await m.reply('❌ You are not authorized to use this command');
        }

        const args = m.body.split(' ');
        if (args.length < 4) {
            return await m.reply(
                '❌ *Usage:* .addchannel <channel_link> <followers> <reacts>\n\n' +
                '📝 *Example:*\n' +
                '.addchannel https://whatsapp.com/channel/... 5000 1500\n\n' +
                '• channel_link: WhatsApp channel URL\n' +
                '• followers: Number of followers\n' +
                '• reacts: Number of reactions'
            );
        }

        const channelLink = args[1];
        const followers = args[2];
        const reacts = args[3];

        // Validate numbers
        if (isNaN(followers) || isNaN(reacts)) {
            return await m.reply('❌ Followers and reacts must be numbers');
        }

        if (!channelLink.includes('whatsapp.com/channel')) {
            return await m.reply('❌ Please provide a valid WhatsApp channel link');
        }

        try {
            // Extract channel ID from link
            const channelId = channelLink.split('/').pop();

            // Load and update channel data
            let channelData = loadChannelData();
            
            channelData[channelId] = {
                link: channelLink,
                followers: parseInt(followers),
                reacts: parseInt(reacts),
                addedAt: new Date().toISOString(),
                addedBy: m.sender
            };

            saveChannelData(channelData);

            let message = `✅ *Channel Added Successfully!*\n\n`;
            message += `🔗 Link: ${channelLink}\n`;
            message += `👥 Followers: *${followers}*\n`;
            message += `👍 Reactions: *${reacts}*\n`;
            message += `📱 Channel ID: ${channelId}`;

            await m.reply(message);

        } catch (error) {
            return await m.reply(`❌ Error adding channel: ${error.message}`);
        }
    },

    /**
     * Update channel followers count
     * Usage: .updatefollowers <channel_link_or_id> 5000
     */
    updatefollowers: async (conn, m) => {
        if (!isOwner(m.sender)) {
            return await m.reply('❌ You are not authorized to use this command');
        }

        const args = m.body.split(' ');
        if (args.length < 3) {
            return await m.reply('❌ Usage: .updatefollowers <channel_link_or_id> <new_count>');
        }

        const channelId = args[1].split('/').pop();
        const newCount = args[2];

        if (isNaN(newCount)) {
            return await m.reply('❌ Count must be a number');
        }

        try {
            let channelData = loadChannelData();

            if (!channelData[channelId]) {
                return await m.reply('❌ Channel not found. Add it first with .addchannel');
            }

            channelData[channelId].followers = parseInt(newCount);
            channelData[channelId].updatedAt = new Date().toISOString();

            saveChannelData(channelData);

            await m.reply(`✅ Followers updated to: *${newCount}* for channel ${channelId}`);

        } catch (error) {
            return await m.reply(`❌ Error updating followers: ${error.message}`);
        }
    },

    /**
     * Update channel reacts count
     * Usage: .updatereacts <channel_link_or_id> 1500
     */
    updatereacts: async (conn, m) => {
        if (!isOwner(m.sender)) {
            return await m.reply('❌ You are not authorized to use this command');
        }

        const args = m.body.split(' ');
        if (args.length < 3) {
            return await m.reply('❌ Usage: .updatereacts <channel_link_or_id> <new_count>');
        }

        const channelId = args[1].split('/').pop();
        const newCount = args[2];

        if (isNaN(newCount)) {
            return await m.reply('❌ Count must be a number');
        }

        try {
            let channelData = loadChannelData();

            if (!channelData[channelId]) {
                return await m.reply('❌ Channel not found. Add it first with .addchannel');
            }

            channelData[channelId].reacts = parseInt(newCount);
            channelData[channelId].updatedAt = new Date().toISOString();

            saveChannelData(channelData);

            await m.reply(`✅ Reacts updated to: *${newCount}* for channel ${channelId}`);

        } catch (error) {
            return await m.reply(`❌ Error updating reacts: ${error.message}`);
        }
    },

    /**
     * List all managed channels
     * Usage: .channellist
     */
    channellist: async (conn, m) => {
        if (!isOwner(m.sender)) {
            return await m.reply('❌ You are not authorized to use this command');
        }

        try {
            let channelData = loadChannelData();
            const channels = Object.values(channelData);

            if (channels.length === 0) {
                return await m.reply('📭 No channels added yet\n\nUse: .addchannel <link> <followers> <reacts>');
            }

            let message = `📱 *Managed Channels* (${channels.length})\n\n`;

            channels.forEach((channel, index) => {
                message += `*${index + 1}. Channel ${index + 1}*\n`;
                message += `👥 Followers: ${channel.followers}\n`;
                message += `👍 Reacts: ${channel.reacts}\n`;
                message += `🔗 Link: ${channel.link}\n`;
                message += `📅 Added: ${new Date(channel.addedAt).toLocaleDateString()}\n\n`;
            });

            message += `🔒 Owner only command`;

            await m.reply(message);

        } catch (error) {
            return await m.reply(`❌ Error fetching channels: ${error.message}`);
        }
    },

    /**
     * Get channel info
     * Usage: .channelinfo <channel_link_or_id>
     */
    channelinfo: async (conn, m) => {
        if (!isOwner(m.sender)) {
            return await m.reply('❌ You are not authorized to use this command');
        }

        const args = m.body.split(' ');
        if (args.length < 2) {
            return await m.reply('❌ Usage: .channelinfo <channel_link_or_id>');
        }

        const channelId = args[1].split('/').pop();

        try {
            let channelData = loadChannelData();

            if (!channelData[channelId]) {
                return await m.reply('❌ Channel not found');
            }

            const channel = channelData[channelId];

            let message = `📱 *Channel Information*\n\n`;
            message += `🔗 Link: ${channel.link}\n`;
            message += `👥 Followers: *${channel.followers}*\n`;
            message += `👍 Reacts: *${channel.reacts}*\n`;
            message += `📅 Added: ${new Date(channel.addedAt).toLocaleDateString()}\n`;
            if (channel.updatedAt) {
                message += `🔄 Updated: ${new Date(channel.updatedAt).toLocaleDateString()}\n`;
            }
            message += `\n🔒 Owner only command`;

            await m.reply(message);

        } catch (error) {
            return await m.reply(`❌ Error fetching channel info: ${error.message}`);
        }
    },

    /**
     * Delete a channel
     * Usage: .deletechannel <channel_link_or_id>
     */
    deletechannel: async (conn, m) => {
        if (!isOwner(m.sender)) {
            return await m.reply('❌ You are not authorized to use this command');
        }

        const args = m.body.split(' ');
        if (args.length < 2) {
            return await m.reply('❌ Usage: .deletechannel <channel_link_or_id>');
        }

        const channelId = args[1].split('/').pop();

        try {
            let channelData = loadChannelData();

            if (!channelData[channelId]) {
                return await m.reply('❌ Channel not found');
            }

            delete channelData[channelId];
            saveChannelData(channelData);

            await m.reply(`✅ Channel removed from database`);

        } catch (error) {
            return await m.reply(`❌ Error deleting channel: ${error.message}`);
        }
    }
};

const handleOwnerCommand = async (conn, m) => {
    const command = m.body.split(' ')[0].toLowerCase().substring(1);

    if (command === 'restart') {
        await ownerCommands.restart(conn, m);
    } else if (command === 'addchannel') {
        await ownerCommands.addchannel(conn, m);
    } else if (command === 'updatefollowers') {
        await ownerCommands.updatefollowers(conn, m);
    } else if (command === 'updatereacts') {
        await ownerCommands.updatereacts(conn, m);
    } else if (command === 'channellist') {
        await ownerCommands.channellist(conn, m);
    } else if (command === 'channelinfo') {
        await ownerCommands.channelinfo(conn, m);
    } else if (command === 'deletechannel') {
        await ownerCommands.deletechannel(conn, m);
    }
};

module.exports = {
    ownerCommands,
    handleOwnerCommand,
    isOwner,
    loadChannelData,
    saveChannelData
};
