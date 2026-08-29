// 이 배포가 어느 사이트인지 — DB 를 여러 사이트가 같이 쓰므로 행마다 site 로 구분한다.
// weflow(본 사이트)는 모든 사이트의 문의·예약을 보고, 랜딩페이지들은 자기 것만 본다.
export const SITE = 'landingpage'
export const SITE_LABEL: Record<string, string> = {
  weflow: '본 사이트',
  landingpage: '랜딩페이지',
  landinghomepage: '랜딩홈페이지',
}
