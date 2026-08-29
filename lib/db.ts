// Neon(Postgres) 연결 — 라우트는 store.ts 를 통해서만 DB에 닿는다.
//
// 지연 초기화: 모듈 로드 시점이 아니라 실제 요청 시점에 연결을 만든다.
// (next build 의 page-data 수집 단계에서 env 없이 모듈을 평가해도 throw 하지 않도록)
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let client: NeonQueryFunction<false, false> | null = null

export function getSql(): NeonQueryFunction<false, false> {
  if (client) return client

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('Neon 환경변수(DATABASE_URL)가 설정되지 않았습니다.')
  }

  client = neon(url)
  return client
}
