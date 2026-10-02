/* Uygulama geneli paylaşılan state: katalog, puan, sepet ve ödeme. */

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { kampanyaAktifMi, urunKurallariniUygula } from "../lib/katalogKurallari";
import { socket, socketIsletmesiniAyarla } from "../lib/socket";
import { sepetAnahtariOlustur } from "../lib/urunSecimleri";
import { oneriIndirimAyariniDonustur, oneriSepetSatiriniGuncelle, oneriUrunFiyatiniGuncelle } from "../lib/oneriIndirimi";
import { useIsletme } from "./IsletmeContext";
import { useDil } from "../dil/DilContext";
import {
  beniGetir, tokeniAl, tokeniSil, profilGuncelle, siparisGecmisiniGetir,
  sadakatOzetiniGetir, puanlaOdulSatinAl, kullaniciHediyesiniKullan,
  damgaKartiAyariniGetir, istekAt, tenantDepoAnahtari,
  masaCagriOturumuAc, masaPersonelCagrisiniGetir, masaPersonelCagrisiOlustur,
} from "../lib/authApi";

const AppContext = createContext(null);
const VARSAYILAN_DAMGA_KARTI = {
  aktif: false, hedefAdet: 5, kategori: "", odulMetni: "Hediye",
  kartEtiketi: "YE KAZAN", baslik: "Lezzet yolculuğun",
  aciklama: "Her uygun üründe bir damga kazan, kartını tamamla ve hediyeni kap.",
  damgaBirimi: "ürün", tamamlanmaMetni: "Hediyen hazır!", ikon: "★",
};

function kataloguBirlestir(uzakUrunler) {
  return uzakUrunler.map((uzak) => {
    const doluUzakAlanlar = Object.fromEntries(
      Object.entries(uzak).filter(([, deger]) => deger !== null && deger !== undefined)
    );
    return urunKurallariniUygula(doluUzakAlanlar);
  });
}

const TUMU_KATEGORISI = { id: "tumu", ad: "Tümü", gorsel: null, sira: 0 };

function kategorileriBirlestir(uzakKategoriler) {
  const liste = uzakKategoriler
    .filter((kategori) => kategori && String(kategori.ad || "").trim() && kategori.aktif !== false)
    .map((kategori, sira) => ({
      id: kategori.id ?? `uzak-${sira}`,
      ad: String(kategori.ad).trim(),
      gorsel: kategori.gorsel || null,
      sira: Number.isFinite(Number(kategori.sira)) ? Number(kategori.sira) : sira + 1,
      ceviriler: kategori.ceviriler || {},
      ceviriDurumu: kategori.ceviriDurumu || "bekliyor",
    }));
  const benzersiz = Array.from(new Map(liste.map((kategori) => [kategori.ad, kategori])).values());
  return [TUMU_KATEGORISI, ...benzersiz.sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, "tr"))];
}

function kategorileriUrunlerdenTamamla(mevcut, urunler) {
  const adlar = new Set(mevcut.map((kategori) => kategori.ad));
  const eklenenler = [];
  for (const urun of urunler) {
    const ad = String(urun.kategori || "").trim();
    if (!ad || adlar.has(ad)) continue;
    adlar.add(ad);
    eklenenler.push({ id: `urun-${ad}`, ad, gorsel: urun.gorsel || null, sira: mevcut.length + eklenenler.length });
  }
  return eklenenler.length ? [...mevcut, ...eklenenler] : mevcut;
}

export function AppProvider({ children }) {
  const { isletmeSlug, tema } = useIsletme();
  const { dil } = useDil();
  const temaOnizlemeModu = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("temaOnizleme") === "1";
  const depoAnahtari = useCallback((anahtar) => tenantDepoAnahtari(anahtar, isletmeSlug), [isletmeSlug]);
  const [puan, setPuan] = useState(0);
  const [sadakat, setSadakat] = useState({ burgerDamga: 0, burgerDamgaHedef: 5, damgaKarti: VARSAYILAN_DAMGA_KARTI, oduller: [], puanGecmisi: [], hediyeler: [] });
  const [damgaKarti, setDamgaKarti] = useState(VARSAYILAN_DAMGA_KARTI);
  const [urunler, setUrunler] = useState([]);
  const [menuKategorileri, setMenuKategorileri] = useState([TUMU_KATEGORISI]);
  const [kampanyalar, setKampanyalar] = useState([]);
  const [oneriIndirimAyari, setOneriIndirimAyari] = useState({ aktif: false, indirimYuzde: 0 });
  const oneriIndirimAyariniUygula = useCallback((ayar) => {
    const guncel = oneriIndirimAyariniDonustur(ayar);
    setOneriIndirimAyari((onceki) => onceki.aktif === guncel.aktif && onceki.indirimYuzde === guncel.indirimYuzde ? onceki : guncel);
  }, []);

  // Katalog işletmeye özeldir ve yalnızca backend kayıtlarından yüklenir.
  useEffect(() => {
    setUrunler([]);
    setMenuKategorileri([TUMU_KATEGORISI]);
    setKampanyalar([]);
    istekAt("/api/urunler")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(({ urunler: uzakUrunler }) => {
        if (!Array.isArray(uzakUrunler)) return;
        const katalog = kataloguBirlestir(uzakUrunler);
        setUrunler(katalog);
        setMenuKategorileri((mevcut) => kategorileriUrunlerdenTamamla(mevcut, katalog));
      })
      .catch(() => {});
    istekAt("/api/kategoriler")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(({ kategoriler: uzakKategoriler }) => {
        if (Array.isArray(uzakKategoriler) && uzakKategoriler.length) {
          setMenuKategorileri(kategorileriBirlestir(uzakKategoriler));
        }
      })
      .catch(() => {});
    istekAt("/api/kampanyalar")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(({ kampanyalar: uzakKampanyalar }) => {
        if (Array.isArray(uzakKampanyalar)) setKampanyalar(uzakKampanyalar);
      })
      .catch(() => {});
    damgaKartiAyariniGetir()
      .then((ayar) => { if (ayar) setDamgaKarti({ ...VARSAYILAN_DAMGA_KARTI, ...ayar }); })
      .catch(() => {});
  }, [isletmeSlug, dil]);

  // İşletme "Tümü" rozeti için kendi görselini ayarladıysa (yönetim panelinden),
  // konseptin genel varsayılan görselinin önüne geçer. State üzerinde değil
  // her render'da türetilir: /api/kategoriler'in gecikmeli yanıtı ya da
  // urunler-guncellendi soketi menuKategorileri'ni değiştirdiğinde bile
  // (kategorileriBirlestir tumuGorseli'nden habersiz olduğundan) üzerine
  // yazılmadan hep en güncel değeri gösterir.
  const gosterilenKategoriler = useMemo(() => {
    if (tema?.tumuGorseli === undefined) return menuKategorileri;
    return menuKategorileri.map((kategori) =>
      kategori.ad === "Tümü" ? { ...kategori, gorsel: tema.tumuGorseli ?? kategori.gorsel } : kategori
    );
  }, [menuKategorileri, tema?.tumuGorseli]);

  useEffect(() => {
    const katalogGuncelle = (uzakUrunler) => {
      if (!Array.isArray(uzakUrunler)) return;
      const katalog = kataloguBirlestir(uzakUrunler);
      setUrunler(katalog);
      setMenuKategorileri((mevcut) => kategorileriUrunlerdenTamamla(mevcut, katalog));
    };
    const kategorilerGuncelle = (uzakKategoriler) => {
      if (Array.isArray(uzakKategoriler)) setMenuKategorileri(kategorileriBirlestir(uzakKategoriler));
    };
    const kampanyalarGuncelle = (uzakKampanyalar) => {
      if (Array.isArray(uzakKampanyalar)) setKampanyalar(uzakKampanyalar);
    };
    const sadakatAyariGuncellendi = (ayar) => {
      const guncel = { ...VARSAYILAN_DAMGA_KARTI, ...(ayar || {}) };
      setDamgaKarti(guncel);
      setSadakat((onceki) => ({ ...onceki, burgerDamgaHedef: guncel.hedefAdet, damgaKarti: guncel }));
    };
    const oneriIndirimAyariGuncellendi = (ayar) => oneriIndirimAyariniUygula(ayar);
    socket.on("urunler-guncellendi", katalogGuncelle);
    socket.on("kategoriler-guncellendi", kategorilerGuncelle);
    socket.on("kampanyalar-guncellendi", kampanyalarGuncelle);
    socket.on("sadakat-ayari-guncellendi", sadakatAyariGuncellendi);
    socket.on("oneri-indirim-ayari-guncellendi", oneriIndirimAyariGuncellendi);
    return () => {
      socket.off("urunler-guncellendi", katalogGuncelle);
      socket.off("kategoriler-guncellendi", kategorilerGuncelle);
      socket.off("kampanyalar-guncellendi", kampanyalarGuncelle);
      socket.off("sadakat-ayari-guncellendi", sadakatAyariGuncellendi);
      socket.off("oneri-indirim-ayari-guncellendi", oneriIndirimAyariGuncellendi);
    };
  }, [isletmeSlug, oneriIndirimAyariniUygula]);

  // --- Giriş yapmış kullanıcı (auth) ---
  // null ise misafir/giriş yapılmamış. Doluysa gerçek hesap.
  const [kullanici, setKullanici] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [authYuklendi, setAuthYuklendi] = useState(false);
  const adminMi = kullanici?.rol === "admin";

  const kullaniciyiYenile = useCallback(async () => {
    const guncel = await beniGetir();
    if (guncel) {
      setKullanici(guncel);
      setPuan(guncel.puan || 0);
    } else if (!tokeniAl()) {
      setKullanici(null);
      setPuan(0);
      socketIsletmesiniAyarla(isletmeSlug);
    }
    return guncel;
  }, [isletmeSlug]);

  useEffect(() => {
    setAvatar(kullanici?.id ? localStorage.getItem(`bp_avatar_${isletmeSlug}_${kullanici.id}`) : null);
  }, [isletmeSlug, kullanici?.id]);

  // Açılışta token varsa kullanıcıyı geri getir (oturum korunur)
  useEffect(() => {
    kullaniciyiYenile().then((k) => {
      if (k) {
        setKullanici(k);
        setPuan(k.puan || 0);
      }
      setAuthYuklendi(true);
    });
  }, [kullaniciyiYenile]);

  // Davet edilen kişinin ödemesi başka bir cihazda tamamlanabilir. Kullanıcı
  // uygulamaya geri döndüğünde güncel puanı ve davet bilgileri otomatik alınır.
  useEffect(() => {
    const odaklaninca = () => kullaniciyiYenile().catch(() => {});
    const gorunurlukDegisince = () => {
      if (document.visibilityState === "visible") odaklaninca();
    };
    window.addEventListener("focus", odaklaninca);
    document.addEventListener("visibilitychange", gorunurlukDegisince);
    return () => {
      window.removeEventListener("focus", odaklaninca);
      document.removeEventListener("visibilitychange", gorunurlukDegisince);
    };
  }, [kullaniciyiYenile]);

  // Giriş/kayıt başarılı olunca çağrılır
  const girisiTamamla = (k) => {
    setKullanici(k);
    setPuan(k.puan || 0);
    sessionStorage.removeItem(depoAnahtari("bp_misafir")); // giriş yapan misafir değildir
    socketIsletmesiniAyarla(isletmeSlug);
  };
  // Çıkış
  const cikisYap = () => {
    tokeniSil();
    setKullanici(null);
    setPuan(0);
    setAvatar(null);
    setSiparislerim([]);
    setSadakat({ burgerDamga: 0, burgerDamgaHedef: damgaKarti.hedefAdet, damgaKarti, oduller: [], puanGecmisi: [], hediyeler: [] });
    socketIsletmesiniAyarla(isletmeSlug);
  };

  // Profil güncelle (email + telefon). Başarılıysa kullanıcı state'ini tazeler.
  const profiliGuncelle = async (email, telefon) => {
    const sonuc = await profilGuncelle(email, telefon);
    if (sonuc.kullanici) setKullanici(sonuc.kullanici);
    return sonuc; // {kullanici} veya {hata}
  };

  // --- Sepet ---
  // Gel Al (masasız) için YEREL sepet.
  const [sepet, setSepet] = useState([]);
  const [oneriler, setOneriler] = useState([]);
  const [oneriReferansi, setOneriReferansi] = useState(null);

  // Aktif masa: QR ile karşılama ekranından gelince set edilir.
  // null ise Gel Al; dolu ise masaya servis. Sipariş tipini bu belirler.
  // sessionStorage'a yazılır → sayfa yenilenince (F5) korunur.
  const [aktifMasa, setAktifMasaState] = useState(
    () => sessionStorage.getItem(tenantDepoAnahtari("bp_aktifMasa", isletmeSlug)) || null
  );
  const [aktifMasaTokeni, setAktifMasaTokeni] = useState(
    () => sessionStorage.getItem(tenantDepoAnahtari("bp_aktifMasaTokeni", isletmeSlug)) || null
  );
  const setAktifMasa = useCallback((deger, masaToken = null) => {
    const anahtar = depoAnahtari("bp_aktifMasa");
    const tokenAnahtari = depoAnahtari("bp_aktifMasaTokeni");
    if (deger) sessionStorage.setItem(anahtar, deger);
    else sessionStorage.removeItem(anahtar);
    if (deger && masaToken) sessionStorage.setItem(tokenAnahtari, masaToken);
    else if (!deger) sessionStorage.removeItem(tokenAnahtari);
    setAktifMasaState(deger);
    setAktifMasaTokeni(deger ? masaToken : null);
  }, [depoAnahtari]);

  // Misafir oturumu: QR'dan "Misafir olarak devam et" ile gelince true olur.
  // sessionStorage'a yazılır → sayfa yenilenince korunur.
  // ÖNEMLİ: Giriş yapmış kullanıcı ASLA misafir değildir (kullanici doluysa misafir=false).
  const [misafirState, setMisafirState] = useState(() => {
    const landingOnizlemesi = new URLSearchParams(window.location.search).get("misafir") === "1";
    return temaOnizlemeModu
      || landingOnizlemesi
      || sessionStorage.getItem(tenantDepoAnahtari("bp_misafir", isletmeSlug)) === "1";
  });
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("misafir") === "1") {
      sessionStorage.setItem(depoAnahtari("bp_misafir"), "1");
    }
  }, [depoAnahtari]);
  const misafir = kullanici ? false : misafirState;
  const setMisafir = (deger) => {
    const anahtar = depoAnahtari("bp_misafir");
    if (deger) sessionStorage.setItem(anahtar, "1");
    else sessionStorage.removeItem(anahtar);
    setMisafirState(deger);
  };

  // --- Masa özeti (canlı) ---
  // Masadaki HERKESİN siparişi. Backend'den canlı gelir.
  // Masa numarası localStorage'da tutulur → sekme/tarayıcı kapansa bile
  // masaya bağlanmaya devam eder, sipariş durumu (hazırlanıyor→hazır) güncellenir.
  const [ozetMasaNo, setOzetMasaNo] = useState(
    () => localStorage.getItem(tenantDepoAnahtari("bp_ozetMasa", isletmeSlug)) || sessionStorage.getItem(tenantDepoAnahtari("bp_ozetMasa", isletmeSlug)) || null
  );
  const [ozetMasaTokeni, setOzetMasaTokeni] = useState(
    () => localStorage.getItem(tenantDepoAnahtari("bp_ozetMasaTokeni", isletmeSlug)) || null
  );
  const [masaOzeti, setMasaOzeti] = useState({ kalemler: [], toplam: 0 });
  const [personelCagrisi, setPersonelCagrisi] = useState(null);
  const [personelCagriOturumu, setPersonelCagriOturumu] = useState(null);
  const [personelCagriYukleniyor, setPersonelCagriYukleniyor] = useState(false);
  const [personelCagriHatasi, setPersonelCagriHatasi] = useState("");

  // Masadaki siparişlerin canlı durumu (mutfak güncelledikçe değişir).
  // Tüm kalemler "hazir" ise → hazır; biri hazırlanıyorsa → hazırlanıyor; yoksa → yeni.
  const masaDurumu = (() => {
    const k = masaOzeti.kalemler || [];
    if (k.length === 0) return null;
    if (k.every((x) => x.durum === "hazir")) return "hazir";
    if (k.some((x) => x.durum === "hazirlaniyor")) return "hazirlaniyor";
    return "yeni";
  })();

  // aktifMasa set edilince özet masasını da güncelle (kalıcı)
  useEffect(() => {
    if (aktifMasa && aktifMasaTokeni) {
      setOzetMasaNo(aktifMasa);
      setOzetMasaTokeni(aktifMasaTokeni);
      localStorage.setItem(depoAnahtari("bp_ozetMasa"), aktifMasa);
      localStorage.setItem(depoAnahtari("bp_ozetMasaTokeni"), aktifMasaTokeni);
    }
  }, [aktifMasa, aktifMasaTokeni, depoAnahtari]);

  // Özet masasına bağlan, canlı güncellemeleri dinle
  useEffect(() => {
    if (!ozetMasaNo || !ozetMasaTokeni) {
      setMasaOzeti({ kalemler: [], toplam: 0 });
      return;
    }
    const masayaKatil = () => socket.emit("masaya-katil", { masaNo: ozetMasaNo, masaToken: ozetMasaTokeni });
    masayaKatil();
    const dinleyici = (veri) => {
      if (String(veri.masaNo) === String(ozetMasaNo)) setMasaOzeti(veri);
    };
    socket.on("masa-guncellendi", dinleyici);
    socket.on("connect", masayaKatil);
    return () => {
      socket.off("masa-guncellendi", dinleyici);
      socket.off("connect", masayaKatil);
    };
  }, [ozetMasaNo, ozetMasaTokeni]);

  // Statik QR tokeni yalnızca kısa ömürlü çağrı oturumu açar. Çağrılarda bu
  // ayrı token kullanılır; personel "masada yok" derse backend cihazı engeller.
  useEffect(() => {
    if (!ozetMasaNo || !ozetMasaTokeni) {
      setPersonelCagriOturumu(null);
      setPersonelCagrisi(null);
      setPersonelCagriHatasi("");
      return undefined;
    }
    let iptal = false;
    let yenilemeZamanlayicisi;
    const cihazAnahtari = depoAnahtari("bp_cagri_cihaz");
    let cihazId = localStorage.getItem(cihazAnahtari);
    if (!cihazId) {
      cihazId = crypto.randomUUID();
      localStorage.setItem(cihazAnahtari, cihazId);
    }
    const oturumAnahtari = depoAnahtari(`bp_cagri_oturum_${ozetMasaNo}`);
    const bitisAnahtari = `${oturumAnahtari}_bitis`;

    const yeniOturumAc = async () => {
      const oturum = await masaCagriOturumuAc(ozetMasaNo, ozetMasaTokeni, cihazId);
      sessionStorage.setItem(oturumAnahtari, oturum.token);
      sessionStorage.setItem(bitisAnahtari, String(new Date(oturum.bitis).getTime()));
      return oturum.token;
    };

    const yukle = async () => {
      setPersonelCagriYukleniyor(true);
      setPersonelCagriHatasi("");
      try {
        let token = sessionStorage.getItem(oturumAnahtari);
        const bitis = Number(sessionStorage.getItem(bitisAnahtari) || 0);
        if (!token || bitis < Date.now() + 30_000) token = await yeniOturumAc();
        let cagri;
        try {
          cagri = await masaPersonelCagrisiniGetir(ozetMasaNo, token);
        } catch (e) {
          if (e.status !== 403) throw e;
          sessionStorage.removeItem(oturumAnahtari);
          sessionStorage.removeItem(bitisAnahtari);
          token = await yeniOturumAc();
          cagri = await masaPersonelCagrisiniGetir(ozetMasaNo, token);
        }
        if (!iptal) {
          setPersonelCagriOturumu(token);
          setPersonelCagrisi(cagri);
          clearTimeout(yenilemeZamanlayicisi);
          const kalanSure = Number(sessionStorage.getItem(bitisAnahtari)) - Date.now() - 30_000;
          yenilemeZamanlayicisi = setTimeout(yukle, Math.max(30_000, kalanSure));
        }
      } catch (e) {
        sessionStorage.removeItem(oturumAnahtari);
        sessionStorage.removeItem(bitisAnahtari);
        if (!iptal) setPersonelCagriHatasi(e.message || "Personel çağrı özelliği hazırlanamadı.");
      } finally { if (!iptal) setPersonelCagriYukleniyor(false); }
    };
    yukle();

    const cagrisiGuncellendi = (cagri) => {
      if (String(cagri?.masaNo) === String(ozetMasaNo)) setPersonelCagrisi(cagri);
    };
    socket.on("personel-cagrisi-guncellendi", cagrisiGuncellendi);
    return () => { iptal = true; clearTimeout(yenilemeZamanlayicisi); socket.off("personel-cagrisi-guncellendi", cagrisiGuncellendi); };
  }, [ozetMasaNo, ozetMasaTokeni, depoAnahtari]);

  const personelCagir = useCallback(async (neden) => {
    if (!ozetMasaNo || !personelCagriOturumu) throw new Error("Masa çağrı oturumu henüz hazır değil.");
    setPersonelCagriYukleniyor(true);
    setPersonelCagriHatasi("");
    try {
      const cagri = await masaPersonelCagrisiOlustur(ozetMasaNo, personelCagriOturumu, neden, crypto.randomUUID());
      setPersonelCagrisi(cagri);
      return cagri;
    } catch (e) {
      setPersonelCagriHatasi(e.message || "Personel çağrılamadı.");
      throw e;
    } finally { setPersonelCagriYukleniyor(false); }
  }, [ozetMasaNo, personelCagriOturumu]);

  // --- Kampanyalar (saatli/sürekli indirimler) ---
  // Dakikada bir tazelenen saat — saatli kampanyaların (örn. 14:00-17:00
  // Happy Hour) aktiflik durumu otomatik güncellensin diye.
  const [kampanyaSaati, setKampanyaSaati] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setKampanyaSaati(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const aktifKampanyalar = useMemo(
    () => kampanyalar.filter((k) => kampanyaAktifMi(k, kampanyaSaati)),
    [kampanyalar, kampanyaSaati]
  );

  // Yönetici öneri indirimini değiştirdiğinde açık sepetler ve ekrandaki öneriler
  // yeniden yükleme beklemeden güncel orana geçer. Ödeme yine backend'deki güncel
  // ayarla doğrulandığı için ekrandaki tutar ile tahsil edilen tutar aynı kalır.
  useEffect(() => {
    setOneriler((mevcut) => mevcut.map((urun) => oneriUrunFiyatiniGuncelle(urun, oneriIndirimAyari)));
    setSepet((mevcut) => {
      let degisti = false;
      const guncelSepet = mevcut.map((satir) => {
        const kampanya = kullanici ? aktifKampanyalar
          .filter((aday) => aday.gecerliKategoriler?.includes(satir.kategori) && Number(aday.indirimYuzde) > 0)
          .sort((a, b) => Number(b.indirimYuzde) - Number(a.indirimYuzde))[0] : null;
        const guncelSatir = oneriSepetSatiriniGuncelle(satir, oneriIndirimAyari, kampanya?.indirimYuzde || 0);
        if (guncelSatir !== satir) degisti = true;
        return guncelSatir;
      });
      return degisti ? guncelSepet : mevcut;
    });
  }, [oneriIndirimAyari, aktifKampanyalar, kullanici]);
  // Ürünün kategorisine uygulanan aktif kampanya varsa indirimli fiyatı döner.
  // Kampanya indirimleri sadece giriş yapmış (üye) kullanıcılar içindir — misafir
  // kampanyayı görebilir ama fiyat indirimi/otomatik uygulama misafire yapılmaz.
  const indirimliFiyat = (urun) => {
    const normalFiyat = Number(urun.normalFiyat ?? urun.fiyat);
    let enIyi = Number(urun.oneriIndirimYuzde) > 0 && Number(urun.fiyat) < normalFiyat
      ? { kaynak: "oneri", kampanya: null, fiyat: Number(urun.fiyat) }
      : { kaynak: null, kampanya: null, fiyat: normalFiyat };
    if (kullanici) {
      const kampanya = aktifKampanyalar
        .filter((aday) => aday.gecerliKategoriler?.includes(urun.kategori) && Number(aday.indirimYuzde) > 0)
        .sort((a, b) => Number(b.indirimYuzde) - Number(a.indirimYuzde))[0];
      const kampanyaFiyati = kampanya
        ? Math.round(normalFiyat * (1 - Number(kampanya.indirimYuzde) / 100) * 100) / 100
        : normalFiyat;
      if (kampanyaFiyati < enIyi.fiyat) enIyi = { kaynak: "kampanya", kampanya, fiyat: kampanyaFiyati };
    }
    if (!enIyi.kaynak) return null;
    return { ...enIyi, orijinalFiyat: normalFiyat };
  };

  // --- Sepet (tamamen yerel/kişisel) ---
  // Ortak masa sepeti YOK. Herkes kendi sepetini oluşturur, kendi öder.
  // Backend'e gönderim ödeme anında olur (aşağıda odemeyiTamamla).
  const sepeteEkle = (urun) => {
    if (urun?.stokta === false) return false;
    const gelenOneriReferansi = typeof urun?.oneriReferansi === "string" ? urun.oneriReferansi : null;
    // Aktif kampanya varsa ürün sepete indirimli fiyatla girer — ödeme akışı
    // (sepetToplam, odemeyiTamamla) hiç değişmeden bu fiyatı kullanır.
    const indirim = indirimliFiyat(urun);
    const ekstraFiyat = Number(urun.gramajFiyatArtisi) || 0;
    const eklenecek = indirim
      ? { ...urun, fiyat: indirim.fiyat + ekstraFiyat, orijinalFiyat: indirim.orijinalFiyat + ekstraFiyat, uygulananIndirimKaynagi: indirim.kaynak }
      : { ...urun, fiyat: urun.fiyat + ekstraFiyat };
    const sepetAnahtari = sepetAnahtariOlustur(urun);
    setSepet((onceki) => {
      const mevcut = onceki.find((s) => s.sepetAnahtari === sepetAnahtari);
      if (mevcut) {
        return onceki.map((s) =>
          s.sepetAnahtari === sepetAnahtari
            ? { ...s, adet: s.adet + 1, oneriReferanslari: gelenOneriReferansi
              ? [...new Set([...(s.oneriReferanslari || []), gelenOneriReferansi])].slice(-5)
              : (s.oneriReferanslari || []) }
            : s
        );
      }
      return [...onceki, { ...eklenecek, sepetAnahtari, adet: 1, oneriReferanslari: gelenOneriReferansi ? [gelenOneriReferansi] : [] }];
    });
    return true;
  };

  const avatarGuncelle = (gorsel) => {
    if (!kullanici?.id) return;
    const anahtar = `bp_avatar_${isletmeSlug}_${kullanici.id}`;
    if (gorsel) localStorage.setItem(anahtar, gorsel);
    else localStorage.removeItem(anahtar);
    setAvatar(gorsel || null);
  };

  const adetArtir = async (anahtar) => {
    const urun = sepet.find((satir) => satir.sepetAnahtari === anahtar);
    const referans = urun?.oneriReferanslari?.at(-1);
    if (referans) {
      try {
        await oneriOlayiGonder({ referans, urunId: urun.id, olay: "sepete_eklendi" });
      } catch { return false; }
    }
    setSepet((o) => o.map((s) => (s.sepetAnahtari === anahtar ? { ...s, adet: s.adet + 1 } : s)));
    return true;
  };

  const adetAzalt = (anahtar) =>
    setSepet((o) =>
      o
        .map((s) => (s.sepetAnahtari === anahtar
          ? { ...s, adet: s.adet - 1 }
          : s))
        .filter((s) => s.adet > 0)
    );

  const sepettenCikar = (anahtar) => setSepet((o) => o.filter((s) => s.sepetAnahtari !== anahtar));

  const sepetiBosalt = () => setSepet([]);

  const aktifSepet = sepet;
  const sepetToplam = sepet.reduce((t, s) => t + s.fiyat * s.adet, 0);
  const sepetAdet = sepet.reduce((t, s) => t + s.adet, 0);

  const oneriOlayiGonder = useCallback(async ({ referans = oneriReferansi, urunId, olay, adet = 1 }) => {
    if (!referans) return false;
    const yanit = await istekAt("/api/oneriler/olay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referans, urunId, olay, adet, olayAnahtari: crypto.randomUUID() }),
    });
    if (!yanit.ok) {
      const veri = await yanit.json().catch(() => ({}));
      throw new Error(veri.hata || "Öneri olayı kaydedilemedi.");
    }
    return true;
  }, [oneriReferansi]);

  // Sepet değiştikten kısa süre sonra çapraz satış önerilerini katalogdan al.
  // Debounce, adet artırma/azaltmada gereksiz ağ isteğini önler.
  useEffect(() => {
    const urunIdleri = [...new Set(sepet.map((urun) => Number(urun.id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (!urunIdleri.length) {
      setOneriler([]);
      setOneriReferansi(null);
      return undefined;
    }
    let iptalEdildi = false;
    const zamanlayici = setTimeout(() => {
      istekAt(`/api/oneriler?urunler=${encodeURIComponent(urunIdleri.join(","))}`)
        .then((yanit) => yanit.ok ? yanit.json() : Promise.reject())
        .then(({ urunler: uzakUrunler, oneriReferansi: yeniReferans, indirimAyari: uzakIndirimAyari }) => {
          if (!iptalEdildi && Array.isArray(uzakUrunler)) {
            setOneriler(kataloguBirlestir(uzakUrunler, isletmeSlug));
            setOneriReferansi(typeof yeniReferans === "string" ? yeniReferans : null);
            oneriIndirimAyariniUygula(uzakIndirimAyari);
          }
        })
        .catch(() => { if (!iptalEdildi) { setOneriler([]); setOneriReferansi(null); } });
    }, 300);
    return () => {
      iptalEdildi = true;
      clearTimeout(zamanlayici);
    };
  }, [sepet, isletmeSlug, oneriIndirimAyariniUygula]);

  // --- Ödeme ---
  // Son ödemenin özeti (onay ekranı bunu gösterir)
  const [sonOdeme, setSonOdeme] = useState(null);

  // --- Siparişlerim ve sadakat ---
  // Üye kullanıcı için tek doğruluk kaynağı backend'dir. Misafirin hesabı
  // olmadığından backend'de kalıcı bir siparişi yoktur — bu yüzden misafirin
  // kendi siparişleri, aynı cihaz/tarayıcıda görünmeye devam etsin diye
  // işletmeye özel localStorage'da ayrıca tutulur (bkz. misafirSiparisiKaydet).
  const [siparislerim, setSiparislerim] = useState([]);
  const [misafirSiparisleri, setMisafirSiparisleri] = useState(() => {
    try {
      const ham = localStorage.getItem(tenantDepoAnahtari("bp_misafirSiparisler", isletmeSlug));
      const liste = ham ? JSON.parse(ham) : [];
      return Array.isArray(liste) ? liste : [];
    } catch {
      return [];
    }
  });

  const siparisleriYenile = useCallback(async () => {
    if (!kullanici?.id) {
      setSiparislerim([]);
      return [];
    }
    const liste = await siparisGecmisiniGetir();
    setSiparislerim(liste);
    return liste;
  }, [kullanici?.id]);

  // Misafir olarak tamamlanan bir siparişi cihazda kalıcı hale getirir; aynı
  // siparişin (siparisNo) tekrar eklenmesini engeller, listeyi son 20 ile sınırlar.
  const misafirSiparisiKaydet = useCallback((ozet) => {
    setMisafirSiparisleri((onceki) => {
      const digerleri = onceki.filter((s) => s.siparisNo !== ozet.siparisNo);
      const guncel = [ozet, ...digerleri].slice(0, 20);
      try {
        localStorage.setItem(depoAnahtari("bp_misafirSiparisler"), JSON.stringify(guncel));
      } catch { /* depolama dolu/erişilemez olabilir, sessizce geç */ }
      return guncel;
    });
  }, [depoAnahtari]);

  const sadakatiYenile = useCallback(async () => {
    if (!kullanici?.id) return null;
    const guncel = await sadakatOzetiniGetir();
    setSadakat(guncel);
    if (guncel?.damgaKarti) setDamgaKarti({ ...VARSAYILAN_DAMGA_KARTI, ...guncel.damgaKarti });
    setPuan(guncel.puan);
    return guncel;
  }, [kullanici?.id]);

  useEffect(() => {
    const odulleriYenile = () => sadakatiYenile().catch(() => {});
    socket.on("oduller-guncellendi", odulleriYenile);
    return () => socket.off("oduller-guncellendi", odulleriYenile);
  }, [sadakatiYenile]);

  useEffect(() => {
    if (!authYuklendi || !kullanici?.id) {
      setSiparislerim([]);
      return;
    }
    siparisleriYenile().catch(() => {});
    sadakatiYenile().catch(() => {});
  }, [authYuklendi, kullanici?.id, siparisleriYenile, sadakatiYenile]);

  const masaSiparisleriniTamamla = useCallback(() => {
    siparisleriYenile().catch(() => {});
  }, [siparisleriYenile]);

  const odulSatinAl = async (odul) => {
    const istekAnahtari = crypto.randomUUID();
    const guncel = await puanlaOdulSatinAl(odul.id, istekAnahtari);
    setSadakat(guncel);
    setPuan(guncel.puan);
    return { basarili: true };
  };

  const hediyeKullan = async (hediye) => {
    const sonuc = await kullaniciHediyesiniKullan(hediye.id, aktifMasa);
    setSadakat(sonuc.sadakat);
    setPuan(sonuc.sadakat.puan);
    await siparisleriYenile();
    return sonuc.odeme;
  };

  const burgerDamga = Number(sadakat.burgerDamga || 0);
  const DAMGA_HEDEF = Number(damgaKarti.hedefAdet || sadakat.burgerDamgaHedef || 5);
  const hediyeler = sadakat.hediyeler || [];

  // Masa kapatıldı bildirimini dinle (salon personeli kapatınca gelir).
  // O masanın siparişleri "tamamlandı" olur, masa bağlantısı temizlenir.
  useEffect(() => {
    const kapandi = ({ masaNo }) => {
      masaSiparisleriniTamamla(masaNo);
      // Bu masaya bağlıysak bağlantıyı bırak (yeni müşteri temiz başlasın)
      if (String(masaNo) === String(ozetMasaNo)) {
        setOzetMasaNo(null);
        setOzetMasaTokeni(null);
        localStorage.removeItem(depoAnahtari("bp_ozetMasa"));
        localStorage.removeItem(depoAnahtari("bp_ozetMasaTokeni"));
        sessionStorage.removeItem(depoAnahtari(`bp_cagri_oturum_${masaNo}`));
        sessionStorage.removeItem(`${depoAnahtari(`bp_cagri_oturum_${masaNo}`)}_bitis`);
        setMasaOzeti({ kalemler: [], toplam: 0 });
        setPersonelCagriOturumu(null);
        setPersonelCagrisi(null);
      }
    };
    socket.on("masa-kapandi", kapandi);
    return () => socket.off("masa-kapandi", kapandi);
  }, [ozetMasaNo, masaSiparisleriniTamamla, depoAnahtari]);

  // Başarı yalnızca backend'in onayladığı ödeme nesnesiyle işlenir. Böylece
  // tarayıcı tutarı/puanı değiştiremez ve mutfak aktarımı backend'de kalır.
  const odemeyiTamamla = (onayliOdeme) => {
    const ozet = {
      ...onayliOdeme,
      misafir,
      tarih: onayliOdeme.tarih || new Date().toISOString(),
    };
    setSonOdeme(ozet);
    if (Number.isFinite(onayliOdeme.guncelPuan)) setPuan(onayliOdeme.guncelPuan);

    if (Number.isFinite(onayliOdeme.burgerDamga)) {
      setSadakat((onceki) => ({ ...onceki, burgerDamga: onayliOdeme.burgerDamga }));
    }
    if (kullanici?.id) {
      siparisleriYenile().catch(() => {});
      sadakatiYenile().catch(() => {});
    } else {
      misafirSiparisiKaydet(ozet);
    }
    sepetiBosalt();
    setAktifMasa(null);
    return ozet;
  };

  const deger = {
    puan,
    // auth
    kullanici,
    avatar,
    avatarGuncelle,
    adminMi,
    authYuklendi,
    girisiTamamla,
    cikisYap,
    profiliGuncelle,
    kullaniciyiYenile,
    // kampanyalar (saatli/sürekli indirimler)
    aktifKampanyalar,
    kampanyalar,
    indirimliFiyat,
    // Backend tarafından yönetilen dinamik ürün kataloğu
    urunler,
    kategoriler: gosterilenKategoriler,
    // sepet (yerel/kişisel)
    sepet: aktifSepet,
    sepeteEkle,
    adetArtir,
    adetAzalt,
    sepettenCikar,
    sepetiBosalt,
    sepetToplam,
    sepetAdet,
    oneriler,
    oneriReferansi,
    oneriOlayiGonder,
    // ödeme
    sonOdeme,
    odemeyiTamamla,
    // siparişlerim (üye için backend'den, misafir için bu cihazda kalıcı liste)
    siparislerim: kullanici?.id ? siparislerim : misafirSiparisleri,
    siparisleriYenile,
    // burger damga sayacı (5 al 1 bedava)
    burgerDamga,
    burgerDamgaHedef: DAMGA_HEDEF,
    damgaKarti: { ...damgaKarti, hedefAdet: DAMGA_HEDEF },
    // hediye envanteri (Ye Kazan + puanla alınan ödüller)
    hediyeler,
    oduller: sadakat.oduller || [],
    puanGecmisi: sadakat.puanGecmisi || [],
    hediyeKullan,
    odulSatinAl,
    // masa özeti (canlı, masadaki herkesin siparişi)
    masaOzeti,
    ozetMasaNo,
    ozetMasaTokeni,
    masaDurumu,
    personelCagrisi,
    personelCagriHazir: Boolean(ozetMasaNo && personelCagriOturumu),
    personelCagriYukleniyor,
    personelCagriHatasi,
    personelCagir,
    // aktif masa (QR ile gelen)
    aktifMasa,
    aktifMasaTokeni,
    setAktifMasa,
    // misafir oturumu
    misafir,
    setMisafir,
  };

  return <AppContext.Provider value={deger}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp, AppProvider içinde kullanılmalı");
  return ctx;
}
