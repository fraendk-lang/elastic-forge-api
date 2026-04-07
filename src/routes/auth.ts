import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcrypt'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db.js'

declare module 'express-session' {
  interface SessionData {
    userId?: string
  }
}

export const authRouter = Router()

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body as {
    email?: string
    password?: string
    displayName?: string
  }

  if (!email || !password) {
    res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' })
    return
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' })
    return
  }

  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    res.status(409).json({ error: 'E-Mail bereits registriert.' })
    return
  }

  const id = uuid()
  const hash = await bcrypt.hash(password, 12)
  const name = displayName?.trim() || email.split('@')[0] || 'Anon'

  db.prepare('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)').run(
    id, email.toLowerCase().trim(), hash, name,
  )

  res.status(201).json({ id })
})

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' })
    return
  }

  const db = getDb()
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(
    email.toLowerCase().trim(),
  ) as { id: string; password_hash: string } | undefined

  if (!user) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten.' })
    return
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten.' })
    return
  }

  req.session.userId = user.id
  res.status(200).json({})
})

authRouter.get('/me', (req: Request, res: Response) => {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Nicht eingeloggt.' })
    return
  }

  const db = getDb()
  const user = db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?').get(
    req.session.userId,
  ) as { id: string; email: string; display_name: string; created_at: string } | undefined

  if (!user) {
    req.session.destroy(() => {})
    res.status(401).json({ error: 'Benutzer nicht gefunden.' })
    return
  }

  res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    createdAt: user.created_at,
  })
})

authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid')
    res.status(204).end()
  })
})
