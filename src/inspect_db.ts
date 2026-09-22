import { prisma } from './config/db';

async function main() {
  const companies = await prisma.company.findMany({
    include: { users: true }
  });
  console.log('=== TOTAL COMPANIES IN DB:', companies.length, '===');
  companies.forEach(c => {
    console.log(`Company ID: ${c.id} | Name: ${c.name} | Currency: ${c.currency}`);
    console.log(`   Users (${c.users.length}):`, c.users.map(u => `${u.name} <${u.email}> (${u.role})`).join(', ') || 'NONE');
  });

  const orphanCompanies = companies.filter(c => c.users.length === 0);
  console.log('\n=== COMPANIES WITH NO USERS (ORPHANS):', orphanCompanies.length, '===');
  orphanCompanies.forEach(c => {
    console.log(`ORPHAN COMPANY: "${c.name}" (ID: ${c.id})`);
  });
}

main().finally(() => prisma.$disconnect());
