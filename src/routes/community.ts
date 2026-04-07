import { Router, type Request, type Response, type NextFunction } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db.js'

export const communityRouter = Router()

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Nicht eingeloggt.' })
    return
  }
  next()
}

// GET /api/community/entries?q=&sort=new|top|favorites&page=1&pageSize=12
communityRouter.get('/entries', (req: Request, res: Response) => {
  const db = getDb()
  const q = (req.query.q as string || '').trim()
  const sort = (req.query.sort as string) || 'new'
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 12))
  const offset = (page - 1) * pageSize

  let where = ''
  const params: unknown[] = []
  if (q) {
    where = 'WHERE e.title LIKE ?'
    params.push(`%${q}%`)
  }

  let orderBy = 'e.published_at DESC'
  if (sort === 'top') orderBy = 'e.views DESC'
  if (sort === 'favorites') orderBy = 'fav_count DESC'

  const sql = `
    SELECT
      e.id, e.title, e.tagline, e.description,
      u.display_name AS author_name,
      e.created_at, e.published_at, e.views,
      e.thumbnail_data_url,
      (SELECT COUNT(*) FROM likes l WHERE l.entry_id = e.id) AS likes_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.entry_id = e.id) AS fav_count
    FROM community_entries e
    JOIN users u ON u.id = e.user_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `
  params.push(pageSize, offset)

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string
    title: string
    tagline: string | null
    description: string | null
    author_name: string
    created_at: string
    published_at: string
    views: number
    thumbnail_data_url: string | null
    likes_count: number
    fav_count: number
  }>

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    tagline: r.tagline,
    description: r.description,
    author: { displayName: r.author_name },
    createdAt: r.created_at,
    publishedAt: r.published_at,
    views: r.views,
    likesCount: r.likes_count,
    favoritesCount: r.fav_count,
    thumbnailUrl: r.thumbnail_data_url,
  }))

  res.json({ items })
})

// POST /api/community/entries (auth required)
communityRouter.post('/entries', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const { title, tagline, fragment, uniforms, layers, thumbnailDataUrl } = req.body as {
    title?: string
    tagline?: string
    fragment?: string
    uniforms?: unknown
    layers?: unknown
    thumbnailDataUrl?: string
  }

  if (!title || !fragment) {
    res.status(400).json({ error: 'Titel und Fragment-Shader erforderlich.' })
    return
  }

  const id = uuid()
  db.prepare(`
    INSERT INTO community_entries (id, user_id, title, tagline, fragment, uniforms, layers, thumbnail_data_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.session.userId,
    title,
    tagline || null,
    fragment,
    JSON.stringify(uniforms ?? {}),
    layers ? JSON.stringify(layers) : null,
    thumbnailDataUrl || null,
  )

  res.status(201).json({ id })
})

// GET /api/community/entries/:id
communityRouter.get('/entries/:id', (req: Request, res: Response) => {
  const db = getDb()
  const entry = db.prepare('SELECT title, uniforms, fragment FROM community_entries WHERE id = ?').get(
    req.params.id,
  ) as { title: string; uniforms: string; fragment: string } | undefined

  if (!entry) {
    res.status(404).json({ error: 'Eintrag nicht gefunden.' })
    return
  }

  let parsedUniforms: unknown
  try {
    parsedUniforms = JSON.parse(entry.uniforms)
  } catch {
    parsedUniforms = {}
  }

  res.json({
    title: entry.title,
    uniforms: parsedUniforms,
    fragment: entry.fragment,
  })
})

// POST /api/community/entries/:id/view
communityRouter.post('/entries/:id/view', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('UPDATE community_entries SET views = views + 1 WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

// POST /api/community/entries/:id/like (auth required)
communityRouter.post('/entries/:id/like', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.session.userId!
  const entryId = req.params.id

  const existing = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND entry_id = ?').get(userId, entryId)
  if (existing) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND entry_id = ?').run(userId, entryId)
  } else {
    db.prepare('INSERT INTO likes (user_id, entry_id) VALUES (?, ?)').run(userId, entryId)
  }

  res.status(204).end()
})

// POST /api/community/entries/:id/favorite (auth required)
communityRouter.post('/entries/:id/favorite', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const userId = req.session.userId!
  const entryId = req.params.id

  const existing = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND entry_id = ?').get(userId, entryId)
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND entry_id = ?').run(userId, entryId)
  } else {
    db.prepare('INSERT INTO favorites (user_id, entry_id) VALUES (?, ?)').run(userId, entryId)
  }

  res.status(204).end()
})

// GET /api/community/me/entries (auth required)
communityRouter.get('/me/entries', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      e.id, e.title, e.tagline, e.description,
      u.display_name AS author_name,
      e.created_at, e.published_at, e.views,
      e.thumbnail_data_url,
      (SELECT COUNT(*) FROM likes l WHERE l.entry_id = e.id) AS likes_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.entry_id = e.id) AS fav_count
    FROM community_entries e
    JOIN users u ON u.id = e.user_id
    WHERE e.user_id = ?
    ORDER BY e.published_at DESC
  `).all(req.session.userId) as Array<{
    id: string
    title: string
    tagline: string | null
    description: string | null
    author_name: string
    created_at: string
    published_at: string
    views: number
    thumbnail_data_url: string | null
    likes_count: number
    fav_count: number
  }>

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    tagline: r.tagline,
    description: r.description,
    author: { displayName: r.author_name },
    createdAt: r.created_at,
    publishedAt: r.published_at,
    views: r.views,
    likesCount: r.likes_count,
    favoritesCount: r.fav_count,
    thumbnailUrl: r.thumbnail_data_url,
  }))

  res.json({ items })
})
