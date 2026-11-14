import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../js/cart.js", import.meta.url), "utf8");
const variants = [
  { id: "white", color: "Branca", ready: 1, pending: 2 },
  { id: "blue", color: "Azul", ready: 0, pending: 1 },
  { id: "grey", color: "Cinza", ready: 0, pending: 0 }
];
const mixer = { id: "mixer", code: "REN-001", name: "Masseira", stock: { ready: 1, pending: 3 }, variants };
const soldOut = { id: "divider", code: "REN-002", name: "Divisora", stock: { ready: 0, pending: 0 }, variants: [] };

function prepare(saved = []) {
  let result = [mixer, soldOut];
  const requests = [];
  const storage = entries => {
    const map = new Map(entries);
    return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) };
  };
  const window = {
    localStorage: storage([["renovapan_cart_v1", JSON.stringify(saved)]]),
    sessionStorage: storage(),
    RenovapanAPI: {
      async get(url, options) {
        requests.push([url, options.cache]);
        if (result instanceof Error) throw result;
        return { products: result };
      }
    }
  };
  runInNewContext(script, { window });
  return { cart: window.RenovapanCart, requests, serve: products => { result = products; },
    savedItems: () => JSON.parse(window.localStorage.getItem("renovapan_cart_v1")) };
}

function message(quote) {
  const url = new URL(quote.url);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/5511952031535");
  return url.searchParams.get("text");
}

test("lista conserva itens ao recarregar, remove por cor e limpa todos", async () => {
  const original = prepare();
  const renamed = { ...mixer, name: "Masseira Açúcar & Pão" };
  original.cart.addItem(renamed, 3, { variantId: "white", condition: "ready" });
  original.cart.addItem(renamed, 2, { variantId: "blue", condition: "pending" });
  original.cart.addItem(soldOut);
  const reloaded = prepare(original.savedItems());
  reloaded.serve([renamed, soldOut]);
  const lines = reloaded.cart.getItems();
  assert.equal(lines.length, 3);
  reloaded.cart.setQuantity(lines.find(item => item.product.color === "Branca").key, 0);
  const text = message(await reloaded.cart.prepareQuote());
  assert.match(text, /Masseira Açúcar & Pão/);
  assert.match(text, /Cor: Azul.*Quantidade desejada: 2/);
  assert.doesNotMatch(text, /Cor: Branca/);
  assert.match(text, /Divisora/);
  reloaded.cart.clear();
  assert.deepEqual(reloaded.savedItems(), []);
  assert.equal((await reloaded.cart.prepareQuote()).url, undefined);
});

test("lista mantém linhas por cor e condição, com excedente separado da disponibilidade", async () => {
  const { cart, requests } = prepare();
  cart.addItem(mixer);
  cart.addItem(mixer, 3, { variantId: "white", condition: "ready" });
  cart.addItem(mixer, 1, { variantId: "white", condition: "pending" });
  cart.addItem(mixer, 1, { variantId: "blue", condition: "pending" });
  assert.equal(cart.getItems().length, 4);
  assert.equal(new Set(cart.getItems().map(item => item.key)).size, 4);
  assert.equal(cart.getItemQuantity(mixer.id), 1);
  assert.equal(cart.getItemQuantity(mixer.id, { variantId: "white", condition: "ready" }), 3);
  const quote = await cart.prepareQuote();
  assert.equal(quote.productCount, 1);
  const text = message(quote);
  assert.match(text, /Masseira · Cód\. REN-001/);
  assert.match(text, /Cor: Branca \| Condição: Pronta entrega \| Quantidade desejada: 3/);
  assert.match(text, /Pronta entrega: 1 · Sob encomenda: 2\n2 unidade\(s\) acima do saldo/);
  assert.match(text, /Cor: Branca \| Condição: Sob encomenda \| Quantidade desejada: 1/);
  assert.match(text, /Cor: Azul \| Condição: Sob encomenda \| Quantidade desejada: 1/);
  assert.match(text, /Cor: A definir/);
  assert.deepEqual(requests, [["/api/catalog", "no-store"]]);
  assert.deepEqual(mixer.stock, { ready: 1, pending: 3 });
});

test("lista mantém consulta futura para equipamento e cor esgotados", async () => {
  const { cart } = prepare();
  cart.addItem(soldOut, 2, { condition: "future" });
  cart.addItem(mixer, 1, { variantId: "grey", condition: "future" });
  const quote = await cart.prepareQuote();
  assert.equal(quote.productCount, 2);
  const text = message(quote);
  assert.match(text, /Divisora · Cód\. REN-002/);
  assert.match(text, /Cor: Cinza \| Condição: Consulta de disponibilidade futura/);
  assert.match(text, /Sem estoque · Pronta entrega: 0 · Sob encomenda: 0/);
  assert.match(text, /possível aquisição e reforma futura/);
});

test("revalida no envio, pede revisão de estoque novo e bloqueia cor removida", async () => {
  const { cart, serve, requests } = prepare();
  cart.addItem(mixer, 1, { variantId: "white", condition: "ready" });
  assert.equal((await cart.revalidate()).changed, false);
  serve([{ ...mixer, variants: [{ ...variants[0], ready: 0 }, ...variants.slice(1)] }]);
  const stale = await cart.prepareQuote();
  assert.equal(stale.changed, true);
  assert.equal(stale.url, undefined);
  assert.equal(cart.getItems()[0].excess, 1);
  assert.match(message(await cart.prepareQuote()), /Pronta entrega: 0 · Sob encomenda: 2/);
  serve([{ ...mixer, variants: variants.slice(1) }]);
  for (let attempt = 0; attempt < 2; attempt++) {
    const missing = await cart.prepareQuote();
    assert.equal(missing.blocked, true);
    assert.equal(missing.url, undefined);
    assert.equal(cart.getItems()[0].issue, "color");
  }
  assert.equal(requests.length, 5);
});

test("itens legados despublicados não são enviados e falha de rede impede cotação", async () => {
  const { cart, serve } = prepare([
    { id: mixer.id, name: mixer.name, quantity: 1, color: "Branca" },
    { id: soldOut.id, name: soldOut.name, quantity: 1 }
  ]);
  serve([soldOut]);
  assert.equal((await cart.prepareQuote()).blocked, true);
  const missing = cart.getItems().find(item => item.issue === "product");
  assert.equal(missing.product.id, mixer.id);
  cart.setQuantity(missing.key, 0);
  const text = message(await cart.prepareQuote());
  assert.match(text, /Divisora/);
  assert.doesNotMatch(text, /Masseira/);
  serve(new Error("fora do ar"));
  await assert.rejects(cart.prepareQuote(), /fora do ar/);
});

test("lista aceita itens legados com cor após revisão sem juntar linhas sem cor", async () => {
  const { cart } = prepare([
    { id: mixer.id, name: mixer.name, quantity: 1, color: "Branca" },
    { id: mixer.id, name: mixer.name, quantity: 2 }
  ]);
  assert.equal((await cart.prepareQuote()).changed, true);
  assert.equal(cart.getItems().length, 2);
  const text = message(await cart.prepareQuote());
  assert.match(text, /Cor: Branca.*Quantidade desejada: 1/);
  assert.match(text, /Cor: A definir.*Quantidade desejada: 2/);
});
