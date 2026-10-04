import { MongoClient } from 'mongodb';
import { env } from '../config/env.js';

async function diagnose() {
  // Let's connect with the direct replica set URI
  const uri = env.MONGODB_URI;
  console.log('Connecting to URI:', uri);
  const client = new MongoClient(uri);
  await client.connect();
  
  const adminDb = client.db().admin();
  const dbs = await adminDb.listDatabases();
  console.log('Databases on cluster:');
  for (const d of dbs.databases) {
    console.log(` - ${d.name} (size: ${d.sizeOnDisk} bytes)`);
    const db = client.db(d.name);
    const collections = await db.listCollections().toArray();
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments({});
      console.log(`     * ${coll.name}: ${count} documents`);
    }
  }
  
  await client.close();
}

diagnose().catch(console.error);
