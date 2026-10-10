// Writes docs/legal-review.md from the country data: every legal value with
// the source that backs it, for a person to check (design doc: laws drafted
// with AI need human review before verifiedAt is filled).
// Usage: node scripts/legal-review.js

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { resolveCountry } from '../src/engine/countries.js';

const countriesById = loadCountries(fileURLToPath(new URL('../data/countries/', import.meta.url)));
const NAMES = { BR: 'Brasil', US: 'Estados Unidos', JP: 'Japão', RU: 'Rússia', GB: 'Reino Unido (Inglaterra)' };
const FIELDS = {
  'ages.majority': 'Maioridade',
  'ages.drinking': 'Idade para beber',
  'ages.smoking': 'Idade para fumar',
  'ages.driving': 'Idade para dirigir',
  'ages.criminalResponsibility': 'Responsabilidade penal (justiça juvenil)',
  education: 'Sistema escolar',
};

function valueOf(country, field) {
  if (field === 'education') {
    const { schoolYearStartMonth, stages } = country.education;
    const list = stages.map((s) => `${s.id} ${s.startAge}+ (${s.years} anos${s.entranceExam ? ', exame' : ''})`).join('; ');
    return `mês ${schoolYearStartMonth} a ${country.education.schoolYearEndMonth ?? '(mês anterior ao início)'}; ${list}`;
  }
  return String(field.split('.').reduce((value, key) => value[key], country));
}

const lines = [
  '# Revisão das leis por país',
  '',
  'Gerado por `node scripts/legal-review.js` a partir de `data/countries/`. Não edite à mão: corrija os dados e gere de novo.',
  '',
  'Situação de cada item: `researched` (pesquisado, com fonte primária indicada, falta conferir), `needs_primary_check` (⚠️ detalhe que muda ou varia por região; conferir com atenção) ou `verified`. Ao conferir, preencha `verifiedAt` (data) e troque `reviewStatus` para `"verified"` no JSON do país; se o valor estiver errado, corrija o campo e a fonte. Pesquisa de base: `docs/fontes-paises.md`.',
  '',
  '`risk` dos temas sensíveis continua sem valor: nenhuma mecânica usa ainda e as fontes não dão um número.',
];

for (const id of Object.keys(NAMES)) {
  const country = resolveCountry(id, countriesById);
  lines.push('', `## ${NAMES[id]}`, '', '| Conferido | Item | Valor no jogo | Fonte citada | Situação |', '| --- | --- | --- | --- | --- |');
  for (const [field, label] of Object.entries(FIELDS)) {
    const source = country.legalSources?.[field] ?? {};
    const status = source.verifiedAt ? `verificado em ${source.verifiedAt}` : source.reviewStatus ?? 'sem fonte';
    lines.push(`| [${source.verifiedAt ? 'x' : ' '}] | ${label} | ${valueOf(country, field)} | ${source.source ?? '—'} | ${status} |`);
  }
  const topic = country.topics?.same_sex_relationship;
  if (topic) {
    const status = topic.verifiedAt ? `verificado em ${topic.verifiedAt}` : topic.reviewStatus ?? 'sem fonte';
    const value = `legal: ${topic.legal ?? '—'}; aceitação: ${topic.acceptance ?? '—'}; risco: ${topic.risk ?? '—'}`;
    lines.push(`| [${topic.verifiedAt ? 'x' : ' '}] | Casal do mesmo sexo | ${value} | ${topic.source ?? '—'} | ${status} |`);
  }
}

writeFileSync(fileURLToPath(new URL('../docs/legal-review.md', import.meta.url)), lines.join('\n') + '\n');
console.log('docs/legal-review.md written');
