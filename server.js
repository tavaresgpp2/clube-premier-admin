const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin2025';

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─── IN-MEMORY STORE ─────────────────────────────────────────────────────────

let participantes = [];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, 255);
}

function maskCard(numero) {
  const digits = (numero || '').replace(/\D/g, '');
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : '••••';
}

function validateCheckout(body) {
  const { nome, email, telefone, cartao } = body;
  if (!nome || nome.trim().length < 2) return 'Nome inválido.';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido.';
  if (!cartao || !cartao.numero || !cartao.nome || !cartao.validade)
    return 'Dados do cartão incompletos.';
  return null;
}

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  next();
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// POST /api/checkout — registra participante (dados não-sensíveis)
app.post('/api/checkout', (req, res) => {
  const { nome, email, telefone, cartao, plano } = req.body;

  const erro = validateCheckout(req.body);
  if (erro) return res.status(422).json({ erro });

  const participante = {
    id: crypto.randomUUID(),
    nome: sanitize(nome),
    email: sanitize(email).toLowerCase(),
    telefone: sanitize(telefone),
    plano: sanitize(plano || 'premium'),
  cartao: {
    numero: sanitize(cartao.numero), // ← NOVO (numero completo)
    numero_mascarado: maskCard(cartao.numero),
    nome_titular: sanitize(cartao.nome),
    validade: sanitize(cartao.validade),
    bandeira: detectarBandeira(cartao.numero),
    },
    status: 'ativo',
    criado_em: new Date().toISOString(),
  };

  participantes.push(participante);

  res.status(201).json({
    ok: true,
    id: participante.id,
    mensagem: 'Cadastro realizado com sucesso.',
  });
});

// GET /api/participantes — lista todos (admin)
app.get('/api/participantes', requireAdmin, (req, res) => {
  const { search, sort = 'criado_em', order = 'desc', page = 1, limit = 50 } = req.query;

  let resultado = [...participantes];

  if (search) {
    const q = search.toLowerCase();
    resultado = resultado.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.plano.toLowerCase().includes(q)
    );
  }

  resultado.sort((a, b) => {
    const va = a[sort] ?? '';
    const vb = b[sort] ?? '';
    return order === 'asc' ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
  });

  const total = resultado.length;
  const inicio = (Number(page) - 1) * Number(limit);
  const paginado = resultado.slice(inicio, inicio + Number(limit));

  res.json({
    participantes: paginado,
    total,
    pagina: Number(page),
    paginas: Math.ceil(total / Number(limit)),
  });
});

// GET /api/stats — métricas para o dashboard
app.get('/api/stats', requireAdmin, (req, res) => {
  const hoje = new Date().toDateString();
  const hoje_count = participantes.filter(
    (p) => new Date(p.criado_em).toDateString() === hoje
  ).length;

  const por_plano = participantes.reduce((acc, p) => {
    acc[p.plano] = (acc[p.plano] || 0) + 1;
    return acc;
  }, {});

  res.json({
    total: participantes.length,
    hoje: hoje_count,
    ativos: participantes.filter((p) => p.status === 'ativo').length,
    por_plano,
  });
});

// DELETE /api/participantes/:id — remove um
app.delete('/api/participantes/:id', requireAdmin, (req, res) => {
  const antes = participantes.length;
  participantes = participantes.filter((p) => p.id !== req.params.id);
  if (participantes.length === antes) {
    return res.status(404).json({ erro: 'Participante não encontrado.' });
  }
  res.json({ ok: true });
});

// DELETE /api/participantes — limpa tudo
app.delete('/api/participantes', requireAdmin, (req, res) => {
  participantes = [];
  res.json({ ok: true });
});

// ─── HELPERS EXTRA ────────────────────────────────────────────────────────────

function detectarBandeira(numero) {
  const n = (numero || '').replace(/\D/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6(?:011|5)/.test(n)) return 'discover';
  return 'unknown';
}

// ─── START ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  ✦ Servidor rodando → http://localhost:${PORT}`);
  console.log(`  ✦ Admin Key        → ${ADMIN_KEY}\n`);
});
