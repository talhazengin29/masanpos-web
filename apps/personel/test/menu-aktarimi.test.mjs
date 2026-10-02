import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const admin = await readFile(new URL("../src/screens/Admin.jsx", import.meta.url), "utf8");
const api = await readFile(new URL("../src/lib/adminApi.js", import.meta.url), "utf8");

test("menü fotoğrafı mobil kameradan seçilip analiz endpointine gönderilir", () => {
  assert.match(admin, /capture="environment"/);
  assert.match(api, /\/menu-aktarim\/analiz/);
  assert.match(api, /application\/pdf/);
  assert.match(api, /sinir \* 1024 \* 1024/);
});

test("OCR sonucu doğrudan yayınlanmayıp düzenlenebilir pasif taslak olarak kaydedilir", () => {
  assert.match(admin, /\/menu-aktarim\/onayla/);
  assert.match(admin, /Pasif taslakları kaydet/);
  assert.match(admin, /menuUrunGuncelle/);
  assert.match(admin, /urun\.secili/);
});
