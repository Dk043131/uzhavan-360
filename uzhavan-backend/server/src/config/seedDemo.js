/**
 * Uzhavan 360 - Demo Bridge Seeder
 * Creates demo accounts:
 *   🌾 Farmer  — Karthiga   | Phone: 9811112222 | Password: Karthiga@360
 *   🛒 Buyer   — Harshanth  | Phone: 9833334444 | Password: Harshanth@360
 *
 * Karthiga's produce listings are visible to Harshanth on the marketplace.
 * A sample order request is created so order tracking works out-of-the-box.
 *
 * Run: npm run seed:demo  (from uzhavan-backend/)
 */

import { connectDB, disconnectDB } from './db.js';
import { User } from '../modules/auth/user.model.js';
import { FarmerProfile } from '../modules/farmers/farmerProfile.model.js';
import { BuyerProfile } from '../modules/buyers/buyerProfile.model.js';
import { Product } from '../modules/products/product.model.js';
import { InventoryLot } from '../modules/inventory/inventoryLot.model.js';
import { InventoryLedger } from '../modules/inventory/inventoryLedger.model.js';
import { BuyerRequest as OrderRequest } from '../modules/requests/request.model.js';
import { ROLES, UNITS, INVENTORY_TRANSACTION_TYPES } from '@uzhavan360/shared';

// ── Demo credentials ──────────────────────────────────────────────────────────
const KARTHIGA_PHONE = '9811112222';
const KARTHIGA_PASS  = 'Karthiga@360';

const HARSHANTH_PHONE = '9833334444';
const HARSHANTH_PASS  = 'Harshanth@360';

// Karthiga's farm — Pollachi, Coimbatore district (lng, lat — GeoJSON order!)
const FARM_COORDS = [77.0030, 10.6542];

// ── Produce Karthiga lists ─────────────────────────────────────────────────────
const KARTHIGA_PRODUCTS = [
  {
    name: 'Organic Banana (நாட்டு வாழைப்பழம்)',
    category: 'FRUITING',
    unit: UNITS.KG,
    pricePerUnit: 45,
    quantity: 600,
    description: 'Fresh Nendran bananas harvested this morning from chemical-free plantation.'
  },
  {
    name: 'Red Chilli Powder Ready Chilli (காய்ந்த மிளகாய்)',
    category: 'OTHER',
    unit: UNITS.KG,
    pricePerUnit: 120,
    quantity: 200,
    description: 'Sun-dried Guntur variety chillies, naturally processed without preservatives.'
  },
  {
    name: 'Country Moringa Drumstick (நாட்டு முருங்கைக்காய்)',
    category: 'FRUITING',
    unit: UNITS.KG,
    pricePerUnit: 30,
    quantity: 300,
    description: 'Tender drumsticks plucked at peak nutrition — protein-rich natural produce.'
  }
];

export async function seedDemo() {
  console.log('\n🌾 [DEMO SEED] Starting Karthiga ↔ Harshanth bridge seed...\n');
  await connectDB();

  // ── 1. Create / find Karthiga (Farmer) ────────────────────────────────────
  let karthiga = await User.findOne({ phone: KARTHIGA_PHONE });
  if (!karthiga) {
    karthiga = await User.create({
      name: 'Karthiga',
      phone: KARTHIGA_PHONE,
      password: KARTHIGA_PASS,
      role: ROLES.FARMER,
      isVerified: true,
      farmDetails: {
        farmName: 'Karthiga Natural Farm',
        bio: 'Third-generation farmer from Pollachi. Specialises in banana, chilli and drumstick cultivation using traditional methods.',
        location: { type: 'Point', coordinates: FARM_COORDS },
        address: {
          village: 'Pollachi',
          district: 'Coimbatore',
          state: 'Tamil Nadu',
          pincode: '642001'
        }
      }
    });
    console.log('✅ Created Farmer:', karthiga.name, '|', KARTHIGA_PHONE, '|', KARTHIGA_PASS);
  } else {
    console.log('ℹ️  Farmer already exists:', karthiga.name);
  }

  await FarmerProfile.findOneAndUpdate(
    { userId: karthiga._id },
    {
      userId: karthiga._id,
      farmName: 'Karthiga Natural Farm',
      acreage: 6.0,
      farmingPractice: 'ORGANIC',
      primaryCrops: ['Banana', 'Chilli', 'Drumstick', 'Coconut'],
      soilType: 'BLACK_SOIL',
      irrigationSource: 'CANAL',
      experienceYears: 12,
      location: { type: 'Point', coordinates: FARM_COORDS },
      address: {
        village: 'Pollachi',
        district: 'Coimbatore',
        state: 'Tamil Nadu',
        pincode: '642001'
      },
      trustScore: 88
    },
    { upsert: true, new: true }
  );
  console.log('✅ FarmerProfile upserted for Karthiga');

  // ── 2. Create / find Harshanth (Buyer) ────────────────────────────────────
  let harshanth = await User.findOne({ phone: HARSHANTH_PHONE });
  if (!harshanth) {
    harshanth = await User.create({
      name: 'Harshanth',
      phone: HARSHANTH_PHONE,
      password: HARSHANTH_PASS,
      role: ROLES.BUYER,
      isVerified: true,
      buyerDetails: {
        businessType: 'WHOLESALE',
        noShowCount: 0
      }
    });
    console.log('✅ Created Buyer:', harshanth.name, '|', HARSHANTH_PHONE, '|', HARSHANTH_PASS);
  } else {
    console.log('ℹ️  Buyer already exists:', harshanth.name);
  }

  await BuyerProfile.findOneAndUpdate(
    { userId: harshanth._id },
    {
      userId: harshanth._id,
      businessName: 'Harshanth Agro Traders',
      businessType: 'WHOLESALE',
      preferredCategories: ['FRUITING', 'SPICE', 'LEAFY'],
      reliabilityScore: 95
    },
    { upsert: true, new: true }
  );
  console.log('✅ BuyerProfile upserted for Harshanth');

  // ── 3. Create Karthiga's produce listings ─────────────────────────────────
  const createdProducts = [];
  for (const item of KARTHIGA_PRODUCTS) {
    let prod = await Product.findOne({ farmerId: karthiga._id, name: item.name });
    if (!prod) {
      prod = await Product.create({
        farmerId: karthiga._id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        pricePerUnit: item.pricePerUnit,
        totalStock: item.quantity,
        availableStock: item.quantity,
        reservedStock: 0,
        soldStock: 0,
        harvestDate: new Date(),
        location: { type: 'Point', coordinates: FARM_COORDS },
        description: item.description,
        isAvailable: true
      });

      // Inventory Lot
      const lotNum = `LOT-DEMO-${Date.now().toString().slice(-6)}-${item.category.slice(0, 3)}`;
      await InventoryLot.create({
        productId: prod._id,
        farmerId: karthiga._id,
        lotNumber: lotNum,
        harvestDate: new Date(),
        initialQuantity: item.quantity,
        availableQuantity: item.quantity,
        reservedQuantity: 0,
        soldQuantity: 0,
        unit: item.unit,
        qualityGrade: 'ORGANIC_PREMIUM'
      });

      // Double-entry ledger
      await InventoryLedger.create({
        productId: prod._id,
        farmerId: karthiga._id,
        transactionType: INVENTORY_TRANSACTION_TYPES.NEW_HARVEST,
        quantityDelta: item.quantity,
        totalBefore: 0,
        totalAfter: item.quantity,
        availableBefore: 0,
        availableAfter: item.quantity,
        reservedBefore: 0,
        reservedAfter: 0,
        soldBefore: 0,
        soldAfter: 0,
        reason: 'Demo seed — initial harvest listing'
      });

      console.log(`✅ Product: ${prod.name} (${item.quantity} ${item.unit} @ ₹${item.pricePerUnit})`);
    } else {
      console.log(`ℹ️  Product already exists: ${prod.name}`);
    }
    createdProducts.push(prod);
  }

  // ── 4. Create a sample order request (Harshanth → Karthiga) ───────────────
  // Use the first product (Banana) for the bridge order
  const bridgeProduct = createdProducts[0];
  if (bridgeProduct) {
    const existingReq = await OrderRequest.findOne({
      buyerId: harshanth._id,
      farmerId: karthiga._id,
      productId: bridgeProduct._id
    });

    if (!existingReq) {
      await OrderRequest.create({
        buyerId: harshanth._id,
        farmerId: karthiga._id,
        productId: bridgeProduct._id,
        quantity: 50,
        unit: bridgeProduct.unit,
        offeredPricePerUnit: bridgeProduct.pricePerUnit,
        totalAmount: 50 * bridgeProduct.pricePerUnit,
        status: 'REQUESTED',
        note: 'Demo order — Harshanth requesting 50 kg of bananas from Karthiga.'
      });
      console.log(`\n🔗 Bridge Order created: Harshanth → Karthiga (${bridgeProduct.name}, 50 kg)`);
    } else {
      console.log('\nℹ️  Bridge order already exists.');
    }
  }

  console.log('\n──────────────────────────────────────────────────────────');
  console.log('🌾 DEMO ACCOUNTS READY');
  console.log('──────────────────────────────────────────────────────────');
  console.log('  Farmer  → Karthiga   | Phone: 9811112222 | Pass: Karthiga@360');
  console.log('  Buyer   → Harshanth  | Phone: 9833334444 | Pass: Harshanth@360');
  console.log('──────────────────────────────────────────────────────────');
  console.log('  Karthiga listed 3 products visible on the marketplace.');
  console.log('  Harshanth has a PENDING order request for 50 kg Bananas.');
  console.log('  Log in as either account to see the full order tracking bridge.');
  console.log('──────────────────────────────────────────────────────────\n');
}

// Direct CLI execution
if (process.argv[1]?.endsWith('seedDemo.js')) {
  seedDemo()
    .then(() => disconnectDB())
    .catch((err) => {
      console.error('[DEMO SEED ERROR]', err);
      process.exit(1);
    });
}
