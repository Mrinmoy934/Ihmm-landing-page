import { connectDb, closePool } from '../config/database.js';

async function assign() {
  const db = await connectDb();
  
  // Find manager user
  const manager = await db.collection('users').findOne({ email: 'manager@enviguide.com' });
  if (!manager) {
    console.error('Manager user not found!');
    await closePool();
    return;
  }
  
  // Find any vessel
  const vessel = await db.collection('vessels').findOne({});
  if (!vessel) {
    console.log('No vessels found in database to assign.');
  } else {
    console.log(`Assigning vessel "${vessel.name}" (IMO: ${vessel.imo_number}) to Ship Manager "${manager.name}"`);
    await db.collection('vessels').updateOne(
      { _id: vessel._id },
      { $set: { created_by_id: manager._id } }
    );
    console.log('Assignment completed.');
  }
  
  await closePool();
}

assign().catch(err => {
  console.error(err);
  process.exit(1);
});
