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
const { regraDoEspaco, faixaParaBanco, erroDoLimiteGratis, valorInvalido, regraDeValorMudou, previaDaFaixa, resumoCurtoDoValor, valorUsoDoEspaco, valorParaBanco, calcularPercentual, lerPercentual, limparPercentualDigitado, erroDoPercentual, previaDoCalculo, textoTotalPedido, valorUsoPorExtenso } = await import('../../src/lib/valorEspaco.ts');
const { erroDaCota, mascaraCentavos, cotaEmCentavos } = await import('../../src/lib/cotaMinima.ts');

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

// "Regra mudou?" (nota "vale só para novos pedidos"): compara salva x atual no formato do banco
const G = { faixaGratisAte: null, faixaValor: null };
assert.equal(regraDeValorMudou(G, faixaParaBanco('GRATIS', 7, 99)), false, 'grátis com sobras de outra opção não é mudança');
assert.equal(regraDeValorMudou(G, faixaParaBanco('PAGA', null, 90)), true);
assert.equal(regraDeValorMudou({ faixaGratisAte: 10, faixaValor: 350 }, faixaParaBanco('FAIXA', 10, 350)), false);
assert.equal(regraDeValorMudou({ faixaGratisAte: 10, faixaValor: 350 }, faixaParaBanco('FAIXA', 11, 350)), true);
assert.equal(regraDeValorMudou({ faixaGratisAte: 10, faixaValor: 350 }, faixaParaBanco('FAIXA', 10, 351)), true);
assert.equal(regraDeValorMudou({ faixaGratisAte: 10, faixaValor: 350 }, faixaParaBanco('PAGA', 10, 350)), true);
assert.equal(regraDeValorMudou({ faixaGratisAte: 0, faixaValor: 90 }, faixaParaBanco('PAGA', null, 90)), false);
assert.equal(regraDeValorMudou({ faixaGratisAte: 0, faixaValor: 90 }, faixaParaBanco('GRATIS', null, 0)), true);
console.log('regraDeValorMudou ok');

// ── Fase 2 (0048): percentual da cota ──
// Conta do percentual: a mesma do banco (valor_percentual): centavo mais próximo, meio para cima, mínimo R$ 0,01
assert.equal(calcularPercentual(1200, 5), 60);
assert.equal(calcularPercentual(1234.56, 5), 61.73);
assert.equal(calcularPercentual(1.1, 5), 0.06);
assert.equal(calcularPercentual(0.01, 0.01), 0.01, 'nunca vira grátis por arredondamento');
assert.equal(calcularPercentual(1225, 5), 61.25);
assert.equal(calcularPercentual(1200, 7.5), 90);

// Leitura do percentual digitado
assert.equal(lerPercentual('5'), 5);
assert.equal(lerPercentual('7,5'), 7.5);
assert.equal(lerPercentual('7.50'), 7.5);
assert.equal(lerPercentual('100'), 100);
for (const ruim of ['', '0', '0,00', '100,01', '101', '1000', '-5', 'abc', '7,555', '5%', '1e2', 'Infinity', 'NaN']) assert.equal(lerPercentual(ruim), null, `deve recusar "${ruim}"`);
assert.equal(limparPercentualDigitado('7,5,3'), '7,53');
assert.equal(limparPercentualDigitado('a1b2.3.4'), '12.34');
assert.equal(limparPercentualDigitado('12345678'), '123456');

// Gravação: os quatro campos vão juntos; trocar de tipo limpa o outro
assert.deepEqual(valorParaBanco('GRATIS', 'PERCENTUAL', 5, 0, 5), { faixaGratisAte: null, faixaValor: null, valorTipo: 'FIXO', faixaPercentual: null });
assert.deepEqual(valorParaBanco('PAGA', 'PERCENTUAL', 7, 99, 5), { faixaGratisAte: 0, faixaValor: null, valorTipo: 'PERCENTUAL', faixaPercentual: 5 });
assert.deepEqual(valorParaBanco('FAIXA', 'PERCENTUAL', 10, 99, 7.5), { faixaGratisAte: 10, faixaValor: null, valorTipo: 'PERCENTUAL', faixaPercentual: 7.5 });
assert.deepEqual(valorParaBanco('FAIXA', 'FIXO', 10, 350, 5), { faixaGratisAte: 10, faixaValor: 350, valorTipo: 'FIXO', faixaPercentual: null });
assert.deepEqual(valorParaBanco('PAGA', 'FIXO', null, 90, null), { faixaGratisAte: 0, faixaValor: 90, valorTipo: 'FIXO', faixaPercentual: null });

// Abrir o espaço salvo em percentual
assert.equal(regraDoEspaco({ faixaGratisAte: 0, faixaValor: null, valorTipo: 'PERCENTUAL', faixaPercentual: 5 }), 'PAGA');
assert.equal(regraDoEspaco({ faixaGratisAte: 10, faixaValor: null, valorTipo: 'PERCENTUAL', faixaPercentual: 5 }), 'FAIXA');

// Validade para salvar: percentual exige percentual válido E cota cadastrada
assert.equal(valorInvalido('PAGA', null, 20, 0, 'PERCENTUAL', 5, true), false);
assert.equal(valorInvalido('PAGA', null, 20, 0, 'PERCENTUAL', null, true), true);
assert.equal(valorInvalido('PAGA', null, 20, 0, 'PERCENTUAL', 5, false), true, 'sem cota não salva');
assert.equal(valorInvalido('FAIXA', 10, 20, 0, 'PERCENTUAL', 5, true), false);
assert.equal(valorInvalido('FAIXA', 20, 20, 0, 'PERCENTUAL', 5, true), true);
assert.equal(valorInvalido('GRATIS', null, 20, 0, 'PERCENTUAL', null, false), false, 'grátis nunca depende da cota');
assert.equal(valorInvalido('PAGA', null, 20, 90, 'FIXO', null, false), false, 'fixo nunca depende da cota');
assert.equal(erroDoPercentual('PAGA', 'PERCENTUAL', '', false), '');
assert.equal(erroDoPercentual('PAGA', 'PERCENTUAL', '', true), 'Informe o percentual da cota, maior que 0 e até 100.');
assert.match(erroDoPercentual('PAGA', 'PERCENTUAL', '150', true), /maior que 0 e até 100/);
assert.equal(erroDoPercentual('PAGA', 'PERCENTUAL', '5', true), '');
assert.equal(erroDoPercentual('PAGA', 'FIXO', '', true), '');

// "Regra mudou?" com percentual
const P = { faixaGratisAte: 0, faixaValor: null, valorTipo: 'PERCENTUAL', faixaPercentual: 5 };
assert.equal(regraDeValorMudou(P, valorParaBanco('PAGA', 'PERCENTUAL', null, 0, 5)), false);
assert.equal(regraDeValorMudou(P, valorParaBanco('PAGA', 'PERCENTUAL', null, 0, 6)), true);
assert.equal(regraDeValorMudou(P, valorParaBanco('PAGA', 'FIXO', null, 5, null)), true);
assert.equal(regraDeValorMudou({ faixaGratisAte: 0, faixaValor: 5 }, valorParaBanco('PAGA', 'PERCENTUAL', null, 0, 5)), true);

// Textos: o morador vê só R$ (nunca percentual nem cota); a gestão vê o percentual
igual(previaDaFaixa('PAGA', null, null, 'PERCENTUAL', 5), 'Todas as reservas: 5% da cota do condomínio.');
igual(previaDaFaixa('FAIXA', 10, null, 'PERCENTUAL', 7.5), 'Até 10 pessoas: grátis. Acima de 10: 7,5% da cota do condomínio.');
igual(previaDaFaixa('PAGA', null, null, 'PERCENTUAL', null), 'Preencha o percentual para ver o resumo.');
const pct = { faixaGratisAte: 0, faixaValor: null, valorTipo: 'PERCENTUAL', faixaPercentual: 5, valorCalculado: 61.25 };
const pctFaixa = { ...pct, faixaGratisAte: 10 };
const semCota = { ...pct, valorCalculado: null };
igual(resumoCurtoDoValor(pct, true), '5% da cota por reserva (R$ 61,25)');
igual(resumoCurtoDoValor(pctFaixa, true), 'grátis até 10 pessoas, depois 5% da cota (R$ 61,25)');
igual(resumoCurtoDoValor(semCota, true), '5% da cota por reserva (cota não cadastrada)');
igual(resumoCurtoDoValor(pct), 'R$ 61,25 por reserva');
igual(resumoCurtoDoValor(pctFaixa), 'grátis até 10 pessoas, depois R$ 61,25');
igual(resumoCurtoDoValor(semCota), 'valor a combinar com o síndico');
igual(valorUsoDoEspaco(pct), 'R$ 61,25 por reserva');
igual(valorUsoDoEspaco(pctFaixa), 'R$ 61,25 acima de 10 pessoas');
igual(valorUsoDoEspaco(semCota), 'Valor a combinar com o síndico');
igual(valorUsoPorExtenso(pctFaixa), 'Grátis até 10 pessoas · R$ 61,25 acima');
for (const t of [resumoCurtoDoValor(pct), resumoCurtoDoValor(pctFaixa), valorUsoDoEspaco(pct), valorUsoPorExtenso(pct), valorUsoPorExtenso(pctFaixa)]) assert.doesNotMatch(t, /%|cota/i, 'morador não vê percentual nem cota');

// Prévia do cálculo (gestão)
igual(previaDoCalculo('PAGA', null, 5, 1225), '5% da cota de R$ 1.225,00 = R$ 61,25.');
igual(previaDoCalculo('FAIXA', 10, 5, 1225), 'Acima de 10 pessoas: 5% da cota de R$ 1.225,00 = R$ 61,25.');
igual(previaDoCalculo('PAGA', null, null, 1225), 'Informe o percentual para ver o valor.');
igual(previaDoCalculo('PAGA', null, 5, null), 'Cadastre a cota do condomínio para ver o valor.');

// L3: o pedido mostra o TOTAL (uso + higienização); sem a cota
igual(textoTotalPedido(100, 80), 'Total a pagar: R$ 180,00.');
igual(textoTotalPedido(0, 80), 'Total a pagar: R$ 80,00.');
igual(textoTotalPedido(61.25, 0), 'Total a pagar: R$ 61,25.');
igual(textoTotalPedido(0.1, 0.2), 'Total a pagar: R$ 0,30.');
igual(textoTotalPedido(0, 0), '');

// Cota mínima (campo da tela de Configurações)
assert.equal(mascaraCentavos('R$ 1.225,00abc'), '122500');
assert.equal(mascaraCentavos('0000150'), '150');
assert.equal(mascaraCentavos('12345678901234567890'), '123456789');
assert.equal(cotaEmCentavos(''), null);
assert.equal(erroDaCota(''), 'Informe a cota em reais, de no mínimo R$ 1,00.');
assert.equal(erroDaCota('0'), 'Informe a cota em reais, de no mínimo R$ 1,00.');
assert.match(erroDaCota('1'), /mínima é de R\$ 1,00/, 'R$ 0,01 não vale');
assert.match(erroDaCota('99'), /mínima é de R\$ 1,00/, 'R$ 0,99 não vale');
assert.equal(erroDaCota('100'), '', 'R$ 1,00 vale');
assert.equal(erroDaCota('122500'), '');
assert.equal(erroDaCota('10000000'), '', 'R$ 100.000,00 ainda vale');
assert.match(erroDaCota('10000001'), /máximo é R\$ 100\.000,00/);
console.log('fase 2 (percentual, cota, total): ok');
