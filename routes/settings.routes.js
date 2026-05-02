const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const authenticateToken = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

// All routes require authentication
router.use(authenticateToken);

// App info & updates (admin only for install)
router.get('/app-info', settingsController.getAppInfo);
router.get('/check-updates', settingsController.checkForUpdates);
router.post('/install-update', authorizeRoles('admin'), settingsController.installUpdate);

// User account management
router.get('/profile', settingsController.getUserProfile);
router.put('/credentials', settingsController.updateCredentials);

// System diagnostics
router.get('/system-info', authorizeRoles('admin'), settingsController.getSystemInfo);

module.exports = router;