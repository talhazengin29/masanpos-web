import test from "node:test";
import assert from "node:assert/strict";
import { oneriSepetSatiriniGuncelle, oneriUrunFiyatiniGuncelle } from "../src/lib/oneriIndirimi.js";

test("açık öneri kartı güncel orana anında geçer", () => {
  assert.deepEqual(
    oneriUrunFiyatiniGuncelle({ id: 7, fiyat: 90, normalFiyat: 100, oneriIndirimYuzde: 10 }, { aktif: true, indirimYuzde: 25 }),
    { id: 7, fiyat: 75, normalFiyat: 100, oneriIndirimYuzde: 25 }
  );
});

test("indirim kapatılınca açık sepetteki öneri normal fiyata döner", () => {
  const sonuc = oneriSepetSatiriniGuncelle({
    id: 7, fiyat: 90, normalFiyat: 100, orijinalFiyat: 100,
    oneriIndirimYuzde: 10, uygulananIndirimKaynagi: "oneri", oneriReferanslari: ["imzali-referans"],
  }, { aktif: false, indirimYuzde: 10 });
  assert.equal(sonuc.fiyat, 100);
  assert.equal(sonuc.oneriIndirimYuzde, 0);
  assert.equal(sonuc.uygulananIndirimKaynagi, undefined);
});

test("oran değişince öneri fiyatı güncellenir ve daha iyi kampanya korunur", () => {
  const satir = { id: 7, fiyat: 90, normalFiyat: 100, orijinalFiyat: 100, oneriReferanslari: ["imzali-referans"] };
  assert.equal(oneriSepetSatiriniGuncelle(satir, { aktif: true, indirimYuzde: 25 }).fiyat, 75);
  const kampanyali = oneriSepetSatiriniGuncelle(satir, { aktif: true, indirimYuzde: 10 }, 20);
  assert.equal(kampanyali.fiyat, 80);
  assert.equal(kampanyali.uygulananIndirimKaynagi, "kampanya");
});
