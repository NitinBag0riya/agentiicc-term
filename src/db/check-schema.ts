/**
 * Check database schema - List all tables
 */
import { getPool } from './postgres';

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');
  
  const pool = getPool();
  
  try {
    // List all tables
    console.log('📋 All tables in database:');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    tables.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });
    
    // Check for user-related tables
    console.log('\n🔍 Checking for user-related tables...');
    const userTables = tables.rows.filter((row: any) => 
      row.table_name.includes('user') || row.table_name.includes('credential')
    );
    
    if (userTables.length > 0) {
      console.log('   Found:');
      for (const table of userTables) {
        console.log(`\n   📊 Table: ${table.table_name}`);
        const columns = await pool.query(`
          SELECT column_name, data_type, character_maximum_length
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table.table_name]);
        
        columns.rows.forEach((col: any) => {
          const type = col.character_maximum_length 
            ? `${col.data_type}(${col.character_maximum_length})`
            : col.data_type;
          console.log(`      - ${col.column_name}: ${type}`);
        });
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema().catch(console.error);
