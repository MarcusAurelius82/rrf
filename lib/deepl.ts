export interface Language {
  code: string;
  label: string;
  flag: string;
  deeplCode: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "ES", label: "Español",    flag: "🇪🇸", deeplCode: "ES" },
  { code: "AR", label: "العربية",    flag: "🇸🇦", deeplCode: "AR" },
  { code: "FA", label: "فارسی",      flag: "🇮🇷", deeplCode: "FA" },
  { code: "FR", label: "Français",   flag: "🇫🇷", deeplCode: "FR" },
  { code: "ZH", label: "中文",        flag: "🇨🇳", deeplCode: "ZH" },
  { code: "UK", label: "Українська", flag: "🇺🇦", deeplCode: "UK" },
  { code: "RU", label: "Русский",    flag: "🇷🇺", deeplCode: "RU" },
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
