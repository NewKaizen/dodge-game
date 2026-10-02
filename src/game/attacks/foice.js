import { definirAtaque } from './definir.js'
import { ATAQUE } from '../constants.js'

// Machado (foice de duas lâminas) girando e atravessando a caixa. Cada
// passagem varre uma FAIXA colada numa borda: a faixa pisca antes (aviso) e
// a outra ponta da caixa, de pelo menos LACUNA_MINIMA, fica segura.
//
// Para ficar parado nunca dar certo:
//   mirar     a faixa varrida é a do lado onde o coração está AGORA. As duas
//             faixas possíveis cobrem o centro, então não existe lugar fixo
//             seguro: quem não sai da faixa piscando leva o golpe.
//   volta     bumerangue: a lâmina sai pelo outro lado e VOLTA, mirando de
//             novo (normalmente na faixa para onde o coração acabou de fugir).
//             Esquiva para um lado, depois para o outro.
//   vertical  os arremessos alternam: um atravessa na horizontal (faixa de
//             cima/baixo), o seguinte na vertical (faixa da esquerda/direita).
//   faiscas   faíscas que a lâmina solta ao passar: piscam paradas (aviso) e
//             depois cruzam a caixa na direção da parte segura, obrigando a
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
//   aviso            ms de aviso de cada arremesso
//   avisoVolta       ms de aviso da volta do bumerangue (mínimo ATAQUE.telegrafoMs)
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
      const eixo = ehVolta ? anterior.eixo : cfg.vertical && arremesso % 2 === 1 ? 'v' : 'h'
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
        lado = k % 2
      }
      // sentido: +1 = da esquerda/de cima; a volta faz o caminho contrário
      const sentido = ehVolta ? -anterior.sentido : arremesso % 2 === 0 ? 1 : -1

      const ms = ehVolta ? avisoVolta : cfg.aviso
      if (!cabe(ms)) return

      const inicioFaixa = h ? l.top : l.left
      const fimFaixa = h ? l.bottom : l.right
      const borda = lado === 0 ? inicioFaixa : fimFaixa
      const profundo = alcance + cfg.espessura / 2
      const faixa = lado === 0 ? [inicioFaixa, inicioFaixa + profundo] : [fimFaixa - profundo, fimFaixa]
      a.parede({ eixo: h ? 'y' : 'x', ocupados: [faixa] })

      const area = h
        ? { tipo: 'area', x: l.left, y: faixa[0], largura: l.width, altura: faixa[1] - faixa[0], ms }
        : { tipo: 'area', x: faixa[0], y: l.top, largura: faixa[1] - faixa[0], altura: l.height, ms }

      a.aviso(area, () => {
        // a lâmina da ida termina de sumir fora da caixa: a volta "é" ela
        if (ehVolta && anterior.bala) anterior.bala.morta = true

        const iniAndar = h ? l.left : l.top
        const fimAndar = h ? l.right : l.bottom
        const partida = sentido > 0 ? iniAndar - alcance : fimAndar + alcance
        const v = sentido * velocidade
        const pontos = Array.from({ length: Math.max(0, cfg.faiscas) }, (_, i) => {
          const f = (i + 0.5 + a.aleatorio(-0.2, 0.2)) / cfg.faiscas
          return sentido > 0 ? iniAndar + f * comprimento : fimAndar - f * comprimento
        })
        let proxima = 0

        const bala = a.bala({
          x: h ? partida : borda,
          y: h ? borda : partida,
          vx: h ? v : 0,
          vy: h ? 0 : v,
          comprimento: alcance * 2,
          espessura: cfg.espessura,
          angulo: h ? Math.PI / 2 : 0,
          forma: 'foice',
          atravessa: true,
          jaAvisada: true,
          pulso: 0,
          atualizar: (b) => {
            b.angulo = (h ? Math.PI / 2 : 0) + balanco * Math.sin((b.idade / 1000) * ritmoBalanco) * sentido
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
        a.depois(tempoTravessia, () => passagem(k + 1))
      })
    }

    // Faísca: nasce na borda onde a lâmina passou, pisca parada pelo aviso
    // padrão (>= ATAQUE.telegrafoMs) e depois cruza a caixa em direção ao
    // lado seguro, com um leve desvio
    const faisca = (h, ponto, borda, lado, i) => {
      const dentro = lado === 0 ? 1 : -1 // para dentro da caixa
      const recuo = cfg.raioFaisca + 4
      const ang = a.aleatorio(-0.45, 0.45)
      const vPerp = Math.cos(ang) * cfg.velocidadeFaisca * dentro
      const vLado = Math.sin(ang) * cfg.velocidadeFaisca
      a.bala({
        x: h ? ponto : borda + dentro * recuo,
        y: h ? borda + dentro * recuo : ponto,
        vx: h ? vLado : vPerp,
        vy: h ? vPerp : vLado,
        raio: cfg.raioFaisca,
        forma: a.forma(i),
        girar: 8,
        aviso: ATAQUE.telegrafoMs,
      })
    }

    // depois(0): só começa quando o respiro de início termina (timers parados)
    a.depois(0, () => passagem(0))
  },
})
