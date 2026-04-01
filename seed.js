const mongoose = require("mongoose");
const produtos  = require("./catalogo.json");

mongoose.connect("mongodb://peres:12345@ac-pyte4gt-shard-00-00.ygdges0.mongodb.net:27017,ac-pyte4gt-shard-00-01.ygdges0.mongodb.net:27017,ac-pyte4gt-shard-00-02.ygdges0.mongodb.net:27017/?ssl=true&replicaSet=atlas-ob5pqr-shard-0&authSource=admin&appName=tabacariajr")
  .then(async () => {
    console.log("✅  MongoDB conectado");

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
      validade:        { type: Date,    default: null },
    }, { timestamps: true });

    const Produto = mongoose.model("Produto", ProdutoSchema);

    const existentes = await Produto.countDocuments();
    if (existentes > 0) {
      console.log(`⚠️  Já existem ${existentes} produto(s) no banco. Abortando para evitar duplicatas.`);
      console.log("   Se quiser reimportar, apague os documentos primeiro e rode novamente.");
      await mongoose.disconnect();
      return;
    }

    const docs = produtos.map(p => ({
      nome:      p.name,
      preco:     p.price,
      categoria: p.category,
      estoque:   p.stock ?? 0,
      imagem:    p.img   ?? "",
      descricao: p.desc  ?? "",
    }));

    await Produto.insertMany(docs);
    console.log(`✅  ${docs.length} produtos inseridos com sucesso!`);
    await mongoose.disconnect();
  })
  .catch(err => {
    console.error("❌  Erro:", err.message);
    process.exit(1);
  });
