export function haricMalzemeleriGetir(urun) {
  return urun.haricMalzemeler || urun.haric_malzemeler || urun.secimler?.haricMalzemeler || [];
}

export function gramajMetni(secimler) {
  const parcalar = [];
  if (Number(secimler?.toplamGramaj) > 0) {
    const ek = Number(secimler.ekstraGramaj) > 0 ? ` (+${secimler.ekstraGramaj})` : " (Standart)";
    parcalar.push(`${secimler.toplamGramaj} ${secimler.gramajBirim || "gr"} ${secimler.gramajEtiketi || "Gramaj"}${ek}`);
  } else if (secimler?.ekstraGramaj) {
    parcalar.push(`+${secimler.ekstraGramaj} ${secimler.gramajBirim || "gr"} ${secimler.gramajEtiketi || "Ekstra gramaj"}`);
  }
  if (secimler?.boyutEtiketi) parcalar.push(`${secimler.boyutEtiketi}: ${secimler.boyutMiktar} ${secimler.boyutBirim}`);
  if (secimler?.yanBoyutEtiketi) parcalar.push(`${secimler.yanLezzetAd}: ${secimler.yanBoyutEtiketi} (${secimler.yanBoyutMiktar} ${secimler.yanBoyutBirim})`);
  if (secimler?.icecekBoyutEtiketi) parcalar.push(`${secimler.icecekAd}: ${secimler.icecekBoyutEtiketi} (${secimler.icecekBoyutMiktar} ${secimler.icecekBoyutBirim})`);
  if (Array.isArray(secimler?.ekstraMalzemeler) && secimler.ekstraMalzemeler.length) {
    parcalar.push(`Ekstra: ${secimler.ekstraMalzemeler.map((ekstra) => ekstra.ad).join(", ")}`);
  }
  return parcalar.length ? parcalar.join(" · ") : null;
}

export function sepetAnahtariOlustur(urun) {
  return JSON.stringify({
    id: urun.id,
    oneriFirsati: Number(urun.oneriIndirimYuzde || 0) > 0,
    haricMalzemeler: [...haricMalzemeleriGetir(urun)].sort(),
    secimler: urun.secimler || {},
  });
}

export function varsayilanSecimliUrunHazirla(urun, urunler) {
  const urunTipi = urun.urunTipi || "burger";
  const varsayilanBoyut = (boyutlar, kod) =>
    boyutlar?.find((boyut) => boyut.kod === kod)
    || boyutlar?.find((boyut) => boyut.varsayilan)
    || boyutlar?.[0]
    || null;
  const menuYapisi = urunTipi === "menu" ? urun.menuYapisi : null;
  const menuBurger = menuYapisi
    ? urunler.find((aday) => Number(aday.id) === Number(menuYapisi.burgerUrunId))
    : null;
  const menuYanLezzet = menuYapisi
    ? urunler.find((aday) => Number(aday.id) === Number(menuYapisi.yanLezzetUrunId))
    : null;
  const menuIcecek = menuYapisi
    ? urunler.find((aday) => Number(aday.id) === Number(menuYapisi.icecekUrunId))
    : null;
  const gramajKaynagi = menuBurger || urun;
  const miktarGoster = Boolean(gramajKaynagi.gramajOpsiyonu) && gramajKaynagi.gramajOpsiyonu.goster !== false && Number(gramajKaynagi.temelMiktar) > 0;
  const urunBoyutu = varsayilanBoyut(urun.boyutSecenekleri);
  const yanBoyut = varsayilanBoyut(menuYanLezzet?.boyutSecenekleri, menuYapisi?.varsayilanYanBoyut);
  const icecekBoyut = varsayilanBoyut(menuIcecek?.boyutSecenekleri, menuYapisi?.varsayilanIcecekBoyut);
  const dahilMalzemeler = gramajKaynagi.malzemeler || [];
  const secimler = {
    dahilMalzemeler,
    haricMalzemeler: [],
    ...(miktarGoster ? {
      ekstraGramaj: 0,
      standartGramaj: Number(gramajKaynagi.temelMiktar || 0),
      toplamGramaj: Number(gramajKaynagi.temelMiktar || 0),
      gramajEtiketi: gramajKaynagi.gramajOpsiyonu.etiket,
      gramajBirim: gramajKaynagi.gramajOpsiyonu.birim,
    } : {}),
    ...(["yan_lezzet", "icecek"].includes(urunTipi) && urunBoyutu ? {
      boyutKodu: urunBoyutu.kod,
      boyutEtiketi: urunBoyutu.etiket,
      boyutMiktar: urunBoyutu.miktar,
      boyutBirim: urunBoyutu.birim,
    } : {}),
    ...(menuYapisi ? {
      menuBurgerId: menuBurger?.id,
      menuBurgerAd: menuBurger?.ad,
      yanLezzetId: menuYanLezzet?.id,
      yanLezzetAd: menuYanLezzet?.ad,
      yanBoyutKodu: yanBoyut?.kod,
      yanBoyutEtiketi: yanBoyut?.etiket,
      yanBoyutMiktar: yanBoyut?.miktar,
      yanBoyutBirim: yanBoyut?.birim,
      icecekId: menuIcecek?.id,
      icecekAd: menuIcecek?.ad,
      icecekBoyutKodu: icecekBoyut?.kod,
      icecekBoyutEtiketi: icecekBoyut?.etiket,
      icecekBoyutMiktar: icecekBoyut?.miktar,
      icecekBoyutBirim: icecekBoyut?.birim,
    } : {}),
    ekstraMalzemeIdleri: [],
    ekstraMalzemeler: [],
  };

  return { ...urun, haricMalzemeler: [], secimler };
}
