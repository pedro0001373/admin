/**
 * Migração: converte imagens base64 no MongoDB → URLs do Cloudinary
 * Uso: node migrate-images.js
 */
require("dotenv").config();
const mongoose   = require("mongoose");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD  || "dyjhrnazu",
  api_key:    process.env.CLOUDINARY_KEY    || "611456872451991",
  api_secret: process.env.CLOUDINARY_SECRET || "8a7191NhOBNwy5ZwXlzGtrOwkVU",
});

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://peres:12345@ac-pyte4gt-shard-00-00.ygdges0.mongodb.net:27017,ac-pyte4gt-shard-00-01.ygdges0.mongodb.net:27017,ac-pyte4gt-shard-00-02.ygdges0.mongodb.net:27017/?ssl=true&replicaSet=atlas-ob5pqr-shard-0&authSource=admin&appName=tabacariajr";

const ProdutoSchema = new mongoose.Schema({
  nome:   String,
  imagem: String,
}, { timestamps: true, strict: false });

const Produto = mongoose.model("Produto", ProdutoSchema);

async function migrate() {
  await mongoose.connect(MONGODB_URI, { maxPoolSize: 2 });
  console.log("✅ MongoDB conectado");

  // Buscar apenas _id e nome dos que têm base64 (sem carregar a imagem inteira na listagem)
  const ids = await Produto.find({ imagem: /^data:image/ }).select("_id nome").lean();
  console.log(`📦 ${ids.length} produto(s) com imagem base64 para migrar\n`);

  let ok = 0, fail = 0;
  for (const { _id, nome } of ids) {
    try {
      // Carrega imagem individualmente
      const doc = await Produto.findById(_id).select("imagem").lean();
      if (!doc?.imagem?.startsWith("data:")) { console.log(`⏭️  ${nome} — já migrado`); continue; }

      process.stdout.write(`⬆️  ${nome} (${Math.round(doc.imagem.length / 1024)}KB)... `);
      const result = await cloudinary.uploader.upload(doc.imagem, {
        folder: "tabacaria-jr",
        public_id: _id.toString(),
        overwrite: true,
        transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto", fetch_format: "auto" }],
      });

      await Produto.findByIdAndUpdate(_id, { imagem: result.secure_url });
      console.log(`✅ ${result.secure_url}`);
      ok++;
    } catch (err) {
      console.log(`❌ ERRO: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n🏁 Migração concluída: ${ok} OK, ${fail} falhas`);
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => { console.error("❌ Fatal:", err.message); process.exit(1); });
