import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconArrowRight, IconCheck, IconClock, IconMinus, IconPlus, IconUsers, IconWarning } from "./Icons";
import {
  masaZekasiOnerisiGetir, masaZekasiOrtakOnerisiGetir,
  masaZekasiOturumunaKatil, masaZekasiTercihiniKaydet, tenantDepoAnahtari,
} from "../lib/authApi";
import { socket } from "../lib/socket";
import "./MasaZekasi.css";

const PARA = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });

function alerjenEtiketiniTemizle(deger) {
  return [...String(deger || "")]
    .filter((karakter) => karakter.charCodeAt(0) >= 32 && karakter !== "<" && karakter !== ">")
    .join("").trim().slice(0, 60);
}

function Secenek({ aktif, onClick, children }) {
  return <button type="button" className={`mz-chip${aktif ? " mz-chip--aktif" : ""}`} aria-pressed={aktif} onClick={onClick}>{children}</button>;
}

export function MasaZekasiKart({ masaNo, onAc }) {
  return (
    <motion.button
      type="button"
      className="masa-zekasi-kart"
      onClick={onAc}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: .35, delay: .09 }}
    >
      <span className="masa-zekasi-kart__ikon" aria-hidden="true"><IconUsers /></span>
      <span className="masa-zekasi-kart__metin">
        <small>{masaNo ? `MASA ${masaNo} İÇİN` : "MASANPOS MASA ZEKÂSI"}</small>
        <strong>Masaya ne söyleyelim?</strong>
        <span>Bütçenize ve tercihlerinize göre masaya özel plan oluşturalım.</span>
      </span>
      <span className="masa-zekasi-kart__ok" aria-hidden="true"><IconArrowRight /></span>
    </motion.button>
  );
}

export default function MasaZekasi({ acik, masaNo, masaTokeni, kullanici, urunler, sepeteEkle, onKapat }) {
  const [adim, setAdim] = useState(1);
  const [tercih, setTercih] = useState({ kisiSayisi: 2, butceKisi: 400, paylasim: true, aclik: "normal", aci: 2, beslenme: "farketmez", alerjenler: [], sevilmeyenler: "" });
  const [sonuc, setSonuc] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [eklendi, setEklendi] = useState("");
  const [ortakOturum, setOrtakOturum] = useState(null);
  const [ortakYukleniyor, setOrtakYukleniyor] = useState(false);
  const katilimciIdRef = useRef("");
  const cihazRef = useRef("");
  const panelRef = useRef(null);
  const ortakMod = Boolean(masaNo && masaTokeni);
  const gorunenKisiSayisi = ortakMod ? Math.max(1, ortakOturum?.katilimcilar?.length || 1) : tercih.kisiSayisi;
  const alerjenSecenekleri = useMemo(() => {
    const benzersiz = new Map();
    (urunler || []).forEach((urun) => {
      (Array.isArray(urun?.alerjenler) ? urun.alerjenler : []).forEach((deger) => {
        const etiket = alerjenEtiketiniTemizle(deger);
        if (!etiket) return;
        const anahtar = etiket.toLocaleLowerCase("tr-TR");
        if (!benzersiz.has(anahtar)) benzersiz.set(anahtar, etiket);
      });
    });
    return [...benzersiz.values()].sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [urunler]);

  useEffect(() => {
    const gecerli = new Set(alerjenSecenekleri.map((a) => a.toLocaleLowerCase("tr-TR")));
    setTercih((onceki) => {
      const alerjenler = onceki.alerjenler.filter((a) => gecerli.has(String(a).toLocaleLowerCase("tr-TR")));
      return alerjenler.length === onceki.alerjenler.length ? onceki : { ...onceki, alerjenler };
    });
  }, [alerjenSecenekleri]);

  useEffect(() => {
    if (!acik) return undefined;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const klavye = (e) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", klavye);
    window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => { document.body.style.overflow = onceki; window.removeEventListener("keydown", klavye); };
  }, [acik, onKapat]);

  useEffect(() => {
    if (!acik || !ortakMod) { setOrtakOturum(null); return undefined; }
    let iptal = false;
    const anahtar = tenantDepoAnahtari("bp_masa_zekasi_cihaz");
    let cihaz = localStorage.getItem(anahtar);
    if (!cihaz) {
      cihaz = crypto.randomUUID();
      localStorage.setItem(anahtar, cihaz);
    }
    cihazRef.current = cihaz;
    setOrtakYukleniyor(true);
    const ad = kullanici?.ad || `Misafir ${cihaz.slice(-4).toUpperCase()}`;
    masaZekasiOturumunaKatil(masaNo, masaTokeni, cihaz, ad)
      .then(({ oturum }) => {
        if (iptal) return;
        setOrtakOturum(oturum);
        katilimciIdRef.current = oturum.katilimcilar.find((k) => k.ben)?.id || "";
      })
      .catch((e) => { if (!iptal) setHata(e.message); })
      .finally(() => { if (!iptal) setOrtakYukleniyor(false); });
    const guncellendi = (oturum) => {
      if (iptal || String(oturum?.masaNo) !== String(masaNo)) return;
      setOrtakOturum({ ...oturum, katilimcilar: (oturum.katilimcilar || []).map((k) => ({ ...k, ben: String(k.id) === String(katilimciIdRef.current) })) });
    };
    socket.on("masa-zekasi-guncellendi", guncellendi);
    return () => { iptal = true; socket.off("masa-zekasi-guncellendi", guncellendi); };
  }, [acik, ortakMod, masaNo, masaTokeni, kullanici?.ad]);

  const degistir = (alan, deger) => setTercih((onceki) => ({ ...onceki, [alan]: deger }));
  const alerjenDegistir = (deger) => degistir("alerjenler", tercih.alerjenler.includes(deger) ? tercih.alerjenler.filter((a) => a !== deger) : [...tercih.alerjenler, deger]);

  async function planOlustur() {
    setYukleniyor(true); setHata(""); setEklendi("");
    try {
      let veri;
      if (ortakMod) {
        const { oturum } = await masaZekasiTercihiniKaydet(masaNo, masaTokeni, cihazRef.current, tercih);
        setOrtakOturum(oturum);
        const bekleyen = oturum.katilimcilar.filter((k) => !k.hazir);
        veri = await masaZekasiOrtakOnerisiGetir(masaNo, masaTokeni, cihazRef.current);
        veri.bekleyenKisi = bekleyen.length;
      } else {
        veri = await masaZekasiOnerisiGetir(tercih);
      }
      setSonuc(veri); setAdim(3);
    } catch (e) { setHata(e.message || "Öneri oluşturulamadı."); }
    finally { setYukleniyor(false); }
  }

  function planiEkle(plan) {
    let adet = 0;
    plan.kalemler.forEach((kalem) => {
      const urun = urunler.find((u) => Number(u.id) === Number(kalem.urunId));
      if (!urun || urun.stokta === false) return;
      for (let i = 0; i < kalem.adet; i += 1) { if (sepeteEkle(urun) !== false) adet += 1; }
    });
    if (!adet) return setHata("Plan sepete eklenemedi. Ürün stoklarını yenileyip tekrar deneyin.");
    setHata(""); setEklendi(`${adet} ürün sepete eklendi.`);
  }

  return (
    <AnimatePresence>
      {acik && <motion.div className="mz-perde" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onKapat(); }}>
        <motion.section ref={panelRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="mz-baslik" className="mz-panel" initial={{ opacity: 0, y: 42, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }}>
          <header className="mz-header">
            <div><small>MASANPOS MASA ZEKÂSI</small><h2 id="mz-baslik">Masaya özel sipariş planı</h2></div>
            <button type="button" className="mz-kapat" onClick={onKapat} aria-label="Kapat">×</button>
          </header>
          <div className="mz-ilerleme" aria-label={`3 adımın ${adim}. adımı`}><span className={adim >= 1 ? "aktif" : ""} /><span className={adim >= 2 ? "aktif" : ""} /><span className={adim >= 3 ? "aktif" : ""} /></div>

          {ortakMod && <div className="mz-ortak">
            <span className="mz-ortak__canli"><i /> ORTAK MASA · CANLI</span>
            <div className="mz-katilimcilar">
              {ortakYukleniyor && <small>Masaya bağlanılıyor…</small>}
              {(ortakOturum?.katilimcilar || []).map((k) => <span key={k.id} className={k.hazir ? "hazir" : ""}>{k.ad}{k.ben ? " (sen)" : ""}<i aria-label={k.hazir ? "Tercihleri hazır" : "Tercihleri bekleniyor"} /></span>)}
            </div>
          </div>}

          {adim === 1 && <div className="mz-icerik">
            <div className="mz-adim-baslik"><span>01</span><div><h3>Önce masayı tanıyalım</h3><p>Toplamı kişi sayısı ve bütçenize göre hesaplarız.</p></div></div>
            {!ortakMod && <label className="mz-alan"><span>Kaç kişisiniz?</span><div className="mz-stepper"><button type="button" onClick={() => degistir("kisiSayisi", Math.max(1, tercih.kisiSayisi - 1))} aria-label="Kişi sayısını azalt"><IconMinus /></button><strong>{tercih.kisiSayisi}<small> kişi</small></strong><button type="button" onClick={() => degistir("kisiSayisi", Math.min(12, tercih.kisiSayisi + 1))} aria-label="Kişi sayısını artır"><IconPlus /></button></div></label>}
            <label className="mz-alan"><span>Kişi başı yaklaşık bütçe</span><div className="mz-para"><span>₺</span><input type="number" min="50" max="5000" step="50" value={tercih.butceKisi} onChange={(e) => degistir("butceKisi", e.target.value)} /></div><small>{ortakMod ? `${gorunenKisiSayisi} katılımcı için ` : ""}Toplam hedef: {PARA.format((Number(tercih.butceKisi) || 0) * gorunenKisiSayisi)}</small></label>
            <button type="button" className={`mz-paylasim${tercih.paylasim ? " aktif" : ""}`} onClick={() => degistir("paylasim", !tercih.paylasim)}><span><strong>Paylaşmalık ürün olsun</strong><small>Yan lezzetleri masaya ortak planlarız.</small></span><i aria-hidden="true"><IconCheck /></i></button>
            <footer className="mz-footer"><button type="button" className="mz-ana-btn" onClick={() => setAdim(2)}>Tercihlere geç <IconArrowRight /></button></footer>
          </div>}

          {adim === 2 && <div className="mz-icerik">
            <div className="mz-adim-baslik"><span>02</span><div><h3>Tercihleriniz nasıl?</h3><p>Uymayan ürünleri daha plan kurulmadan eleriz.</p></div></div>
            <fieldset className="mz-grup"><legend>Açlık seviyesi</legend><div className="mz-chipler"><Secenek aktif={tercih.aclik === "hafif"} onClick={() => degistir("aclik", "hafif")}>Hafif</Secenek><Secenek aktif={tercih.aclik === "normal"} onClick={() => degistir("aclik", "normal")}>Normal</Secenek><Secenek aktif={tercih.aclik === "cok"} onClick={() => degistir("aclik", "cok")}>Çok açız</Secenek></div></fieldset>
            <fieldset className="mz-grup"><legend>Beslenme tercihi</legend><div className="mz-chipler"><Secenek aktif={tercih.beslenme === "farketmez"} onClick={() => degistir("beslenme", "farketmez")}>Fark etmez</Secenek><Secenek aktif={tercih.beslenme === "vejetaryen"} onClick={() => degistir("beslenme", "vejetaryen")}>Vejetaryen</Secenek><Secenek aktif={tercih.beslenme === "vegan"} onClick={() => degistir("beslenme", "vegan")}>Vegan</Secenek></div></fieldset>
            <fieldset className="mz-grup"><legend>Acı tercihi <b>{tercih.aci}/5</b></legend><input className="mz-range" type="range" min="0" max="5" value={tercih.aci} onChange={(e) => degistir("aci", Number(e.target.value))} /></fieldset>
            <fieldset className="mz-grup"><legend>Alerjenler</legend>{alerjenSecenekleri.length > 0 ? <div className="mz-chipler">{alerjenSecenekleri.map((a) => <Secenek key={a.toLocaleLowerCase("tr-TR")} aktif={tercih.alerjenler.includes(a)} onClick={() => alerjenDegistir(a)}>{a}</Secenek>)}</div> : <p className="mz-alerjen-bos">Bu işletmenin ürün kayıtlarında henüz alerjen bilgisi tanımlanmamış.</p>}</fieldset>
            <label className="mz-alan"><span>Sevmediğiniz malzemeler</span><input className="mz-metin-input" maxLength="240" value={tercih.sevilmeyenler} onChange={(e) => degistir("sevilmeyenler", e.target.value)} placeholder="Örn. turşu, soğan, mantar" /><small>Birden fazlaysa virgülle ayırın.</small></label>
            {hata && <p className="mz-hata" role="alert">{hata}</p>}
            <footer className="mz-footer mz-footer--iki"><button type="button" className="mz-geri" onClick={() => setAdim(1)}>Geri</button><button type="button" className="mz-ana-btn" disabled={yukleniyor || ortakYukleniyor} onClick={planOlustur}>{yukleniyor ? "Kaydediliyor…" : ortakMod ? "Tercihimi masaya gönder" : "Planları oluştur"}<IconArrowRight /></button></footer>
          </div>}

          {adim === 3 && sonuc && <div className="mz-icerik mz-sonuc">
            <div className="mz-sonuc-ozet"><div><small>{masaNo ? `MASA ${masaNo}` : `${sonuc.ozet.kisiSayisi} KİŞİ`}</small><h3>Size uygun {sonuc.planlar.length} plan hazırladık</h3></div><span><IconClock /> {sonuc.ozet.mutfak.tahminiDakika.min}–{sonuc.ozet.mutfak.tahminiDakika.max} dk</span></div>
            <p className="mz-mutfak">Mutfak şu an <strong>{sonuc.ozet.mutfak.seviye}</strong>. Süre mevcut sipariş yoğunluğuna göre tahmin edilmiştir.</p>
            {sonuc.bekleyenKisi > 0 && <p className="mz-bekleyen"><IconUsers /> Plan, tercihlerini tamamlayan kişiler için hazırlandı. {sonuc.bekleyenKisi} kişi henüz plana dahil değil.</p>}
            <div className="mz-planlar">{sonuc.planlar.map((plan, index) => <article className={`mz-plan${index === 0 ? " mz-plan--onerilen" : ""}`} key={plan.id}>
              {index === 0 && <small className="mz-plan-rozet">ÖNERİLEN</small>}
              <div className="mz-plan-baslik"><div><h4>{plan.baslik}</h4><p>{plan.aciklama}</p></div><strong>{PARA.format(plan.kisiBasi)}<small>/kişi</small></strong></div>
              <ul>{plan.kalemler.map((kalem) => <li key={kalem.urunId}><span>{kalem.ad}{kalem.indirimYuzde > 0 && <small>%{kalem.indirimYuzde} avantaj</small>}</span><b>{kalem.adet}×</b></li>)}</ul>
              <div className="mz-plan-alt"><span>Toplam <strong>{PARA.format(plan.toplam)}</strong>{!plan.butceyeUygun && <small>Bütçe hedefinin üzerinde</small>}</span><button type="button" onClick={() => planiEkle(plan)}>Planı sepete ekle</button></div>
            </article>)}</div>
            {eklendi && <p className="mz-basarili" role="status"><IconCheck /> {eklendi}</p>}
            {hata && <p className="mz-hata" role="alert">{hata}</p>}
            <div className="mz-uyari"><IconWarning /><p>{sonuc.ozet.uyarilar.join(" ")}</p></div>
            <footer className="mz-footer mz-footer--iki"><button type="button" className="mz-geri" onClick={() => setAdim(2)}>Tercihleri değiştir</button><button type="button" className="mz-ana-btn" onClick={onKapat}>Menüye dön</button></footer>
          </div>}
        </motion.section>
      </motion.div>}
    </AnimatePresence>
  );
}
