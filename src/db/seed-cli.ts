import { closeAppDb, getDb } from './index';

async function main() {
  await getDb();
  console.log('Base de dades migrada i inicialitzada correctament (dnd5e-2014 + admin).');
  await closeAppDb();
}

main().catch((error) => {
  console.error('Error inicialitzant la base de dades:', error);
  process.exit(1);
});
