import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create default farm
  const farm = await prisma.farm.upsert({
    where: { code: 'MAIN001' },
    update: {},
    create: {
      name: 'Main Goat Farm',
      code: 'MAIN001',
      location: 'Maharashtra, India',
      address: '123 Farm Road, Pune, Maharashtra 411001',
      phone: '+91-9876543210',
      gstNumber: '27AABCU9603R1ZX',
      upiId: 'farmowner@upi',
    },
  });
  console.log(`✅  Farm: ${farm.name}`);

  // Create Super Admin
  const superAdminHash = await bcrypt.hash('SuperAdmin@2026', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@goatfarmerp.in' },
    update: {},
    create: {
      email: 'superadmin@goatfarmerp.in',
      passwordHash: superAdminHash,
      name: 'Super Admin',
      role: 'SUPERADMIN',
      isActive: true,
    },
  });
  console.log(`✅  Super Admin: ${superAdmin.email}`);

  // Create Farm Owner
  const ownerHash = await bcrypt.hash('Owner@2026', 12);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@goatfarmerp.in' },
    update: {},
    create: {
      email: 'owner@goatfarmerp.in',
      passwordHash: ownerHash,
      name: 'Farm Owner',
      role: 'OWNER',
      farmId: farm.id,
      phone: '+91-9876543210',
      whatsappNumber: '919876543210',
      isActive: true,
    },
  });
  console.log(`✅  Owner: ${owner.email}`);

  // Create Farm Manager
  const managerHash = await bcrypt.hash('Manager@2026', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@goatfarmerp.in' },
    update: {},
    create: {
      email: 'manager@goatfarmerp.in',
      passwordHash: managerHash,
      name: 'Farm Manager',
      role: 'MANAGER',
      farmId: farm.id,
      isActive: true,
    },
  });
  console.log(`✅  Manager: ${manager.email}`);

  // Create Veterinarian
  const vetHash = await bcrypt.hash('Vet@2026', 12);
  const vet = await prisma.user.upsert({
    where: { email: 'vet@goatfarmerp.in' },
    update: {},
    create: {
      email: 'vet@goatfarmerp.in',
      passwordHash: vetHash,
      name: 'Dr. Priya Sharma',
      role: 'VETERINARIAN',
      farmId: farm.id,
      isActive: true,
    },
  });
  console.log(`✅  Veterinarian: ${vet.email}`);

  // Create Accountant
  const accountantHash = await bcrypt.hash('Accountant@2026', 12);
  await prisma.user.upsert({
    where: { email: 'accountant@goatfarmerp.in' },
    update: {},
    create: {
      email: 'accountant@goatfarmerp.in',
      passwordHash: accountantHash,
      name: 'Farm Accountant',
      role: 'ACCOUNTANT',
      farmId: farm.id,
      isActive: true,
    },
  });
  console.log(`✅  Accountant: accountant@goatfarmerp.in`);

  // Seed sample animals
  const breeds = ['Boer', 'Jamnapari', 'Beetal', 'Black Bengal', 'Osmanabadi', 'Sirohi'];
  const locations = ['Pen A', 'Pen B', 'Pen C', 'Shed 1', 'Shed 2'];
  const animalIds: string[] = [];

  for (let i = 1; i <= 20; i++) {
    const customId = `G${String(i).padStart(3, '0')}`;
    const breed = breeds[i % breeds.length];
    const gender = i % 3 === 0 ? 'MALE' : 'FEMALE';
    const dob = new Date(2022, i % 12, (i % 28) + 1);
    const weight = 20 + (i * 1.5);

    const existing = await prisma.animal.findUnique({ where: { customId } });
    if (!existing) {
      const a = await prisma.animal.create({
        data: {
          customId,
          name: `Goat ${i}`,
          breed,
          weight,
          dateOfBirth: dob,
          gender,
          color: i % 2 === 0 ? 'White' : 'Brown',
          location: locations[i % locations.length],
          farmId: farm.id,
          purchaseCost: 3000 + i * 100,
          purchaseDate: new Date(2023, 0, i),
          status: 'ACTIVE',
        },
      });
      animalIds.push(a.id);

      // Add weight history
      await prisma.weightRecord.create({
        data: { animalId: a.id, weight: weight - 5, recordedAt: new Date(2024, 0, 1) },
      });

      // Schedule vaccination
      await prisma.vaccination.create({
        data: {
          animalId: a.id,
          vaccineName: i % 2 === 0 ? 'PPR Vaccine' : 'FMD Vaccine',
          nextDueDate: new Date(Date.now() + (i * 2 - 5) * 24 * 60 * 60 * 1000),
          status: i % 4 === 0 ? 'OVERDUE' : 'PENDING',
          disease: i % 2 === 0 ? 'Peste des Petits Ruminants' : 'Foot and Mouth Disease',
        },
      });
    } else {
      animalIds.push(existing.id);
    }
  }
  console.log(`✅  Seeded 20 animals`);

  // Seed Feed Inventory
  const feedTypes = [
    { feedType: 'Maize Silage', supplier: 'AgriSupply Co.', cost: 15000, qty: 1000 },
    { feedType: 'Lucerne Hay', supplier: 'Green Farms', cost: 8000, qty: 500 },
    { feedType: 'Concentrates', supplier: 'FeedMart', cost: 20000, qty: 800 },
  ];

  for (const feed of feedTypes) {
    await prisma.feedInventory.upsert({
      where: { id: `seed-feed-${feed.feedType.replace(' ', '-')}` },
      update: {},
      create: {
        id: `seed-feed-${feed.feedType.replace(' ', '-')}`,
        feedType: feed.feedType,
        supplier: feed.supplier,
        quantityPurchased: feed.qty,
        cost: feed.cost,
        costPerKg: feed.cost / feed.qty,
        availableStock: feed.qty * 0.7,
        minimumThreshold: 50,
        farmId: farm.id,
      },
    });
  }
  console.log(`✅  Seeded feed inventory`);

  // Seed sample customers
  const customerData = [
    { name: 'Rajesh Kumar', mobile: '9876543001', whatsappNumber: '919876543001', state: 'Maharashtra', outstanding: 15000 },
    { name: 'Suresh Patel', mobile: '9876543002', whatsappNumber: '919876543002', state: 'Gujarat', outstanding: 8500 },
    { name: 'Priya Sharma', mobile: '9876543003', whatsappNumber: '919876543003', state: 'Rajasthan', outstanding: 0 },
  ];

  for (const c of customerData) {
    await prisma.customer.upsert({
      where: { id: `seed-customer-${c.mobile}` },
      update: {},
      create: {
        id: `seed-customer-${c.mobile}`,
        name: c.name, mobile: c.mobile, whatsappNumber: c.whatsappNumber,
        state: c.state, country: 'India', outstandingBalance: c.outstanding,
        totalPurchased: c.outstanding + 5000,
      },
    });
  }
  console.log(`✅  Seeded 3 customers`);

  console.log('\n🎉  Seed completed!\n');
  console.log('📋  Login Credentials:');
  console.log('   Super Admin: superadmin@goatfarmerp.in / SuperAdmin@2026');
  console.log('   Farm Owner:  owner@goatfarmerp.in / Owner@2026');
  console.log('   Manager:     manager@goatfarmerp.in / Manager@2026');
  console.log('   Vet:         vet@goatfarmerp.in / Vet@2026');
  console.log('   Accountant:  accountant@goatfarmerp.in / Accountant@2026');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
