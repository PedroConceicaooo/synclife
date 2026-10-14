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
  youthStipend: 'Bolsa de formação (base de clube)',
};

function valueOf(country, field) {
  if (field === 'youthStipend') {
    const { minAge, maxAge, teamLevels } = country.youthStipend;
    const amounts = Object.entries(teamLevels).map(([level, a]) => `${level} ${a.multiplier}× ${a.scale} (${country.currency.code} ${country.currency.scale[a.scale] * a.multiplier}/mês)`);
    return `${minAge} a ${maxAge} anos; ${amounts.join('; ')}`;
  }
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
  'Situação de cada item:',
  '',
  '- `ai_checked`: o texto da lei foi lido por IA na fonte indicada (link e data abaixo). Falta só a sua confirmação.',
  '- `simplified`: a regra real varia por estado ou região; o jogo usa um valor nacional representativo, explicado na fonte (regiões estão previstas no design para o futuro).',
  '- `needs_primary_check`: ⚠️ a fonte primária ainda não foi conferida; o motivo está no texto da fonte.',
  '- `Reconferir após`: o valor depende de uma decisão pendente; confira de novo depois dessa data.',
  '- `verified`: conferido por uma pessoa.',
  '',
  'Para confirmar um item, abra o link, confira e, no JSON do país, preencha `verifiedAt` (data) e troque `reviewStatus` para `"verified"`. Se o valor estiver errado, corrija o campo e a fonte. Pesquisa de base: `docs/fontes-paises.md`.',
  '',
  '`risk` dos temas sensíveis continua sem valor: nenhuma mecânica usa ainda e as fontes não dão um número.',
];

for (const id of Object.keys(NAMES)) {
  const country = resolveCountry(id, countriesById);
  lines.push('', `## ${NAMES[id]}`, '', '| Conferido | Item | Valor no jogo | Fonte citada | Situação |', '| --- | --- | --- | --- | --- |');
  for (const [field, label] of Object.entries(FIELDS)) {
    const source = country.legalSources?.[field] ?? {};
    const status = source.verifiedAt ? `verificado em ${source.verifiedAt}` : source.reviewStatus ?? 'sem fonte';
    const where = (source.checkedUrl ? ` ([link](${source.checkedUrl}), ${source.checkedAt})` : '') + (source.recheckAfter ? ` Reconferir após ${source.recheckAfter}.` : '');
    lines.push(`| [${source.verifiedAt ? 'x' : ' '}] | ${label} | ${valueOf(country, field)} | ${source.source ?? '—'}${where} | ${status} |`);
  }
  const topic = country.topics?.same_sex_relationship;
  if (topic) {
    const status = topic.verifiedAt ? `verificado em ${topic.verifiedAt}` : topic.reviewStatus ?? 'sem fonte';
    const value = `legal: ${topic.legal ?? '—'}; aceitação: ${topic.acceptance ?? '—'}; risco: ${topic.risk ?? '—'}`;
    const where = (topic.checkedUrl ? ` ([link](${topic.checkedUrl}), ${topic.checkedAt})` : '') + (topic.recheckAfter ? ` Reconferir após ${topic.recheckAfter}.` : '');
    lines.push(`| [${topic.verifiedAt ? 'x' : ' '}] | Casal do mesmo sexo | ${value} | ${topic.source ?? '—'}${where} | ${status} |`);
  }
}

writeFileSync(fileURLToPath(new URL('../docs/legal-review.md', import.meta.url)), lines.join('\n') + '\n');
console.log('docs/legal-review.md written');
