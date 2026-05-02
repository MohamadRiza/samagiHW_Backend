const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const db = require('../config/database');

// Your GitHub repo info
const GITHUB_OWNER = 'your-username'; // Replace with your GitHub username
const GITHUB_REPO = 'pos-system'; // Replace with your repo name
const BACKEND_REPO = 'pos-system-backend'; // Your backend repo name

class UpdateService {
  // Check for latest release from GitHub
  static async checkForUpdates(repoName = GITHUB_REPO, isBackend = false) {
    try {
      const repo = isBackend ? BACKEND_REPO : repoName;
      const url = `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/releases/latest`;
      
      return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'POS-System' }}, (res) => {
          let data = '';
          
          res.on('data', chunk => data += chunk);
          res.on('end', async () => {
            try {
              if (res.statusCode !== 200) {
                return resolve({ success: false, error: 'Failed to fetch releases', downloadUrl: null });
              }
              
              const release = JSON.parse(data);
              const currentVersion = process.env.APP_VERSION || '1.0.0';
              const latestVersion = release.tag_name.replace('v', '');
              
              // Compare versions (simple semver comparison)
              const isNewer = UpdateService.compareVersions(latestVersion, currentVersion) > 0;
              
              resolve({
                success: true,
                hasUpdate: isNewer,
                currentVersion,
                latestVersion,
                releaseName: release.name,
                releaseNotes: release.body,
                downloadUrl: release.assets?.[0]?.browser_download_url || null,
                publishedAt: release.published_at
              });
            } catch (error) {
              reject(error);
            }
          });
        }).on('error', reject);
      });
    } catch (error) {
      console.error('Check updates error:', error);
      return { success: false, error: error.message, downloadUrl: null };
    }
  }
  
  // Simple semver comparison: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
  static compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      const a = parts1[i] || 0;
      const b = parts2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }
  
  // Backup database before update
  static async backupDatabase(backupDir = './backups') {
    try {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `db-backup-${timestamp}.sqlite`);
      
      // Copy database file
      const dbPath = path.join(__dirname, '..', 'database.sqlite');
      fs.copyFileSync(dbPath, backupPath);
      
      // Also backup uploads folder if exists
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      if (fs.existsSync(uploadsDir)) {
        const uploadsBackup = path.join(backupDir, `uploads-backup-${timestamp}`);
        UpdateService.copyFolder(uploadsDir, uploadsBackup);
      }
      
      return {
        success: true,
        backupPath,
        timestamp,
        size: fs.statSync(backupPath).size
      };
    } catch (error) {
      console.error('Backup database error:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Helper: Copy folder recursively
  static copyFolder(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        UpdateService.copyFolder(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  
  // Download update file
  static async downloadUpdate(downloadUrl, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      let downloaded = 0;
      let total = 0;
      
      https.get(downloadUrl, { headers: { 'User-Agent': 'POS-System' }}, (res) => {
        total = parseInt(res.headers['content-length'], 10);
        
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (onProgress && total > 0) {
            const percent = Math.round((downloaded / total) * 100);
            onProgress({ downloaded, total, percent });
          }
          file.write(chunk);
        });
        
        res.on('end', () => {
          file.end();
          resolve({ success: true, path: destPath, size: downloaded });
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {}); // Cleanup
        reject(err);
      });
      
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }
  
  // Extract and install update (for ZIP releases)
  static async installUpdate(zipPath, installDir) {
    try {
      // Note: For production, use a proper ZIP library like 'adm-zip'
      // This is a simplified example - you should add proper extraction
      
      // 1. Backup current installation
      const backupDir = path.join(installDir, '_backup_' + Date.now());
      UpdateService.copyFolder(installDir, backupDir);
      
      // 2. Extract new files (simplified - replace with actual extraction)
      // For now, we'll just log what would happen
      console.log(`Would extract ${zipPath} to ${installDir}`);
      
      // 3. Run any migration scripts if needed
      // await UpdateService.runMigrations(installDir);
      
      // 4. Update version file
      const versionFile = path.join(installDir, 'package.json');
      if (fs.existsSync(versionFile)) {
        const pkg = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
        // Version would be updated from release info
      }
      
      return {
        success: true,
        backupDir,
        message: 'Update installed. Restart required.'
      };
    } catch (error) {
      console.error('Install update error:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Restart application (for Electron)
  static async restartApp() {
    try {
      // For Electron: use app.relaunch() and app.exit()
      // For Node.js standalone: use process management
      if (process.versions.electron) {
        const { app } = require('electron');
        app.relaunch();
        app.exit(0);
      } else {
        // Fallback: restart via shell
        const script = process.platform === 'win32' 
          ? `timeout /t 2 & node ${process.argv[1]}`
          : `sleep 2 && node ${process.argv[1]}`;
        
        exec(script, { detached: true, stdio: 'ignore' }, (err) => {
          if (err) console.error('Restart error:', err);
          process.exit(0);
        });
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = UpdateService;