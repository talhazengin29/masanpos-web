import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useIsletmeNavigate } from "../hooks/useIsletmeNavigate";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../context/AppContext";
import { useSuruklenebilir } from "../hooks/useSuruklenebilir";
import { IconPlus, IconSearch, IconFilter } from "../components/Icons";
import OrtakHeader from "../components/OrtakHeader";
import MasaZekasi, { MasaZekasiKart } from "../components/MasaZekasi";
import { siraliKonteyner, siraliOge, asagiAcilma } from "../lib/animasyonlar";
import { guvenliMetin } from "../lib/dogrulama";
import { useTema } from "../context/TemaContext";
import { useDil } from "../dil/DilContext";
import "./Home.css";

// Arama çubuğundaki filtre düğmesinin sıralama seçenekleri
const siralamalar = [
  { id: "onerilen", anahtar: "home.recommended" },
  { id: "artan", anahtar: "home.priceAsc" },
  { id: "azalan", anahtar: "home.priceDesc" },
];

function sayfaYenilendiMi() {
  if (typeof window === "undefined") return false;
  return window.performance?.getEntriesByType?.("navigation")?.[0]?.type === "reload";
}

export default function Home() {
  const { metinler } = useTema();
  const { dil, locale, t, yerelAlan } = useDil();
  const location = useLocation();
  // Kampanyalar'dan "Sipariş Ver" ile gelinirse ilgili kategori otomatik seçili açılır.
  // Tarayıcı yenilemesinde history state geri gelse bile menü her zaman Tümü'nden başlar.
  const [aktifKategori, setAktifKategori] = useState(
    sayfaYenilendiMi() ? "Tümü" : (location.state?.kategori || "Tümü")
  );
  const [arama, setArama] = useState("");
  const [siralama, setSiralama] = useState("onerilen");
  const [filtreAcik, setFiltreAcik] = useState(false);
  const [masaZekasiAcik, setMasaZekasiAcik] = useState(false);
  const { sepeteEkle, burgerDamga, burgerDamgaHedef, damgaKarti, misafir, kullanici, indirimliFiyat, urunler, kategoriler, ozetMasaNo, ozetMasaTokeni } = useApp();
  const git = useIsletmeNavigate();
  const chipRef = useSuruklenebilir();
  const masaZekasiniKapat = useCallback(() => setMasaZekasiAcik(false), []);

  useEffect(() => {
    if (kategoriler.some((kategori) => kategori.ad === aktifKategori)) return;
    setAktifKategori(kategoriler.find((kategori) => kategori.ad === "Tümü")?.ad || kategoriler[0]?.ad || "Tümü");
  }, [aktifKategori, kategoriler]);

  // Kategori + arama + sıralama; hepsi yalnızca listelemeyi etkiler
  const gosterilen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase(locale);
    const liste = urunler.filter(
      (u) =>
        (aktifKategori === "Tümü" || u.kategori === aktifKategori) &&
        (q === "" || String(yerelAlan(u, "ad", u.ad)).toLocaleLowerCase(locale).includes(q))
    );
    if (siralama === "artan") return [...liste].sort((a, b) => a.fiyat - b.fiyat);
    if (siralama === "azalan") return [...liste].sort((a, b) => b.fiyat - a.fiyat);
    const kategoriSirasi = new Map(kategoriler.map((kategori, index) => [kategori.ad, index]));
    return [...liste].sort((a, b) =>
      (aktifKategori === "Tümü" ? (kategoriSirasi.get(a.kategori) ?? 999) - (kategoriSirasi.get(b.kategori) ?? 999) : 0)
      || Number(a.sira ?? 100) - Number(b.sira ?? 100)
      || String(yerelAlan(a, "ad", a.ad)).localeCompare(String(yerelAlan(b, "ad", b.ad)), locale)
    );
  }, [aktifKategori, arama, siralama, urunler, kategoriler, locale, yerelAlan]);

  const gorunenDamga = Math.min(burgerDamga, burgerDamgaHedef);
  const kalanDamga = Math.max(burgerDamgaHedef - burgerDamga, 0);
  const damgaSutunSayisi = burgerDamgaHedef > 6 ? Math.ceil(burgerDamgaHedef / 2) : Math.max(1, burgerDamgaHedef);
  const sonDamgaSatiriAdedi = burgerDamgaHedef % damgaSutunSayisi || damgaSutunSayisi;
  const sonDamgaSatiriEksik = sonDamgaSatiriAdedi < damgaSutunSayisi;
  const sonDamgaSatiriBaslangici = burgerDamgaHedef - sonDamgaSatiriAdedi;
  const populerUrunler = gosterilen.filter((urun) => urun.populer === true).slice(0, 4);
  const digerUrunler = gosterilen.filter((urun) => urun.populer !== true);
  const aktifKategoriVerisi = kategoriler.find((kategori) => kategori.ad === aktifKategori);
  const kategoriBasligi = aktifKategori === "Tümü" ? t("home.products") : yerelAlan(aktifKategoriVerisi, "ad", aktifKategori);
  const sloganVurguIndex = metinler.slogan.lastIndexOf(metinler.sloganVurgu);
  const sloganBaslangici = sloganVurguIndex >= 0 ? metinler.slogan.slice(0, sloganVurguIndex).trim() : metinler.slogan;

  return (
    <div className="ekran home">
      <OrtakHeader selamlama />

      <div className="home-govde">
        {/* Kahraman başlık */}
        <motion.h1
          className="home-hero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {sloganBaslangici}
          {sloganVurguIndex >= 0 && <><br /><span className="vurgu">{metinler.sloganVurgu}</span></>}
        </motion.h1>

        {/* Ye Kazan damga kartı */}
        {damgaKarti.aktif && <motion.section
          className="damga-kart"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        >
          <div className="damga-ust">
            <div>
              <h2 className="damga-baslik">{yerelAlan(damgaKarti, "baslik", damgaKarti.baslik)}</h2>
              <p className="damga-aciklama">{yerelAlan(damgaKarti, "aciklama", damgaKarti.aciklama)}</p>
            </div>
            {!misafir && (
              <div className="damga-sayac"><strong>{gorunenDamga}</strong><span>/{burgerDamgaHedef}</span><small>{t("home.completed")}</small></div>
            )}
          </div>

          <div className="damga-noktalar" style={{ "--damga-sutun": damgaSutunSayisi }}>
            {Array.from({ length: burgerDamgaHedef }, (_, indeks) => {
              const dolu = !misafir && indeks < gorunenDamga;
              const siradaki = !misafir && indeks === gorunenDamga;
              const ortalanmisSonSatir = sonDamgaSatiriEksik && indeks >= sonDamgaSatiriBaslangici;
              return <motion.span key={indeks} className={`${dolu ? "dolu" : ""} ${siradaki ? "siradaki" : ""} ${ortalanmisSonSatir ? "damga-son-satir" : ""}`} initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .08 + indeks * .035 }}><i>{dolu ? damgaKarti.ikon : indeks + 1}</i><small>{dolu ? t("home.stamp") : indeks + 1 === burgerDamgaHedef ? t("home.gift") : ""}</small></motion.span>;
            })}
          </div>

          {misafir ? (
            <div className="damga-misafir-not"><span>{t("home.membersOnly")}</span><p>{t("home.stampHint", { category: damgaKarti.kategori })}</p></div>
          ) : (
            <div className="damga-alt"><div><small>{t("home.nextReward")}</small><strong>{yerelAlan(damgaKarti, "odulMetni", damgaKarti.odulMetni)}</strong></div><p>{kalanDamga === 0 ? yerelAlan(damgaKarti, "tamamlanmaMetni", damgaKarti.tamamlanmaMetni) : t("home.remaining", { count: kalanDamga, unit: yerelAlan(damgaKarti, "damgaBirimi", damgaKarti.damgaBirimi) })}</p></div>
          )}
        </motion.section>}

        {/* Kategoriler — yuvarlak görseller, yatay kaydırma */}
        <MasaZekasiKart masaNo={ozetMasaNo} onAc={() => setMasaZekasiAcik(true)} />

        <div className="kategori-satir" ref={chipRef}>
          {kategoriler.map((kategori) => {
            const k = kategori.ad;
            return (
            <motion.button
              key={kategori.id || k}
              type="button"
              className={"kategori" + (k === aktifKategori ? " kategori--aktif" : "")}
              onClick={() => setAktifKategori(k)}
              aria-pressed={k === aktifKategori}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <span className="kategori-daire">
                {kategori.gorsel && (
                  <span className="kategori-gorsel-kirp">
                    <img className="kategori-gorsel" src={kategori.gorsel} alt="" loading="lazy" />
                  </span>
                )}
              </span>
              <span className="kategori-ad">{k === "Tümü" ? t("home.products") : yerelAlan(kategori, "ad", k)}</span>
            </motion.button>
            );
          })}
        </div>

        {/* Arama çubuğu — cam, solda arama ikonu, sağda sıralama filtresi */}
        <motion.div
          className="arama-sarici"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
        >
          <div className="arama-kutu">
            <IconSearch className="arama-ikon" aria-hidden="true" />
            <input
              className="arama-input"
              type="search"
              value={arama}
              onChange={(e) => setArama(guvenliMetin(e.target.value, 80))}
              placeholder={dil === "tr" ? metinler.aramaPlaceholder : t("home.search")}
              aria-label={dil === "tr" ? metinler.aramaPlaceholder : t("home.search")}
              maxLength="80"
            />
            <motion.button
              type="button"
              className={"filtre-btn" + (filtreAcik ? " filtre-btn--acik" : "")}
              onClick={() => setFiltreAcik((v) => !v)}
              aria-label={t("home.sort")}
              aria-expanded={filtreAcik}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <IconFilter className="filtre-ikon" />
            </motion.button>
          </div>

          <AnimatePresence>
            {filtreAcik && (
              <>
                {/* Dışarı tıklayınca menü kapansın */}
                <button
                  type="button"
                  className="filtre-perde"
                  aria-label={t("home.closeSort")}
                  onClick={() => setFiltreAcik(false)}
                />
                <motion.div className="filtre-menu" {...asagiAcilma}>
                  {siralamalar.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={"filtre-secenek" + (siralama === s.id ? " filtre-secenek--aktif" : "")}
                      onClick={() => {
                        setSiralama(s.id);
                        setFiltreAcik(false);
                      }}
                    >
                      {t(s.anahtar)}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Kategoriye göre öne çıkan ilk beş ürün — yatay kaydırılabilir. */}
        {populerUrunler.length > 0 && <div className="bolum-satir">
          <h3 className="bolum-baslik">{aktifKategori === "Tümü" ? metinler.urunBolumBaslik : `${metinler.urunBolumBaslik}: ${kategoriBasligi}`}</h3>
        </div>}

        {/* Popüler ürünler — kategori değişince yeniden sıralanır. */}
        {populerUrunler.length > 0 && <AnimatePresence mode="wait">
          <motion.div
            className="populer-urun-listesi"
            key={`populer-${aktifKategori}-${siralama}-${arama}`}
            {...siraliKonteyner}
            initial="initial"
            animate="animate"
          >
            {populerUrunler.map((u) => {
              const indirim = indirimliFiyat(u);
              return <UrunKarti key={u.id} urun={u} indirim={indirim} git={git} sepeteEkle={sepeteEkle} />;
            })}
          </motion.div>
        </AnimatePresence>}

        {digerUrunler.length > 0 && (
          <section className="diger-urunler">
            <div className="bolum-satir diger-urunler-baslik"><h3 className="bolum-baslik">{t("home.allCategory", { category: kategoriBasligi })}</h3><small>{t("home.count", { count: digerUrunler.length })}</small></div>
            <AnimatePresence mode="wait">
              <motion.div className="urun-grid" key={`diger-${aktifKategori}-${siralama}-${arama}`} {...siraliKonteyner} initial="initial" animate="animate">
                {digerUrunler.map((u) => <UrunKarti key={u.id} urun={u} indirim={indirimliFiyat(u)} git={git} sepeteEkle={sepeteEkle} />)}
              </motion.div>
            </AnimatePresence>
          </section>
        )}

        {gosterilen.length === 0 && (
          <p className="bos-sonuc">{arama ? t("home.noResult", { query: arama }) : t("home.waitingProducts")}</p>
        )}
      </div>
      <MasaZekasi
        acik={masaZekasiAcik}
        masaNo={ozetMasaNo}
        masaTokeni={ozetMasaTokeni}
        kullanici={kullanici}
        urunler={urunler}
        sepeteEkle={sepeteEkle}
        onKapat={masaZekasiniKapat}
      />
    </div>
  );
}

function UrunKarti({ urun, indirim, git, sepeteEkle }) {
  const { t, yerelAlan } = useDil();
  const urunAdi = yerelAlan(urun, "ad", urun.ad);
  const standartBoyut = urun.boyutSecenekleri?.find((boyut) => boyut.varsayilan) || urun.boyutSecenekleri?.[0];
  const standartBoyutIndeksi = standartBoyut ? urun.boyutSecenekleri.indexOf(standartBoyut) : -1;
  const standartBoyutEtiketi = standartBoyut ? yerelAlan(urun, `boyutSecenekleri.${standartBoyutIndeksi}.etiket`, standartBoyut.etiket) : "";
  const stoktaYok = urun.stokta === false;
  return <motion.article className={`urun-kart ${stoktaYok ? "urun-kart--tukendi" : ""}`} variants={siraliOge} onClick={() => git(`/urun/${urun.id}`)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") git(`/urun/${urun.id}`); }}>
    <div className="urun-gorsel-wrap"><img className="urun-gorsel" src={urun.gorsel} alt={urunAdi} loading="lazy" />{stoktaYok && <span className="stok-tukendi-rozet">{t("home.soldOut")}</span>}</div>
    <div className="urun-alt"><h4 className="urun-ad">{urunAdi}</h4>{urun.gramajOpsiyonu?.goster !== false && urun.temelMiktar > 0 && <span className="urun-standart-miktar">{yerelAlan(urun, "gramajEtiketi", urun.gramajOpsiyonu?.etiket || t("home.quantity"))}: {urun.temelMiktar} {urun.gramajOpsiyonu?.birim || "gr"}</span>}{standartBoyut && <span className="urun-standart-miktar">{t("home.standard")} {standartBoyutEtiketi} · {standartBoyut.miktar} {standartBoyut.birim}</span>}<div className="urun-fiyat-satir">{indirim ? <span className="urun-fiyat-grup"><span className="urun-fiyat-eski">₺{indirim.orijinalFiyat.toFixed(2)}</span><span className="urun-fiyat urun-fiyat--indirim">₺{indirim.fiyat.toFixed(2)}</span></span> : <span className="urun-fiyat">₺{urun.fiyat.toFixed(2)}</span>}<motion.button className="ekle-btn" disabled={stoktaYok} onClick={(e) => { e.stopPropagation(); if (stoktaYok) return; if (urun.urunTipi === "menu" || standartBoyut || urun.ekstraMalzemeAyari?.aktif) git(`/urun/${urun.id}`); else sepeteEkle(urun); }} aria-label={stoktaYok ? t("home.outOfStockAria", { name: urunAdi }) : t("home.addAria", { name: urunAdi })} whileTap={stoktaYok ? undefined : { scale: 0.85 }} whileHover={stoktaYok ? undefined : { scale: 1.1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}><IconPlus className="ekle-ikon" /></motion.button></div></div>
  </motion.article>;
}
