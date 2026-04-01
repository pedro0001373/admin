---
name: Projeto Tabacaria JR - Visão Geral
description: Sistema completo de catálogo e gestão para Empório e Tabacaria JR — stack, arquitetura, features implementadas e estado atual
type: project
---

# Projeto: Empório e Tabacaria JR

Sistema web full-stack para gestão e venda de produtos de tabacaria/vapes localizado em Bertioga e Região.

**Why:** Negócio real com necessidade de catálogo online + painel administrativo para controle de estoque, pedidos e validade de produtos.  
**How to apply:** Ao sugerir mudanças, considerar que é um negócio real pequeno — priorizar praticidade, simplicidade e funcionalidade.

---

## Stack Tecnológica

- **Backend:** Node.js + Express 5 + Mongoose 9 (MongoDB Atlas)
- **Frontend:** HTML puro + Tailwind CSS (CDN) + Font Awesome 6 + Plus Jakarta Sans
- **Banco:** MongoDB Atlas (cluster `tabacariajr`, usuário `peres`)
- **Servidor:** `server.js` na raiz, porta 3000
- **Sem build tool** — arquivos estáticos servidos diretamente pelo Express

---

## Estrutura de Arquivos

```
C:\Users\Heloisa\Downloads\teste\
├── server.js          — API REST + servidor Express
├── index.html         — Catálogo público (vitrine para clientes)
├── admin.html         — Painel administrativo (área restrita)
├── seed.js            — Script para popular banco de dados inicial
├── catalogo.json      — Dados iniciais de produtos para seed
├── package.json       — Dependências: express, mongoose, cors, dotenv
├── node_modules/
└── imagens locais (cactus.jpeg, mango.jpeg, strawberry.jpeg, pianeapple.jpeg, ice kimg.jpeg, Design sem nome.jpg, + PNGs de produtos Elfbar/Ignite)
```

---

## Models MongoDB (server.js)

### Produto
| Campo | Tipo | Notas |
|---|---|---|
| nome | String (required) | |
| preco | Number (required, min:0) | |
| categoria | String (required) | |
| estoque | Number | default: 0 |
| imagem | String | URL ou caminho local |
| descricao | String | |
| lote | String | |
| fabricacao | Date | |
| quantidade_lote | Number | |
| validade | Date | Campo adicionado posteriormente |
| timestamps | auto | createdAt, updatedAt |

### Pedido
| Campo | Tipo | Notas |
|---|---|---|
| numero | Number | Auto-incrementado |
| cliente | String (required) | |
| endereco | String | |
| regiao | String | |
| pagamento | String | default: "Pix" |
| itens | Array | Lista de produtos com qty |
| subtotal | Number | |
| taxaEntrega | Number | |
| total | Number | |
| status | String (enum) | pendente / em andamento / entregue / cancelado |
| data | Date | default: Date.now |

---

## API REST (server.js)

| Método | Rota | Descrição |
|---|---|---|
| GET | /api/produtos | Lista todos os produtos |
| POST | /api/produtos | Cria novo produto |
| PUT | /api/produtos/:id | Atualiza produto |
| DELETE | /api/produtos/:id | Remove produto |
| GET | /api/pedidos | Lista todos os pedidos (ordem: mais recente) |
| POST | /api/pedidos | Cria pedido + decrementa estoque automaticamente |
| PUT | /api/pedidos/:id | Atualiza status do pedido |
| DELETE | /api/pedidos/:id | Remove pedido |
| GET | /api/stats | Estatísticas do dashboard |

**Helper `adaptProduto`:** converte campos PT → EN para o frontend (nome→name, preco→price, etc.)

**Stats endpoint retorna:** totalProdutos, totalPedidos, pedidosPendentes, estoqueZero, faturamento, vencidos, proximosVencer (próximos 30 dias)

---

## Frontend: index.html (Catálogo Público)

**Funcionalidades:**
- Header com imagem de fundo (Design sem nome.jpg), nome da loja, indicador "Aberto" animado, contador de pedidos
- Barra de busca por nome de produto
- Filtro por categorias (pills horizontais com scroll)
- Grid de produtos 2 colunas (cards com imagem, nome, preço, estoque)
- Modal de produto com detalhes e botão "Adicionar ao carrinho"
- Barra flutuante do carrinho (fixada no bottom) com contador e total
- Modal de checkout com:
  - Lista de itens com controle de quantidade
  - Campos: nome, endereço, região, forma de pagamento
  - Regiões de entrega com taxas: Retirada (R$0), Bertioga Centro (R$22), Rio da Praia/Maitinga/São Rafael (R$18), Riviera (R$18), Vista Linda/Indaiatuba (R$10), Guaratuba/Boraceia (R$40)
  - Formas de pagamento: Pix, Cartão (Maquininha), Dinheiro
  - Botão "Finalizar no WhatsApp" (envia pedido via WhatsApp)

**Sistema de carregamento de catálogo (multi-fallback):**
1. Tenta `/api/produtos` (servidor)
2. Fallback: `localStorage` (catalogProducts)
3. Fallback: `localStorage` default (catalogProductsDefault)
4. Fallback: catálogo embutido no HTML (50 produtos no `<script type="application/json">`)

**Catálogo embutido:** 50 produtos pré-cadastrados (PODS DESCARTAVEIS: Elfbar 40K King, IGNITE V80/V155/V300, Mix Ignite; Vinhos rosés; Bebidas Destiladas; Tabacos; Acessórios)

---

## Frontend: admin.html (Painel Administrativo)

**Sistema de login com 3 níveis de acesso:**
- **Funcionário** — acesso limitado (sem Dashboard, sem Pedidos)
- **Gestor** — acesso parcial (com Dashboard e Validade)
- **Administrador** — acesso total

**Abas do painel:**
1. **Dashboard** — cards de estatísticas (Produtos, Pedidos, Pendentes, Faturamento), alertas de validade, widget de estoque baixo, últimos pedidos
2. **Produtos** — tabela com busca e filtro por categoria, CRUD completo (modal de criação/edição com todos os campos incluindo lote, fabricação, quantidade_lote, validade)
3. **Pedidos** — tabela com histórico, atualização de status, exclusão
4. **Estoque** — visualização focada em estoque com alertas de baixo estoque
5. **Validade** — controle de validade com badges (Vencido / Próximo de Vencer / Válido / Sem data), relatório imprimível via Ctrl+P

**Badges de status:**
- Pedidos: pendente (amarelo), em andamento (azul), entregue (verde), cancelado (vermelho)
- Validade: b-venc (vermelho), b-prox (laranja), b-valid (verde), b-semval (cinza)
- Estoque: b-low (laranja), b-out (vermelho), b-ok (verde)

**Print CSS:** aba Validade tem CSS de impressão completo que oculta tudo exceto `#print-area` — gera relatório de validade formatado

---

## seed.js

Script one-time para popular o banco a partir de `catalogo.json`. Tem proteção contra duplicatas (aborta se já há produtos cadastrados). Mapeia campos EN→PT ao inserir.

---

## Estado Atual do Projeto (2026-04-01)

Sistema funcional e em uso. As principais features já implementadas:
- CRUD completo de produtos com campo `validade` (adicionado em evolução recente)
- Sistema de pedidos com auto-decremento de estoque
- Dashboard com stats em tempo real
- Controle de validade com alertas e relatório imprimível
- Catálogo público com carrinho e finalização por WhatsApp
- Multi-nível de acesso no painel admin
- Fallback offline para o catálogo (funciona sem servidor)
