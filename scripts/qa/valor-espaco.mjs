// Regra de valor do espaço (função pura, sem banco). Rode: node scripts/qa/valor-espaco.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';

// O módulo importa '@/lib/...' (alias do Next); este gancho resolve o alias e a extensão .ts só para o teste.
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) spec = new URL('../../src/' + spec.slice(2) + '.ts', ${JSON.stringify(import.meta.url)}).href;
    return next(spec, ctx);
  }
`));
const { regraDoEspaco, faixaParaBanco, erroDoLimiteGratis, valorInvalido, previaDaFaixa, resumoCurtoDoValor, valorUsoDoEspaco } = await import('../../src/lib/valorEspaco.ts');

const igual = (a, b, m) => assert.equal(String(a).replace(/\s/g, ' '), b, m);

// Banco <-> tela: limite 0 abre "Paga em toda reserva"; nulos = grátis; limite > 0 = faixa
assert.equal(regraDoEspaco({ faixaGratisAte: null, faixaValor: null }), 'GRATIS');
assert.equal(regraDoEspaco({ faixaGratisAte: 0, faixaValor: 90 }), 'PAGA');
assert.equal(regraDoEspaco({ faixaGratisAte: 10, faixaValor: 350 }), 'FAIXA');
assert.deepEqual(faixaParaBanco('GRATIS', 5, 100), { faixaGratisAte: null, faixaValor: null });
assert.deepEqual(faixaParaBanco('PAGA', 7, 90), { faixaGratisAte: 0, faixaValor: 90 });
assert.deepEqual(faixaParaBanco('FAIXA', 10, 350), { faixaGratisAte: 10, faixaValor: 350 });

// Erros do limite
assert.equal(erroDoLimiteGratis('GRATIS', 0, 20, true), '');
assert.equal(erroDoLimiteGratis('PAGA', null, 20, true), '');
assert.equal(erroDoLimiteGratis('FAIXA', null, 20, false), '');
assert.equal(erroDoLimiteGratis('FAIXA', null, 20, true), 'Informe quantas pessoas podem usar sem pagar. Mínimo 1.');
assert.equal(erroDoLimiteGratis('FAIXA', 0, 20, false), "Com 0 pessoas grátis, todos pagam. Escolha 'Paga em toda reserva'.");
assert.match(erroDoLimiteGratis('FAIXA', 20, 20, false), /menor que a capacidade do espaço \(20 pessoas\)/);
assert.equal(erroDoLimiteGratis('FAIXA', 19, 20, true), '');

// Validade para salvar
assert.equal(valorInvalido('GRATIS', null, 20, 0), false);
assert.equal(valorInvalido('PAGA', null, 20, 0), true);
assert.equal(valorInvalido('PAGA', null, 20, 90), false);
assert.equal(valorInvalido('FAIXA', 0, 20, 90), true);
assert.equal(valorInvalido('FAIXA', 10, 20, 0), true);
assert.equal(valorInvalido('FAIXA', 10, 20, 350), false);

// Frases (2.5)
igual(previaDaFaixa('GRATIS', null, null), 'Grátis para qualquer número de pessoas.');
igual(previaDaFaixa('FAIXA', 10, 350), 'Até 10 pessoas: grátis. Acima de 10: R$ 350,00.');
igual(previaDaFaixa('PAGA', null, 350), 'Todas as reservas: R$ 350,00.');
igual(previaDaFaixa('PAGA', null, null), 'Preencha o valor para ver o resumo.');
igual(resumoCurtoDoValor({ faixaGratisAte: null, faixaValor: null }), 'grátis');
igual(resumoCurtoDoValor({ faixaGratisAte: 10, faixaValor: 350 }), 'grátis até 10 pessoas, depois R$ 350,00');
igual(resumoCurtoDoValor({ faixaGratisAte: 0, faixaValor: 350 }), 'R$ 350,00 por reserva');
igual(valorUsoDoEspaco({ faixaGratisAte: 10, faixaValor: 350 }), 'R$ 350,00 acima de 10 pessoas');
igual(valorUsoDoEspaco({ faixaGratisAte: 0, faixaValor: 350 }), 'R$ 350,00 por reserva');
console.log('valor-espaco: ok');
