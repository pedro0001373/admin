require("dotenv").config();
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const path       = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://peres:12345@ac-pyte4gt-shard-00-00.ygdges0.mongodb.net:27017,ac-pyte4gt-shard-00-01.ygdges0.mongodb.net:27017,ac-pyte4gt-shard-00-02.ygdges0.mongodb.net:27017/?ssl=true&replicaSet=atlas-ob5pqr-shard-0&authSource=admin&appName=tabacariajr";

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("✅  MongoDB conectado");
    // Garante que todas as categorias dos produtos existam na coleção Categoria
    const cats = await Produto.distinct("categoria");
    const validas = cats.filter(Boolean);
    await Promise.all(validas.map(nome =>
      Categoria.findOneAndUpdate({ nome }, { nome }, { upsert: true })
    ));
    if (validas.length) console.log(`✅  ${validas.length} categoria(s) sincronizadas`);
  })
  .catch(err => console.error("❌  Erro MongoDB:", err));

// ── MODELOS ───────────────────────────────────────────────────────────────────
const ProdutoSchema = new mongoose.Schema({
  nome:            { type: String,  required: true },
  preco:           { type: Number,  required: true, min: 0 },
  categoria:       { type: String,  required: true },
  estoque:         { type: Number,  default: 0 },
  imagem:          { type: String,  default: "" },
  descricao:       { type: String,  default: "" },
  lote:            { type: String,  default: "" },
  fabricacao:      { type: Date,    default: null },
  quantidade_lote: { type: Number,  default: 0 },
  validade:        { type: Date,    default: null },   // ← NOVO
}, { timestamps: true });

ProdutoSchema.index({ categoria: 1 });
ProdutoSchema.index({ validade: 1 });
ProdutoSchema.index({ estoque: 1 });

const Produto = mongoose.model("Produto", ProdutoSchema);

const PedidoSchema = new mongoose.Schema({
  numero:      Number,
  cliente:     { type: String, required: true },
  endereco:    { type: String, default: "" },
  regiao:      { type: String, default: "" },
  pagamento:   { type: String, default: "Pix" },
  itens:       { type: Array,  default: [] },
  subtotal:    { type: Number, default: 0 },
  taxaEntrega: { type: Number, default: 0 },
  total:       { type: Number, default: 0 },
  status:      { type: String, default: "pendente",
                 enum: ["pendente","em andamento","entregue","cancelado"] },
  observacao:  { type: String, default: "" },
  data:        { type: Date,   default: Date.now },
}, { timestamps: true });

PedidoSchema.index({ status: 1 });
PedidoSchema.index({ data: -1 });
PedidoSchema.index({ numero: -1 });

const Pedido = mongoose.model("Pedido", PedidoSchema);

const CategoriaSchema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
}, { timestamps: true });
const Categoria = mongoose.model("Categoria", CategoriaSchema);

// ── HELPER ────────────────────────────────────────────────────────────────────
function adaptProduto(p) {
  return {
    _id: p._id, id: p._id,
    name: p.nome, price: p.preco, category: p.categoria,
    stock: p.estoque, img: p.imagem, desc: p.descricao,
    lote: p.lote, fabricacao: p.fabricacao,
    quantidade_lote: p.quantidade_lote,
    validade: p.validade,
  };
}

// ── PRODUTOS ──────────────────────────────────────────────────────────────────
app.get("/api/produtos", async (req, res) => {
  try { res.json((await Produto.find().sort({ categoria:1, nome:1 })).map(adaptProduto)); }
  catch(err){ res.status(500).json({ erro: err.message }); }
});

app.post("/api/produtos", async (req, res) => {
  try {
    const { name, price, category, stock, img, desc,
            lote, fabricacao, quantidade_lote, validade } = req.body;
    const novo = await new Produto({
      nome: name, preco: price, categoria: category,
      estoque: stock??0, imagem: img||"", descricao: desc||"",
      lote: lote||"", fabricacao: fabricacao||null,
      quantidade_lote: quantidade_lote??0,
      validade: validade||null,
    }).save();
    res.status(201).json(adaptProduto(novo));
  } catch(err){ res.status(400).json({ erro: err.message }); }
});

app.put("/api/produtos/:id", async (req, res) => {
  try {
    const { name, price, category, stock, img, desc,
            lote, fabricacao, quantidade_lote, validade } = req.body;
    const doc = await Produto.findByIdAndUpdate(req.params.id,
      { nome:name, preco:price, categoria:category, estoque:stock,
        imagem:img||"", descricao:desc||"", lote:lote||"",
        fabricacao:fabricacao||null, quantidade_lote:quantidade_lote??0,
        validade:validade||null },
      { new:true, runValidators:true });
    if(!doc) return res.status(404).json({ erro:"Produto não encontrado" });
    res.json(adaptProduto(doc));
  } catch(err){ res.status(400).json({ erro: err.message }); }
});

app.delete("/api/produtos/:id", async (req, res) => {
  try { await Produto.findByIdAndDelete(req.params.id); res.json({ ok:true }); }
  catch(err){ res.status(500).json({ erro: err.message }); }
});

// ── PEDIDOS ───────────────────────────────────────────────────────────────────
app.get("/api/pedidos", async (req, res) => {
  try { res.json(await Pedido.find().sort({ data:-1 })); }
  catch(err){ res.status(500).json({ erro: err.message }); }
});

app.post("/api/pedidos", async (req, res) => {
  try {
    const ultimo = await Pedido.findOne().sort({ numero:-1 }).select("numero");
    const pedido = await new Pedido({ ...req.body, numero:(ultimo?.numero??0)+1 }).save();
    for(const item of req.body.itens??[]){
      const pid = item.id||item._id;
      if(pid) await Produto.findByIdAndUpdate(pid,{ $inc:{ estoque:-(item.qty??1) } });
    }
    res.status(201).json(pedido);
  } catch(err){ res.status(400).json({ erro: err.message }); }
});

app.put("/api/pedidos/:id", async (req, res) => {
  try {
    const update = { status: req.body.status };
    if (req.body.observacao !== undefined) update.observacao = req.body.observacao;
    const doc = await Pedido.findByIdAndUpdate(req.params.id, update, { new:true });
    if(!doc) return res.status(404).json({ erro:"Pedido não encontrado" });
    res.json(doc);
  } catch(err){ res.status(400).json({ erro: err.message }); }
});

app.delete("/api/pedidos/:id", async (req, res) => {
  try { await Pedido.findByIdAndDelete(req.params.id); res.json({ ok:true }); }
  catch(err){ res.status(500).json({ erro: err.message }); }
});

// ── STATS ─────────────────────────────────────────────────────────────────────
app.get("/api/stats", async (req, res) => {
  try {
    const hoje = new Date();
    const em30  = new Date(); em30.setDate(hoje.getDate()+30);
    const [tp, tped, pp, ez, fat, venc, prox] = await Promise.all([
      Produto.countDocuments(),
      Pedido.countDocuments(),
      Pedido.countDocuments({ status:"pendente" }),
      Produto.countDocuments({ estoque:0 }),
      Pedido.aggregate([{ $group:{ _id:null, total:{ $sum:"$total" } } }]),
      Produto.countDocuments({ validade:{ $lt: hoje } }),
      Produto.countDocuments({ validade:{ $gte: hoje, $lte: em30 } }),
    ]);
    res.json({
      totalProdutos:tp, totalPedidos:tped, pedidosPendentes:pp,
      estoqueZero:ez, faturamento:fat[0]?.total??0,
      vencidos:venc, proximosVencer:prox,
    });
  } catch(err){ res.status(500).json({ erro: err.message }); }
});

// ── CATEGORIAS ───────────────────────────────────────────────────────────────
app.get("/api/categorias", async (req, res) => {
  try {
    const [standalone, fromProds] = await Promise.all([
      Categoria.find().sort({ nome: 1 }),
      Produto.distinct("categoria"),
    ]);
    const standaloneNomes = standalone.map(c => c.nome);
    const merged = [...new Set([...standaloneNomes, ...fromProds])].sort();
    const countResult = await Produto.aggregate([{ $group: { _id: "$categoria", count: { $sum: 1 } } }]);
    const countMap = Object.fromEntries(countResult.map(r => [r._id, r.count]));
    const counts = merged.map(n => countMap[n] || 0);
    const standaloneMap = Object.fromEntries(standalone.map(c => [c.nome, c._id]));
    res.json(merged.map((nome, i) => ({ _id: standaloneMap[nome] || null, nome, count: counts[i] })));
  } catch(err){ res.status(500).json({ erro: err.message }); }
});

app.post("/api/categorias", async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome?.trim()) return res.status(400).json({ erro: "Nome obrigatório." });
    const nova = await Categoria.findOneAndUpdate(
      { nome: nome.trim() }, { nome: nome.trim() }, { upsert: true, new: true }
    );
    res.status(201).json(nova);
  } catch(err){ res.status(400).json({ erro: err.message }); }
});

app.delete("/api/categorias/:nome", async (req, res) => {
  try {
    const nome = decodeURIComponent(req.params.nome);
    const { acao, destino } = req.query;
    if (acao === "deletar") {
      await Produto.deleteMany({ categoria: nome });
    } else if (acao === "mover" && destino) {
      await Produto.updateMany({ categoria: nome }, { $set: { categoria: destino } });
    }
    await Categoria.deleteOne({ nome });
    res.json({ ok: true });
  } catch(err){ res.status(500).json({ erro: err.message }); }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀  http://localhost:${PORT}`));
