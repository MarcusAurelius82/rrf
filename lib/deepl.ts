export interface Language {
  code: string;
  label: string;
  flag: string;
  deeplCode: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "ES",    label: "Español",    flag: "🇪🇸", deeplCode: "ES"    }, // Venezuelan, Cuban, Central American
  { code: "AR",    label: "العربية",    flag: "🇸🇦", deeplCode: "AR"    }, // Syrian, Iraqi, Somali diaspora
  { code: "FA",    label: "فارسی",      flag: "🇮🇷", deeplCode: "FA"    }, // Afghan (Dari ≈ Farsi), Iranian
  { code: "FR",    label: "Français",   flag: "🇫🇷", deeplCode: "FR"    }, // Congolese, West African
  { code: "PT-BR", label: "Português",  flag: "🇧🇷", deeplCode: "PT-BR" }, // Brazilian, Angolan, Venezuelan PT
  { code: "TR",    label: "Türkçe",     flag: "🇹🇷", deeplCode: "TR"    }, // Afghan/Syrian transit population
  { code: "ZH",    label: "中文",        flag: "🇨🇳", deeplCode: "ZH"    }, // Chinese asylum seekers
  { code: "UK",    label: "Українська", flag: "🇺🇦", deeplCode: "UK"    }, // Ukrainian
  { code: "RU",    label: "Русский",    flag: "🇷🇺", deeplCode: "RU"    }, // Russian-speaking former Soviet states
  { code: "ID",    label: "Indonesia",  flag: "🇮🇩", deeplCode: "ID"    }, // Southeast Asian populations
  { code: "KO",    label: "한국어",      flag: "🇰🇷", deeplCode: "KO"    }, // North Korean defectors
];

export async function translateText(text: string, targetLang: string): Promise<string> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target_lang: targetLang }),
  });
  if (!res.ok) return text;
  const { data } = await res.json();
  return data?.translated_text ?? text;
}
