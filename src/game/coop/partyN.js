// A party do CO-OP de 3 e 4 (Fase 5B): cada jogador escolhe o PRÓPRIO personagem, sem repetir (a mesma
// regra da party de 2: o baralho de cada personagem é só dele). Lógica pura (sem Phaser), testada em
// __tests__/partyN.test.js. Quem arbitra é o HOST da partida: o primeiro pedido a chegar leva o personagem;
// o convidado vê a party do host e, se o pedido não valeu, escolhe outro.
//
//   const p = criarParty({ vagas: 4 })
//   p.confirmar(vaga, id, ids)     { ok: true } | { ok: false, motivo: 'repetido' | 'invalido' | 'ja_confirmou' }
//   p.confirmados                  [id | null] por vaga
//   p.completa(presentes)          todas as vagas em `presentes` (índices) já confirmaram?
//   p.lista(ids, vagas)            a party por vaga para a luta: quem não escolheu (saiu antes) fica com um
//                                  personagem que ninguém pegou (fica "SAIU" na arena)
export function criarParty({ vagas = 4 } = {}) {
  const confirmados = Array(vagas).fill(null)
  return {
    confirmados,
    confirmar(vaga, id, ids) {
      if (!ids.includes(id) || vaga < 0 || vaga >= vagas) return { ok: false, motivo: 'invalido' }
      if (confirmados[vaga]) return { ok: false, motivo: 'ja_confirmou' }
      if (confirmados.includes(id)) return { ok: false, motivo: 'repetido' }
      confirmados[vaga] = id
      return { ok: true }
    },
    completa(presentes) {
      return presentes.length > 0 && presentes.every((v) => confirmados[v])
    },
    // a vaga voltou a escolher (o convidado saiu da sala antes de a luta começar)
    liberar(vaga) {
      confirmados[vaga] = null
    },
    lista(ids, tamanho = vagas) {
      const livres = ids.filter((id) => !confirmados.includes(id))
      return Array.from({ length: tamanho }, (_, v) => confirmados[v] ?? livres.shift() ?? ids[v % ids.length])
    },
  }
}

// o personagem que um jogador quer e não pode (já foi pego): o aviso
export const avisoRepetido = (nomeDoOutro, nomePersonagem) => `${nomeDoOutro} pegou ${nomePersonagem} primeiro: escolha outro`
