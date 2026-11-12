
import { randomUUID } from "node:crypto";
import { now, transaction } from "./db.mjs";
import { audit, mutation } from "./audit.mjs";
import { quantity, RequestError } from "./inventory.mts";

export const isId = value => typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);

export function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError(400, "Dados inválidos.");
  return value;
}

export function field(value, label, max, required = false) {
  const text = typeof value === "string" ? value.trim() : "";
  if ((required && !text) || text.length > max) {
    throw new RequestError(400, "Confira o campo " + label + " (até " + max + " caracteres).");
  }
  return text;
}

function imageIds(db, value) {
  if (!Array.isArray(value) || value.length > 12 || value.some(id => !isId(id))) {
    throw new RequestError(400, "Informe até 12 imagens válidas.");
  }
  const ids = [...new Set(value)];
  const exists = db.prepare("SELECT 1 FROM media WHERE id = ?");
  if (ids.some(id => !exists.get(id))) throw new RequestError(400, "Uma imagem não foi encontrada.");
  return ids;
}

function specifications(value) {
  if (!Array.isArray(value) || value.length > 30) throw new RequestError(400, "Informe até 30 especificações.");
  return value.map(item => {
    if (!Array.isArray(item) || item.length !== 2) throw new RequestError(400, "Especificação inválida.");
    return [field(item[0], "nome da especificação", 80, true), field(item[1], "valor da especificação", 250, true)];
  });
}

export function videoLink(value) {
  const text = field(value, "link do vídeo", 700);
  if (!text) return "";
  let url;
  try { url = new URL(text); } catch { throw new RequestError(400, "Informe um link HTTPS para o vídeo."); }
  if (url.protocol !== "https:" || url.username || url.password) throw new RequestError(400, "Informe um link HTTPS para o vídeo.");
  return url.href;
}

export function saveProduct(db, id, input, actor) {
  const p = record(input);
  if (!["draft", "published", "hidden", "archived"].includes(p.visibility)) throw new RequestError(400, "Selecione a visibilidade.");
  const price = p.priceCents == null ? null : quantity(p.priceCents, 0, 100000000000);
  const publicPrice = p.publicPriceCents == null ? null : quantity(p.publicPriceCents, 0, 100000000000);
  if (p.showPrice && publicPrice === null) throw new RequestError(400, "Informe o preço público para exibi-lo no catálogo.");
  return transaction(db, () => {
    const before = id ? db.prepare("SELECT * FROM products WHERE id = ?").get(id) : null;
    if (id && !before) throw new RequestError(404, "Equipamento não encontrado.");
    const productId = id || randomUUID();
    const values = [
      field(p.name, "nome", 140, true), field(p.category, "categoria", 80, true),
      field(p.brand, "marca", 100), field(p.model, "modelo", 100),
      field(p.description, "descrição", 6000, true), JSON.stringify(specifications(p.specs)),
      JSON.stringify(imageIds(db, p.images)), videoLink(p.video), field(p.leadTime, "prazo", 240),
      price, p.showPrice === true ? 1 : 0, p.featured === true ? 1 : 0, p.visibility, now(),
      quantity(p.sortOrder ?? 0), publicPrice
    ];
    if (id) {
      db.prepare("UPDATE products SET name=?, category=?, brand=?, model=?, description=?, specs=?, images=?, video=?, lead_time=?, price_cents=?, show_price=?, featured=?, visibility=?, updated_at=?, sort_order=?, public_price_cents=? WHERE id=?").run(...values, id);
    } else {
      db.prepare("INSERT INTO products (id, name, category, brand, model, description, specs, images, video, lead_time, price_cents, show_price, featured, visibility, updated_at, sort_order, public_price_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(productId, ...values);
    }
    audit(db, actor, "product", productId, id ? "edit" : "create", before, db.prepare("SELECT * FROM products WHERE id = ?").get(productId));
    return { id: productId };
  });
}

export function duplicateProduct(db, actor, key, id, input) {
  const data = record(input);
  return mutation(db, key, ["duplicate-product", id], data, () => {
    const source = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!source) throw new RequestError(404, "Equipamento não encontrado.");
    const target = randomUUID();
    db.prepare("INSERT INTO products (id, name, category, brand, model, description, specs, images, video, lead_time, price_cents, show_price, featured, visibility, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', NULL, 0, 0, 'draft', ?)")
      .run(target, field(data.name, "nome da cópia", 140, true), source.category, source.brand, source.model,
        data.copyDetails === true ? source.description : "", data.copyDetails === true ? source.specs : "[]",
        data.copyPhotos === true ? source.images : "[]", now());
    audit(db, actor, "product", target, "duplicate", { sourceId: id }, db.prepare("SELECT * FROM products WHERE id = ?").get(target));
    return { id: target };
  });
}

export function saveVariant(db, productId, id, input, actor) {
  const variant = record(input);
  const color = field(variant.color, "cor", 70, true);
  const colorKey = color.normalize("NFC").toLocaleLowerCase("pt-BR");
  const hex = field(variant.hex, "código da cor", 7);
  if (hex && !/^#[a-f\d]{6}$/i.test(hex)) throw new RequestError(400, "Use um código de cor como #DB1A22.");
  return transaction(db, () => {
    if (!db.prepare("SELECT id FROM products WHERE id = ?").get(productId)) throw new RequestError(404, "Equipamento não encontrado.");
    const duplicate = db.prepare("SELECT id FROM variants WHERE product_id = ? AND color_key = ?").get(productId, colorKey);
    if (duplicate && duplicate.id !== id) throw new RequestError(409, "Essa cor já está cadastrada para o equipamento.");
    const images = JSON.stringify(imageIds(db, variant.images));
    if (id) {
      const before = db.prepare("SELECT * FROM variants WHERE id=? AND product_id=?").get(id, productId);
      const result = db.prepare("UPDATE variants SET color=?, color_key=?, hex=?, images=? WHERE id=? AND product_id=?").run(color, colorKey, hex, images, id, productId);
      if (!result.changes) throw new RequestError(404, "Cor não encontrada.");
      audit(db, actor, "variant", id, "edit", before, db.prepare("SELECT * FROM variants WHERE id=?").get(id));
      return { id };
    }
    const newId = randomUUID();
    db.prepare("INSERT INTO variants (id, product_id, color, color_key, hex, images) VALUES (?, ?, ?, ?, ?, ?)").run(newId, productId, color, colorKey, hex, images);
    audit(db, actor, "variant", newId, "create", null, db.prepare("SELECT * FROM variants WHERE id=?").get(newId));
    return { id: newId };
  });
}

export function products(db, { admin = false, id = null } = {}) {
  const rows = db.prepare(
    "SELECT * FROM products WHERE (? OR visibility = 'published') AND (? IS NULL OR id = ?) ORDER BY sort_order, name COLLATE NOCASE"
  ).all(Number(admin), id, id);
  const variants = db.prepare("SELECT v.*, s.ready, s.pending FROM variants v JOIN variant_stock s ON s.id = v.id WHERE v.product_id = ? ORDER BY v.rowid");
  const unitPhotos = db.prepare("SELECT DISTINCT media_id, kind FROM public_unit_photos WHERE variant_id = ? ORDER BY kind, media_id");
  const results = rows.map(row => {
    const product = {
      id: row.id, code: row.id.slice(0, 8).toUpperCase(), name: row.name, category: row.category,
      brand: row.brand, model: row.model, description: row.description, specs: JSON.parse(row.specs),
      images: JSON.parse(row.images), video: row.video, leadTime: row.lead_time,
      featured: Boolean(row.featured),
      variants: variants.all(row.id).map(v => {
        const photos = admin ? [] : unitPhotos.all(v.id);
        const images = [...new Set([...JSON.parse(v.images), ...photos.map(photo => photo.media_id)])];
        return { id: v.id, color: v.color, hex: v.hex, ready: v.ready, pending: v.pending, images,
          photoKinds: Object.fromEntries(photos.map(photo => [photo.media_id, photo.kind])) };
      })
    };
    product.stock = product.variants.reduce((stock, v) => ({
      ready: stock.ready + v.ready, pending: stock.pending + v.pending
    }), { ready: 0, pending: 0 });
    if (admin) return { ...product, visibility: row.visibility, sortOrder: row.sort_order,
      priceCents: row.price_cents, publicPriceCents: row.public_price_cents, showPrice: Boolean(row.show_price) };
    return row.show_price && row.public_price_cents !== null ? { ...product, publicPriceCents: row.public_price_cents } : product;
  });
  if (!admin) results.sort((a, b) => Number(b.stock.ready + b.stock.pending > 0) - Number(a.stock.ready + a.stock.pending > 0));
  return results;
}

export function storeImage(db, mime, bytes) {
  const signature = Buffer.from(bytes);
  const valid = mime === "image/png"
    ? signature.length >= 45 && signature.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
      && signature.toString("ascii", 12, 16) === "IHDR" && signature.subarray(-8, -4).toString("ascii") === "IEND"
    : mime === "image/jpeg"
      ? signature.length >= 16 && signature[0] === 255 && signature[1] === 216 && signature[2] === 255
        && signature.at(-2) === 255 && signature.at(-1) === 217
      : mime === "image/webp" && signature.length >= 20 && signature.toString("ascii", 0, 4) === "RIFF"
        && signature.toString("ascii", 8, 12) === "WEBP" && signature.readUInt32LE(4) + 8 === signature.length
        && ["VP8 ", "VP8L", "VP8X"].includes(signature.toString("ascii", 12, 16));
  if (!valid) throw new RequestError(415, "Envie uma imagem JPEG, PNG ou WebP válida.");
  const id = randomUUID();
  db.prepare("INSERT INTO media VALUES (?, ?, ?)").run(id, mime, bytes);
  return { id };
}

export function getImage(db, id, admin) {
  return db.prepare(
    "SELECT mime, body FROM media WHERE id = ? AND (? OR EXISTS ("
    + "SELECT 1 FROM products p JOIN json_each(p.images) i ON i.value = media.id WHERE p.visibility = 'published'"
    + " UNION ALL SELECT 1 FROM variants v JOIN products p ON p.id = v.product_id JOIN json_each(v.images) i ON i.value = media.id WHERE p.visibility = 'published'"
    + " UNION ALL SELECT 1 FROM public_unit_photos WHERE media_id = media.id))"
  ).get(id, Number(admin));
}
