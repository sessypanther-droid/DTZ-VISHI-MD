/**
 * Anti-Ban Ultra Protection System for WhatsApp Mini Bot
 * Implements rate limiting, request delays, and account safety measures
 * 
 * Features:
 * - Intelligent rate limiting
 * - Request queuing and delays
 * - Account activity monitoring
 * - Suspicious behavior detection
 * - Automatic cooldowns
 * - User/chat throttling
 */

const fs = require('fs');
const path = require('path');

class AntiBanProtection {
  constructor() {
    this.config = {
      maxMessagesPerMinute: 20,
      maxMessagesPerHour: 300,
      messageDelay: 800, // ms between messages
      maxGroupsPerMinute: 5,
      maxUsersPerMinute: 10,
      cooldownTime: 300000, // 5 minutes
      warningThreshold: 0.7, // 70% of limit
      suspiciousActivityThreshold: 50,
      enableAutoThrottle: true,
      enableCooldown: true,
    };

    this.userStats = new Map();
    this.chatStats = new Map();
    this.globalStats = {
      messagesThisMinute: 0,
      messagesThisHour: 0,
      lastMinuteReset: Date.now(),
      lastHourReset: Date.now(),
      isCoolingDown: false,
      suspiciousActivityScore: 0,
    };

    this.queue = [];
    this.isProcessing = false;
    this.bannedUsers = new Set();
    this.suspiciousUsers = new Map();

    this.initializeDataStore();
  }

  initializeDataStore() {
    this.dataDir = path.join(process.cwd(), 'antiban_data');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  canSendMessage(userId, chatId) {
    if (this.bannedUsers.has(userId)) {
      return {
        allowed: false,
        reason: 'USER_BANNED',
        message: 'This user is temporarily banned from sending messages',
      };
    }

    if (this.globalStats.isCoolingDown) {
      return {
        allowed: false,
        reason: 'GLOBAL_COOLDOWN',
        message: 'Bot is in global cooldown mode',
      };
    }

    if (this.globalStats.messagesThisMinute >= this.config.maxMessagesPerMinute) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_MINUTE',
        message: `Rate limit exceeded (${this.config.maxMessagesPerMinute}/min)`,
      };
    }

    const userStats = this.getUserStats(userId);
    if (userStats.messagesThisMinute >= this.config.maxUsersPerMinute) {
      return {
        allowed: false,
        reason: 'USER_RATE_LIMIT',
        message: `User rate limit exceeded (${this.config.maxUsersPerMinute}/min)`,
      };
    }

    if (userStats.suspiciousScore > this.config.suspiciousActivityThreshold) {
      return {
        allowed: false,
        reason: 'SUSPICIOUS_ACTIVITY',
        message: 'Suspicious activity detected. Please try again later.',
      };
    }

    return { allowed: true };
  }

  recordMessageSend(userId, chatId, messageType = 'text') {
    const now = Date.now();

    if (now - this.globalStats.lastMinuteReset > 60000) {
      this.globalStats.messagesThisMinute = 0;
      this.globalStats.lastMinuteReset = now;
    }

    if (now - this.globalStats.lastHourReset > 3600000) {
      this.globalStats.messagesThisHour = 0;
      this.globalStats.lastHourReset = now;
    }

    this.globalStats.messagesThisMinute++;
    this.globalStats.messagesThisHour++;

    const userStats = this.getUserStats(userId);
    userStats.messagesThisMinute++;
    userStats.totalMessages++;
    userStats.lastMessageTime = now;

    return { success: true, currentMinute: this.globalStats.messagesThisMinute };
  }

  getUserStats(userId) {
    if (!this.userStats.has(userId)) {
      this.userStats.set(userId, {
        messagesThisMinute: 0,
        totalMessages: 0,
        lastMessageTime: 0,
        suspiciousScore: 0,
        warningCount: 0,
        blockedCount: 0,
      });
    }
    return this.userStats.get(userId);
  }

  getChatStats(chatId) {
    if (!this.chatStats.has(chatId)) {
      this.chatStats.set(chatId, {
        messagesThisMinute: 0,
        totalMessages: 0,
        lastMessageTime: 0,
      });
    }
    return this.chatStats.get(chatId);
  }

  detectSuspiciousBehavior(userId) {
    const userStats = this.getUserStats(userId);
    let suspicionPoints = 0;

    if (userStats.messagesThisMinute > this.config.maxUsersPerMinute * 0.8) {
      suspicionPoints += 20;
    }

    if (userStats.blockedCount > 3) {
      suspicionPoints += 30;
    }

    userStats.suspiciousScore = suspicionPoints;
    return suspicionPoints > this.config.suspiciousActivityThreshold;
  }

  triggerCooldown(userId = null, duration = this.config.cooldownTime) {
    if (userId) {
      this.bannedUsers.add(userId);
      setTimeout(() => {
        this.bannedUsers.delete(userId);
      }, duration);
    } else {
      this.globalStats.isCoolingDown = true;
      setTimeout(() => {
        this.globalStats.isCoolingDown = false;
      }, duration);
    }
  }

  async queueMessage(message, handler) {
    return new Promise((resolve, reject) => {
      this.queue.push({ message, handler, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { message, handler, resolve, reject } = this.queue.shift();
      try {
        await this.delay(this.config.messageDelay);
        const result = await handler(message);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    this.isProcessing = false;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      globalStats: this.globalStats,
      queueLength: this.queue.length,
      bannedUsersCount: this.bannedUsers.size,
      totalTrackedUsers: this.userStats.size,
    };
  }

  exportStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      global: this.globalStats,
      users: Array.from(this.userStats.entries()),
    };
    return stats;
  }
}

module.exports = AntiBanProtection;