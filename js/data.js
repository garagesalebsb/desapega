// Regiões administrativas do DF com um ponto central aproximado (o vendedor ajusta o pino).
export const REGIONS = [
  ['Plano Piloto', -15.7939, -47.8828],
  ['Sudoeste/Octogonal', -15.7960, -47.9250],
  ['Águas Claras', -15.8396, -48.0262],
  ['Taguatinga', -15.8335, -48.0564],
  ['Guará', -15.8227, -47.9774],
  ['Lago Sul', -15.8416, -47.8770],
  ['Lago Norte', -15.7340, -47.8530],
  ['Sobradinho', -15.6533, -47.7899],
  ['Sobradinho II', -15.6400, -47.8200],
  ['Cruzeiro', -15.7905, -47.9406],
  ['Vicente Pires', -15.8030, -48.0280],
  ['Jardim Botânico', -15.8700, -47.8000],
  ['Park Way', -15.9000, -47.9600],
  ['Núcleo Bandeirante', -15.8714, -47.9675],
  ['Candangolândia', -15.8510, -47.9500],
  ['Arniqueira', -15.8550, -48.0080],
  ['Ceilândia', -15.8190, -48.1076],
  ['Sol Nascente/Pôr do Sol', -15.8150, -48.1450],
  ['Samambaia', -15.8786, -48.0880],
  ['Recanto das Emas', -15.9110, -48.0640],
  ['Riacho Fundo', -15.8830, -48.0170],
  ['Riacho Fundo II', -15.9060, -48.0460],
  ['Gama', -16.0198, -48.0647],
  ['Santa Maria', -16.0080, -48.0160],
  ['São Sebastião', -15.9030, -47.7760],
  ['Paranoá', -15.7744, -47.7797],
  ['Itapoã', -15.7480, -47.7680],
  ['Varjão', -15.7100, -47.8770],
  ['Planaltina', -15.6189, -47.6521],
  ['Arapoanga', -15.6300, -47.6500],
  ['Brazlândia', -15.6766, -48.2002],
  ['Fercal', -15.6000, -47.8700],
  ['SCIA/Estrutural', -15.7840, -47.9980],
  ['SIA', -15.8000, -47.9530],
  ['Água Quente', -16.0300, -48.2600],
].map(([name, lat, lng]) => ({ name, lat, lng }));

export const DF_CENTER = [-15.80, -47.93];

export const regionByName = (name) => REGIONS.find((r) => r.name === name);

export const SALE_TYPES = {
  garagem: { label: 'Venda de garagem', short: 'Garagem' },
  mudanca: { label: 'Venda de mudança', short: 'Mudança' },
  bazar: { label: 'Bazar coletivo', short: 'Bazar' },
};

export const CATEGORIES = {
  moveis: 'Móveis',
  eletrodomesticos: 'Eletrodomésticos',
  eletronicos: 'Eletrônicos',
  roupas: 'Roupas e calçados',
  infantil: 'Infantil',
  livros: 'Livros e mídia',
  casa: 'Casa e decoração',
  cozinha: 'Cozinha',
  ferramentas: 'Ferramentas',
  esportes: 'Esportes e lazer',
  jardim: 'Plantas e jardim',
  outros: 'Outros',
};

export const REPORT_REASONS = [
  'Golpe ou fraude',
  'Item proibido',
  'Conteúdo impróprio',
  'Informação falsa',
  'Venda não aconteceu',
  'Outro',
];
