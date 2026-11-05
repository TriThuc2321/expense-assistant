import postgres from 'postgres';

const input = process.argv[2];

if (!input || !process.env.DATABASE_URL) {
  console.error('Usage: pnpm admin:grant <email> (needs DATABASE_URL)');
  process.exit(1);
}

const email = input.trim().toLowerCase();
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const rows = await sql`
    UPDATE "user" SET role = 'admin' WHERE email = ${email} RETURNING email
  `;

  if (rows.length === 0) {
    console.error(`No account for ${email}. Sign in once first.`);
    process.exitCode = 1;
  } else {
    console.info(`${email} is now an admin.`);
  }
} finally {
  await sql.end();
}
