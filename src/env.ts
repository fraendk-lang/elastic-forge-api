export const PORT = Number(process.env.PORT) || 4000
export const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5183'
export const DB_PATH = process.env.DB_PATH || (process.env.NODE_ENV === 'production' ? '/tmp/forge.db' : './forge.db')
export const IS_PRODUCTION = process.env.NODE_ENV === 'production'
