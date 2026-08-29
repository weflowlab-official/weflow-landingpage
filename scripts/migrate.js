// Supabase → Neon 1회 이관 스크립트
//
//   node --env-file=.env.local scripts/migrate.js --schema   # Neon 에 테이블 생성
//   node --env-file=.env.local scripts/migrate.js --data     # Supabase 데이터 복사 (id·created_at 유지)
//
// .env.local 에 필요한 값:
//   DATABASE_URL                 Neon 연결 문자열
//   NEXT_PUBLIC_SUPABASE_URL     옛 Supabase URL      (--data 만)
//   SUPABASE_SERVICE_ROLE_KEY    옛 Supabase 서비스 키 (--data 만)
//
// 여러 번 실행해도 안전 — 같은 id 는 건너뛴다(ON CONFLICT DO NOTHING).

const fs = require('fs')
const path = require('path')
const { neon } = require('@neondatabase/serverless')

const sql = neon(process.env.DATABASE_URL)
const TABLES = ['bookings', 'inquiries', 'page_views']

async function schema() {
  const file = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('--')).join('\n') // 주석 줄 제거
  const stmts = file.split(';').map(s => s.trim()).filter(Boolean)
  for (const s of stmts) await sql.query(s)
  console.log('테이블 생성 완료:', TABLES.join(', '))
}

// Supabase REST 로 테이블 전체를 1000건씩 페이지 넘기며 읽는다
async function fetchAll(table) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error('Supabase 환경변수가 없습니다')
  const rows = []
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${base}/rest/v1/${table}?select=*&order=created_at.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    })
    if (!res.ok) throw new Error(`${table} 조회 실패: ${res.status} ${await res.text()}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows
}

async function insertRows(table, rows) {
  if (!rows.length) return 0
  const cols = Object.keys(rows[0])
  let n = 0
  // 100건씩 묶어서 INSERT
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const params = []
    const values = chunk.map(r => {
      const ph = cols.map(c => { params.push(r[c] ?? null); return `$${params.length}` })
      return `(${ph.join(',')})`
    })
    const q = `INSERT INTO ${table} (${cols.join(',')}) VALUES ${values.join(',')} ON CONFLICT (id) DO NOTHING`
    await sql.query(q, params)
    n += chunk.length
  }
  return n
}

async function data() {
  for (const t of TABLES) {
    const rows = await fetchAll(t)
    const n = await insertRows(t, rows)
    const [{ count }] = await sql.query(`SELECT count(*)::int AS count FROM ${t}`)
    console.log(`${t}: Supabase ${rows.length}건 → Neon 총 ${count}건`)
  }
}

const mode = process.argv[2]
;(mode === '--schema' ? schema() : mode === '--data' ? data() : Promise.reject(new Error('--schema 또는 --data')))
  .catch(e => { console.error(e.message); process.exit(1) })
