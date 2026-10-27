import { CORES } from './constants.js'

// A cor de cada vaga da sala (Fase 5A): P1 e P2 são as almas de sempre (o coração
// de cada um), P3 e P4 vêm de CORES.vagasExtra. Tudo segue o modo daltônico
// (daltonismo.js escreve em CORES): leia na hora de desenhar.
export const corDaVaga = (i) => (i < 2 ? CORES.almas[i] : CORES.vagasExtra[i - 2]) ?? 0x9a9ab0
export const textoDaVaga = (i) => `#${corDaVaga(i).toString(16).padStart(6, '0')}`
