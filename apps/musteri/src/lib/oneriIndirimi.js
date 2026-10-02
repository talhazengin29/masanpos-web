const paraYuvarla = (deger) => Math.round(Number(deger) * 100) / 100;

export function oneriIndirimAyariniDonustur(ayar = {}) {
  const oran = Number(ayar?.indirimYuzde);
  return {
    aktif: ayar?.aktif === true,
    indirimYuzde: Number.isFinite(oran) && oran >= 1 && oran <= 50 ? Math.round(oran * 10) / 10 : 0,
  };
}

export function oneriUrunFiyatiniGuncelle(urun, ayar) {
  const guncelAyar = oneriIndirimAyariniDonustur(ayar);
  const normalFiyat = Number(urun?.normalFiyat ?? urun?.fiyat ?? 0);
  return {
    ...urun,
    normalFiyat,
    fiyat: guncelAyar.aktif ? paraYuvarla(normalFiyat * (1 - guncelAyar.indirimYuzde / 100)) : normalFiyat,
    oneriIndirimYuzde: guncelAyar.aktif ? guncelAyar.indirimYuzde : 0,
  };
}

export function oneriSepetSatiriniGuncelle(satir, ayar, kampanyaYuzde = 0) {
  const oneridenEklendi = Array.isArray(satir?.oneriReferanslari) && satir.oneriReferanslari.length > 0;
  if (!oneridenEklendi) return satir;

  const guncelAyar = oneriIndirimAyariniDonustur(ayar);
  const normalTemelFiyat = Number(satir.normalFiyat ?? satir.orijinalFiyat ?? satir.fiyat ?? 0);
  const toplamNormalFiyat = Number(satir.orijinalFiyat ?? normalTemelFiyat);
  const ekFiyat = Math.max(0, toplamNormalFiyat - normalTemelFiyat);
  const kampanyaOrani = Math.max(0, Number(kampanyaYuzde) || 0);
  const adaylar = [
    { kaynak: null, fiyat: toplamNormalFiyat },
    ...(kampanyaOrani > 0 ? [{ kaynak: "kampanya", fiyat: paraYuvarla(normalTemelFiyat * (1 - kampanyaOrani / 100)) + ekFiyat }] : []),
    ...(guncelAyar.aktif ? [{ kaynak: "oneri", fiyat: paraYuvarla(normalTemelFiyat * (1 - guncelAyar.indirimYuzde / 100)) + ekFiyat }] : []),
  ];
  const enIyi = adaylar.reduce((sonuc, aday) => aday.fiyat < sonuc.fiyat ? aday : sonuc, adaylar[0]);

  const guncel = {
    ...satir,
    normalFiyat: normalTemelFiyat,
    orijinalFiyat: toplamNormalFiyat,
    fiyat: paraYuvarla(enIyi.fiyat),
    oneriIndirimYuzde: guncelAyar.aktif ? guncelAyar.indirimYuzde : 0,
    uygulananIndirimKaynagi: enIyi.kaynak || undefined,
  };
  if (
    Number(satir.fiyat) === Number(guncel.fiyat)
    && Number(satir.normalFiyat) === Number(guncel.normalFiyat)
    && Number(satir.orijinalFiyat) === Number(guncel.orijinalFiyat)
    && Number(satir.oneriIndirimYuzde || 0) === Number(guncel.oneriIndirimYuzde || 0)
    && satir.uygulananIndirimKaynagi === guncel.uygulananIndirimKaynagi
  ) return satir;
  return guncel;
}
