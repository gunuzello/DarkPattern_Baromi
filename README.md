# 바로미 (Baromi)

바로미는 쇼핑몰 운영자가 공개 HTTPS 주소를 등록해 다크패턴 위험 신호를 확인하는 자동 진단 서비스입니다. 사용자가 선택한 진단 범위에 따라 Playwright·Chromium으로 접근 가능한 화면과 구매 흐름을 살펴보고, 화면 문구·가격·선택 상태·상호작용 등 관찰 자료를 16개 기준과 대조합니다. 기본 엔진은 수집된 사실을 근거와 함께 보고하고, 사용자는 원하는 항목을 AI 꼼꼼 점검에 추가로 요청할 수 있습니다. 결과는 법률 위반 확정이 아니라 관찰된 위험 신호와 확인 범위를 설명합니다. 모든 화면을 빠짐없이 탐색한다고 보장하지 않으며, 도달하지 못한 화면은 미검사로 표시합니다.

## 서비스 구성

- **웹 프론트엔드:** [baromi-web-coral.vercel.app](https://baromi-web-coral.vercel.app)에서 제공하며 Vercel에 배포합니다.
- **API·진단 작업기:** Cloud Run의 `baromi-api`가 요청을 받고, `baromi-scan-worker` 작업이 진단 요청 때 실행됩니다. 브라우저 작업기를 상시 켜 두지 않습니다.
- **계정·저장:** Supabase Auth로 계정을 관리하고, 운영용 데이터베이스와 비공개 증거 저장소를 사용합니다. 비밀 키는 서버 환경에만 둡니다.
- **기본 점검과 AI:** 기본 엔진이 16개 유형의 근거 기반 보고서를 만듭니다. AI는 별도 후속 기능이며, 현재 시연 기간에는 로그인한 모든 계정이 선택한 항목을 요청할 수 있습니다. 화면의 유료 기능·요금 안내 문구는 유지됩니다.

서비스 구조와 Cloud Run 재배포 절차는 [Cloud Run 배포 안내](docs/CLOUD-RUN-DEPLOYMENT.md)를 참고하세요.

## 로컬 실행

Node.js 22.12 이상과 npm이 필요합니다.

```sh
npm ci
npx playwright install chromium
cp .env.example .env
npm run db:setup
npm run dev
```

웹 서버와 진단 워커를 한 번에 실행하려면 다음 명령을 사용하세요.

```sh
npm run local
```

실행 후 [로컬 진단 화면](http://127.0.0.1:3000/scan/new)을 열면 됩니다. `Ctrl-C`로 웹 서버와 워커를 함께 종료합니다. 자세한 재현·장애 확인 절차는 [로컬 진단 테스트](docs/LOCAL-TEST.md)를 참고하세요.
포트 3000에 기존 개발 서버가 켜져 있으면 먼저 종료해야 하며, 스크립트가 이를 감지해 중복 실행을 막습니다.

테스트 계정으로 동적 진단을 사용하려면 `.env`의 `BAROMI_CREDENTIAL_KEY`를 별도로 생성하세요(`openssl rand -base64 32`). 전용 테스트 계정만 사용하며, 암호화된 작업 값은 진단 종료 후 삭제됩니다.

웹 진단을 처리하려면 다른 터미널에서 작업기도 실행합니다.

```sh
npm run worker
```

로컬 또는 자체 호스팅 SQLite 환경에서는 `RETENTION_DAYS`(기본 30일)를 설정하고 `npm run cleanup:retention`을 주기적으로 실행하세요. 종료된 진단의 데이터베이스 레코드와 증거 이미지를 함께 삭제하며, 진행 중인 진단은 삭제하지 않습니다.

SQLite와 증거를 함께 백업하려면 워커와 웹 프로세스를 중지한 유지보수 창에서 `BACKUP_DIR=/secure/backups npm run backup`을 실행하세요. 백업 디렉터리에는 데이터베이스 파일과 `scan-results`가 같은 시각 스냅샷으로 저장됩니다. 복구는 새 운영 디렉터리에 두 항목을 함께 복원한 뒤 `DATABASE_URL`과 `SCAN_RESULTS_DIR`을 해당 경로로 지정하고 마이그레이션 상태와 보고서 다운로드를 확인해야 합니다.
`BACKUP_DIR`은 `SCAN_RESULTS_DIR` 바깥에 지정해야 하며, 내부 경로는 자기 자신을 복사할 수 있어 거부됩니다.

백업 스냅샷은 기존 경로를 덮어쓰지 않는 `npm run restore -- /secure/backups/<timestamp> /srv/baromi-restored` 명령으로 복원할 수 있습니다. 대상 디렉터리가 이미 있으면 명령이 중단됩니다.

동적 브라우저 실행 제한은 `SCAN_TIMEOUT_MS`로 조정할 수 있습니다. 기본값은 280초이며 30초~300초 범위로만 적용됩니다.

배포 상태 확인은 `GET /api/v1/health`를 사용합니다. 정상일 때만 `status: "ok"`를 반환하며, 사용자·상점 데이터는 포함하지 않습니다.

[로컬 데모](http://127.0.0.1:3000)에서 정상·위험 구매 흐름을 직접 확인할 수 있습니다. 개발 서버를 켜 둔 상태에서 다른 터미널로 진단을 실행합니다.

```sh
npm run scan -- risky
npm run scan -- clean
```

명령은 `scan-results/<진단 ID>/report.json` 경로를 출력합니다. 같은 폴더의 `product.png`, `cart.png`, `checkout.png`가 화면 증거입니다. SQLite에는 작업 상태와 발견 항목이 저장됩니다. 위험 데모의 예상 결과는 상품 상세의 사전선택 1건과 주문서의 필수 처리비 공개 1건입니다. 정상 데모의 예상 결과는 0건입니다.

## 검증

```sh
npm run typecheck
npm run build
npm test
```

Playwright 테스트는 별도 포트에서 데모 서버를 시작합니다. 상세 범위와 후속 설계는 [개발 명세](docs/SPEC.md)를 참고하세요.

Chromium 다운로드가 어려운 환경에서 Chrome이 이미 설치되어 있으면 `PLAYWRIGHT_CHANNEL=chrome npm test` 또는 `PLAYWRIGHT_CHANNEL=chrome npm run scan -- risky`로 실행할 수 있습니다.

워커에서 `browser.newContext` 또는 `Target page, context or browser has been closed`가 발생하면 쇼핑몰 오류와 브라우저 실행 환경을 먼저 구분합니다. 설치된 Chrome을 사용할 수 있는 환경에서는 워커와 테스트를 같은 채널로 실행하세요.

```sh
PLAYWRIGHT_CHANNEL=chrome npm run worker
PLAYWRIGHT_CHANNEL=chrome npm test
```

브라우저가 중단되면 워커는 결제·주문 확정 동작을 시도하지 않고, 해당 단계와 미검사 범위를 보고서에 남겨야 합니다. OTP·CAPTCHA·추가 인증은 우회하지 않습니다.

## 브라우저에서 진단

개발 서버와 별도 터미널에서 진단 워커를 실행합니다.

```sh
npm run worker
# 설치된 Chrome으로 실행하려면 PLAYWRIGHT_CHANNEL=chrome npm run worker
```

[쇼핑몰 진단 화면](http://127.0.0.1:3000/scan/new)에서 공개 HTTPS 쇼핑몰 또는 상품 상세 URL을 입력하고 검사 권한을 확인합니다. 진단 요청은 SQLite에 대기열로 저장되고 워커가 한 건씩 처리합니다. 완료 또는 부분 완료 화면에서 근거와 개선 방법을 열고, 같은 URL로 재진단할 수 있습니다. 최초 요청의 브라우저 세션에서만 해당 웹 진단 결과와 스크린샷을 열 수 있습니다.

`DEMO_ORIGIN`을 설정할 경우 웹 서버와 워커에 동일한 로컬 주소를 사용하세요. SQLite와 증거 경로도 두 프로세스에서 공유해야 합니다.

### Spring 전환기 워커 큐

Spring Boot·PostgreSQL 환경을 함께 띄우려면 `docker compose -f docker-compose.spring.yml up --build`를 사용합니다. 기본 워커 큐는 SQLite이며, Spring `claim` API 검증을 마친 환경에서만 다음 값을 켭니다.

```sh
BAROMI_SPRING_API_URL="http://127.0.0.1:8080" \
BAROMI_WORKER_TOKEN="운영-워커-토큰" \
BAROMI_SPRING_QUEUE_ENABLED=true \
BAROMI_SPRING_AUTHORITATIVE=true \
npm run worker
```

Spring 큐는 `POST /api/v1/scans/claim`으로 작업을 원자적으로 가져오고, `POST /api/v1/scans/recover`로 기준 시각 이전의 오래된 작업을 복구합니다. `BAROMI_SPRING_AUTHORITATIVE=true`를 켜면 상태·보고서 GET이 Spring/PostgreSQL read-through를 사용합니다. 운영 전환 전 PostgreSQL·워커 재시작·중복 claim·read-through 검증을 완료해야 합니다. 상세 조건은 [Spring 환경 체크리스트](docs/SPRING-ENVIRONMENT-CHECKLIST.md)를 참고하세요.

외부 진단은 공개 HTTPS 주소를 받습니다. 소유 확인 전에는 공개 화면만 읽고, 장바구니·주문서 등 구매 흐름은 검사하지 않습니다. 소유 확인과 사용자의 검사 동의를 마치면 선택한 범위에서 별도 브라우저 세션으로 동적 화면을 살펴볼 수 있습니다. 주문 확정과 결제는 실행하지 않습니다. 로그인 테스트 계정은 사용자가 제공한 경우에만 사용하며, OTP·CAPTCHA·추가 인증을 우회하지 않습니다. 사이트 구조·접근 제한에 따라 일부 화면은 미검사로 남을 수 있습니다.

외부 테스트몰의 로그인 경로만 확인하려면 계정 값을 환경변수로 주입하는 스모크 명령을 사용할 수 있습니다. 값은 파일이나 명령 출력에 저장하지 말고 전용 테스트 계정만 사용하세요. 이 명령은 주문·결제를 실행하지 않습니다.

```sh
BAROMI_SMOKE_URL="https://shop.example.com" \
BAROMI_SMOKE_USERNAME="test@example.com" \
BAROMI_SMOKE_PASSWORD="전용-테스트-비밀번호" \
npm run smoke:external-login
```

OTP·CAPTCHA가 나타나면 명령은 우회하지 않고 실패로 종료합니다. 실제 동적 진단은 웹 화면에서 암호화 키가 설정된 서버와 전용 테스트 계정을 사용하세요.

상품 상세 발견은 특정 플랫폼 URL 규칙에 의존하지 않습니다. 공개 화면의 일반 링크, `Product`·`ItemList` JSON-LD, canonical/OG 메타데이터를 후보로 모은 뒤 가격·상품·구매 행동 신호를 확인해 채택합니다. 링크가 없는 client-rendered SPA는 같은 출처의 안전한 렌더링 폴백으로 확인하며, 후보가 여러 개이면 임의의 상품을 선택하지 않고 미검사 사유를 남깁니다.

## 탐지 규칙 평가

```sh
npm run evaluate
npm run evaluate -- --text-validation
# 설치된 Chrome으로 실행하려면 PLAYWRIGHT_CHANNEL=chrome npm run evaluate
```

로컬 합성 쇼핑몰 40건을 Playwright로 탐색합니다. 결과는 `scan-results/evaluation/summary.json`에 기록되며, 추가 문구 변형·정상 대조군 16건의 결과는 `scan-results/text-validation/summary.json`에 기록됩니다. 각 사례 폴더에는 스크린샷과 진단 JSON이 저장됩니다. [측정 결과와 한계](docs/EVALUATION.md)를 참고하세요.
