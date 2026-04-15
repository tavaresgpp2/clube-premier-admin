export async function getParticipantes() {
  const res = await fetch('/api/participantes');
  return res.json();
}