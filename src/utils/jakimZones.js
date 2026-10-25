// Verbatim from iOS PrayerTimeService.swift — do NOT change zone codes.
// Sarawak = SWK (not SRW), Kelantan = KTN (not KEL), etc.

export const DISTRICT_ZONE_MAP = {
  // Johor
  "johor bahru":"JHR02","kota tinggi":"JHR02","mersing":"JHR02","kulai":"JHR02",
  "kluang":"JHR03","pontian":"JHR03",
  "batu pahat":"JHR04","muar":"JHR04","segamat":"JHR04","tangkak":"JHR04","gemas":"JHR04",
  // Kedah
  "kota setar":"KDH01","kubang pasu":"KDH01","pokok sena":"KDH01",
  "kuala muda":"KDH02","yan":"KDH02","pendang":"KDH02",
  "padang terap":"KDH03","sik":"KDH03","baling":"KDH04",
  "bandar baharu":"KDH05","kulim":"KDH05","langkawi":"KDH06",
  // Kelantan
  "bachok":"KTN01","kota bharu":"KTN01","machang":"KTN01","pasir mas":"KTN01",
  "pasir puteh":"KTN01","tanah merah":"KTN01","tumpat":"KTN01","kuala krai":"KTN01",
  "gua musang":"KTN02","jeli":"KTN02","lojing":"KTN02",
  // Melaka
  "melaka tengah":"MLK01","alor gajah":"MLK01","jasin":"MLK01",
  // Negeri Sembilan
  "tampin":"NGS01","jempol":"NGS01",
  "jelebu":"NGS02","kuala pilah":"NGS02","rembau":"NGS02",
  "port dickson":"NGS03","seremban":"NGS03",
  // Pahang
  "kuantan":"PHG02","pekan":"PHG02","muadzam shah":"PHG02","rompin":"PHG02",
  "jerantut":"PHG03","temerloh":"PHG03","maran":"PHG03","bera":"PHG03",
  "bentong":"PHG04","lipis":"PHG04","raub":"PHG04","cameron highlands":"PHG06",
  // Perlis
  "kangar":"PLS01","padang besar":"PLS01","arau":"PLS01","perlis":"PLS01",
  // Pulau Pinang
  "timur laut":"PNG01","barat daya":"PNG01","seberang perai tengah":"PNG01",
  "seberang perai utara":"PNG01","seberang perai selatan":"PNG01","george town":"PNG01",
  // Perak
  "muallim":"PRK01","batang padang":"PRK01",
  "kinta":"PRK02","ipoh":"PRK02","kuala kangsar":"PRK02","kampar":"PRK02",
  "batu gajah":"PRK02","sungai siput":"PRK02",
  "hulu perak":"PRK03","gerik":"PRK03","grik":"PRK03","lenggong":"PRK03","pengkalan hulu":"PRK03",
  "hilir perak":"PRK05","teluk intan":"PRK05","bagan datuk":"PRK05",
  "perak tengah":"PRK05","seri iskandar":"PRK05","manjung":"PRK05",
  "kerian":"PRK06","larut matang":"PRK06","taiping":"PRK06","selama":"PRK06",
  "bagan serai":"PRK06","parit buntar":"PRK06",
  // Sabah
  "sandakan":"SBH01","beluran":"SBH02",
  "lahad datu":"SBH03","kunak":"SBH03","semporna":"SBH03",
  "tawau":"SBH04","kalabakan":"SBH04",
  "kudat":"SBH05","kota marudu":"SBH05","pitas":"SBH05",
  "kota kinabalu":"SBH07","papar":"SBH07","kota belud":"SBH07","tuaran":"SBH07",
  "penampang":"SBH07","putatan":"SBH07","ranau":"SBH07",
  "keningau":"SBH08","tambunan":"SBH08","nabawan":"SBH08","pensiangan":"SBH08",
  "beaufort":"SBH09","kuala penyu":"SBH09","sipitang":"SBH09","tenom":"SBH09",
  // Selangor
  "gombak":"SGR01","petaling":"SGR01","sepang":"SGR01","hulu langat":"SGR01",
  "hulu selangor":"SGR01","shah alam":"SGR01",
  "kuala selangor":"SGR02","sabak bernam":"SGR02",
  "klang":"SGR03","kuala langat":"SGR03",
  // Sarawak
  "limbang":"SWK01","lawas":"SWK01",
  "miri":"SWK02","marudi":"SWK02","bekenu":"SWK02",
  "bintulu":"SWK03","tatau":"SWK03","belaga":"SWK03",
  "sibu":"SWK04","mukah":"SWK04","dalat":"SWK04","kapit":"SWK04","kanowit":"SWK04",
  "sarikei":"SWK05","julau":"SWK05","daro":"SWK05",
  "sri aman":"SWK06","betong":"SWK06","saratok":"SWK06","lubok antu":"SWK06",
  "serian":"SWK07","simunjan":"SWK07","samarahan":"SWK07",
  "kuching":"SWK08","bau":"SWK08","lundu":"SWK08","sematan":"SWK08",
  // Terengganu
  "kuala terengganu":"TRG01","marang":"TRG01","kuala nerus":"TRG01",
  "besut":"TRG02","setiu":"TRG02","hulu terengganu":"TRG03",
  "dungun":"TRG04","kemaman":"TRG04",
  // Wilayah Persekutuan
  "kuala lumpur":"WLY01","putrajaya":"WLY01","labuan":"WLY02",
};

// Fallback by state (matched with .includes so "Johor Darul Takzim" works)
export const STATE_DEFAULT_ZONE = [
  ["johor","JHR02"],["kedah","KDH01"],["kelantan","KTN01"],["melaka","MLK01"],["malacca","MLK01"],
  ["negeri sembilan","NGS03"],["pahang","PHG02"],["perlis","PLS01"],["pulau pinang","PNG01"],
  ["penang","PNG01"],["perak","PRK02"],["sabah","SBH07"],["selangor","SGR01"],["sarawak","SWK08"],
  ["terengganu","TRG01"],["kuala lumpur","WLY01"],["putrajaya","WLY01"],["labuan","WLY02"],
  ["wilayah persekutuan","WLY01"],
];
