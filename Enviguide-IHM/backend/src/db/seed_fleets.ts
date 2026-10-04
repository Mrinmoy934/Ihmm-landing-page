import crypto from 'crypto';
import { connectDb, closePool } from '../config/database.js';

const MOCK_FLEETS = [
  { name: 'Ice Class', owner: 'Thor Shipping Limited', manager: 'Bernhard Schulte Shipmanagement (British Isles)' },
  { name: 'Colombo Class', owner: '-', manager: 'Bernhard Schulte Shipmanagement (British Isles)' },
  { name: 'Dalian Class', owner: 'Hapag-Lloyd Aktiengesellschaft', manager: 'Hapag-Lloyd Aktiengesellschaft' },
  { name: 'Hamburg Class', owner: 'Hapag-Lloyd Aktiengesellschaft', manager: 'Hapag-Lloyd Aktiengesellschaft' },
  { name: 'Dublin Class', owner: 'Hapag-Lloyd Aktiengesellschaft', manager: 'Hapag-Lloyd Aktiengesellschaft' },
  { name: 'Dallas Class', owner: 'Hapag-Lloyd Aktiengesellschaft', manager: 'Hapag-Lloyd Aktiengesellschaft' },
  { name: 'Valparaiso Class', owner: 'Hapag-Lloyd Aktiengesellschaft', manager: 'Hapag-Lloyd Aktiengesellschaft' },
  { name: 'A18 Class', owner: 'NF Shipping Maritime 3 Ltd', manager: 'Hapag-Lloyd Aktiengesellschaft' }
];

const MOCK_SUB_FLEETS = [
  { name: 'FS Class 211', parentFleet: 'Ice Class', owner: 'Thor Shipping Limited', manager: 'Bernhard Schulte Shipmanagement (British Isles)' },
  { name: 'FS Ice class 1A', parentFleet: 'Ice Class', owner: 'Thor Shipping Limited', manager: 'Bernhard Schulte Shipmanagement (British Isles)' },
  { name: 'FS Ice class 1B', parentFleet: 'Ice Class', owner: 'Thor Shipping Limited', manager: 'Bernhard Schulte Shipmanagement (British Isles)' },
  { name: 'FS Ice CLASS II', parentFleet: 'Ice Class', owner: 'Thor Shipping Limited', manager: 'Bernhard Schulte Shipmanagement (British Isles)' },
  { name: 'FS Ice class 1C', parentFleet: 'Ice Class', owner: 'Thor Shipping Limited', manager: 'Bernhard Schulte Shipmanagement (British Isles)' },
  { name: 'N', parentFleet: 'Ice Class', owner: 'Thor Shipping Limited', manager: 'Bernhard Schulte Shipmanagement (British Isles)' },
  { name: 'Colombo-Vienna Class', parentFleet: 'Colombo Class', owner: 'Hapag-Lloyd Aktiengesellschaft', manager: 'Hapag-Lloyd Aktiengesellschaft' },
  { name: 'Colombo-Prague Class', parentFleet: 'Colombo Class', owner: 'Hapag-Lloyd Aktiengesellschaft', manager: 'Hapag-Lloyd Aktiengesellschaft' }
];

async function seed() {
  const db = await connectDb();
  console.log('Connecting to database and seeding fleets + sub-fleets...');

  const fleetsColl = db.collection('fleets');
  const subFleetsColl = db.collection('sub_fleets');

  const fleetCount = await fleetsColl.countDocuments({});
  const nameToId = new Map<string, string>();

  if (fleetCount === 0) {
    console.log('Seeding fleets...');
    for (const f of MOCK_FLEETS) {
      const _id = crypto.randomUUID();
      await fleetsColl.insertOne({
        _id,
        name: f.name,
        owner: f.owner,
        manager: f.manager,
        created_at: new Date(),
        updated_at: new Date()
      });
      nameToId.set(f.name, _id);
      console.log(` - Seeded Fleet: ${f.name}`);
    }
  } else {
    console.log('Fleets already exist in database. Skipping fleet seeding.');
    const all = await fleetsColl.find({}).toArray();
    for (const f of all) {
      nameToId.set(f.name, f._id);
    }
  }

  const subCount = await subFleetsColl.countDocuments({});
  if (subCount === 0) {
    console.log('Seeding sub-fleets...');
    for (const sf of MOCK_SUB_FLEETS) {
      const parentId = nameToId.get(sf.parentFleet) || '';
      await subFleetsColl.insertOne({
        _id: crypto.randomUUID(),
        name: sf.name,
        parent_fleet_id: parentId,
        parent_fleet_name: sf.parentFleet,
        owner: sf.owner,
        manager: sf.manager,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log(` - Seeded Sub-Fleet: ${sf.name} (Parent: ${sf.parentFleet})`);
    }
  } else {
    console.log('Sub-fleets already exist in database. Skipping sub-fleet seeding.');
  }

  console.log('Seeding complete.');
  await closePool();
}

seed().catch(console.error);
