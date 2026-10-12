export function headphoneFormat(product) {
  const title=String(product?.titulo||product?.title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/ear.?clip|open.?ear|orelha aberta|audio direcional|gancho/.test(title)) return 'open-ear';
  if(/headphone|headset|over.?ear|on.?ear|jbl.*(?:520|720|770|510)/.test(title)) return 'headphone';
  if(/tws|earbuds|\bbuds\b|intra.?auricular/.test(title)) return 'tws';
  if(/com fio|\bp2\b|3[.,]5mm/.test(title)) return 'wired';
  return 'unknown';
}
export const headphoneFormats={
  tws:['Fones TWS e intra-auriculares','Formato compacto; confira vedação, encaixe, autonomia e microfone. Não equivale a um headphone.'],
  headphone:['Headphones e headsets','Arco sobre a cabeça; confira conforto, peso e isolamento. Headset pode ter proposta própria para chamadas ou jogos.'],
  'open-ear':['Fones abertos, ear clip e com gancho','Proposta de encaixe aberto ou esportivo; confirme formato, vazamento de som e estabilidade. Não presume isolamento.'],
  wired:['Fones com fio','Confira conector e compatibilidade; não compare autonomia com modelos sem fio.'],
  unknown:['Formato a confirmar','O título não identifica o formato com segurança. Confira a variante e a ficha antes de comparar.'],
};
