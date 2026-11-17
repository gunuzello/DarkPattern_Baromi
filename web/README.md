# 바로미 웹 (web/)

바로미 서비스 화면을 Next.js(React) + TypeScript로 구현한 **Vercel 배포용 프론트엔드**입니다. 저장소 루트의 API·진단 엔진과 분리돼 있으며, 데이터는 `/api/v1` API를 통해 주고받습니다. 현재 프론트 주소는 [baromi-web-coral.vercel.app](https://baromi-web-coral.vercel.app)입니다.

- 디자인 시스템: "Ledger"(`app/globals.css`, `components/ui/`) 기반
- 정보 구조(서비스 소개, 분석 방법, 탐지 기준, 안전 원칙, 로그인)와 보고서 레이아웃(문서 캔버스 + 오른쪽 작업 사이드바): `feature/redesign` 브랜치에서 가져와 Ledger 스타일로 다시 구현
- 백엔드 통합 명세(2026-11-15)의 `phaseResults`(구매 3단계 + 별도 영역 7개), `ruleCoverage`(16개 유형 판정), `priceLedger`(가격 원장)를 표시

- Next.js 16.4.6, React 19.3.1, TypeScript 5.9.3 (저장소와 같은 버전)
- 외부 UI 라이브러리 없음. 디자인 토큰과 컴포넌트는 `app/globals.css`, `components/ui/`에 있습니다.

## 화면

| 경로 | 화면 |
|---|---|
| `/` | 랜딩. 스크롤하면 오른쪽 패널이 3D 모델에서 단계별 실제 화면으로 바뀝니다 |
| `/about`, `/method`, `/criteria`, `/principles` | 서비스 소개, 분석 방법, 16가지 탐지 기준, 안전 원칙 |
| `/login` | Supabase 이메일 로그인·가입. 로그인 세션의 access token을 API 요청에 전달합니다 |
| `/scan/new` | 새 진단: 진단 범위, PC/모바일, 장바구니/바로구매, 테스트 계정, 동의, 소유 확인(메타 태그, 파일, DNS TXT) |
| `/scan/[id]` | 진단 진행: 1.5초마다 상태 조회, `phaseResults` 기준 구매 3단계·별도 영역 7개의 상태·소요 시간·사유, 진단 중단 |
| `/report/[id]` | 진단 보고서: 16개 유형 분포, 구매 흐름 타임라인, 발견 상세와 증거, 16가지 항목 표(`ruleCoverage`), 가격 원장, 검사 범위 10개, 재진단 비교, AI 정밀 분석 |
| `/report/[id]/[finding]` | 발견 항목 상세: 단계별 스크린샷과 위치 표시, 가격 기록 |
| `/shops` | 내 쇼핑몰 (`GET /shops`), 쇼핑몰 삭제 |
| `/shop/[id]` | 진단 이력, 진단 삭제, 쇼핑몰 삭제 |
| `/report/sample` | 예시 보고서 (백엔드 없이 항상 동작) |

## 로컬 실행

Node.js 22.12 이상이 필요합니다.

```sh
npm install
cp .env.example .env.local
npm run dev
```

웹과 API를 함께 로컬에서 실행하려면 루트 API 서버는 `127.0.0.1:3000`, 이 앱은 `127.0.0.1:3001`에서 실행하세요. `web/.env.local`에 `BAROMI_API_ORIGIN=http://127.0.0.1:3000`, Supabase 공개 URL/키, `NEXT_PUBLIC_DEMO_MODE=false`를 설정하고 루트 `.env.local`의 `BAROMI_WEB_ORIGINS`에 `http://127.0.0.1:3001`을 추가합니다. 프론트 포트나 주소를 바꾸면 허용 origin도 함께 바꿔야 합니다.

백엔드 없이 화면만 보려면 `.env.local`에 `NEXT_PUBLIC_DEMO_MODE=true`를 넣으세요. 새 진단부터 진행, 보고서까지 예시 데이터로 동작합니다.

## 환경변수

| 이름 | 설명 |
|---|---|
| `BAROMI_API_ORIGIN` | DarkPatternPrevent API 서버의 주소(끝에 `/` 없이). 설정하면 `/api/v1/*` 요청이 이 주소로 전달됩니다. Supabase access token은 프론트에서 Bearer 인증으로 전달됩니다. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저에 사용해도 되는 Supabase publishable/anon key. 비밀키는 넣지 않습니다. |
| `NEXT_PUBLIC_DEMO_MODE` | `true`이면 모든 화면이 `lib/demo.ts`의 예시 데이터를 씁니다. Vercel 미리보기용입니다. |

## 운영 배포 구성

프론트엔드는 Vercel에서 제공하고, 현재 API 주소는 `https://baromi-api-zby54gcwwq-du.a.run.app`입니다. 진단 API와 Chromium 작업기는 Cloud Run의 `baromi-api` 서비스와 요청 시 실행되는 `baromi-scan-worker` Job으로 운영합니다. 진단 요청이 없을 때 브라우저 작업기를 계속 켜 두지 않습니다.

Vercel 프로젝트의 Root Directory는 `web`으로 설정합니다. 환경변수에는 `BAROMI_API_ORIGIN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 둡니다. 인증 API의 `BAROMI_WEB_ORIGINS`에도 프론트 도메인을 허용해야 합니다. 미리보기에서만 `NEXT_PUBLIC_DEMO_MODE=true`를 사용합니다.

AI 꼼꼼 점검은 화면과 요금 안내에서는 유료 후속 기능으로 소개하지만, 현재 시연 기간에는 로그인한 모든 계정이 요청할 수 있습니다. 계정 로그인과 사용자별 쇼핑몰·진단 이력 보호는 그대로 적용됩니다.

## 사용하는 API (백엔드 명세 v1, 9절의 공개 API만)

| 화면 | 호출 |
|---|---|
| 내 쇼핑몰 | `GET /shops?limit=50`, `DELETE /shops/:id` |
| 새 진단 | `POST /shops`, `POST /shops/:id/verify`, `POST /scans` |
| 진단 진행 | `GET /scans/:id` (진행 중 1.5초 간격, 끝나면 중지), `POST /scans/:id/cancel`, `POST /scans` (재진단) |
| 진단 보고서 | `GET /scans/:id/report`, `GET /scans/:id/report?download=1`, `POST /scans/:id/ai-review`, `POST /scans/:id/ai-review-labels` |
| 발견 항목 상세 | `GET /findings/:id`, `GET /evidences/:scanId-:stage` |
| 진단 이력 | `GET /shops/:id`, `GET /shops/:id/scans`, `DELETE /scans/:id`, `DELETE /shops/:id` |

`X-Baromi-Owner`, `X-Baromi-Worker` 헤더와 Spring 직접 호출은 쓰지 않습니다. Supabase Auth가 사용자 로그인을 관리하고, 프론트 API 클라이언트가 현재 세션의 access token을 `Authorization: Bearer`로 전달합니다. 백엔드는 Supabase claim을 검증해 사용자별 데이터 범위를 정합니다. 브라우저에는 publishable/anon key만 두며 service-role key는 사용하지 않습니다.

### 명세에 맞춘 처리

- **세션 만료:** 진단 진행, 보고서, 진단 이력에서 `404`(또는 `401`)를 받으면 `/scan/new?expired=1`로 돌아가 안내를 보여줍니다. `/report/sample`은 예외입니다.
- **오류 코드:** `503`은 저장소·작업기 상태 또는 오래된 실행 기록에 따른 API 상태 저하, `429`는 호출 제한, `409`는 상태 충돌(진행 중인 진단 삭제 등)을 나타낼 수 있습니다. 그 밖에는 서버가 준 `error` 문구를 그대로 보여줍니다.
- **중복 진단:** `POST /scans`가 `deduplicated: true`를 주면 진행 중인 기존 진단으로 이동하고 그 사실을 알려줍니다.
- **진단 중단:** 대기 중이던 진단은 `CANCELLED`로 바로 끝나고, 진행 중이면 `cancelRequested`로 "중단 요청 처리 중"을 보여줍니다.
- **상태 정규화 (`lib/normalize.ts`):** 소문자 상태나 `succeeded`가 와도 대문자 상태로 바꿉니다. 별도 탐색 영역 키는 명세 예시의 `SEARCH`, `LOGIN`과 Node API의 `CATALOG`, `AUTH`를 같은 일곱 영역으로 묶습니다. 같은 영역에 값이 여러 개면 더 많이 진행된 상태를 씁니다.
- **미검사 표시:** 보고서는 `coverage`, `surfaceCoverage`, `summary.notTested`를 항상 보여줘 미검사와 위험 판정을 구분합니다.

## 구조

```
app/
  page.tsx                 랜딩
  (service)/layout.tsx     서비스 화면 공통 틀(왼쪽 메뉴)
  (service)/scan/new       새 진단
  (service)/scan/[id]      진단 진행
  (service)/report/[id]    보고서, [finding] 발견 항목 상세
  (service)/shop/[id]      진단 이력
  globals.css              디자인 토큰과 컴포넌트 스타일
components/
  ui/        버튼, 상태 표시, 알림, 단계 표시, 토스트 등 공통 부품
  site/      상단 메뉴·푸터, 소개 페이지 공통 틀
  landing/   스크롤 스토리, 3D 모델, 단계별 화면
  scan/      새 진단 양식, 진단 진행
  report/    보고서(ScanReport, FindingRows, ReportSections, ResultRing), 운영자 라벨, AI 정밀 분석, 진단 이력
lib/
  types.ts   백엔드 응답 타입 (route.ts 기준)
  api.ts     API 클라이언트 (실제 백엔드 또는 데모)
  demo.ts    예시 데이터
  labels.ts  16가지 점검 항목, 단계·영역·상태 이름 (backend legal-rules.ts 기준)
  checks.ts  보고서를 16가지 항목 결과로 바꾸는 규칙
  normalize.ts  상태와 별도 탐색 영역 키 정규화
  phases.ts     phaseResults 읽기 (없으면 coverage/surfaceCoverage로 대체, currentStage로 추론하지 않음)
  session.ts    세션 만료 시 등록 화면으로 복귀
```

### 16가지 항목 결과를 정하는 방식 (`lib/checks.ts`)

보고서에 서버의 `ruleCoverage`가 있으면 그대로 씁니다(`SUSPECTED`→위험 신호, `REVIEW_NEEDED`→검토 필요, `NOT_OBSERVED`→미관찰, `NOT_TESTED`→미검사와 사유). 없을 때만 아래 규칙으로 계산합니다.

- 해당 유형의 `SUSPECTED` 발견이 있으면 **위험 신호**, `REVIEW_NEEDED`만 있으면 **검토 필요**
- 발견이 없더라도 그 항목에 필요한 화면을 검사하지 못했으면 **미검사**와 이유
  - 로그인·구독·해지·추천 관련 항목: 해당 별도 탐색 영역이 `COVERED`가 아니면 미검사
  - 뒤늦게 붙는 비용, 숨겨진 비용: 주문서를 검사하지 못했으면 미검사
  - 장바구니 몰래 추가: 장바구니를 검사하지 못했거나 바로구매 경로면 미검사
- 위 조건을 모두 통과해야 **미관찰**

백엔드가 항목별 검사 범위를 직접 내려주게 되면 이 파일만 바꾸면 됩니다.

## 확인한 것

- `npm run typecheck`, `npm run build` 통과
- 데모 모드에서 모든 경로 응답 확인, 헤드리스 브라우저로 새 진단 입력부터 소유 확인, 진단 진행, 보고서, 발견 항목, 이력까지 실행 중 오류 없음

## 바꾸면 좋은 곳

- 이용약관, 개인정보처리방침, 문의 메일(`hello@baromi.app`)은 자리만 잡아 두었습니다.
- 요금제의 `[제공 범위 확정 전]`, `[가격 미정]`은 확정 후 바꿔주세요.
- 별도 탐색 영역 키는 명세 예시(`SEARCH`, `LOGIN`)와 실제 Node API(`CATALOG`, `AUTH` 등)가 달라서 양쪽을 다 받도록 했습니다. 최종 키 목록이 정해지면 `lib/normalize.ts`의 대응표만 고치면 됩니다.
