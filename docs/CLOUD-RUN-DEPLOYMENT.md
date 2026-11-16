# 바로미 Cloud Run 배포

Vercel에서 `web` 앱을 배포한다. Cloud Run Service는 기존 `/api/v1` API를 제공하고, Cloud Run Job은 진단 한 건을 처리한 뒤 종료한다. Supabase Auth는 가입과 로그인을, PostgreSQL은 진단 상태와 보고서를, 비공개 Supabase Storage 버킷은 화면 증거를 보관한다.

## 배포 전 연결 작업

1. API와 Job의 상태 저장을 SQLite에서 Supabase PostgreSQL로 전환한다. SQLite 전용 마이그레이션과 SQL을 검토하고, 진단 ID별 작업 선점과 취소 상태를 PostgreSQL에서 원자적으로 처리한다.
2. 보고서 JSON과 증거 파일을 영구 저장소에 연결한다. Job은 수집 중 임시 경로를 사용하고, 보고서와 증거를 저장한 뒤 진단을 완료 상태로 전환한다. 기존 보고서 조회, 다운로드, 증거 조회, 비교와 삭제 경로도 함께 연결한다.
3. 진단 ID를 받아 한 건을 실행하고 종료하는 Job 진입점을 만든다. API는 접수를 저장하고 Job을 실행한다. 중복 호출, 작업 시작 실패, 중단된 작업을 처리한다. Job 인자에는 진단 ID만 전달한다.
4. 정적 진단을 HTTP와 HTML 파서만 사용하는 경로로 구현한다. 동적 진단은 Playwright가 포함된 이미지에서 Chromium으로 실행한다.

## 배포 순서

### AI 꼼꼼 점검 (Gemini)

1. Google AI Studio에서 Gemini API 키를 만든 뒤 Cloud Console → 보안 → Secret Manager에서 `BAROMI_AI_API_KEY` 시크릿을 만들고 값에 키를 저장한다. 키 값은 프론트 환경변수나 저장소 파일에 넣지 않는다.
2. `baromi-worker` 서비스 계정에 이 시크릿의 Secret Accessor 권한만 부여한다. 배포 스크립트는 시크릿이 있을 때만 작업기에 연결한다.
3. Cloud Run 작업기 환경변수는 `BAROMI_AI_API_URL=https://generativelanguage.googleapis.com/v1beta`, `BAROMI_AI_MODEL=gemini-3.5-flash-lite`, `BAROMI_AI_INPUT_USD_PER_MILLION=0.30`, `BAROMI_AI_OUTPUT_USD_PER_MILLION=2.50`, `BAROMI_AI_MAX_COST_USD=0.25`를 사용한다. 요금은 변경될 수 있으므로 배포 시 Gemini 가격표와 다시 대조한다.
4. AI 검토 작업만 이 API를 호출한다. 기본 쇼핑몰 진단은 AI 키가 없어도 실행된다.

실제 AI 호출은 항목별 호출로 과금될 수 있다. 첫 운영 확인은 테스트 쇼핑몰 하나와 한 항목으로 제한하고, Cloud Logging과 `AiReview.usageJson`의 사용량을 비교한다.

1. 결제가 연결된 Google Cloud 프로젝트에서 API와 Job용 서비스 계정을 준비한다. API 계정에 해당 Job 실행 권한을 부여하고 서버 비밀값은 Secret Manager에서 주입한다.
2. 저장소 루트의 Dockerfile로 API와 브라우저 이미지(빌드 타깃 `worker`)를 빌드한다. Job은 한 건 처리 진입점을 사용하도록 설정한다.
3. Cloud Run API HTTPS URL을 Vercel의 `BAROMI_API_ORIGIN`에 넣는다. Vercel 운영 URL을 API 허용 출처와 Supabase Auth 리디렉션에 등록하고, 프론트 데모 모드를 끈다.
4. 배포 URL에서 가입·로그인, 정적·동적 진단, 진행 상태, 16개 항목 보고서와 다운로드, 증거 접근을 확인한다. Job이 종료된 뒤에도 결과가 열리는지 확인한다.

현재 Dockerfile은 이미지 준비 단계다. 저장소 전환과 Job 실행 연결이 완료되어야 통합 서비스로 배포할 수 있다.

API 서비스 계정은 진단 ID를 Job 인자로 전달해 실행하므로 `roles/run.jobsExecutorWithOverrides`가 필요하다. 권한은 `baromi-scan-worker` Job에만 부여한다.
