const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected. Running ALTER TABLE products...');
    
    await client.query(`
      ALTER TABLE products 
      ALTER COLUMN price TYPE NUMERIC(10,2),
      ALTER COLUMN cost_price TYPE NUMERIC(10,2);
    `);
    console.log('✅ Altered price and cost_price to NUMERIC.');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

migrate();
