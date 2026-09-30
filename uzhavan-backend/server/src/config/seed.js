/**
 * Uzhavan 360 - Database Seeder
 * Level 4 Architecture Reference: Section 1 — Seed & Development Data
 *
 * Populates realistic agricultural data across core domains:
 * - Farmers & FarmerProfiles
 * - Buyers & BuyerProfiles
 * - Produce Catalog with GeoJSON coordinates
 * - InventoryLots & Double-Entry Ledger entries
 * - Harvest Byproducts
 * - Demand Signals
 */

import mongoose from 'mongoose';
import { env } from './env.js';
import { connectDB, disconnectDB } from './db.js';
import { User } from '../modules/auth/user.model.js';
import { FarmerProfile } from '../modules/farmers/farmerProfile.model.js';
import { BuyerProfile } from '../modules/buyers/buyerProfile.model.js';
import { Product } from '../modules/products/product.model.js';
import { InventoryLot } from '../modules/inventory/inventoryLot.model.js';
import { InventoryLedger } from '../modules/inventory/inventoryLedger.model.js';
import { HarvestByproduct } from '../modules/byproducts/byproduct.model.js';
import { DemandSignal } from '../modules/demand/demandSignal.model.js';
import { ROLES, UNITS, FRESHNESS_TIERS, DEMAND_TRENDS, INVENTORY_TRANSACTION_TYPES } from '@uzhavan360/shared';

export async function seedDatabase() {
  console.log('[SEED] Starting Uzhavan 360 database seed...');
  await connectDB();

  // 1. Seed Farmer
  let farmer = await User.findOne({ phone: '9876543210' });
  if (!farmer) {
    farmer = await User.create({
      name: 'Rajan Murugesan',
      phone: '9876543210',
      password: 'password123',
      role: ROLES.FARMER,
      isVerified: true,
      farmDetails: {
        farmName: 'Murugan Organic Farms',
        bio: 'Chemical-free natural farming for over 15 years in Kinathukadavu belt.',
        location: {
          type: 'Point',
          coordinates: [76.9558, 11.0168]
        },
        address: {
          village: 'Kinathukadavu',
          district: 'Coimbatore',
          state: 'Tamil Nadu',
          pincode: '642109'
        }
      }
    });
    console.log('[SEED] Created Farmer:', farmer.name);
  }

  // FarmerProfile
  await FarmerProfile.findOneAndUpdate(
    { userId: farmer._id },
    {
      userId: farmer._id,
      farmName: 'Murugan Organic Farms',
      acreage: 4.5,
      farmingPractice: 'ORGANIC',
      primaryCrops: ['Tomato', 'Onion', 'Brinjal', 'Drumstick'],
      soilType: 'RED_SOIL',
      irrigationSource: 'DRIP',
      experienceYears: 15,
      location: {
        type: 'Point',
        coordinates: [76.9558, 11.0168]
      },
      address: {
        village: 'Kinathukadavu',
        district: 'Coimbatore',
        state: 'Tamil Nadu',
        pincode: '642109'
      },
      trustScore: 92
    },
    { upsert: true, new: true }
  );

  // 2. Seed Buyer
  let buyer = await User.findOne({ phone: '9123456780' });
  if (!buyer) {
    buyer = await User.create({
      name: 'Selvi Krishnan',
      phone: '9123456780',
      password: 'password123',
      role: ROLES.BUYER,
      isVerified: true,
      buyerDetails: {
        businessType: 'RETAIL',
        noShowCount: 0
      }
    });
    console.log('[SEED] Created Buyer:', buyer.name);
  }

  // BuyerProfile
  await BuyerProfile.findOneAndUpdate(
    { userId: buyer._id },
    {
      userId: buyer._id,
      businessName: 'Selvi Organic Mart',
      businessType: 'RETAIL',
      preferredCategories: ['LEAFY', 'FRUITING', 'TUBER'],
      reliabilityScore: 98
    },
    { upsert: true, new: true }
  );

  // 3. Seed Products with InventoryLots & Double-Entry Ledger
  const sampleProducts = [
    {
      name: 'Farm-Fresh Country Tomatoes (நாட்டு தக்காளி)',
      category: 'FRUITING',
      unit: UNITS.KG,
      pricePerUnit: 35,
      quantity: 500,
      harvestDate: new Date(),
      location: { type: 'Point', coordinates: [76.9558, 11.0168] },
      description: 'Naturally ripened, tangy country tomatoes harvested this morning.'
    },
    {
      name: 'Small Shallot Onions (சின்ன வெங்காயம்)',
      category: 'TUBER',
      unit: UNITS.KG,
      pricePerUnit: 55,
      quantity: 800,
      harvestDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      location: { type: 'Point', coordinates: [76.9600, 11.0200] },
      description: 'Pungent, high-potency small onions cured and sorted.'
    },
    {
      name: 'Fresh Siru Keerai (சிறுகீரை)',
      category: 'LEAFY',
      unit: UNITS.KG,
      pricePerUnit: 20,
      quantity: 150,
      harvestDate: new Date(),
      location: { type: 'Point', coordinates: [76.9500, 11.0150] },
      description: 'Crisp green leaves harvested at dawn. Best consumed fresh.'
    }
  ];

  for (const item of sampleProducts) {
    let prod = await Product.findOne({ farmerId: farmer._id, name: item.name });
    if (!prod) {
      prod = await Product.create({
        farmerId: farmer._id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        pricePerUnit: item.pricePerUnit,
        totalStock: item.quantity,
        availableStock: item.quantity,
        reservedStock: 0,
        soldStock: 0,
        harvestDate: item.harvestDate,
        location: item.location,
        description: item.description,
        isAvailable: true
      });

      // Create Lot
      const lotNum = `LOT-${Date.now().toString().slice(-6)}-${item.category.slice(0, 3)}`;
      await InventoryLot.create({
        productId: prod._id,
        farmerId: farmer._id,
        lotNumber: lotNum,
        harvestDate: item.harvestDate,
        initialQuantity: item.quantity,
        availableQuantity: item.quantity,
        reservedQuantity: 0,
        soldQuantity: 0,
        unit: item.unit,
        qualityGrade: 'ORGANIC_PREMIUM'
      });

      // Create Initial Ledger Entry
      await InventoryLedger.create({
        productId: prod._id,
        farmerId: farmer._id,
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
        reason: 'Initial harvest batch listing'
      });

      console.log(`[SEED] Created Product: ${prod.name} (${item.quantity} ${item.unit})`);
    }
  }

  // 4. Seed Harvest Byproduct
  let byproduct = await HarvestByproduct.findOne({ farmerId: farmer._id, name: 'Paddy Straw Bales' });
  if (!byproduct) {
    await HarvestByproduct.create({
      farmerId: farmer._id,
      name: 'Paddy Straw Bales',
      category: 'PADDY_STRAW',
      quantity: 8,
      unit: UNITS.TON,
      expectedPrice: 2200,
      location: {
        type: 'Point',
        coordinates: [76.9558, 11.0168]
      },
      moistureLevel: 'LOW',
      packagingType: 'BALED',
      potentialUses: [
        'Mushroom cultivation substrate',
        'Cattle fodder supplement',
        'Mulching for soil moisture conservation',
        'Bio-fuel pellet manufacturing'
      ]
    });
    console.log('[SEED] Created Harvest Byproduct: Paddy Straw Bales');
  }

  // 5. Seed Demand Signals
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  await DemandSignal.findOneAndUpdate(
    { category: 'FRUITING', district: 'Coimbatore' },
    {
      category: 'FRUITING',
      commodityName: 'Tomatoes',
      district: 'Coimbatore',
      timeframeStart: sevenDaysAgo,
      timeframeEnd: now,
      requestCount: 42,
      previousRequestCount: 28,
      growthPercentage: 50,
      estimatedVolumeDemand: 3500,
      unit: UNITS.KG,
      trend: DEMAND_TRENDS.INCREASING,
      confidenceScore: 90
    },
    { upsert: true }
  );
  console.log('[SEED] Seeded DemandSignal: FRUITING / Coimbatore (Trend: INCREASING)');

  console.log('[SEED] Database seed completed successfully.\n');
}

// Direct execution from CLI
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => disconnectDB())
    .catch((err) => {
      console.error('[SEED ERROR]', err);
      process.exit(1);
    });
}
