import { useEffect, useState } from "react";
import { useIsletmeNavigate } from "../hooks/useIsletmeNavigate";
import QRCode from "qrcode";
import { useApp } from "../context/AppContext";
import {
  IconEdit, IconUser, IconReceipt, IconHelp, IconLogout, IconChevron, IconQr, IconGift, IconWallet, IconChat, IconShield,
} from "../components/Icons";
import OrtakHeader from "../components/OrtakHeader";
import SayfaSarici from "../components/SayfaSarici";
import DilSecici from "../components/DilSecici";
import UyeOl from "./UyeOl";
import { davetOzetiniGetir, ikiFaktorKurulumBaslat, ikiFaktorKurulumOnayla, ikiFaktorKapat } from "../lib/authApi";
import { useDil } from "../dil/DilContext";
import "./Profile.css";

const menuSatirlari = [
  { etiket: "profile.wallet", Ikon: IconWallet, yol: "/cuzdanim" },
  { etiket: "profile.personal", Ikon: IconUser, yol: "/profil-duzenle" },
  { etiket: "profile.gifts", Ikon: IconGift, yol: "/hediyelerim" },
  { etiket: "profile.orderHistory", Ikon: IconReceipt, yol: "/siparislerim" },
  { etiket: "profile.feedback", Ikon: IconChat, yol: "/sikayet" },
  { etiket: "profile.support", Ikon: IconHelp, yol: null },
];

export default function Profile() {
  const { t } = useDil();
  const { misafir, adminMi, kullanici, cikisYap, avatar, kullaniciyiYenile } = useApp();
  const git = useIsletmeNavigate();
  const [yardimAcik, setYardimAcik] = useState(false);
  const [davetOzeti, setDavetOzeti] = useState(null);
  const [davetKopyalandi, setDavetKopyalandi] = useState(false);
  const [ikiFaktorModal, setIkiFaktorModal] = useState(false);
  const [ikiFaktorAdim, setIkiFaktorAdim] = useState("baslangic");
  const [ikiFaktorSifre, setIkiFaktorSifre] = useState("");
  const [ikiFaktorKod, setIkiFaktorKod] = useState("");
  const [ikiFaktorKurulum, setIkiFaktorKurulum] = useState(null);
  const [kurtarmaKodlari, setKurtarmaKodlari] = useState([]);
  const [ikiFaktorHata, setIkiFaktorHata] = useState("");
  const [ikiFaktorYukleniyor, setIkiFaktorYukleniyor] = useState(false);

  useEffect(() => {
    if (!kullanici?.id) return;
    let iptal = false;
    davetOzetiniGetir().then((ozet) => { if (!iptal) setDavetOzeti(ozet); }).catch(() => {});
    return () => { iptal = true; };
  }, [kullanici?.id]);

  const davetKodunuKopyala = async () => {
    const kod = davetOzeti?.davetKodu || kullanici?.davetKodu;
    if (!kod) return;
    try {
      await navigator.clipboard.writeText(kod);
      setDavetKopyalandi(true);
      setTimeout(() => setDavetKopyalandi(false), 1800);
    } catch {
      setDavetKopyalandi(false);
    }
  };

  const ikiFaktorPenceresiniAc = () => {
    setIkiFaktorAdim(kullanici?.ikiFaktorAktif ? "kapat" : "baslangic");
    setIkiFaktorSifre(""); setIkiFaktorKod(""); setIkiFaktorKurulum(null);
    setKurtarmaKodlari([]); setIkiFaktorHata(""); setIkiFaktorModal(true);
  };

  const ikiFaktorKurulumuBaslat = async () => {
    setIkiFaktorYukleniyor(true); setIkiFaktorHata("");
    try {
      const sonuc = await ikiFaktorKurulumBaslat(ikiFaktorSifre);
      const qrDataUrl = await QRCode.toDataURL(sonuc.otpauthUri, { width: 260, margin: 1, errorCorrectionLevel: "M" });
      setIkiFaktorKurulum({ ...sonuc, qrDataUrl });
      setIkiFaktorSifre(""); setIkiFaktorAdim("dogrula");
    } catch (e) { setIkiFaktorHata(e.message); }
    finally { setIkiFaktorYukleniyor(false); }
  };

  const ikiFaktorKurulumunuOnayla = async () => {
    setIkiFaktorYukleniyor(true); setIkiFaktorHata("");
    try {
      const sonuc = await ikiFaktorKurulumOnayla(ikiFaktorKod);
      setKurtarmaKodlari(sonuc.kurtarmaKodlari || []);
      setIkiFaktorKod(""); setIkiFaktorAdim("kurtarma");
      await kullaniciyiYenile();
    } catch (e) { setIkiFaktorHata(e.message); }
    finally { setIkiFaktorYukleniyor(false); }
  };

  const ikiFaktoruKapat = async () => {
    setIkiFaktorYukleniyor(true); setIkiFaktorHata("");
    try {
      await ikiFaktorKapat(ikiFaktorSifre, ikiFaktorKod);
      await kullaniciyiYenile();
      setIkiFaktorModal(false);
    } catch (e) { setIkiFaktorHata(e.message); }
    finally { setIkiFaktorYukleniyor(false); }
  };

  // Misafir profil bölümüne giremez — üyeliğe davet ekranı göster
  if (misafir) {
    return (
      <UyeOl
        baslik={t("profile.joinTitle")}
        aciklama={t("profile.joinText")}
        dilSecici
      />
    );
  }

  return (
    <div className="ekran profile">
      <OrtakHeader />
      <SayfaSarici>

      <div className="profile-govde">
        {/* Avatar bloğu */}
        <div className="profil-avatar-blok">
          <div className="profil-avatar-wrap">
            {avatar ? <img className="profil-avatar" src={avatar} alt="Profil" /> : <div className="profil-avatar profil-avatar-harf">{kullanici ? kullanici.ad.charAt(0).toUpperCase() : "?"}</div>}
            <button className="profil-duzenle" aria-label={t("profile.edit")} onClick={() => git("/profil-duzenle")}><IconEdit /></button>
          </div>
          <h2 className="profil-ad">
            {kullanici ? `${kullanici.ad} ${kullanici.soyad}` : t("profile.guest")}
          </h2>
          <p className="profil-uyelik">
            {kullanici ? kullanici.email : t("profile.notSignedIn")}
          </p>
        </div>

        {kullanici && (
          <section className="profil-davet-kart">
            <div className="profil-davet-ust">
              <div><span>{t("profile.inviteCode")}</span><strong>{davetOzeti?.davetKodu || kullanici.davetKodu || "—"}</strong></div>
              <button type="button" onClick={davetKodunuKopyala} disabled={!davetOzeti?.davetKodu && !kullanici.davetKodu}>{davetKopyalandi ? t("profile.copied") : t("profile.copy")}</button>
            </div>
            <p>{t("profile.inviteText")}</p>
            <div className="profil-davet-ozet">
              <span><b>{davetOzeti?.davetEdilenSayisi ?? 0}</b>{t("profile.invited")}</span>
              <span><b>{davetOzeti?.odulluSiparisSayisi ?? 0}</b>{t("profile.rewardedOrders")}</span>
              <span><b>{davetOzeti?.kazanilanPuan ?? 0}</b>{t("profile.earnedPoints")}</span>
            </div>
          </section>
        )}

        {/* İşletme bölümü — SADECE ADMIN görür */}
        {adminMi && (
          <>
            <div className="profil-isletme-baslik">{t("profile.business")}</div>
            <button className="profil-menu isletme-satir" onClick={() => git("/qr-uret")}>
              <span className="profil-menu-ikon-daire isletme-ikon"><IconQr /></span>
              <div className="isletme-metin">
                <span className="profil-menu-ad">{t("profile.tableQr")}</span>
                <span className="isletme-alt">{t("profile.tableQrHint")}</span>
              </div>
              <IconChevron className="profil-menu-ok" />
            </button>
          </>
        )}

        {/* Menü satırları */}
        <div className="profil-menu">
          <div className="profil-menu-satir profil-dil-satir">
            <span className="profil-menu-ikon-daire profil-dil-ikon" aria-hidden="true">文</span>
            <span className="profil-menu-ad">{t("language.label")}</span>
            <DilSecici />
          </div>
          <button className="profil-menu-satir" onClick={ikiFaktorPenceresiniAc}>
          <span className="profil-menu-ikon-daire profil-2fa-ikon" aria-hidden="true"><IconShield /></span>
            <span className="profil-menu-ad">{t("profile.twoFactor")}<small className="profil-2fa-durum">{kullanici?.ikiFaktorAktif ? t("profile.enabled") : t("profile.disabled")}</small></span>
            <IconChevron className="profil-menu-ok" />
          </button>
          {menuSatirlari.map(({ etiket, Ikon, yol }) => (
            <button
              key={etiket}
              className="profil-menu-satir"
              onClick={() => yol ? git(yol) : setYardimAcik(true)}
            >
              <span className={`profil-menu-ikon-daire${etiket === "profile.feedback" ? " profil-menu-ikon-daire--chat" : ""}`}><Ikon /></span>
              <span className="profil-menu-ad">{t(etiket)}</span>
              <IconChevron className="profil-menu-ok" />
            </button>
          ))}
        </div>

        {/* Çıkış */}
        <button className="cikis-btn" onClick={() => { cikisYap(); git("/"); }}>
          <IconLogout className="cikis-ikon" />
          {t("profile.logout")}
        </button>
        {yardimAcik && <div className="destek-perde" onClick={() => setYardimAcik(false)}><section className="destek-modal" onClick={(e) => e.stopPropagation()}><span>{t("profile.supportBrand")}</span><h3>{t("profile.supportTitle")}</h3><p>{t("profile.supportText")}</p><p className="destek-not">{t("profile.supportHours")}</p><a href="mailto:info@masanpos.com">info@masanpos.com</a><button onClick={() => setYardimAcik(false)}>{t("common.close")}</button></section></div>}
        {ikiFaktorModal && (
          <div className="destek-perde" onClick={() => ikiFaktorAdim !== "kurtarma" && setIkiFaktorModal(false)}>
            <section className="destek-modal iki-faktor-modal" onClick={(e) => e.stopPropagation()}>
              <span>{t("profile.security")}</span>
              <h3>{t("profile.twoFactor")}</h3>
              {ikiFaktorAdim === "baslangic" && <><p>{t("profile.setupText")}</p><label>{t("profile.currentPassword")}<input type="password" value={ikiFaktorSifre} onChange={(e) => setIkiFaktorSifre(e.target.value.slice(0, 72))} autoComplete="current-password" /></label><button className="iki-faktor-ana-btn" onClick={ikiFaktorKurulumuBaslat} disabled={!ikiFaktorSifre || ikiFaktorYukleniyor}>{t("profile.startSetup")}</button></>}
              {ikiFaktorAdim === "dogrula" && <><p>{t("profile.scanText")}</p><img className="iki-faktor-qr" src={ikiFaktorKurulum?.qrDataUrl} alt="Authenticator setup QR code" /><code className="iki-faktor-secret">{ikiFaktorKurulum?.secret}</code><label>{t("profile.sixDigitCode")}<input inputMode="numeric" autoComplete="one-time-code" value={ikiFaktorKod} onChange={(e) => setIkiFaktorKod(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" /></label><button className="iki-faktor-ana-btn" onClick={ikiFaktorKurulumunuOnayla} disabled={ikiFaktorKod.length !== 6 || ikiFaktorYukleniyor}>{t("profile.enable")}</button></>}
              {ikiFaktorAdim === "kurtarma" && <><p>{t("profile.recoveryText")}</p><div className="iki-faktor-kodlar">{kurtarmaKodlari.map((kod) => <code key={kod}>{kod}</code>)}</div><button className="iki-faktor-ana-btn" onClick={async () => { await navigator.clipboard.writeText(kurtarmaKodlari.join("\n")).catch(() => {}); }}>{t("profile.copyCodes")}</button><button onClick={() => setIkiFaktorModal(false)}>{t("profile.savedFinish")}</button></>}
              {ikiFaktorAdim === "kapat" && <><p>{t("profile.disableText")}</p><label>{t("profile.currentPassword")}<input type="password" value={ikiFaktorSifre} onChange={(e) => setIkiFaktorSifre(e.target.value.slice(0, 72))} autoComplete="current-password" /></label><label>{t("profile.verificationCode")}<input value={ikiFaktorKod} onChange={(e) => setIkiFaktorKod(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 11))} autoComplete="one-time-code" /></label><button className="iki-faktor-tehlike-btn" onClick={ikiFaktoruKapat} disabled={!ikiFaktorSifre || !ikiFaktorKod || ikiFaktorYukleniyor}>{t("profile.disableTwoFactor")}</button></>}
              {ikiFaktorHata && <p className="iki-faktor-hata">{ikiFaktorHata}</p>}
              {ikiFaktorAdim !== "kurtarma" && <button onClick={() => setIkiFaktorModal(false)}>{t("profile.cancel")}</button>}
            </section>
          </div>
        )}
      </div>
      </SayfaSarici>
    </div>
  );
}
