import { definirAtaque } from './definir.js'
import { ATAQUE } from '../constants.js'

// Machado (foice de duas lâminas) girando e atravessando a caixa. Cada
// passagem varre uma FAIXA colada numa borda e a outra ponta da caixa, de pelo
// menos LACUNA_MINIMA, fica segura. Nada pisca na caixa: a lâmina aparece na
// borda por onde vai entrar, em pé, cobrindo a faixa que vai varrer, e se
// arrasta devagar por `aviso` ms (é o aviso) antes de atravessar.
//
// Para ficar parado nunca dar certo:
//   mirar     a faixa varrida é a do lado onde o coração está AGORA. As duas
//             faixas possíveis cobrem o centro, então não existe lugar fixo
//             seguro: quem não sai da faixa piscando leva o golpe.
//   volta     bumerangue: a lâmina sai pelo outro lado e VOLTA, mirando de
//             novo (normalmente na faixa para onde o coração acabou de fugir).
//             Esquiva para um lado, depois para o outro.
//   vertical  cada arremesso sorteia se atravessa na horizontal (faixa de
//             cima/baixo) ou na vertical (faixa da esquerda/direita), e de que
//             lado entra (nunca o mesmo eixo três vezes seguidas).
//   faiscas   faíscas que a lâmina solta ao passar: entram pela borda da faixa
//             e cruzam a caixa na direção da parte segura, obrigando a
//             andar de lado também dentro da rota de fuga.
//
// Config:
//   varridas         passagens da lâmina (ida e volta contam separado)
//   travessia        ms para cruzar a caixa (antes do fator de velocidade)
//   alcance          meio comprimento da lâmina = profundidade da faixa (px; é
//                    reduzido para sempre sobrar LACUNA_MINIMA)
//   espessura        espessura da lâmina
//   giro             ritmo do balanço da lâmina (rad/s da fase; a ponta respeita a velocidade máxima)
//   balanco          quanto a lâmina balança para os lados (rad, máx. 0.5)
//   aviso            ms (+ 250) que a lâmina se arrasta na borda antes de cada arremesso
//   avisoVolta       idem, antes da volta do bumerangue (mínimo ATAQUE.telegrafoMs)
//   mirar, volta, vertical   ver acima (true por padrão)
//   faiscas          faíscas por passagem (0 desliga)
//   velocidadeFaisca, raioFaisca
export default definirAtaque({
  nome: 'foice',
  padrao: {
    duracao: 6000,
    varridas: 3,
    alcance: 100,
    espessura: 8,
    giro: 3,
    balanco: 0.35,
    aviso: 700,
    avisoVolta: 550,
    travessia: 1800,
    mirar: true,
    volta: true,
    vertical: true,
    faiscas: 2,
    velocidadeFaisca: 110,
    raioFaisca: 5,
  },
  iniciar(a, cfg) {
    const avisoVolta = Math.max(ATAQUE.telegrafoMs, cfg.avisoVolta)
    // arremessos por passagem: com bumerangue, cada arremesso tem ida e volta
    const porArremesso = cfg.volta ? 2 : 1
    let anterior = null // última passagem: { eixo, lado, sentido, bala }
    const eixos = [] // eixos dos últimos arremessos (para não repetir três vezes)

    // O aviso cabe antes do fim da onda? (conta as pausas de respiro que ainda
    // vêm pela frente, em que os timers ficam parados). Evita aviso piscando
    // sem ataque quando a onda acaba no meio dele.
    const cabe = (ms) => {
      let extra = 0
      const r = a.respiro
      if (r) {
        const rel = a.tempo - r.origem
        for (const [ini, fim] of r.pausas) if (fim > rel) extra += fim - Math.max(ini, rel)
      }
      return a.tempo + ms + extra <= a.fim
    }

    const passagem = (k) => {
      if (k >= cfg.varridas) return
      const l = a.caixa
      const ehVolta = cfg.volta && k % 2 === 1 && anterior
      const arremesso = Math.floor(k / porArremesso)

      // eixo 'h': a lâmina anda na horizontal e varre a faixa de cima/baixo;
      // eixo 'v': anda na vertical e varre a faixa da esquerda/direita
      let eixo = 'h'
      if (ehVolta) eixo = anterior.eixo
      else if (cfg.vertical) {
        // sorteado; se os dois últimos arremessos foram no mesmo eixo, troca
        eixo = a.aleatorio(0, 1) < 0.5 ? 'h' : 'v'
        if (eixos.length >= 2 && eixos.at(-1) === eixos.at(-2) && eixo === eixos.at(-1)) eixo = eixo === 'h' ? 'v' : 'h'
      }
      if (!ehVolta) eixos.push(eixo)
      const h = eixo === 'h'
      const profundidade = h ? l.height : l.width // tamanho da caixa na direção da faixa
      const comprimento = h ? l.width : l.height // tamanho na direção em que a lâmina anda

      // faixa: no mínimo `alcance`, ~62% da caixa (as duas faixas cobrem o
      // centro) e no máximo o que deixa LACUNA_MINIMA livre do outro lado
      const alcance = Math.max(
        8,
        Math.min(Math.max(cfg.alcance, profundidade * 0.62), profundidade - a.lacunaMinima - cfg.espessura / 2 - 2),
      )
      // A lâmina fica quase em pé (perpendicular à borda) e balança como uma
      // foice. Girando de verdade ela passava "deitada" e errava quem estava
      // dentro da faixa: agora a faixa avisada é a faixa que corta (pelo menos
      // cos(balanco) dela em qualquer instante).
      const balanco = Math.min(Math.abs(cfg.balanco), 0.5)
      const ritmoBalanco = 2 * Math.min(cfg.giro, a.balas.velocidadeMax / (alcance * Math.max(balanco, 0.05)))
      const distancia = comprimento + 2 * alcance
      const velocidade = distancia / (cfg.travessia / 1000)
      const efetiva = Math.min(velocidade * a.balas.fatorVelocidade, a.balas.velocidadeMax)
      const tempoTravessia = (distancia / efetiva) * 1000

      // lado da faixa: 0 = cima/esquerda, 1 = baixo/direita
      let lado
      if (cfg.mirar) {
        const alvo = a.alvo()
        lado = (h ? alvo.y < l.centerY : alvo.x < l.centerX) ? 0 : 1
      } else {
        lado = a.inteiro(0, 1)
      }
      // sentido: +1 = da esquerda/de cima (sorteado); a volta faz o caminho contrário
      const sentido = ehVolta ? -anterior.sentido : a.aleatorio(0, 1) < 0.5 ? 1 : -1

      // a lâmina espia na borda pelo aviso + 250 ms: antes ela vinha de mais
      // longe (fora da caixa), e esse trecho a mais também era tempo de reagir
      const ms = (ehVolta ? avisoVolta : cfg.aviso) + 250
      if (!cabe(ms)) return

      const inicioFaixa = h ? l.top : l.left
      const fimFaixa = h ? l.bottom : l.right
      const borda = lado === 0 ? inicioFaixa : fimFaixa
      const profundo = alcance + cfg.espessura / 2
      const faixa = lado === 0 ? [inicioFaixa, inicioFaixa + profundo] : [fimFaixa - profundo, fimFaixa]
      a.parede({ eixo: h ? 'y' : 'x', ocupados: [faixa] })

      {
        // a lâmina da ida termina de sumir fora da caixa: a volta "é" ela
        if (ehVolta && anterior.bala) anterior.bala.morta = true

        const iniAndar = h ? l.left : l.top
        const fimAndar = h ? l.right : l.bottom
        // nasce fora, com o fio encostando na borda de entrada: só ele aparece
        const partida = sentido > 0 ? iniAndar - cfg.espessura / 2 + 2 : fimAndar + cfg.espessura / 2 - 2
        const v = sentido * velocidade
        const arrasto = sentido * Math.min(velocidade * 0.08, 14) // px/s enquanto espia na borda
        const pontos = Array.from({ length: Math.max(0, cfg.faiscas) }, (_, i) => {
          const f = (i + 0.5 + a.aleatorio(-0.2, 0.2)) / cfg.faiscas
          return sentido > 0 ? iniAndar + f * comprimento : fimAndar - f * comprimento
        })
        let proxima = 0

        const bala = a.bala({
          x: h ? partida : borda,
          y: h ? borda : partida,
          vx: h ? arrasto : 0,
          vy: h ? 0 : arrasto,
          comprimento: alcance * 2,
          espessura: cfg.espessura,
          angulo: h ? Math.PI / 2 : 0,
          forma: 'foice',
          atravessa: true,
          entrando: true,
          pulso: 0,
          // espiando: em pé na borda, quase parada (o aviso); depois atravessa balançando
          arranque: { ms, vx: h ? v : 0, vy: h ? 0 : v },
          atualizar: (b) => {
            if (b.idade < ms) return
            b.angulo = (h ? Math.PI / 2 : 0) + balanco * Math.sin(((b.idade - ms) / 1000) * ritmoBalanco) * sentido
            if (proxima >= pontos.length) return
            const pos = h ? b.x : b.y
            if (sentido > 0 ? pos < pontos[proxima] : pos > pontos[proxima]) return
            const ponto = pontos[proxima++]
            // nada nasce depois do fim da onda, no respiro ou com as balas desarmadas
            if (b.inofensiva || a.tempo > a.fim || (a.respiro && a.emRespiro(a.respiro))) return
            faisca(h, ponto, borda, lado, k * 7 + proxima)
          },
        })
        anterior = { eixo, lado, sentido, bala }
        // a espiada corre no relógio da bala (não para nos respiros): a próxima
        // passagem conta a partir do relógio do ataque, com folga da espiada
        a.depois(ms + tempoTravessia, () => passagem(k + 1))
      }
    }

    // Faísca: nasce logo fora da borda onde a lâmina passou e entra cruzando
    // a caixa em direção ao lado seguro, com um leve desvio (a entrada pela
    // borda é o aviso; antes ela piscava parada)
    const faisca = (h, ponto, borda, lado, i) => {
      const dentro = lado === 0 ? 1 : -1 // para dentro da caixa
      const recuo = cfg.raioFaisca + 4
      const ang = a.aleatorio(-0.45, 0.45)
      const vPerp = Math.cos(ang) * cfg.velocidadeFaisca * dentro
      const vLado = Math.sin(ang) * cfg.velocidadeFaisca
      a.bala({
        x: h ? ponto : borda - dentro * recuo,
        y: h ? borda - dentro * recuo : ponto,
        vx: h ? vLado : vPerp,
        vy: h ? vPerp : vLado,
        raio: cfg.raioFaisca,
        forma: a.forma(i),
        girar: 8,
        entrando: true,
      })
    }

    // depois(0): só começa quando o respiro de início termina (timers parados)
    a.depois(0, () => passagem(0))
  },
})
