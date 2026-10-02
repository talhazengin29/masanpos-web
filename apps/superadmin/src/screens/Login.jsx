import { useState } from "react";
import { superGiris, superIkiFaktor, superToken } from "../lib/superApi";
import { Hata } from "../components/Ui";

function GozIkonu({ kapali }) {
  return kapali ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.3A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.1 3.7M6.2 6.5A17.2 17.2 0 0 0 2.5 12S6 18 12 18c1.4 0 2.7-.3 3.8-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.8" /></svg>
  );
}

export default function Login({ onGiris }) {
  const varlikTabani = import.meta.env.BASE_URL;
  const [form, setForm] = useState({ email: "", sifre: "", kod: "" });
  const [ikiFaktor, setIkiFaktor] = useState(null);
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sifreGorunur, setSifreGorunur] = useState(false);

  const gonder = async (e) => {
    e.preventDefault();
    setHata("");
    setYukleniyor(true);
    try {
      if (!ikiFaktor) {
        const sonuc = await superGiris(form.email.trim(), form.sifre);
        setIkiFaktor(sonuc);
        setForm((onceki) => ({ ...onceki, sifre: "" }));
      } else {
        if (!/^\d{6}$/.test(form.kod.trim())) throw new Error("Authenticator uygulamasındaki 6 haneli kodu girin.");
        const sonuc = await superIkiFaktor(ikiFaktor.ikiFaktorToken, form.kod.trim());
        superToken.kaydet(sonuc.token);
        onGiris(sonuc.superAdmin);
      }
    } catch (istekHatasi) {
      setHata(istekHatasi.message);
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <main className="super-login">
      <span className="super-login-isik super-login-isik--bir" />
      <span className="super-login-isik super-login-isik--iki" />

      <section className="super-login-kabuk">
        <aside className="super-login-tanitim">
          <div className="super-login-marka">
            <span className="super-login-logo" aria-label="MasanPOS">
              <img className="super-login-logo--acik" src={`${varlikTabani}gorseller/masanpos-logo.webp`} alt="MasanPOS" />
              <img className="super-login-logo--koyu" src={`${varlikTabani}gorseller/masanpos-logo-dark.webp`} alt="MasanPOS" />
            </span>
            <span>SUPER ADMIN</span>
          </div>
          <div className="super-login-tanitim-metin">
            <small>MERKEZİ YÖNETİM PLATFORMU</small>
            <h1>Tüm işletmeler,<br /><em>tek merkezden.</em></h1>
            <p>İşletmeleri, abonelikleri, platform gelirini ve operasyon güvenliğini tek bir kontrol merkezinden yönetin.</p>
          </div>
          <ul className="super-login-guvenlik-listesi">
            <li><i>✓</i><span><b>İki faktörlü doğrulama</b><small>Her oturumda zorunlu güvenlik adımı</small></span></li>
            <li><i>✓</i><span><b>Denetim kaydı</b><small>Yönetim işlemleri eksiksiz kaydedilir</small></span></li>
            <li><i>✓</i><span><b>Otomatik oturum sonlandırma</b><small>Hareketsizlik durumunda güvenli çıkış</small></span></li>
          </ul>
          <footer><i /> Güvenli platform bağlantısı</footer>
        </aside>

        <article className="super-login-kart">
          <header>
            <span className="super-login-adim">ADIM {ikiFaktor ? "2 / 2" : "1 / 2"}</span>
            <h2>{ikiFaktor ? "Kimliğini doğrula" : "Yönetici girişi"}</h2>
            <p>{ikiFaktor ? "Authenticator uygulamandaki güncel kodu gir." : "Platform yönetimine devam etmek için bilgilerini gir."}</p>
          </header>

          <div className="super-login-guvenlik-notu">
            <i>⌾</i>
            <span><b>Yüksek güvenlikli oturum</b><small>4 saatlik yetki · zorunlu 2FA · işlem denetimi</small></span>
          </div>

          <form onSubmit={gonder}>
            <Hata mesaj={hata} />
            {ikiFaktor ? (
              <>
                {ikiFaktor.ikiFaktorKurulumGerekli && (
                  <div className="totp-kurulum">
                    <b>İlk kurulum anahtarı</b>
                    <code>{ikiFaktor.secret}</code>
                    <p>Bu anahtarı Google Authenticator, Microsoft Authenticator veya uyumlu bir TOTP uygulamasına ekleyin.</p>
                    <a href={ikiFaktor.otpauthUri}>Authenticator uygulamasında aç →</a>
                  </div>
                )}
                <label>
                  <span>6 haneli doğrulama kodu</span>
                  <input
                    className="super-kod-input"
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength="6"
                    value={form.kod}
                    onChange={(e) => setForm({ ...form, kod: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    placeholder="000000"
                  />
                </label>
                <button className="super-login-birincil" disabled={yukleniyor || form.kod.length !== 6}>{yukleniyor ? "Doğrulanıyor…" : "Güvenli Oturumu Aç"}</button>
                <button type="button" className="super-login-ikincil" onClick={() => { setIkiFaktor(null); setForm((onceki) => ({ ...onceki, kod: "" })); }}>← Giriş bilgilerine dön</button>
              </>
            ) : (
              <>
                <label>
                  <span>E-posta adresi</span>
                  <input type="email" autoComplete="username" required maxLength="254" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="yonetici@masanpos.com" />
                </label>
                <label>
                  <span>Şifre</span>
                  <div className="super-sifre-alani">
                    <input type={sifreGorunur ? "text" : "password"} autoComplete="current-password" required maxLength="72" value={form.sifre} onChange={(e) => setForm({ ...form, sifre: e.target.value })} placeholder="••••••••" />
                    <button type="button" onClick={() => setSifreGorunur((onceki) => !onceki)} aria-label={sifreGorunur ? "Şifreyi gizle" : "Şifreyi göster"}>
                      <GozIkonu kapali={sifreGorunur} />
                    </button>
                  </div>
                </label>
                <button className="super-login-birincil" disabled={yukleniyor}>{yukleniyor ? "Kontrol ediliyor…" : "İki Faktör Adımına Geç"}<span>→</span></button>
              </>
            )}
          </form>
          <footer>Yetkili oturumlarda yapılan tüm işlemler denetim günlüğüne yazılır.</footer>
        </article>
      </section>
    </main>
  );
}
