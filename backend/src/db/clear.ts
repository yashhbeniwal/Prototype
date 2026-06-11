import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearData() {
  console.log('🧹 Clearing pseudo data...');

  try {
    // Delete in order to avoid foreign key constraint violations
    await prisma.payment.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.customer.deleteMany();
    
    await prisma.feedConsumption.deleteMany();
    await prisma.feedInventory.deleteMany();
    
    await prisma.expense.deleteMany();
    await prisma.revenue.deleteMany();

    await prisma.medicalRecord.deleteMany();
    await prisma.vaccination.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.weightRecord.deleteMany();
    await prisma.animal.deleteMany();

    console.log('✅ All pseudo animals, health records, feed, and billing data have been removed.');
    console.log('✅ User accounts and farm settings were preserved.');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearData();
