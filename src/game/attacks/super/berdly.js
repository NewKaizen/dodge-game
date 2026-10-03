import { definirAtaque } from '../definir.js'
import { ATAQUE, FONTE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

// SUPER de Berdly: PROVA IRREFUTÁVEL. A passiva dele ("Ego Inflado": cada
// vento usado deixa o próximo +10% mais forte, até +30%) vira o golpe
// inteiro. Um redemoinho de lâminas de vento e páginas gira no meio da
// caixa; a cada volta COMPLETA ele acelera +10% (até 3 voltas, o teto exato
// da passiva) e manda mais uma rajada de páginas. Na 3ª volta, convencido de
// que já provou o suficiente, ele junta tudo numa lâmina só, gigante e
// dourada, gira rápido demais pro próprio bem e crava um corte final na
// direção de quem está jogando: "a resposta certa".
//
// Fases:
//   I. Redemoinho (voltas 1-3). Três lâminas de vento giram em volta de um
//      pivô que PASSEIA pela caixa num 8 (o caminho aparece pontilhado antes,
//      enquanto as lâminas piscam): nenhum canto fica seguro o tempo todo. A
//      cada volta completa soa um "ding", aparece "EGO +10%!" e o ego infla de
//      verdade: as lâminas ficam 10% maiores e mais rápidas, o pivô anda mais
//      rápido e sai uma rajada de páginas do pivô (uma a mais a cada volta).
//   II. Transição. As lâminas encolhem e somem; um instante de silêncio
//      (Berdly "recarregando o ego").
//   III. Giro final. Uma lâmina única, maior e dourada, dá duas voltas bem
//      mais rápidas que qualquer uma do redemoinho.
//   IV. Corte final. Ela para, mira quem está jogando e solta um feixe reto
//      que atravessa a caixa inteira.
//
// Justiça:
//   - toda lâmina (as três do redemoinho e a final) fica parada e piscando
//     pelo aviso mínimo antes de começar a girar: ela só passa a valer (e só
//     passa a girar) depois disso;
//   - a lâmina cobre só uma fatia estreita do círculo a cada instante (3
//     lâminas finas): entre duas lâminas sempre passa um coração, e o
//     alcance máximo (raio x (1 + bonus x voltas)) é menor que a caixa: longe
//     do pivô sempre sobra espaço; o pivô anda bem mais devagar que o coração
//     e o caminho dele é mostrado antes;
//   - cada página da rajada nasce no centro já com o aviso mínimo piscando
//     antes de voar; são poucas e se espalham em leque, nunca uma parede;
//   - o corte final telegrafa a linha inteira (como os cortes do Kris) antes
//     de valer.
//
// Config:
//   pas              nº de lâminas do redemoinho
//   avisoPas         ms de aviso antes do redemoinho começar a girar
//   omegaInicial     rad/s do redemoinho na 1ª volta
//   bonusPorVolta    fração de omegaInicial ganha a cada volta (0.1 = +10%, igual à passiva)
//   voltas           quantas voltas ele acelera antes de partir pro golpe final (teto da passiva: 3)
//   rajadaBase       nº de páginas na 1ª rajada (cresce `rajadaPasso` a cada volta)
//   velocidadePagina, avisoPagina, girarPagina
//   pausaFinal       ms de silêncio entre o redemoinho sumir e o giro final começar
//   avisoGiroFinal   ms de aviso da lâmina final antes dela começar a girar
//   omegaFinal       rad/s do giro final
//   voltasFinais     quantas voltas o giro final dá antes do corte
//   avisoCorteFinal  ms de aviso do corte final
export default definirAtaque({
  nome: 'superBerdly',
  padrao: {
    duracao: 9000,
    pas: 3,
    avisoPas: 650,
    omegaInicial: 3.7,
    bonusPorVolta: 0.1,
    voltas: 3,
    rajadaBase: 7,
    rajadaPasso: 1,
    velocidadePagina: 150,
    avisoPagina: 420,
    girarPagina: 6,
    pausaFinal: 400,
    avisoGiroFinal: 600,
    omegaFinal: 9,
    voltasFinais: 2,
    avisoCorteFinal: 700,
    raio: 0.32, // fração do menor lado da caixa (comprimento da lâmina na 1ª volta)
    oito: { ax: 0.27, ay: 0.2, periodo: 4200 }, // o 8 do pivô (frações da caixa, ms por volta do 8)
  },
  iniciar(a, cfg) {
    const l = a.caixa
    const cx = l.centerX
    const cy = l.centerY
    const raio0 = Math.min(l.width, l.height) * cfg.raio
    const espessura = Math.max(16, raio0 * 0.3)
    const avisoPas = Math.max(ATAQUE.telegrafoMs, cfg.avisoPas)
    const oito = { ax: l.width * cfg.oito.ax, ay: l.height * cfg.oito.ay, periodo: cfg.oito.periodo }
    const pontoDoOito = (fase) => ({ x: cx + Math.sin(fase) * oito.ax, y: cy + Math.sin(2 * fase) * oito.ay })

    // longe do pivô sempre sobra um canto livre: o canto mais longe fica a pelo
    // menos meia diagonal do pivô (pior caso: pivô no centro)
    const alcanceMax = raio0 * (1 + cfg.bonusPorVolta * cfg.voltas)
    a.lacuna(Math.hypot(l.width, l.height) / 2 - alcanceMax, 'canto livre longe do redemoinho')
    // entre duas lâminas, no meio delas: o arco entre elas
    a.lacuna(((Math.PI * 2) / cfg.pas) * (alcanceMax / 2) - espessura, 'vão entre lâminas')

    tocar(a.cena, 'super-berdly-vento')
    desenharCaminho(a, pontoDoOito, avisoPas)

    const lams = []
    for (let i = 0; i < cfg.pas; i++) {
      const anguloBase = (i / cfg.pas) * Math.PI * 2
      const bala = a.bala({
        x: cx + Math.cos(anguloBase) * (raio0 / 2),
        y: cy + Math.sin(anguloBase) * (raio0 / 2),
        comprimento: raio0,
        espessura,
        angulo: anguloBase,
        textura: 'super-berdly-lamina',
        tamanho: raio0 * 1.08,
        aviso: avisoPas,
        atravessa: true,
        pulso: 0,
      })
      lams.push({ bala, anguloBase, raio0, espessura0: espessura, escala0: { x: bala.escalaX, y: bala.escalaY } })
    }
    const orbita = criarOrbita(a, cx, cy, raio0 * 1.15)

    let relogio = 0
    let omega = cfg.omegaInicial
    let raio = raio0
    let anguloGiro = 0
    let faseOito = 0
    let velOito = 1
    let volta = 0
    let fase = 'girando'
    const pivo = { x: cx, y: cy }

    a.aoAtualizar((dt) => {
      if (fase !== 'girando') return
      relogio += dt
      if (relogio < avisoPas) return // ainda piscando: parado, sem girar

      const s = dt / 1000
      anguloGiro += omega * s
      faseOito += ((Math.PI * 2) / oito.periodo) * dt * velOito
      Object.assign(pivo, pontoDoOito(faseOito))
      for (const lam of lams) posicionar(lam, pivo.x, pivo.y, lam.anguloBase + anguloGiro, raio)
      girarOrbita(orbita, pivo.x, pivo.y, anguloGiro * 0.55, raio * 1.15)

      if (anguloGiro >= Math.PI * 2) {
        anguloGiro -= Math.PI * 2
        volta++
        tocar(a.cena, 'super-berdly-tique')
        pulsoCentro(a, pivo.x, pivo.y)
        rajada(a, cfg, pivo.x, pivo.y, cfg.rajadaBase + (volta - 1) * cfg.rajadaPasso, anguloGiro)

        if (volta >= cfg.voltas) {
          fase = 'transicao'
          for (const lam of lams) {
            lam.bala.inofensiva = true
            a.cena.tweens.add({ targets: lam.bala.sprite, alpha: 0, scale: 0.2, duration: 320 })
          }
          desmontarOrbita(a, orbita)
          a.depois(cfg.pausaFinal, () => girarFinal(a, cfg, cx, cy, raio))
        } else {
          // Ego Inflado, de verdade: cada volta deixa tudo 10% maior e mais rápido
          const ego = 1 + cfg.bonusPorVolta * volta
          omega = cfg.omegaInicial * ego
          raio = raio0 * ego
          velOito = ego
          gritarEgo(a, pivo.x, pivo.y, volta * Math.round(cfg.bonusPorVolta * 100))
        }
      }
    })
  },
})

// a lâmina gira em torno do pivô; só é reposicionada depois que o próprio
// aviso dela já passou (antes disso fica parada, só piscando). O tamanho
// acompanha o ego (comprimento, espessura e o desenho)
function posicionar(lam, px, py, angulo, raio) {
  const b = lam.bala
  b.x = px + Math.cos(angulo) * (raio / 2)
  b.y = py + Math.sin(angulo) * (raio / 2)
  b.angulo = angulo
  if (b.comprimento !== raio) {
    const f = raio / lam.raio0
    b.comprimento = raio
    b.espessura = lam.espessura0 * f
    b.escalaX = lam.escala0.x * f
    b.escalaY = lam.escala0.y * f
  }
}

// o 8 que o pivô vai percorrer, pontilhado e apagando (só aparece no começo)
function desenharCaminho(a, pontoDoOito, ms) {
  const g = a.decoracao(a.cena.add.graphics().setDepth(1))
  g.fillStyle(0xd8f05a, 0.55)
  for (let k = 0; k < 48; k++) {
    const p = pontoDoOito((k / 48) * Math.PI * 2)
    g.fillCircle(p.x, p.y, 1.6)
  }
  a.cena.tweens.add({ targets: g, alpha: 0.15, duration: 160, yoyo: true, repeat: Math.max(1, Math.floor(ms / 320)) })
  a.cena.tweens.add({ targets: g, alpha: 0, delay: ms + 900, duration: 600 })
}

// "EGO +10%!": o ego subindo, em cima do pivô
function gritarEgo(a, x, y, pct) {
  const t = a.decoracao(
    a.cena.add
      .text(x, y - 18, `EGO +${pct}%!`, { fontFamily: FONTE, fontSize: '12px', color: '#d8f05a', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(9)
      .setScale(0.6),
  )
  a.cena.tweens.add({ targets: t, scale: 1.15, y: y - 40, duration: 260, ease: 'Back.easeOut' })
  a.cena.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 300 })
}

// ---------- rajada de páginas (uma a mais a cada volta) ----------

function rajada(a, cfg, cx, cy, n, anguloBase) {
  const vel = cfg.velocidadePagina
  const alcanceMax = Math.max(a.caixa.width, a.caixa.height)
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoPagina)
  for (let i = 0; i < n; i++) {
    const angulo = anguloBase + (i / n) * Math.PI * 2 + a.aleatorio(-0.1, 0.1)
    a.bala({
      x: cx,
      y: cy,
      raio: 6,
      textura: 'super-berdly-pagina',
      quadro: a.inteiro(0, 2),
      tamanho: 15,
      vx: Math.cos(angulo) * vel,
      vy: Math.sin(angulo) * vel,
      girar: a.escolher([-1, 1]) * cfg.girarPagina,
      aviso,
      vida: (alcanceMax / vel) * 1000 + 450,
    })
  }
}

// flash decorativo no centro a cada volta completa (sem colisão: é só o "ding" visual)
function pulsoCentro(a, cx, cy) {
  const img = a.decoracao(a.cena.add.image(cx, cy, 'super-berdly-impacto').setDepth(6).setScale(0.4).setAlpha(0.9))
  a.cena.tweens.add({ targets: img, scale: 1.7, alpha: 0, duration: 320, ease: 'Quad.easeOut' })
  particulas(a.cena, cx, cy, { cor: 0xd8f05a, quantidade: 8, velocidade: 110, vida: 300 })
}

// ---------- páginas/livros decorativos rodopiando (sem colisão) ----------

function criarOrbita(a, cx, cy, raio) {
  const n = 4
  const itens = []
  for (let i = 0; i < n; i++) {
    const anguloBase = (i / n) * Math.PI * 2
    const img = a.decoracao(
      a.cena.add.image(cx + Math.cos(anguloBase) * raio, cy + Math.sin(anguloBase) * raio, 'super-berdly-orbita', i % 2).setDepth(3).setAlpha(0.85),
    )
    itens.push({ img, anguloBase })
  }
  return { itens, raio }
}

function girarOrbita(orbita, cx, cy, anguloExtra, raio = orbita.raio) {
  for (const it of orbita.itens) {
    const angulo = it.anguloBase + anguloExtra
    it.img.setPosition(cx + Math.cos(angulo) * raio, cy + Math.sin(angulo) * raio)
    it.img.setRotation(angulo + Math.PI / 2)
  }
}

function desmontarOrbita(a, orbita) {
  for (const it of orbita.itens) a.cena.tweens.add({ targets: it.img, alpha: 0, scale: 0.3, duration: 300 })
}

// ---------- III. giro final: uma lâmina só, maior, dourada e bem mais rápida ----------

function girarFinal(a, cfg, cx, cy, raioBase) {
  const raio = raioBase * 1.18
  const espessura = Math.max(24, raio * 0.3)
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoGiroFinal)
  tocar(a.cena, 'super-berdly-giro')
  particulas(a.cena, cx, cy, { cor: 0xd8f05a, quantidade: 16, velocidade: 140, vida: 380 })

  const bala = a.bala({
    x: cx + raio / 2,
    y: cy,
    comprimento: raio,
    espessura,
    angulo: 0,
    textura: 'super-berdly-lamina',
    cor: 0xfff0b0,
    tamanho: raio * 1.1,
    aviso,
    atravessa: true,
    pulso: 0,
    vida: 4000, // se o ataque acabar no meio do giro, ela não fica parada na caixa
  })
  const lam = { bala, raio0: raio, espessura0: espessura, escala0: { x: bala.escalaX, y: bala.escalaY } }

  let relogio = 0
  let angulo = 0
  let voltas = 0
  let rodando = true

  a.aoAtualizar((dt) => {
    if (!rodando) return
    relogio += dt
    if (relogio < aviso) return // parado, só piscando (dourado: "ele está prestes a provar algo")

    const s = dt / 1000
    angulo += cfg.omegaFinal * s
    posicionar(lam, cx, cy, angulo, raio)

    if (angulo >= Math.PI * 2) {
      angulo -= Math.PI * 2
      voltas++
      tocar(a.cena, 'super-berdly-tique')
      if (voltas >= cfg.voltasFinais) {
        rodando = false
        bala.inofensiva = true
        a.cena.tweens.add({ targets: bala.sprite, alpha: 0, duration: 180 })
        corteFinal(a, cfg, cx, cy)
      }
    }
  })
}

// ---------- IV. corte final: um feixe reto mirado em quem está jogando ----------

function corteFinal(a, cfg, cx, cy) {
  const l = a.caixa
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoCorteFinal)
  const alvo = a.alvo()
  const angulo = Math.atan2(alvo.y - cy, alvo.x - cx)
  const comp = Math.hypot(l.width, l.height) + 40
  const dx = Math.cos(angulo) * comp
  const dy = Math.sin(angulo) * comp

  tocar(a.cena, 'super-berdly-vento')
  a.aviso({ tipo: 'linha', x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy, espessura: 18, ms: aviso }, () => {
    tocar(a.cena, 'super-berdly-estalo')
    shake(a.cena, 200, 0.012)
    const feixe = a.bala({
      x: cx,
      y: cy,
      comprimento: comp * 2,
      espessura: 16,
      angulo,
      textura: 'super-berdly-feixe',
      jaAvisada: true,
      vida: 320,
      atravessa: true,
      pulso: 0,
      atualizar: (bala) => {
        if (bala.vida < 140) {
          bala.inofensiva = true
          bala.sprite.setAlpha(Math.max(0, bala.vida / 140))
        }
      },
    })
    // a textura (160x20) ampliada pelo comprimento ficaria grossa demais: fixa a espessura visual
    feixe.sprite.setDisplaySize(comp * 2, 30)
    feixe.escalaX = feixe.sprite.scaleX
    feixe.escalaY = feixe.sprite.scaleY
    particulas(a.cena, cx, cy, { cor: 0xfff0b0, quantidade: 22, velocidade: 210, vida: 420 })
    particulas(a.cena, cx, cy, { cor: 0xd8f05a, quantidade: 14, velocidade: 150, vida: 360 })
  })
}
