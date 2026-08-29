// Neon(Postgres) 테이블 접근 계층 — 라우트는 여기만 통해 DB에 닿는다.
// 테이블 3개: bookings(예약) / inquiries(문의) / page_views(방문 기록)
// DB는 snake_case, 앱은 camelCase — 사이의 변환은 각 to*() 함수가 담당한다.

import { getSql } from './db'

// 예약 1건 — bookings 테이블 한 행
export interface Booking {
  id: string
  status: 'pending' | 'in_progress' | 'done'
  name: string
  phone: string
  type: string
  industry: string
  note: string
  date: string
  time: string
  createdAt: string
}

// 문의 1건 — inquiries 테이블 한 행 (예약과 달리 희망일정 없고 개인정보 동의·유입 출처가 있다)
export interface Inquiry {
  id: string
  status: 'pending' | 'in_progress' | 'done'
  name: string
  phone: string
  type: string
  industry: string
  note: string
  source?: string
  agree: boolean
  createdAt: string
}

// timestamptz 는 Date 로 오므로 ISO 문자열로 맞춘다 (앱 전체가 문자열을 기대한다)
function toIso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v ?? '')
}

// bookings 행 → Booking (created_at → createdAt, null 필드는 빈 문자열로)
function toBooking(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    status: row.status as Booking['status'],
    name: row.name as string,
    phone: row.phone as string,
    type: row.type as string,
    industry: (row.industry as string) || '',
    note: (row.note as string) || '',
    date: row.date as string,
    time: row.time as string,
    createdAt: toIso(row.created_at),
  }
}

function toInquiry(row: Record<string, unknown>): Inquiry {
  return {
    id: row.id as string,
    status: row.status as Inquiry['status'],
    name: row.name as string,
    phone: row.phone as string,
    type: row.type as string,
    industry: (row.industry as string) || '',
    note: (row.note as string) || '',
    source: (row.source as string) || 'web',
    agree: (row.agree as boolean) || false,
    createdAt: toIso(row.created_at),
  }
}

export const bookingStore = {
  getAll: async (): Promise<Booking[]> => {
    const sql = getSql()
    const rows = await sql`SELECT * FROM bookings ORDER BY created_at DESC`
    return rows.map(toBooking)
  },

  create: async (input: Omit<Booking, 'id' | 'status' | 'createdAt'>): Promise<Booking> => {
    const sql = getSql()
    const rows = await sql`
      INSERT INTO bookings (status, name, phone, type, industry, note, date, time)
      VALUES ('pending', ${input.name}, ${input.phone}, ${input.type},
              ${input.industry ?? ''}, ${input.note ?? ''}, ${input.date}, ${input.time})
      RETURNING *`
    return toBooking(rows[0])
  },

  // 관리자 화면에서 바꾸는 값은 상태뿐이라 status 만 반영한다
  update: async (id: string, patch: Partial<Booking>): Promise<Booking | null> => {
    if (!patch.status) return null
    const sql = getSql()
    const rows = await sql`UPDATE bookings SET status = ${patch.status} WHERE id = ${id} RETURNING *`
    return rows.length ? toBooking(rows[0]) : null
  },

  delete: async (id: string): Promise<boolean> => {
    const sql = getSql()
    const rows = await sql`DELETE FROM bookings WHERE id = ${id} RETURNING id`
    return rows.length > 0
  },
}

export interface PageView {
  id: string
  sessionId: string
  path: string
  referrer: string
  source: string
  medium: string
  campaign: string
  device: string
  durationMs: number | null
  maxScroll: number | null
  createdAt: string
}

function toPageView(row: Record<string, unknown>): PageView {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    path: row.path as string,
    referrer: (row.referrer as string) || '',
    source: (row.source as string) || 'direct',
    medium: (row.medium as string) || '',
    campaign: (row.campaign as string) || '',
    device: (row.device as string) || 'desktop',
    durationMs: (row.duration_ms as number) ?? null,
    maxScroll: (row.max_scroll as number) ?? null,
    createdAt: toIso(row.created_at),
  }
}

export const pageViewStore = {
  // 최근 N일 방문 기록 (관리자 통계 집계용) — Postgres 는 행 수 제한이 없어 한 번에 가져온다
  getRecent: async (days = 30): Promise<PageView[]> => {
    const sql = getSql()
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const rows = await sql`
      SELECT * FROM page_views
      WHERE created_at >= ${since}
      ORDER BY created_at ASC, id ASC`
    return rows.map(toPageView)
  },

  create: async (input: {
    sessionId: string; path: string; referrer: string
    source: string; medium: string; campaign: string; device: string
  }): Promise<{ id: string }> => {
    const sql = getSql()
    const rows = await sql`
      INSERT INTO page_views (session_id, path, referrer, source, medium, campaign, device)
      VALUES (${input.sessionId}, ${input.path}, ${input.referrer},
              ${input.source}, ${input.medium}, ${input.campaign}, ${input.device})
      RETURNING id`
    return { id: rows[0].id as string }
  },

  // 페이지 이탈 시 체류시간 + 스크롤 최대 도달률 기록 (정밀 방식)
  setDuration: async (id: string, durationMs: number, maxScroll?: number): Promise<void> => {
    const sql = getSql()
    if (typeof maxScroll === 'number') {
      await sql`UPDATE page_views SET duration_ms = ${durationMs}, max_scroll = ${maxScroll} WHERE id = ${id}`
    } else {
      await sql`UPDATE page_views SET duration_ms = ${durationMs} WHERE id = ${id}`
    }
  },
}

export const inquiryStore = {
  getAll: async (): Promise<Inquiry[]> => {
    const sql = getSql()
    const rows = await sql`SELECT * FROM inquiries ORDER BY created_at DESC`
    return rows.map(toInquiry)
  },

  create: async (input: Omit<Inquiry, 'id' | 'status' | 'createdAt'>): Promise<Inquiry> => {
    const sql = getSql()
    const rows = await sql`
      INSERT INTO inquiries (status, name, phone, type, industry, note, source, agree)
      VALUES ('pending', ${input.name}, ${input.phone}, ${input.type},
              ${input.industry ?? ''}, ${input.note ?? ''}, ${input.source ?? 'web'}, ${input.agree ?? false})
      RETURNING *`
    return toInquiry(rows[0])
  },

  // 관리자 화면에서 바꾸는 값은 상태뿐이라 status 만 반영한다
  update: async (id: string, patch: Partial<Inquiry>): Promise<Inquiry | null> => {
    if (!patch.status) return null
    const sql = getSql()
    const rows = await sql`UPDATE inquiries SET status = ${patch.status} WHERE id = ${id} RETURNING *`
    return rows.length ? toInquiry(rows[0]) : null
  },

  delete: async (id: string): Promise<boolean> => {
    const sql = getSql()
    const rows = await sql`DELETE FROM inquiries WHERE id = ${id} RETURNING id`
    return rows.length > 0
  },
}
