import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import session from 'express-session'
import connectSqlite3 from 'connect-sqlite3'
import { PORT, SESSION_SECRET, CORS_ORIGIN, DB_PATH, IS_PRODUCTION } from './env.js'
import { getDb } from './db.js'
import { authRouter } from './routes/auth.js'
import { communityRouter } from './routes/community.js'

const SQLiteStore = connectSqlite3(session)

const app = express()

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))

app.set('trust proxy', 1)

app.use(session({
  store: new (SQLiteStore as any)({
    db: 'sessions.db',
    dir: DB_PATH.replace(/\/[^/]+$/, '') || '.',
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}))

// Init database
getDb()

app.use('/api/auth', authRouter)
app.use('/api/community', communityRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Elastic Forge API running on port ${PORT}`)
})
