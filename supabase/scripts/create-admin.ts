import { hashSecret } from "@invoz/common/secret";
import { prisma } from "@invoz/database";

function usage(): string {
  return `Usage: npm run admin:create -- <email> <password>

Creates an admin app account, or replaces the password when the email already exists.
The password is stored as a scrypt hash. It is not a Supabase Auth user.`;
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase() ?? "";
  const password = process.argv[3] ?? "";
  if (!email || email === "--help" || process.argv.length > 4) {
    console.log(usage());
    if (!email || email !== "--help" || process.argv.length > 3) process.exitCode = 1;
    return;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Enter an email address.");
  }
  if (password.length < 8) {
    throw new Error("The password must be at least 8 characters.");
  }

  const passwordHash = hashSecret(password);
  const existing = await prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, password_hash: passwordHash },
    update: { password_hash: passwordHash },
  });
  console.log(existing ? `updated admin ${email}` : `created admin ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
