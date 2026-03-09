export const ANCIENT_LANGUAGES: Record<string, string> = {
  grc: "Ancient Greek",
  hbo: "Ancient Hebrew",
  lat: "Latin",
  syc: "Classical Syriac",
  cop: "Coptic",
  ara: "Arabic",
  akk: "Akkadian",
  egy: "Egyptian",
  got: "Gothic",
  arm: "Armenian",
  geo: "Georgian",
  eth: "Ethiopic (Ge'ez)",
  san: "Sanskrit",
  peo: "Old Persian",
};

export function getLanguageName(code: string): string {
  return ANCIENT_LANGUAGES[code] ?? code;
}
