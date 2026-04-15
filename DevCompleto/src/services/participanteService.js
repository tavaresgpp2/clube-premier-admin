export async function getAll() {
  return db.query('SELECT * FROM participantes');
}