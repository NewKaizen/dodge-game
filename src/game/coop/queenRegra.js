// A REGRA "SINAL DE WI-FI" da Queen (e do tenente O Firewall, que usa a versão leve): a ponte entre a lógica
// pura (coop/queenWifi.js), o desenho (coop/queenWifiCena.js) e a API da regra do chefe (coop/regraChefe.js).
//
//   Os corações têm de ficar PERTO (dentro do raio do sinal). Sem parceiro no raio por mais que a carência, a
//   conexão cai e o coração leva um tique de dano até reconectar. Os ataques da Queen tentam separar a dupla
//   (muros, INTERFERÊNCIA que empurra em sentidos opostos, REBOOT que embaralha).
//
// REDE: todos os PCs rodam estes ganchos com o mesmo estado; os sorteios saem do api.rng; o único que nasce num
// PC só é o tique do PRÓPRIO coração (api.meu) e a reconexão (decidida pelo dono do 1º coração de pé): os dois vão
// por api.enviar e todos aplicam (ferir / adicionarQuebra) uma vez.
import { NIVEIS } from '../constants.js'
import { WIFI, raioDaFase, danoDoTique, sinalDeCada, arestas, todosLigados, MonitorDeSinal, empurrao, janelasDeEmpurrao, janelaAgora, destinosDoReboot, distancia } from './queenWifi.js'
import { criarVisualWifi } from './queenWifiCena.js'

// opcoes:
//   id, nome, descricao, fases     (o texto da regra: ver regraChefe.js)
//   danoBala                       do chefe (o tique é uma fração dele)
//   raios, graca, intervalo        a conexão (WIFI)
//   efeitos                        { 'Nome da carta': { empurrar: { forca, quantidade, duracaoJanela, ... },
//                                                       reboot: { aviso, teleporte } } }
export function criarRegraWifi({ id = 'wifi', nome, descricao, fases = {}, danoBala, raios = WIFI.raios, graca = WIFI.graca, intervalo = WIFI.intervalo, efeitos = {} }) {
  return {
    id,
    nome,
    descricao,
    fases,
    criar(api) {
      const monitor = new MonitorDeSinal({ graca, intervalo })
      const fatorNivel = NIVEIS[api.nivel]?.dano ?? 1
      const dano = danoDoTique(danoBala, fatorNivel)
      let fase = 0
      let visual = null
      let tempo = 0
      let duracao = 6000
      let efeito = null
      let janelas = []
      let ladoEmpurrao = 0
      let reboot = null
      let queda = -Infinity // quando o último tique caiu (o fio pisca)

      const raio = () => raioDaFase(fase, api.limites().width, raios)
      const vivos = () => api.coracoes().filter((c) => c.ativo)

      function destruirVisual() {
        visual?.destruir()
        visual = null
      }

      return {
        faseNova(f) {
          fase = f
        },

        // guarda a duração do ataque da carta (para espalhar as janelas de empurrão); o ataque é o de sempre
        ataque(carta, A, padrao) {
          duracao = padrao?.duracao ?? 6000
          return null
        },

        comecarEsquiva({ carta }) {
          tempo = 0
          monitor.zerar()
          efeito = efeitos[carta?.nome] ?? null
          janelas = []
          reboot = null
          if (efeito?.empurrar) {
            const r = api.rng('empurrar')
            janelas = janelasDeEmpurrao(r, duracao, efeito.empurrar)
            ladoEmpurrao = r() < 0.5 ? 0 : 1
          }
          if (efeito?.reboot) {
            reboot = { destinos: destinosDoReboot(api.n, api.limites(), api.rng('reboot')), feito: false, bonusAte: null, concedido: false, ...efeito.reboot }
          }
          destruirVisual()
          if (api.cena?.quadro?.caixa) visual = criarVisualWifi(api.cena)
          api.dica('sinal', 'O círculo é o alcance do sinal: fiquem perto um do outro!')
        },

        atualizar(dt) {
          tempo += dt
          const cs = api.coracoes()
          const r = raio()
          const sinais = sinalDeCada(cs, r)

          // a conexão de cada coração: os tiques do PRÓPRIO coração saem daqui e vão a todos
          for (const s of sinais) {
            const res = monitor.atualizar(s.j, s.ligado, dt)
            if (!api.meu(s.j)) continue
            for (let k = 0; k < res.tiques; k++) api.enviar('queda', { j: s.j })
          }

          // INTERFERÊNCIA: empurra cada coração (o do PC dono) para longe dos outros
          const agora = janelaAgora(janelas, tempo)
          let setas = null
          if (agora) {
            const forca = efeito.empurrar.forca ?? 60
            const direcoes = vivos().map((c) => ({ j: c.j, dir: Math.sign(empurrao(cs, c.j, 1000, 1000, ladoEmpurrao).dx) || 1 }))
            setas = { tipo: agora.tipo, direcoes }
            if (agora.tipo === 'empurra') {
              for (const c of vivos()) {
                if (!api.meu(c.j)) continue
                const { dx, dy } = empurrao(cs, c.j, forca, dt, ladoEmpurrao)
                if (dx || dy) api.empurrar(c.j, dx, dy)
              }
            }
          }

          // REBOOT: avisa, leva os corações para os cantos e abre a janela da QUEBRA por reconectar
          let marcador = null
          let bonus = null
          if (reboot) {
            if (!reboot.feito && tempo >= reboot.teleporte) {
              reboot.feito = true
              reboot.bonusAte = tempo + WIFI.janelaReconexao
              for (const c of vivos()) {
                const d = reboot.destinos[c.j]
                if (d && api.meu(c.j)) api.empurrar(c.j, d.x - c.x, d.y - c.y)
              }
              api.banner('REBOOT!', '#ff9ae0')
            }
            if (!reboot.feito) {
              const falta = Math.max(0, Math.ceil((reboot.teleporte - tempo) / 400))
              marcador = { destinos: vivos().map((c) => reboot.destinos[c.j]).filter(Boolean), texto: `REBOOT${'.'.repeat(Math.min(3, falta))}` }
            } else if (!reboot.concedido && tempo < reboot.bonusAte) {
              bonus = { restanteMs: reboot.bonusAte - tempo, totalMs: WIFI.janelaReconexao }
              // quem é dono do 1º coração de pé decide a reconexão e avisa todos (a QUEBRA entra uma vez em cada PC)
              const primeiro = vivos()[0]
              if (primeiro && api.meu(primeiro.j) && vivos().length >= 2 && tempo > reboot.teleporte + 500 && todosLigados(cs, r * WIFI.colados)) {
                reboot.concedido = true
                api.enviar('reconectou', {})
              }
            }
          }

          visual?.desenhar({ tempo, coracoes: cs, raio: r, sinais, arestas: arestas(cs), monitor, flash: tempo - queda < 220, empurrao: setas, reboot: marcador, bonus })
        },

        aoMensagem(lado, acao, dados) {
          if (acao === 'queda') {
            queda = tempo
            api.ferir(dados.j, dano)
            api.dica('queda', 'Sem sinal: cada tique machuca. Juntem os corações para reconectar!')
          } else if (acao === 'reconectou' && reboot && !reboot.pago) {
            reboot.pago = true
            reboot.concedido = true
            api.adicionarQuebra(WIFI.bonusQuebra, 'reboot')
            api.banner('RECONECTADOS!', '#ff9ae0')
          }
        },

        // a CPU aliada segue o alcance: se o parceiro está longe, vai até ele (perto de novo, desvia como sempre)
        alvoDoBot(j) {
          const eu = vivos().find((c) => c.j === j)
          const outros = vivos().filter((c) => c.j !== j)
          if (!eu || !outros.length) return null
          const perto = outros.sort((p, q) => distancia(eu, p) - distancia(eu, q))[0]
          const colar = reboot?.feito && !reboot.concedido && reboot.bonusAte != null && tempo < reboot.bonusAte
          const limite = colar ? raio() * WIFI.colados * 0.7 : raio() * 0.5
          return distancia(eu, perto) > limite ? { x: perto.x, y: perto.y } : null
        },

        terminarEsquiva() {
          destruirVisual()
          efeito = null
          janelas = []
          reboot = null
        },

        terminar() {
          destruirVisual()
        },
      }
    },
  }
}
