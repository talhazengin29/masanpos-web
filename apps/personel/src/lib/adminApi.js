const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export function aktifIsletmeSlug() {
  const temel = String(import.meta.env.BASE_URL || "/").replace(/^\/+|\/+$/g, "");
  const parcalar = window.location.pathname.split("/").filter(Boolean);
  const temelParcalari = temel ? temel.split("/") : [];
  return decodeURIComponent(parcalar.slice(temelParcalari.length)[0] || "").trim().toLowerCase();
}

export const adminTokenAnahtari = (slug = aktifIsletmeSlug()) => `burger-plus-admin-token_${String(slug || "").trim().toLowerCase()}`;

export function erisimTokeniniCoz(token) {
  try {
    const parca = String(token || "").split(".")[1];
    if (!parca) return null;
    const duzeltilmis = parca.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parca.length / 4) * 4, "=");
    const veri = JSON.parse(atob(duzeltilmis));
    if (veri.tip !== "impersonation" || !veri.isletmeSlug || !veri.impersonatedBy) return null;
    if (Number(veri.exp || 0) * 1000 <= Date.now()) return null;
    return veri;
  } catch {
    return null;
  }
}

export const adminToken = {
  al: (slug) => sessionStorage.getItem(adminTokenAnahtari(slug)),
  kaydet: (token, slug) => sessionStorage.setItem(adminTokenAnahtari(slug), token),
  sil: (slug) => sessionStorage.removeItem(adminTokenAnahtari(slug)),
};

// isletmeSlugu: URL'de henüz slug yokken (ör. tek panelden giriş akışının 2FA
// adımı) hangi işletme için istek atıldığını açıkça belirtmek için kullanılır;
// verilmezse mevcut davranış gibi aktif URL'deki slug kullanılır.
async function istekAt(yol, secenekler = {}) {
  const { isletmeBasligi = true, isletmeSlugu, ...fetchSecenekleri } = secenekler;
  const headers = new Headers(fetchSecenekleri.headers || {});
  if (isletmeBasligi) {
    const slug = isletmeSlugu || aktifIsletmeSlug();
    if (!slug) throw new Error("İşletme belirtilmedi.");
    headers.set("X-Isletme", slug);
    const token = adminToken.al(slug);
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${BACKEND_URL}${yol}`, { ...fetchSecenekleri, headers });
}

async function jsonOku(r) {
  const tip = r.headers.get("content-type") || "";
  if (!tip.includes("application/json")) {
    await r.text().catch(() => "");
    throw new Error(`Sunucu geçersiz yanıt döndürdü (HTTP ${r.status}).`);
  }
  return r.json();
}

async function nakitIstegi(yol, secenekler = {}) {
  const r = await istekAt(`/api/nakit${yol}`, secenekler);
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "Nakit işlemi tamamlanamadı.");
  return veri;
}

function idempotencyAnahtari(kapsam, yol) {
  const slug = aktifIsletmeSlug();
  const depoAnahtari = `bp_idempotency_${slug}_${kapsam}_${yol.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const simdi = Date.now();
  try {
    const mevcut = JSON.parse(sessionStorage.getItem(depoAnahtari) || "null");
    const yas = simdi - Number(mevcut?.olusturma || 0);
    const tamamlanmisYas = simdi - Number(mevcut?.tamamlandi || 0);
    const tekrarKullanilabilir = mevcut?.tamamlandi
      ? tamamlanmisYas < 30_000
      : yas < 24 * 60 * 60 * 1000;
    if (mevcut?.anahtar && tekrarKullanilabilir) {
      return { depoAnahtari, anahtar: mevcut.anahtar };
    }
  } catch { /* Depo kapalıysa bu istek için geçici anahtar kullanılır. */ }
  const rastgele = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const kayit = { depoAnahtari, anahtar: `${kapsam}:${rastgele}` };
  try { sessionStorage.setItem(depoAnahtari, JSON.stringify({ anahtar: kayit.anahtar, olusturma: simdi })); } catch { /* noop */ }
  return kayit;
}

async function idempotentNakitIstegi(kapsam, yol, secenekler = {}) {
  const kayit = idempotencyAnahtari(kapsam, yol);
  const headers = new Headers(secenekler.headers || {});
  headers.set("Idempotency-Key", kayit.anahtar);
  const sonuc = await nakitIstegi(yol, { ...secenekler, headers });
  try {
    const mevcut = JSON.parse(sessionStorage.getItem(kayit.depoAnahtari) || "null");
    if (mevcut?.anahtar === kayit.anahtar) {
      sessionStorage.setItem(kayit.depoAnahtari, JSON.stringify({ ...mevcut, tamamlandi: Date.now() }));
    }
  } catch { /* noop */ }
  return sonuc;
}

export const nakitMasalariniGetir = async () => (await nakitIstegi("/masalar")).masalar;
export const nakitMasasiniAc = async (masaNo) => (await nakitIstegi(`/masalar/${encodeURIComponent(masaNo)}/ac`, { method: "POST" })).masa;
export const nakitSiparisiOnayla = async (id) => (await idempotentNakitIstegi("nakit-onay", `/siparis/${encodeURIComponent(id)}/onayla`, { method: "POST" })).siparis;
export const nakitSiparisiReddet = async (id) => (await idempotentNakitIstegi("nakit-red", `/siparis/${encodeURIComponent(id)}/reddet`, { method: "POST" })).siparis;
export const nakitSiparisiTahsilEt = async (id) => (await idempotentNakitIstegi("nakit-tahsil", `/siparis/${encodeURIComponent(id)}/tahsil`, { method: "POST" })).siparis;

async function personelCagriIstegi(yol = "", secenekler = {}) {
  const r = await istekAt(`/api/personel/personel-cagrilari${yol}`, secenekler);
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "Personel çağrısı işlemi tamamlanamadı.");
  return veri;
}

export const personelCagrilariniGetir = async () => (await personelCagriIstegi()).cagrilar || [];
export const personelCagrisiGuncelle = async (id, durum) => (await personelCagriIstegi(`/${encodeURIComponent(id)}`, {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durum }),
})).cagri;

async function rezervasyonIstegi(yol = "", secenekler = {}) {
  const r = await istekAt(`/api/personel/rezervasyonlar${yol}`, secenekler);
  if (r.status === 204) return null;
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "Rezervasyon işlemi tamamlanamadı.");
  return veri;
}
export const rezervasyonlariGetir = async (filtre = {}) => {
  const q = new URLSearchParams(Object.entries(filtre).filter(([, deger]) => deger));
  return (await rezervasyonIstegi(q.size ? `?${q}` : "")).rezervasyonlar || [];
};
export const rezervasyonKaydet = async (veri) => (await rezervasyonIstegi(veri.id ? `/${encodeURIComponent(veri.id)}` : "", {
  method: veri.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(veri),
})).rezervasyon;
export const rezervasyonDurumuGuncelle = async (id, durum) => (await rezervasyonIstegi(`/${encodeURIComponent(id)}`, {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durum }),
})).rezervasyon;
export const rezervasyonSil = async (id) => rezervasyonIstegi(`/${encodeURIComponent(id)}`, { method: "DELETE" });

async function salonKrokisiIstegi() {
  const r = await istekAt("/api/personel/salon-krokisi");
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "Salon krokisi alınamadı.");
  return veri.kroki;
}
export const salonKrokisiniGetir = salonKrokisiIstegi;

async function kasaCuzdanIstegi(yol, secenekler = {}) {
  const r = await istekAt(`/api/kasa/cuzdan${yol}`, secenekler);
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "Cüzdan işlemi tamamlanamadı.");
  return veri;
}

export const kasaCuzdanMusteriAra = async (arama) => (await kasaCuzdanIstegi(`/musteriler?q=${encodeURIComponent(arama)}`)).musteriler;
export const kasaCuzdanSonYuklemeler = async () => kasaCuzdanIstegi("/son-yuklemeler");
export const kasaCuzdanYukle = async (veri) => (await kasaCuzdanIstegi("/yukle", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(veri),
})).yukleme;

export async function isletmeBilgisiniGetir(slug) {
  const erisimTokeni = adminToken.al(slug);
  const r = await istekAt(`/api/isletme/${encodeURIComponent(String(slug || "").trim().toLowerCase())}`, {
    isletmeBasligi: false,
    headers: erisimTokeni ? { Authorization: `Bearer ${erisimTokeni}` } : {},
  });
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "İşletme bulunamadı.");
  return { ...veri.isletme, tema: veri.tema };
}

// Tek giriş noktası: e-posta+şifre doğrulanır, ekran hesabın backend'deki
// gerçek rolüne göre otomatik belirlenir (bkz. App.jsx#ROL_EKRANI) — burada
// "hangi panel" diye bir seçim/karşılaştırma yapılmaz.
export async function girisYap(email, sifre) {
  const r = await istekAt("/api/giris", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, sifre }) });
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "Giriş yapılamadı.");
  if (veri.ikiFaktorGerekli || veri.sifreDegisimGerekli) return veri;
  return girisiTamamla(veri);
}

function girisiTamamla(veri, slug) {
  adminToken.kaydet(veri.token, slug);
  return veri.kullanici;
}

export async function personelIkiFaktorGirisiniTamamla(ikiFaktorToken, kod) {
  const r = await istekAt("/api/giris/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ikiFaktorToken, kod }) });
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "Doğrulama kodu geçersiz.");
  return girisiTamamla(veri);
}

// Geçici şifreyle giren admin/personel zorunlu olarak kendi şifresini
// belirler (bkz. backend auth.js#girisYap sifreDegisimGerekli dalı).
export async function ilkSifreBelirle(gecisToken, yeniSifre, isletmeSlugu) {
  const r = await istekAt("/api/giris/ilk-sifre", {
    isletmeSlugu,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gecisToken, yeniSifre }),
  });
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "Şifre belirlenemedi.");
  return girisiTamamla(veri, isletmeSlugu);
}

// Tek panelden giriş: hangi işletmeye ait olduğu URL'den değil, girilen
// e-postadan bulunur (backend: /api/giris-genel, isletmeMiddleware'i atlar).
// Başarılı yanıt hangi işletmeye ait olduğunu (isletmeSlug) da içerir; GenelGiris.jsx
// bunu görüp `/{isletmeSlug}`'a yönlendirir.
export async function girisGenel(email, sifre) {
  const r = await istekAt("/api/giris-genel", {
    isletmeBasligi: false,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, sifre }),
  });
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "Giriş yapılamadı.");
  if (veri.ikiFaktorGerekli || veri.sifreDegisimGerekli) return veri;
  return { kullanici: girisiTamamla(veri, veri.isletmeSlug), isletmeSlug: veri.isletmeSlug };
}

export async function ikiFaktorGirisiniTamamlaGenel(ikiFaktorToken, kod, isletmeSlug) {
  const r = await istekAt("/api/giris/2fa", {
    isletmeSlugu: isletmeSlug,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ikiFaktorToken, kod }),
  });
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "Doğrulama kodu geçersiz.");
  return { kullanici: girisiTamamla(veri, isletmeSlug), isletmeSlug };
}

export async function ilkYerelAdminOlustur(email, sifre) {
  const r = await istekAt("/api/yerel-admin-kurulum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, sifre }) });
  const veri = await jsonOku(r);
  if (!r.ok) throw new Error(veri.hata || "İlk yönetici oluşturulamadı.");
  return veri;
}

export async function yerelAdminDurumu() {
  const r = await istekAt("/api/yerel-admin-durum");
  if (!r.ok) return false;
  return (await jsonOku(r)).kurulumGerekli === true;
}

export async function personelOturumunuDogrula() {
  const token = adminToken.al();
  if (!token) return null;
  const impersonation = erisimTokeniniCoz(token);
  const r = await istekAt(impersonation ? "/api/admin/ben" : "/api/ben");
  const veri = await jsonOku(r).catch(() => ({}));
  if ([401, 403].includes(r.status)) {
    adminToken.sil();
    return null;
  }
  if (!r.ok) throw new Error(veri.hata || "Personel oturumu doğrulanamadı.");
  return veri.kullanici ? { ...veri.kullanici, impersonation: veri.impersonation || null } : null;
}

export async function adminIstek(yol, secenekler = {}) {
  const r = await istekAt(`/api/admin${yol}`, {
    ...secenekler,
    headers: { "Content-Type": "application/json", ...(secenekler.headers || {}) },
  });
  const veri = await jsonOku(r).catch(() => ({}));
  if (!r.ok) {
    const hata = new Error(veri.hata || ([401, 403].includes(r.status)
      ? "Yönetici oturumunuz geçersiz veya başka bir işletmeye ait. Lütfen yeniden giriş yapın."
      : r.status === 429 ? "Çok fazla istek gönderildi. Birkaç saniye bekleyin." : `${yol} verisi alınamadı (HTTP ${r.status}).`));
    hata.status = r.status;
    hata.yol = yol;
    if ([401, 403].includes(r.status)) {
      adminToken.sil();
      window.dispatchEvent(new CustomEvent("personel-oturum-bitti"));
    }
    throw hata;
  }
  return veri;
}

export const jsonGonder = (method, body) => ({ method, body: JSON.stringify(body) });

const DESTEKLENEN_GORSELLER = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/bmp"]);
export async function gorselYukle(dosya) {
  if (!dosya || !DESTEKLENEN_GORSELLER.has(dosya.type)) throw new Error("PNG, JPG/JPEG, WebP, GIF, AVIF veya BMP formatında bir görsel seçebilirsin.");
  if (dosya.size > 5 * 1024 * 1024) throw new Error("Görsel en fazla 5 MB olabilir.");
  return adminIstek("/gorseller", { method: "POST", headers: { "Content-Type": dosya.type }, body: dosya });
}

const MENU_AKTARIM_GORSELLERI = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
export async function menuGorseliniAnalizEt(dosya) {
  if (!dosya || !MENU_AKTARIM_GORSELLERI.has(dosya.type)) throw new Error("Menü dosyası PNG, JPG/JPEG, WebP veya PDF formatında olmalıdır.");
  const sinir = dosya.type === "application/pdf" ? 8 : 5;
  if (dosya.size > sinir * 1024 * 1024) throw new Error(`Menü ${dosya.type === "application/pdf" ? "PDF'i" : "fotoğrafı"} en fazla ${sinir} MB olabilir.`);
  return adminIstek("/menu-aktarim/analiz", { method: "POST", headers: { "Content-Type": dosya.type }, body: dosya });
}

const DESTEKLENEN_GIDER_BELGELERI = new Set(["image/png", "image/jpeg", "image/webp"]);
export async function giderBelgesiYukle(dosya) {
  if (!dosya || !DESTEKLENEN_GIDER_BELGELERI.has(dosya.type)) throw new Error("Fiş veya fatura PNG, JPG/JPEG ya da WebP formatında olmalıdır.");
  if (dosya.size > 5 * 1024 * 1024) throw new Error("Gider belgesi en fazla 5 MB olabilir.");
  return adminIstek("/gider-belgesi", { method: "POST", headers: { "Content-Type": dosya.type }, body: dosya });
}

export function temaKaydet(tema) {
  return adminIstek("/tema", jsonGonder("PUT", tema));
}

const DESTEKLENEN_LOGOLAR = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
export async function logoYukle(dosya) {
  if (!dosya || !DESTEKLENEN_LOGOLAR.has(dosya.type)) throw new Error("Logo PNG, JPG/JPEG, WebP veya SVG formatında olmalı.");
  if (dosya.size > 2 * 1024 * 1024) throw new Error("Logo en fazla 2 MB olabilir.");
  const r = await istekAt("/api/admin/logo", { method: "POST", headers: { "Content-Type": dosya.type }, body: dosya });
  const veri = await jsonOku(r).catch(() => ({}));
  if (!r.ok) throw new Error(veri.hata || `Logo yüklenemedi (HTTP ${r.status}).`);
  return veri;
}

export async function temaArkaPlaniYukle(dosya) {
  if (!dosya || !DESTEKLENEN_GORSELLER.has(dosya.type)) throw new Error("PNG, JPG/JPEG, WebP, GIF, AVIF veya BMP formatinda bir arka plan secmelisin.");
  if (dosya.size > 5 * 1024 * 1024) throw new Error("Arka plan gorseli en fazla 5 MB olabilir.");
  const r = await istekAt("/api/admin/tema-arka-plani", { method: "POST", headers: { "Content-Type": dosya.type }, body: dosya });
  const veri = await jsonOku(r).catch(() => ({}));
  if (!r.ok) throw new Error(veri.hata || `Arka plan yuklenemedi (HTTP ${r.status}).`);
  return veri;
}

export async function temaArkaPlaniSil() {
  const r = await istekAt("/api/admin/tema-arka-plani", { method: "DELETE" });
  const veri = await jsonOku(r).catch(() => ({}));
  if (!r.ok) throw new Error(veri.hata || `Arka plan kaldirilamadi (HTTP ${r.status}).`);
  return veri;
}
