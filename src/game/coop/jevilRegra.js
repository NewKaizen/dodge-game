// A REGRA DO JEVIL, "DADO DO CAOS" (coop/regraChefe.js, a API; docs/coop-cartas.md "Jevil"): no começo de toda
// rodada um dado gigante rola e a face que cair muda UMA coisa daquela rodada, para todos. criarRegraDoDado()
// monta a regra; o chefão usa as fases de DADOS_DO_JEVIL e o Mestre de Picadeiro (tenente) o dadinho de 3 faces.
//
// Rede: tudo sai da semente (rolarDado), do tempo do ataque e das posições dos corações; o que mexe num coração
// (api.empurrar) só roda no PC dono dele (os outros veem pela rede), e o que um coração faz (pegar a SORTE) é decidido
// pelo PC dono e repetido nos outros pela API. Nada de Math.random.
import { atordoadoAgora } from './coop2.js'
import { criarVisuaisDoDado } from './jevilDadoCena.js'
import { tocar } from '../audio.js'
import { semLigaduras } from '../campanha/texto.js'
import {
  AJUSTES,
  DADOS_DO_JEVIL,
  rolarDado,
  ajusteDoAtaque,
  derivaDosCoracoes,
  anguloDaMesa,
  instantesDaTroca,
  destinosDaTroca,
  vezDoCoracao,
  pontoDaSorte,
  FACES,
} from './jevilDado.js'

const COR_DO_DADO = 0xffd24c
const VELOCIDADE_PADRAO = 180 // px/s do coração (CORACAO.velocidadePadrao), se a cena não disser

export function criarRegraDoDado({
  id = 'dado',
  nome = 'DADO DO CAOS',
  descricao = 'Um dado gigante rola a cada rodada e muda a regra para todos',
  fases: avisos = {
    1: { descricao: 'As faces ficam mais malucas' },
    2: { descricao: 'CAOS CAOS: agora são DOIS dados por rodada' },
    3: { descricao: 'Dois dados e quase só faces malucas' },
  },
  dados = DADOS_DO_JEVIL,
  forca = 1, // o tenente joga uma versão leve (os efeitos pesam menos)
  pequeno = false,
} = {}) {
  return {
    id,
    nome,
    descricao,
    fases: avisos,
    criar(api) {
      const cena = api.cena ?? null
      const visuais = cena ? criarVisuaisDoDado(cena, { pequeno, corTema: COR_DO_DADO }) : null
      let fase = 0
      let faces = [] // os ids sorteados nesta rodada
      let tempo = 0 // ms de ataque desta esquiva (só passa com o ataque rolando)
      let esquivando = false
      let ultima = {} // j -> { x, y } do coração no fim do frame anterior (o parado volta para lá)
      let sorteou = false
      let trocas = []
      let trocasFeitas = 0
      let vezAnterior = null
      let avisoDaVez = false
      let faseDaMesa = 0
      let angulo = 0
      let tintas = new Map()
      const graca = new Map() // j -> ms de invencibilidade extra que a regra deu

      const tem = (f) => faces.includes(f)
      const velocidadeDoCoracao = () => cena?.quadro?.velocidadeCoracao ?? VELOCIDADE_PADRAO
      const atacando = () => (cena?.quadro ? cena.quadro.atacando : tempo > -1)
      const ativos = () => api.coracoes().filter((c) => c.ativo)
      const coracaoDaCena = (j) => cena?.quadro?.coracoes?.[j] ?? null
      // invencibilidade (só enfeita no PC que não é dono: quem decide o dano é o dono do coração)
      const proteger = (j, ms) => {
        const c = coracaoDaCena(j)
        if (c && c.invencivelMs < ms) c.invencivelMs = ms
        graca.set(j, ms)
      }

      const rolar = (rodada, deFase = fase) => rolarDado({ semente: api.semente, rodada, fase: deFase, fases: dados })

      // a prévia: o dado da rodada de depois (a mesma conta, com rodada + 1)
      const mostrarPrevia = () => {
        const proxima = rolar(api.rodada + 1)
        visuais?.mostrarPrevia(proxima.map((d) => d.id))
        return proxima.map((d) => d.id)
      }

      // inverte os controles de todos (o mecanismo de sempre da arena: CONTROLES INVERTIDOS!)
      const inverterControles = () => {
        if (!cena) return
        if (Array.isArray(cena.invertido)) cena.invertido[0] = { avisado: false }
        else cena.invertido = { avisado: false }
      }

      return {
        // consultas (os testes e o debug leem)
        facesDaRodada: () => [...faces],
        // (não pode se chamar `previa`: esse nome é o GANCHO da prévia da carta do chefe em regraChefe.js,
        // e uma lista de faces no lugar da prévia travava a arena no 'inicio' da rodada 1)
        previaDoDado: () => rolar(api.rodada + 1).map((d) => d.id),
        fase: () => fase,
        // (dev e testes) força as faces desta rodada, como se o dado tivesse dado elas
        forcar(ids) {
          faces = [...ids]
          visuais?.rolar(ids.map((id, k) => ({ id, pips: k + 1 })))
          mostrarPrevia()
        },

        inicioDaRodada(rodada) {
          // chefe atordoado: sem carta, sem quadro, sem dado
          if (cena?.estado && atordoadoAgora(cena.estado)) {
            faces = []
              visuais?.semDado()
            mostrarPrevia()
            return
          }
          const rolagem = rolar(rodada)
          faces = rolagem.map((d) => d.id)
          visuais?.rolar(rolagem)
          mostrarPrevia()
          api.dica('dado', 'O dado gigante muda a regra da rodada: vale para os dois!')
        },

        // as faces que mexem no ataque em si: a velocidade e o dano das balas, e o aperto que compensa os controles pesados
        ataque(carta, A, padrao) {
          const ajuste = ajusteDoAtaque(faces, forca)
          if (ajuste.velocidade === 1 && ajuste.densidade === 1 && ajuste.dano === 1) return null
          const base = padrao
          return {
            ...base,
            iniciar: (a) => {
              if (ajuste.dano !== 1) a.dano = Math.max(1, Math.round(a.dano * ajuste.dano))
              if (a.ritmo) {
                a.ritmo.densidade *= ajuste.densidade
              }
              if (a.balas && ajuste.velocidade !== 1) a.balas.fatorVelocidade *= ajuste.velocidade
              return base.iniciar(a)
            },
          }
        },

        comecarEsquiva() {
          esquivando = true
          tempo = 0
          ultima = {}
          sorteou = false
          trocas = tem('trocados') ? instantesDaTroca() : []
          trocasFeitas = 0
          vezAnterior = null
          avisoDaVez = false
          graca.clear()
          faseDaMesa = api.rng('mesa')()
          angulo = 0
          if (tem('espelhados')) inverterControles()
        },

        atualizar(dt) {
          if (!esquivando) return
          const rolando = atacando()
          if (rolando) tempo += dt
          else return
          const vel = velocidadeDoCoracao()

          // SORTE!: um coração de graça aparece no quadro (depois que o ataque começou: a caixa já tem o tamanho final)
          if (tem('sorte') && !sorteou && tempo >= AJUSTES.sorte.atrasoMs) {
            sorteou = true
            const p = pontoDaSorte(api.rng('sorte'), api.limites())
            const item = api.adicionarItem({
              ...p,
              raio: 10,
              cor: FACES.sorte.cor,
              forma: 'estrela',
              rotulo: 'SORTE!',
              aoPegar: (j) => {
                api.curar(j, Math.round(AJUSTES.sorte.cura * (forca < 1 ? 1.2 : 1)))
                api.dica('sorte', 'Coração da SORTE: cura quem pegar!')
              },
            })
            if (cena) {
              // um coração por cima da estrela (o desenho do item é uma bolinha)
              const t = cena.add.text(item.x, item.y + 1, '♥', { fontFamily: 'sans-serif', fontSize: '15px', color: '#ffffff', stroke: '#1b8a3c', strokeThickness: 3 }).setOrigin(0.5).setDepth(8)
              cena.tweens.add({ targets: t, scale: { from: 0.85, to: 1.2 }, duration: 520, yoyo: true, repeat: -1 })
              item.desenho?.push(t)
              item.desenho?.[0]?.setVisible?.(false)
            }
          }

          // GRAVIDADE INVERTIDA e MESA INCLINADA: os corações (deste PC) escorregam
          if (tem('gravidade') || tem('vento')) {
            if (tem('vento')) {
              angulo = anguloDaMesa(tempo, faseDaMesa, forca)
              visuais?.desenharVento(angulo / ((AJUSTES.vento.graus * Math.PI) / 180), api.limites())
            }
            const { dx, dy } = derivaDosCoracoes(faces, { velocidade: vel, dt, angulo, forca })
            for (const c of ativos()) if (api.meu(c.j)) api.empurrar(c.j, dx, dy)
          }

          // CORAÇÕES TROCADOS: de tempos em tempos todos trocam de lugar (com aviso, e um respiro de proteção depois)
          if (tem('trocados')) {
            const proximo = trocas[trocasFeitas]
            if (proximo != null) {
              const viva = ativos()
              const destinos = destinosDaTroca(viva)
              if (tempo >= proximo - AJUSTES.trocados.avisoMs && tempo < proximo) {
                const falta = 1 - (proximo - tempo) / AJUSTES.trocados.avisoMs
                visuais?.desenharTroca(
                  destinos.map((d) => {
                    const c = viva.find((x) => x.j === d.j)
                    return { x1: c.x, y1: c.y, x2: d.x, y2: d.y, cor: cena?.corDoJogador?.(d.j) ?? 0xffffff }
                  }),
                  falta,
                )
                if (falta > 0.02 && !avisoDaVez) {
                  avisoDaVez = true
                  api.banner('TROCA!', '#ff7ad0')
                  if (cena) tocar(cena, 'tensao')
                }
              } else if (tempo >= proximo) {
                visuais?.limparTroca()
                trocasFeitas++
                avisoDaVez = false
                if (destinos.length) {
                  for (const d of destinos) {
                    proteger(d.j, AJUSTES.trocados.gracaMs)
                    const c = viva.find((x) => x.j === d.j)
                    if (api.meu(d.j)) api.empurrar(d.j, d.x - c.x, d.y - c.y)
                  }
                  if (cena) {
                    tocar(cena, 'inverter')
                    for (const d of destinos) visuais?.estourar(d.x, d.y, cena.corDoJogador?.(d.j))
                  }
                  api.dica('trocados', 'Os corações trocaram de lugar: encontrem uma saída!')
                }
              }
            }
          }

          // UM CORAÇÃO POR VEZ: só o da vez anda; o parado fica protegido (e gelado)
          if (tem('umPorVez')) {
            const viva = ativos()
            const vez = vezDoCoracao(viva.map((c) => c.j).sort((a, b) => a - b), tempo)
            if (vez) {
              if (vezAnterior !== vez.j) {
                if (vezAnterior != null) {
                  proteger(vez.j, AJUSTES.umPorVez.gracaMs)
                  if (cena) tocar(cena, 'cartaDeslizar')
                }
                vezAnterior = vez.j
              }
              for (const c of viva) {
                if (c.j === vez.j) continue
                proteger(c.j, 160) // o parado não leva dano
                const antes = ultima[c.j]
                if (antes && api.meu(c.j)) api.empurrar(c.j, antes.x - c.x, antes.y - c.y)
              }
              const aviso = vez.restanteMs < AJUSTES.umPorVez.avisoMs
              visuais?.desenharMarcas(viva.map((c) => ({ x: ultima[c.j]?.x ?? c.x, y: ultima[c.j]?.y ?? c.y, cor: cena?.corDoJogador?.(c.j) ?? 0xffffff, parado: c.j !== vez.j, aviso: aviso && c.j !== vez.j })))
              if (cena) {
                for (const c of viva) {
                  const h = coracaoDaCena(c.j)
                  if (!h) continue
                  if (c.j !== vez.j) {
                    if (!tintas.has(c.j)) tintas.set(c.j, true)
                    h.sprite.setTint(0x9ad8ff).setAlpha(0.75)
                  } else if (tintas.has(c.j)) {
                    h.sprite.setTint(h.cor).setAlpha(1)
                    tintas.delete(c.j)
                  }
                }
              }
            }
          }

          // a posição de cada coração no fim do frame (o parado volta para lá no próximo)
          for (const c of api.coracoes()) if (c.ativo) ultima[c.j] = { x: c.x, y: c.y }
        },

        terminarEsquiva() {
          esquivando = false
          visuais?.limparTroca()
          visuais?.limparMarcas?.()
          if (cena) {
            visuais?.limparVento()
            for (const j of tintas.keys()) {
              const h = coracaoDaCena(j)
              if (h?.sprite?.scene) h.sprite.setTint(h.cor).setAlpha(1)
            }
          }
          tintas = new Map()
          graca.clear()
        },

        faseNova(f) {
          fase = f
          // o dado muda de fase: a prévia da rodada de depois sai do dado novo
          mostrarPrevia()
        },

        terminar() {
          visuais?.destruir()
          if (cena) {
          }
        },
      }
    },
  }
}

export const REGRA_DO_JEVIL = criarRegraDoDado({})
export const textoDaFace = (id) => semLigaduras(FACES[id].titulo)
