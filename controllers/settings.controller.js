const UpdateService = require('../services/update.service');
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Get current app info
exports.getAppInfo = (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        lastUpdateCheck: process.env.LAST_UPDATE_CHECK || null,
        appName: 'Samagi Hardware POS'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get app info' });
  }
};

// Check for updates
exports.checkForUpdates = async (req, res) => {
  try {
    const { repo, isBackend } = req.query;
    
    const result = await UpdateService.checkForUpdates(repo, isBackend === 'true');
    
    // Save last check time
    process.env.LAST_UPDATE_CHECK = new Date().toISOString();
    
    res.json(result);
  } catch (error) {
    console.error('Check updates error:', error);
    res.status(500).json({ success: false, error: 'Failed to check for updates' });
  }
};

// Download and install update
exports.installUpdate = async (req, res) => {
  try {
    const { downloadUrl, version, isBackend } = req.body;
    
    if (!downloadUrl) {
      return res.status(400).json({ success: false, error: 'Download URL required' });
    }
    
    // 1. Backup database first (CRITICAL)
    const backup = await UpdateService.backupDatabase();
    if (!backup.success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database backup failed. Update cancelled for safety.',
        backup
      });
    }
    
    // 2. Download update
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const fileName = `update-${version}.zip`;
    const destPath = path.join(tempDir, fileName);
    
    const downloadResult = await UpdateService.downloadUpdate(
      downloadUrl, 
      destPath,
      (progress) => {
        // In production, use WebSocket or Server-Sent Events for real-time progress
        console.log(`Download progress: ${progress.percent}%`);
      }
    );
    
    if (!downloadResult.success) {
      return res.status(500).json({ success: false, error: 'Download failed' });
    }
    
    // 3. Install update
    const installDir = path.join(__dirname, '..');
    const installResult = await UpdateService.installUpdate(destPath, installDir);
    
    if (!installResult.success) {
      // Attempt to restore from backup
      console.log('Update failed, backup available at:', backup.data.backupPath);
      return res.status(500).json({ 
        success: false, 
        error: 'Installation failed',
        backup: backup.data,
        message: 'Update failed. Your data is safe in backup. Please contact support.'
      });
    }
    
    // 4. Cleanup temp files
    fs.unlinkSync(destPath);
    
    res.json({
      success: true,
      message: 'Update installed successfully. Restart required.',
      backup: backup.data,
      install: installResult.data,
      restartRequired: true
    });
    
  } catch (error) {
    console.error('Install update error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Update installation failed',
      message: 'An error occurred during update. Your data is safe.'
    });
  }
};

// Update user credentials (username/password)
exports.updateCredentials = async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    const userId = req.user.id;
    
    // Verify current password
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }
    
    // Update username if provided
    if (newUsername && newUsername.trim().length >= 3) {
      // Check username uniqueness
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername.trim(), userId);
      if (existing) {
        return res.status(400).json({ success: false, error: 'Username already taken' });
      }
      
      db.prepare('UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newUsername.trim(), userId);
    }
    
    // Update password if provided
    if (newPassword && newPassword.length >= 6) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hashedPassword, userId);
    }
    
    // Generate new token if credentials changed
    let newToken = null;
    if (newUsername || newPassword) {
      newToken = jwt.sign(
        { id: user.id, username: newUsername?.trim() || user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
    }
    
    res.json({
      success: true,
      message: 'Credentials updated successfully',
      username: newUsername?.trim() || user.username,
      newToken // Frontend should replace stored token if provided
    });
    
  } catch (error) {
    console.error('Update credentials error:', error);
    res.status(500).json({ success: false, error: 'Failed to update credentials' });
  }
};

// Get user profile
exports.getUserProfile = (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true,  user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
};

// Get system info (for diagnostics)
exports.getSystemInfo = (req, res) => {
  try {
    const os = require('os');
    
    res.json({
      success: true,
      data: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memory: {
          total: Math.round(os.totalmem() / 1024 / 1024),
          free: Math.round(os.freemem() / 1024 / 1024)
        },
        uptime: process.uptime(),
        database: {
          size: fs.existsSync('./database.sqlite') 
            ? Math.round(fs.statSync('./database.sqlite').size / 1024) 
            : 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get system info' });
  }
};

module.exports = exports;