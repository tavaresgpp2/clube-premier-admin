export async function getAll(req, res) {
  const data = await service.getAll();
  res.json(data);
}