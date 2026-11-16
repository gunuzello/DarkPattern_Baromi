# 프론트 팀 API 변경 로그

백엔드 기능이나 API 계약이 바뀔 때마다 이 파일을 먼저 갱신하고, 프론트 팀에 변경 브랜치·커밋·영향받는 endpoint를 공유한다.

## 2026-11-17

### 사용자가 선택한 16개 유형의 AI 정밀 분석 계약

- 변경: 유료 소유자가 `POST /api/v1/scans/:scanId/ai-review`에 `selectedRuleTypes`를 보내면 기본 판정 상태와 관계없이 해당 유형을 분석한다. 근거가 없으면 AI 호출 없이 `INSUFFICIENT_DATA`로 남긴다.
- 변경: 완료 항목의 AI 판정은 `SAFE`, `PARTIALLY_SAFE`, `RISK`이며, 항목별 `status`와 분리한다. 기본 보고서 판정은 변경하지 않는다. 재요청 시 기존 완료 결과를 보존한다.
- 프론트 영향: `aiReviewCandidateCount`로 선택 가능 여부를 제한하지 않는다. `ruleCoverage`의 16개 유형을 선택 목록으로 사용하고 `aiReview.result.results[]`와 `ruleScreenshotRefs`를 표시한다.
- 관련 endpoint: `POST /api/v1/scans/:scanId/ai-review`, `GET /api/v1/scans/:scanId/report`.
- 검증: 타입 검사와 선택 증거·개인정보 가림 테스트 2개 통과. 실제 유료 모델 호출 및 운영 배포는 미실행.

### 크롤링 진행 현황을 구조화해 제공

- 변경: `GET /api/v1/scans/:scanId`의 `phaseResults.site-crawl.activity`에 확인·발견·대기 화면 수, 고유 URL 수, 마지막 갱신 시각을 추가했다.
- 프론트 영향: 퍼센트는 완료 단계 기준으로 유지한다. 진행 화면은 실제 크롤링 수치와 마지막 갱신 시각을 함께 표시한다.
- 관련 endpoint: `GET /api/v1/scans/:scanId`.
- 배포: 백엔드와 프론트엔드 변경은 함께 main에 반영한다.

## 2026-11-16

### 16개 유형별 판정 기준과 미관찰 기본값 명시

- 변경: `ruleCoverage` 각 항목에 `decisionCriteria`를 추가해 바로미가 적용하는 유형별 엄격한 기준을 응답한다. 완료된 크롤링에서 해당 기준을 충족하는 신호가 없으면 `NOT_OBSERVED`; 크롤링이 결과를 만들 수 없을 정도로 완료되지 않은 경우에만 `NOT_TESTED`를 반환한다.
- 프론트 영향: 보고서의 16개 항목에서 `decisionCriteria`를 상태·사유와 함께 표시할 수 있다. `NOT_OBSERVED`는 해당 크롤링 범위에서 바로미 기준에 맞는 신호를 찾지 못했다는 뜻이다.
- 관련 endpoint: `GET /api/v1/scans/:scanId`, `GET /api/v1/scans/:scanId/report`.
- 검증: 사용자의 요청에 따라 추가 검증은 실행하지 않았다.

### 장바구니 담기 전 상태 근거 추가

- 변경: 구매 흐름을 시작하기 전에 장바구니를 열어 명시적인 빈 상태 또는 보이는 품목 수를 확인한다. 스냅샷의 `cartBaselineVerified`는 이 기준 상태를 실제 화면에서 확인했는지 나타낸다. 확인할 수 없으면 자동 추가 판정은 미검사를 유지한다.
- 프론트 영향: `Snapshot.cartBaselineVerified`와 `cartCountBeforeAdd`를 함께 읽어 보고서에서 담기 전 상태 확인 여부를 표시할 수 있다. `interactions[]`에도 초기 장바구니 관찰이 남는다.
- 관련 endpoint: `GET /api/v1/scans/:scanId/report`.

### 실패 종료 보고서 열기 연결

- 변경: `GET /api/v1/scans/:scanId`의 공개 응답에 `hasReport`를 일관되게 제공한다. SQLite 저장소의 `reportPath`와 Spring 응답의 `reportAvailable`을 같은 boolean으로 정규화한다.
- 프론트 영향: `FAILED`라도 `hasReport: true`이면 실패 안내와 함께 보고서를 열 수 있다. 보고서가 없을 때만 재진단 동작을 표시한다.
- 단계 상태: 워커 예외 시 이미 끝난 단계는 보존하고 실제 실행 중 단계만 `FAILED`, 시작 전 단계는 `SKIPPED`로 닫는다. 실행 중 단계가 기록되지 않은 경우 첫 미실행 필수 단계만 `FAILED`가 된다.
- 관련 endpoint: `GET /api/v1/scans/:scanId`, `GET /api/v1/scans/:scanId/report`.

### 증거 완결성·단계 실패와 프론트 타입 동기화

- 변경: 기본 엔진 판정에서 선택 상태, 가격/수수료 추출 완료 여부, 상품·장바구니 행 식별과 비교 검증 플래그를 스냅샷 증거로 노출한다. 장바구니의 비교 근거가 충분하지 않으면 `SNEAKY_CART_ADD`를 미관찰로 확정하지 않고 `NOT_TESTED`로 남긴다.
- 변경: `DRIP_PRICING`은 신규 필수 비용을 찾으면 위험 신호를 내고, 상품·장바구니·주문서에서 가격/비용 추출과 동일 상품 비교가 모두 확인된 경우에만 `NOT_OBSERVED`를 반환한다. 총액이 불일치하거나 핵심 증거가 빠지면 `NOT_TESTED`를 유지한다.
- 변경: 작업이 증거 수집 전에 실패하면 단계 상태를 첫 필수 단계 `FAILED`, 이후 단계 `SKIPPED`로 저장한다. 시작되지 않은 구매·탐색 단계를 가짜 `BLOCKED`/미발견으로 표시하지 않는다.
- 프론트 영향: `web/lib/types.ts`를 보고서 스냅샷·가격 원장·크롤링 상세·상호작용·검토 후보·16개 판정 담당(`decisionMode`) 응답에 맞췄다. `phaseResults`의 실제 terminal 상태를 진행 화면에 사용한다.
- 관련 endpoint: `GET /api/v1/scans/:scanId`, `GET /api/v1/scans/:scanId/report`.
- 검증: 백엔드·프론트 타입 검사와 가격 판정 Playwright 회귀 4개 통과. 앞선 증거 판정 Playwright 테스트 7개와 `git diff --check`도 통과.

### 기본 보고서 JSON 요약·AI 전달 경계 고정

- 변경: `summary` 네 값(`suspected`, `reviewNeeded`, `notObserved`, `notTested`)을 `ruleCoverage`의 16개 최종 상태에서 계산한다. 발견 항목 수와 전체 유형 상태 수가 혼동되지 않게 하고, 종료 보고서에서는 네 값의 합이 16이다.
- 변경: 관련 화면이 있어도 해당 유형의 맥락형 검토 후보가 실제 생성되지 않았다면 `REVIEW_NEEDED`로 추정하지 않고 `NOT_TESTED`와 사유를 반환한다.
- 변경: 보고서의 유형 없는 사람 검토 메모와 `BASIC_ENGINE` 항목은 AI provider payload에서 제외한다. 근거가 연결된 `AI_CONTEXT` 8개 유형만 고정된 `ruleType`으로 요청한다. AI 응답의 `suggestedRule`도 해당 후보의 유형과 일치하는 값만 보존한다.
- 변경: 보고서 JSON에 provider 전달 가능한 유형 지정 후보 수 `aiReviewCandidateCount`를, AI 요청 응답에 작업별 `candidateCount`를 추가했다.
- 프론트 영향: 보고서 JSON의 `ruleCoverage`를 유형별 기준 원장으로 사용한다. `findings`는 발견 신호 상세이며 16개 전체 상태의 개수로 사용하지 않는다. AI 요청 버튼은 `aiEligible && aiReviewCandidateCount > 0`일 때만 노출하고, `aiReview.status`, 후보 수, 결과, 사용량을 보고서 JSON에서 표시한다.
- 관련 endpoint: `GET /api/v1/scans/:scanId`, `GET /api/v1/scans/:scanId/report`, `POST /api/v1/scans/:scanId/ai-review`.
- 검증: 타입 검사, 판정·요약·후보 payload 테스트 7개, 브라우저 진단→JSON 다운로드→유료 AI 요청→완료 왕복 1개 통과. AI 제공자는 테스트용 mock을 사용했다. Spring 권위 응답은 미검증이다.

### 16개 판정 담당 및 맥락형 AI 후보 계약 추가

- 변경: `ruleCoverage`의 각 항목에 `decisionMode`를 추가했다. 8개 유형은 `BASIC_ENGINE`, 맥락 해석이 필요한 8개 유형은 `AI_CONTEXT`로 구분한다.
- 변경: 관련 증거가 수집된 맥락형 유형은 `reviewCandidates`에 고정 `ruleType`과 유형별 검토 질문을 담는다. 근거가 없는 유형은 AI 후보를 만들지 않고 `NOT_TESTED`로 남긴다.
- 변경: 기본 엔진 판정기가 연결되지 않은 유형은 화면을 확보했더라도 그 사실과 증거 ID를 `NOT_TESTED` 사유로 공개한다. 해당 유형을 미발견으로 잘못 보고하지 않는다.
- 영향 endpoint: `GET /api/v1/scans/:scanId`, `GET /api/v1/scans/:scanId/report`의 `ruleCoverage`, `reviewCandidates`; `POST /api/v1/scans/:scanId/ai-review` 입력 후보 데이터.
- 프론트 영향: `decisionMode`를 판정 담당 표시로 사용할 수 있다. `AI_CONTEXT`의 `REVIEW_NEEDED`는 위험 확정이 아니며, AI 응답도 기본 사실·판정 상태를 덮어쓰지 않는다.
- 프론트 영향: 보고서의 16개 행에서 판정 담당, 상태, 사유, 증거 ID를 표시할 수 있다. `BASIC_ENGINE` 유형의 `NOT_TESTED`는 현재 기본 판정기가 연결되지 않았다는 뜻일 수 있다.
- 검증: 판정 계약 Playwright 테스트 통과. 로컬 브라우저 보고서·AI 요청 왕복 검증은 위 항목에 기록했다.
- 관련 브랜치: `main` (현재 로컬 백엔드 작업 브랜치)

## 2026-11-15

### 문구만으로 위반 유형을 붙이던 휴리스틱 제거

- 변경: 키워드 일치만으로 긴박감·거짓 할인·위장 광고·죄책감 유도·속임수 질문·가격비교 방해 등의 유형을 생성하던 탐지기를 제거했다. 텍스트와 선택 문구는 `SEMANTIC_REVIEW` 후보와 원본 증거로 보존하며, 고정 문구만으로 `ruleType`을 부여하지 않는다.
- 변경: 사전선택 자동 판정은 구조화된 선택 상태와 양수 금액이 확인된 옵션만 사용한다. 동의 문구의 의미는 보고서 근거에 남기고 자동 위험 판정에서 분리한다.
- 영향 endpoint: `GET /api/v1/scans/:scanId/report`의 `findings`, `ruleCoverage`, `reviewCandidates` 의미. 응답에 새 후보 `kind: SEMANTIC_REVIEW`가 포함될 수 있다.
- 프론트 영향: `SEMANTIC_REVIEW` 후보는 특정 규칙의 발견 건수로 세지 않는다. 유형에 연결된 근거가 부족하면 해당 규칙은 `NOT_TESTED`로 표시한다.
- 관련 브랜치: `backend-evidence-analysis`.

### 보고서 근거 연결과 선택형 AI 입력 최소화

- 변경: AI 검토 요청은 기본 보고서에서 실제 증거를 찾을 수 있는 후보만 큐에 넣는다. AI에는 연결된 구매 스냅샷·크롤링 페이지·별도 표면 관찰을 개인정보와 쿼리 URL을 정리해 전달하고, 내부 후보·증거 ID는 임시 ID로 바꾼 뒤 응답을 보고서 후보에 다시 연결한다.
- 변경: 크롤러 작업 종료만으로 추천·구독·해지 등의 별도 표면을 검사한 것으로 보지 않는다. 해당 표면 증거가 없으면 16개 규칙 상태를 `NOT_TESTED`로 남긴다.
- 영향 endpoint: `POST /api/v1/scans/:scanId/ai-review`; `GET /api/v1/scans/:scanId/report`의 기존 `ruleCoverage` 의미를 엄격하게 적용.
- 프론트 영향: AI 후보가 있어도 연결된 증거가 없으면 요청이 `409`로 끝날 수 있다. `NOT_TESTED`는 해당 가이드라인 표면의 검사 가능한 증거를 확보하지 못했다는 의미다.
- 관련 브랜치: `backend-evidence-analysis`.

### Spring 단계 진행 결과 저장 및 보고서 다운로드 응답 통일

- 변경: 워커가 구매 단계·별도 탐색·전체 크롤링의 `phaseResults`를 Spring에 저장하고 상태 조회에서 실제 저장값을 반환한다. 기존 `currentStage` 추정으로 완료되지 않은 단계를 완료 처리하던 계산을 제거했다.
- 변경: Spring 권위 모드에서도 `GET /api/v1/scans/:scanId/report?download=1`이 첨부파일 응답 헤더를 반환한다.
- 영향 endpoint: 내부 `PATCH /api/v1/scans/:scanId/status`, 공개 `GET /api/v1/scans/:scanId`, `GET /api/v1/scans/:scanId/report`.
- 마이그레이션: Spring Flyway `V10__store_scan_phase_results.sql`; 단계 결과 256KiB 제한.
- 프론트 영향: 진행 UI는 `phaseResults`를 사용해 실제 단계 상태·시간·사유·증거 ID를 표시한다.
- 관련 브랜치: `backend-diagnosis-api`.

- 기준 문서: [`API-SPEC-FRONTEND.md`](./API-SPEC-FRONTEND.md)
- 백엔드 작업 기준 브랜치: `backend-diagnosis-api`
- API 명세 기준 브랜치: `api-spec`
- 현재 변경: 백엔드 기능 작업 브랜치와 프론트 연동 명세 브랜치를 분리
- 영향 endpoint: 없음

### Spring 상태 응답 정규화

- 변경: `GET /api/v1/scans/:scanId`와 `/report`가 Spring의 소문자 상태(`queued`, `running`, `succeeded` 등)를 프론트 계약의 대문자 상태로 정규화한다.
- 매핑: `succeeded → COMPLETED`, `queued → QUEUED`, `running → RUNNING`, `partial → PARTIAL`, `failed → FAILED`, `cancelled → CANCELLED`
- 프론트 영향: 상태 비교를 별도 분기하지 않아도 기존 `ScanState` 계약을 그대로 사용한다.
- 관련 브랜치: `backend`

### 쇼핑몰 목록 조회 추가

- 변경: `GET /api/v1/shops?limit=50` 공개 API를 구현했다.
- 응답: `{ limit, shops: [{ shopId, url, consentAt, verifiedAt }] }`
- 프론트 영향: 쇼핑몰 관리 화면에서 현재 세션의 등록 쇼핑몰 목록을 직접 조회할 수 있다.
- 관련 커밋: 현재 백엔드 작업 중

### 진단 stale 회복 기준 통합

- 변경: 워커와 health API가 공통 `BAROMI_SCAN_STALE_MS`를 사용한다.
- 기본값: `300000`ms(5분), 허용 범위 `60000`~`600000`ms.
- 프론트 영향: 오래 멈춘 진단이 6분 기준으로 남지 않고 같은 회복 기준으로 `FAILED`/복구 상태가 표시된다.
- 환경변수: `.env`에 `BAROMI_SCAN_STALE_MS`를 설정할 수 있다.

### AI 라벨링 지침 추가

- 변경: 유료 AI 검토 후보의 네 가지 라벨, 증거 우선 판정 순서, 2인 라벨링·불일치 합의 규칙을 문서화했다.
- 프론트 영향: AI 검토 화면은 라벨 선택 시 후보 ID와 근거 증거 ID를 함께 보존해야 한다.
- 관련 문서: `docs/AI-LABELING-GUIDE.md`

### AI·오프라인 데이터셋 라벨 매핑 명시

- 변경: 온라인 AI 검토 라벨과 오프라인 평가 데이터셋 상태의 대응 관계를 `datasets/README.md`에 추가했다.
- 프론트 영향: AI 검토 화면은 온라인 라벨(`LIKELY_RISK` 등)을 사용하고, 오프라인 학습 파이프라인의 축약 상태(`RISK` 등)를 직접 노출하지 않는다.

### 데이터셋 라벨 검증 강화

- 변경: `validate-dataset`가 각 라벨의 `type`, 허용된 `status`, `adjudication(PENDING|AGREED)`를 모두 검증한다.
- 영향: 합의 상태가 없거나 잘못된 라벨 레코드는 평가셋에 들어가기 전에 실패한다.

### 상점 그룹 단위 평가 리포트 추가

- 변경: `npm run dataset:groups`가 동일 `shopGroupId`의 합의 라벨·미검사율·위험/검토 분포를 그룹별로 출력한다.
- 영향: 동일 쇼핑몰의 반복 실행을 섞어 평균내지 않고, 데이터 누수와 그룹별 미검사 범위를 릴리스 전에 확인할 수 있다.

### 경량 후보 분류기 회귀 평가 추가

- 변경: `npm run classifier:evaluate`가 AI 전처리용 결정적 분류기의 기준선 정확도와 `UNRESOLVED` 전달률을 출력한다.
- 영향: 규칙으로 분류 가능한 후보를 저비용으로 먼저 걸러내고, 불확실한 후보만 유료 AI 검토 대상으로 남긴다.

### DL 필요성 재평가 기록

- 변경: 현재 규칙·경량 분류기·유료 AI 검토를 우선하고 DL은 shadow-mode 실험 조건을 충족할 때만 재검토하도록 결정 기록을 추가했다.
- 영향: 실제 운영 라벨과 시각 증거가 부족한 상태에서 비용·지연이 큰 모델을 제품 경로에 조기 편입하지 않는다.

### AI 평가 합의 상태 반영

- 변경: `ai:evaluate`가 `operatorAdjudication=PENDING` 라벨을 정확도·정밀도·재현율에서 제외하고 `pendingLabels`로 별도 출력한다.
- 영향: 합의되지 않은 운영자 판단이 모델 선택 지표를 왜곡하지 않는다.

### AI 데이터셋 내보내기 합의 상태 보존

- 변경: `ai:dataset`이 운영자 라벨의 `operatorAdjudication`을 `PENDING/AGREED` 그대로 내보낸다.
- 영향: 라벨 저장부터 평가까지 합의 상태가 유지되어 보류 라벨을 자동으로 지표에서 제외할 수 있다.

### AI 라벨 저장 계약에 합의 상태 추가

- 변경: AI 라벨 저장 API가 선택적 `adjudication`을 받고, 생략 시 `PENDING`으로 정규화한다.
- 영향: 프론트 라벨링 화면이 합의 상태를 명시적으로 전달할 수 있고, 기존 요청은 안전한 보류 상태로 유지된다.

### AI 라벨 후보 무결성 검증

- 변경: 라벨 저장 API가 보고서에 없는 후보 ID와 중복 후보 라벨을 거부한다.
- 영향: 존재하지 않는 증거를 AI 평가 데이터에 섞거나 한 후보를 여러 번 집계하는 문제를 방지한다.

### 세션 폐기 API 추가

- 변경: `DELETE /api/v1/session`이 현재 HttpOnly 소유 세션 쿠키를 즉시 만료시킨다.
- 영향: 브라우저에서 진단 소유 세션을 명시적으로 폐기할 수 있다.
- 보안: 폐기 쿠키도 발급 쿠키와 동일한 `HttpOnly`, `SameSite=Strict`, HTTPS 환경의 `Secure` 속성을 사용한다.

### 인증·배포 아키텍처 결정 기록

- 변경: 무료 1단계 배포를 Cloudflare Pages·Supabase Auth/PostgreSQL/Storage 중심으로 정하고, Spring API·브라우저 워커는 별도 실행 환경으로 분리했다.
- 영향: 로그인 구현과 무료 배포를 먼저 검증하고, 사용량이 커질 때만 Render/Railway/AWS 컨테이너로 확장한다.

### Supabase 무료 단계 설정 계약

- 변경: Supabase Auth/PostgreSQL/Storage와 Cloudflare Pages의 환경변수·JWT 검증·조직 권한·Storage 경로 계약을 문서화했다.
- 영향: 프론트와 백엔드가 비밀키를 노출하지 않고 동일한 사용자·조직 식별자를 사용해 로그인 기능을 구현할 수 있다.

### 무료 프론트 호스팅 선택 조정

- 변경: Next.js 호환성과 미리보기 배포를 고려해 무료 프론트 기본값을 Vercel로 정하고 Cloudflare Pages를 대안으로 명시했다.
- 영향: 프론트 배포는 단순화하되, 장시간 진단 워커는 별도 실행 환경에 남긴다.

### Spring 권위 저장소 조회 범위 확장

- 변경: `BAROMI_SPRING_AUTHORITATIVE=true`일 때 상점 목록·상점 상세·상점별 진단 이력을 Spring/PostgreSQL에서 조회한다.
- 응답: 상점별 진단 이력은 기존 공개 API 계약에 맞춰 `scan[]` 배열로 반환한다. Spring 장애 시 `503`으로 명시한다.
- 프론트 영향: UI 변경은 필요 없으며, 기존 응답 형식을 그대로 사용한다.

### Spring 보고서·발견 목록 조회 경계 명시

- 변경: `BAROMI_SPRING_AUTHORITATIVE=true`일 때 `GET /api/v1/scans/:scanId/report`와 `GET /api/v1/scans/:scanId/findings`는 Spring/PostgreSQL에 저장된 `reportJson`을 기준으로 반환한다.
- 응답: 발견 목록은 보고서의 `findings` 배열을 그대로 반환하며, 보고서가 만료되었거나 Spring이 응답하지 않으면 SQLite로 조용히 되돌아가지 않고 `503`으로 알린다.
- 프론트 영향: 기존 발견 목록·보고서 응답 형식은 유지된다. UI 변경은 필요 없다.
- 환경변수: `BAROMI_SPRING_API_URL`과 `BAROMI_SPRING_AUTHORITATIVE=true`가 필요하다. 기본값은 기존 SQLite 경로다.
- 관련 구현: `src/spring-status.ts`, `app/api/v1/[...path]/route.ts`.

### Spring 진단 진행 상태 계산 보정

- 변경: `GET /api/v1/scans/:scanId`의 Spring 권위 응답이 `currentStage`와 `purchasePath`를 기준으로 `progress`와 `coverage`를 계산한다.
- 영향: 실제로 도달한 상품 상세·장바구니·주문서는 `COVERED`로 표시되고, 아직 도달하지 않은 단계는 `PENDING`으로 남는다. 실행 중인데도 항상 0%로 보이던 문제가 제거된다.
- 프론트 영향: 기존 `progress`·`coverage` 필드를 그대로 사용하므로 UI 변경은 필요 없다.
- 관련 커밋: `75de331`.

### 만료된 Spring 보고서 즉시 비공개 처리

- 변경: `GET /api/v1/scans/:scanId/report`가 `report_expires_at`을 지난 보고서를 정리 작업 전에도 `404`로 반환한다.
- 영향: 보관 정책의 실제 삭제 작업이 지연되어도 만료된 보고서가 조회되지 않는다.
- 프론트 영향: 기존 보고서 없음 응답을 사용하므로 UI 변경은 필요 없다.
- 관련 테스트: `ScanControllerTest.expiredReportIsNotReturnedEvenBeforeCleanupJobRuns`.

### Supabase Bearer 인증 호환 추가

- 변경: `SUPABASE_JWT_SECRET`이 설정된 환경에서 API가 `Authorization: Bearer <JWT>`의 HS256 서명, `exp`, `aud`, 선택적 `iss`를 검증하고 유효한 `sub`를 상점 소유자 식별자로 사용한다.
- 호환성: 기존 HttpOnly `darkpattern-session` 쿠키는 마이그레이션 기간 동안 그대로 지원한다. JWT 요청에는 임시 소유 쿠키를 새로 발급하지 않는다.
- 보안: 검증 실패 토큰은 소유권 식별자로 사용하지 않으며, 서비스 키나 JWT 원문은 저장하지 않는다.
- 프론트 영향: 기존 API 호출에 Bearer 토큰을 추가할 수 있으며 응답 형식 변경은 없다.

### Spring 권위 발견 목록 응답 보정

- 변경: `GET /api/v1/scans/:scanId/findings`가 Spring 보고서 API의 JSON `findings` 배열을 직접 사용하도록 보정했다.
- 영향: Spring 권위 모드에서도 발견 목록이 SQLite 전환기 데이터로 대체되지 않는다.
- 프론트 영향: 응답 형식은 기존과 동일하다.
- 관련 커밋: `a95a905`.

### 프론트 보고서 JSON 전달 계약 보강

- 변경: `GET /api/v1/scans/:scanId/report`의 보고서 최상위 필드와 16개 유형 판정·증거·크롤링·AI 후속 검토 데이터의 용도를 명세했다. 프론트 전달용 대표 응답 JSON을 `docs/report-response.example.json`에 추가했다.
- endpoint 변경: 없음. Spring 권위 모드도 저장된 보고서와 소유자별 플랜·AI 작업 정보를 합쳐 SQLite 모드의 동일한 보고서 JSON 형태로 정규화한다.
- 프론트 영향: 보고서 UI는 응답의 `ruleCoverage`와 `summary`를 그대로 사용하고, 화면에서 상태를 다시 판정하지 않는다. 상세 증거는 각 `evidenceIds`와 대응하는 근거 배열을 연결한다.
- 검증: 로컬 SQLite 모드에서 브라우저로 진단→보고서 열람·다운로드→무료 AI 요청 차단→유료 AI 요청·완료 JSON 확인까지 통과. Spring 정규화는 타입 검사를 통과했으며 Spring 서버 실연동은 별도 미검증이다.
- 검증 범위: JSON 샘플은 데이터 구조 예시이며 실시간 진단 결과를 대체하지 않는다.

### 강제 행동 판정에 인증 맥락 추가

- 변경: 보고서 JSON에 계정 비밀정보가 없는 `authContext`(`ANONYMOUS|TEST_ACCOUNT|UNKNOWN`)를 추가했다. 익명 상태에서 주문서까지 도달한 경우에만 `FORCED_ACTION`을 해당 구매 경로의 `NOT_OBSERVED`로 기록하고, 테스트 계정 또는 불명확한 인증 맥락에서는 `NOT_TESTED`로 남긴다. 로그인 차단은 기존처럼 `SUSPECTED`와 차단 근거를 반환한다.
- 영향 endpoint: `GET /api/v1/scans/:scanId/report` 응답의 `authContext` 필드.
- 프론트 영향: 인증 맥락을 보고서의 검증 범위와 미검사 사유 설명에 활용할 수 있다.
- 보안: 계정 이름·비밀번호·인증 토큰은 저장하거나 응답하지 않고 인증 경로 구분만 저장한다.

## 변경 기록 규칙

### 2026-11-16 — 사용자별 쇼핑몰 보관·진단 이력·삭제

- 소유권: 인증된 Supabase 사용자 ID를 기준으로 쇼핑몰을 저장하고 조회한다. 이메일·비밀번호는 쇼핑몰 레코드에 저장하지 않는다.
- 중복 등록: 동일 소유자의 동일 URL은 기존 쇼핑몰 ID를 반환해 이중 등록을 줄인다.
- 이력: 쇼핑몰별 최근 진단에서 상태, 실행 환경, 경로, 생성 시각, 소요 시간, 보고서 가용성, 위험/검토/미검사 요약을 제공한다.
- 삭제: `DELETE /api/v1/scans/:scanId`로 개별 종료 진단을, `DELETE /api/v1/shops/:shopId`로 쇼핑몰과 전체 이력을 삭제한다. 진행 중 작업이 있으면 `409`; 소유자 불일치/없는 ID는 `404`다. 로컬 증거 파일도 정리한다.
- 저장소: Spring/PostgreSQL에도 소유자 범위 삭제를 추가하고 진단 소요 시간 컬럼을 마이그레이션한다. SQLite 호환 경로와 공개 API 응답을 맞춘다.
- API 응답 스키마 변경: 쇼핑몰 목록에 `consentAt`, `verifiedAt`; 진단 이력에 `reportAvailable`, `durationMs`, `summary.notTested`가 추가됐다.
- 검증: 이번 변경에서는 테스트를 실행하지 않았다. Spring/PostgreSQL 및 실제 Supabase 프로젝트에 연결한 E2E는 별도 확인이 필요하다.

### 2026-11-16 — Supabase Auth 웹 로그인·소유자 검증

- 변경: `/login`에 이메일/비밀번호 로그인 및 계정 생성을 추가하고 `@supabase/ssr` 쿠키 세션과 Next.js `proxy.ts` 갱신 경로를 연결했다.
- 보호 화면: 진단 생성, 진행, 보고서, 상점 이력은 Supabase 세션이 없으면 로그인으로 이동한다.
- API 영향: Supabase access token을 `auth.getClaims()`로 검증하고 `sub`를 소유자로 사용한다. Supabase 설정이 켜진 경우 로그인 없이 상점을 만들 수 없다. 로컬 Supabase 미설정 모드는 기존 익명 세션과 호환된다.
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (선택적으로 서버 전용 `SUPABASE_URL`, `SUPABASE_ANON_KEY`). service-role 키는 사용하지 않는다.
- API 응답 스키마 변경: 없음. `DELETE /session`은 레거시 자체 세션만 종료하며 Supabase 로그아웃은 `auth.signOut()`으로 처리한다.
- 미검증: 실제 Supabase 프로젝트 설정이 없어 이메일 인증 설정, redirect allowlist, 로그인 후 진단 API 연결은 아직 실제 프로젝트에서 확인하지 않았다.

### 2026-11-16 — 단계 완료 즉시 반영 및 인증 전 선택지 추출 표식

- 변경: 구매 화면의 증거 캡처가 끝나면 해당 단계는 즉시 `COVERED`로 저장하고, 다음 구매 단계만 `RUNNING`으로 전환한다. 진행 화면은 전체 사이트 크롤링 상태와 현재 URL도 표시한다.
- 판정: `PRESELECTION`을 `NOT_OBSERVED`로 닫기 전에 인증 전 로그인·가입 화면의 초기 선택 상태까지 확인한다. 인증 화면에서 발견한 선택 동의도 위험 신호에 포함한다.
- 응답 변경: `GET /api/v1/scans/:scanId/report`의 `siteCrawl.pages[]`에 `interactiveInventoryComplete?: boolean`을 추가했다. 이는 컨트롤 목록 추출 완료 표식이며 `interactiveCount`(클릭 동작 수)와 별개다.
- 프론트 영향: 진행 화면에서 전체 쇼핑몰 탐색 상태·현재 URL·완료 시간을 볼 수 있다. 사전 선택이 완전히 검사되지 않은 경우 기본 보고서에서 미검사로 표시한다.
- 검증: 백엔드·프론트 타입 검사 및 5개 판정/상태 테스트 통과. 실제 진단 화면 E2E는 현재 브라우저 세션이 로그인 화면으로 이동해 수행하지 못했다.

각 항목에 다음 정보를 포함한다.

- 변경일
- 기능 요약
- 추가·변경·삭제된 endpoint
- 요청/응답 변경
- 프론트 화면 영향
- 마이그레이션 또는 환경변수 필요 여부
- 관련 커밋 또는 PR

기능 구현 커밋과 API 명세 커밋은 가능하면 같은 PR에 포함한다. 긴급한 서버 내부 변경으로 명세 영향이 없더라도 `영향 endpoint: 없음`을 기록한다.
