const db = require('../config/database');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, full_name, email)
    VALUES ('admin', ?, 'admin', 'System Admin', 'admin@pos.local')
  `);
  
  stmt.run(hashedPassword);
  console.log('✅ Admin user created: username=admin, password=admin123');
};
// Run the seeding function
seedAdmin();