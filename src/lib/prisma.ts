import type { PrismaClient } from '../generated/prisma/client'
import { getPrismaOrNull } from './vault'

/** Wird geworfen, wenn auf die DB zugegriffen wird, ohne dass sie entsperrt ist. */
export class DatabaseLockedError extends Error {
  constructor() {
    super('Datenbank ist gesperrt – bitte zuerst mit dem Master-Passwort entsperren.')
    this.name = 'DatabaseLockedError'
  }
}

/**
 * Lazy-Proxy auf die entsperrte Prisma-Instanz im Tresor.
 * So funktioniert `import { prisma } from '@/lib/prisma'` in allen API-Routen
 * unverändert weiter – solange die DB entsperrt ist. Andernfalls wird ein
 * DatabaseLockedError geworfen.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaOrNull()
    if (!client) throw new DatabaseLockedError()
    const value = Reflect.get(client as object, prop)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
