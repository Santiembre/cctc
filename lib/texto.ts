// Utilidades de texto para búsqueda sin acentos y para generar ids legibles.

// Marcas diacríticas que quedan sueltas tras normalizar a NFD.
// Coincide con el acento combinado de "é" ("e" + "́"); no coincide con "e" ni con "ñ" ya separada en "n".
// Probar: https://regex101.com/?regex=%5Cp%7BDiacritic%7D&flags=gu&testString=ce%CC%81lula
const DIACRITICOS = /\p{Diacritic}/gu;

// Cualquier racha de caracteres que no sean letra minúscula ASCII o dígito.
// Coincide con " " y con " — " en "taller — react"; no coincide con "react" ni con "2027".
// Probar: https://regex101.com/?regex=%5B%5Ea-z0-9%5D%2B&flags=g&testString=taller%20%E2%80%94%20react%202027
const NO_ALFANUMERICO = /[^a-z0-9]+/g;

const LONGITUD_MAXIMA_SLUG = 48;

/** "Cálculo Diferencial" → "calculo diferencial" */
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(DIACRITICOS, "").toLowerCase();
}

/** "Taller de Cálculo — 2027" → "taller-de-calculo-2027" */
export function crearSlug(texto: string): string {
  const slug = normalizarTexto(texto).replace(NO_ALFANUMERICO, "-");
  const sinGuionesExtremos = slug
    .split("-")
    .filter((parte) => parte.length > 0)
    .join("-");
  return sinGuionesExtremos.slice(0, LONGITUD_MAXIMA_SLUG) || "actividad";
}
