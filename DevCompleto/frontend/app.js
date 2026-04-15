import { getParticipantes } from './services/api.js';
import { renderTable } from './components/table.js';

async function init() {
  const data = await getParticipantes();
  renderTable(data);
}

init();