# Baromi API 명세 v1

프론트는 서버 내부 모듈이나 DB를 직접 사용하지 않고 아래 HTTP API만 호출한다.

## 공통 규칙

- Base URL: 현재 프론트와 같은 origin의 `/api/v1`
- 요청 본문: `Content-Type: application/json`
- 로그인: Supabase Auth 이메일/비밀번호를 사용한다. `@supabase/ssr`가 브라우저 세션을 쿠키에 저장·갱신하고, 프론트는 토큰을 직접 보관하거나 API body에 넣지 않는다.
- API 소유자: Supabase access token을 `auth.getClaims()`로 검증한 `sub`를 상점 소유자로 사용한다. Supabase 환경변수가 설정된 경우 로그인 없이는 상점 생성·조회·진단을 할 수 없다.
- 로그아웃: Supabase browser client의 `auth.signOut()`으로 Supabase 세션을 폐기한다. 기존 `DELETE /api/v1/session`은 마이그레이션용 `darkpattern-session` 쿠키만 만료한다.
- 오류 형식: `{ "error": "사용자에게 표시할 메시지" }`
- 주요 상태: `QUEUED`, `RUNNING`, `COMPLETED`, `PARTIAL`, `CANCELLED`, `FAILED`
- 화면 단계: `product`, `cart`, `checkout`
- 모든 구매 단계·별도 표면·전체 크롤링의 `phaseResults.status`: `PENDING`, `RUNNING`, `COVERED`, `DISCOVERED`, `NOT_FOUND`, `BLOCKED`, `FAILED`, `SKIPPED`
- 화면 단계의 요약 `coverage`는 `COVERED|BLOCKED|PENDING|SKIPPED`이며, 원인과 완료 여부는 `phaseResults`를 기준으로 표시한다.

## 1. 서버 상태

### `GET /api/v1/health`

응답 `200`이면 정상, `503`이면 점검 필요.

```json
{
  "status": "ok",
  "service": "baromi",
  "version": "0.1.0",
  "storage": { "mode": "SPRING_POSTGRES", "spring": "ready" },
  "worker": { "queued": 0, "running": 0, "stale": 0 }
}
```

## 2. 쇼핑몰 등록·확인

### `GET /api/v1/shops?limit=50`

로그인한 사용자 소유의 쇼핑몰 목록을 반환한다. `limit`은 1~100으로 제한된다. 이메일이나 비밀번호는 쇼핑몰 데이터와 함께 저장하지 않으며, 소유권은 인증된 Supabase 사용자 ID에 연결된다.

```json
{ "limit": 50, "shops": [{ "shopId": "uuid", "url": "https://shop.example.com", "consentAt": "ISO-8601", "verifiedAt": "ISO-8601|null" }] }
```

### `POST /api/v1/shops`

```json
{ "url": "https://shop.example.com", "consent": true }
```

응답 `201`:

```json
{
  "shopId": "uuid",
  "url": "https://shop.example.com",
  "verification": {
    "name": "baromi-site-verification",
    "token": "...",
    "metaTag": "<meta name=\"baromi-site-verification\" content=\"...\">",
    "filePath": "/baromi-site-verification.txt",
    "dnsRecord": "_baromi-verification.example.com TXT ..."
  }
}
```

데모 주소는 `verification: null`일 수 있다.

### `GET /api/v1/shops/:shopId`

```json
{ "id": "uuid", "url": "https://...", "consentAt": "ISO-8601", "verifiedAt": "ISO-8601|null" }
```

### `POST /api/v1/shops/:shopId/verify`

응답:

```json
{ "verified": true, "verifiedAt": "ISO-8601", "method": "meta|file|dns" }
```

## 3. 진단 시작

### `POST /api/v1/scans`

현재 한 번에 상품 1개 구매 흐름만 진단한다.

```json
{
  "shopId": "uuid",
  "profile": "CONTEST|DYNAMIC",
  "viewport": "DESKTOP|MOBILE",
  "purchasePath": "CART|DIRECT",
  "flows": ["PURCHASE"],
  "productLimit": 1,
  "credentials": { "username": "test@example.com", "password": "..." },
  "baselineScanId": "uuid|null"
}
```

`credentials`는 `DYNAMIC`에서만 보내며 서버가 암호화해 저장한다. 응답 `202`:

```json
{ "scanId": "uuid", "status": "QUEUED", "createdAt": "ISO-8601" }
```

이미 같은 진단이 실행 중이면 `deduplicated: true`가 추가된다.

## 4. 진단 진행 상태

### `GET /api/v1/scans/:scanId`

```json
{
  "scanId": "uuid",
  "shopId": "uuid",
  "executionMode": "STATIC|DYNAMIC",
  "viewport": "DESKTOP|MOBILE",
  "purchasePath": "CART|DIRECT",
  "status": "QUEUED|RUNNING|COMPLETED|PARTIAL|CANCELLED|FAILED",
  "hasReport": true,
  "currentStage": "product|cart|checkout|surface:<영역>|site-crawl|null",
  "progress": 67,
  "phaseResults": { "product": { "status": "COVERED", "startedAt": "ISO-8601", "finishedAt": "ISO-8601", "durationMs": 1200, "reason": null, "evidenceIds": ["evidence-id"] }, "site-crawl": { "status": "RUNNING", "activity": { "visitedScreens": 12, "discoveredScreens": 20, "pendingScreens": 8, "visitedUrls": 9, "discoveredUrls": 14, "updatedAt": "ISO-8601" } } },
  "coverage": { "product": "COVERED", "cart": "PENDING", "checkout": "PENDING" },
  "surfaceCoverage": { "SEARCH": "COVERED", "LOGIN": "DISCOVERED" },
  "summary": { "suspected": 1, "reviewNeeded": 0, "notTested": 0 }
}
```

`hasReport`는 종료 상태와 별개로 실제 보고서 조회가 가능한지 나타낸다. 실패 종료라도 수집된 증거와 16개 유형별 미검사 사유를 담은 보고서가 저장되면 `true`이며, 이 경우 진행 화면은 실패 원인과 함께 보고서 열기 동작을 제공한다. Spring의 `reportAvailable`도 공개 응답에서는 `hasReport`로 정규화한다.

`phaseResults`에는 구매 단계, 별도 탐색 영역, 전체 크롤링 단계의 실제 상태·시간·근거 ID·미완료 사유가 포함된다. 단계 도중 예외가 발생하면 실패한 단계는 `FAILED`, 뒤에 남은 단계는 `SKIPPED`로 끝난다. 실행을 시작하기 전에 실패한 작업도 구매 단계 실패와 나머지 단계 건너뜀으로 저장한다. 프론트는 이 값을 기준으로 실행 중과 미검사를 구분한다.

동적 진단에서 `phaseResults.site-crawl.activity`는 방문·발견·대기 화면 상태 수, 고유 URL 방문·발견 수, 마지막 진행 갱신 시각을 제공한다. 화면 상태 수는 같은 URL에서 조작으로 바뀐 별도 상태를 포함하므로 고유 URL 수와 다를 수 있다. `progress`는 완료된 진단 단계 비율이며, 크롤링 중 세부 활동은 `activity`를 기준으로 함께 표시한다.

프론트는 `QUEUED`/`RUNNING` 동안 1~2초 간격으로 조회하고, `COMPLETED`/`PARTIAL`/`CANCELLED`/`FAILED`에서 중지한다.

### `POST /api/v1/scans/:scanId/cancel`

응답 `202`: `{ "status": "RUNNING", "cancelRequested": true }`  
대기 중 취소 응답: `{ "status": "CANCELLED" }`

## 5. 결과·보고서

### `GET /api/v1/scans/:scanId/findings`

진단 항목 배열. 각 항목은 `id`, `type`, `stage`, `status`, `reason`, `ruleVersion`를 포함한다.

### `GET /api/v1/scans/:scanId/report`

프론트엔드 보고서 화면의 데이터 원본이다. 보고서 화면은 아래 응답을 렌더링하고, 판정 상태를 화면에서 다시 계산하지 않는다. 대표 응답은 [`report-response.example.json`](./report-response.example.json)을 참고한다.

응답은 검사 모드와 수집 결과에 따라 증거 배열의 길이가 달라지지만, 아래 최상위 필드와 규칙별 판정 계약은 유지한다.

| 필드 | 의미 |
| --- | --- |
| `scanId`, `shopId`, `scanStatus`, `executionMode`, `viewport`, `purchasePath`, `authContext`, `durationMs` | 진단 식별자와 실행 요약. 인증 맥락은 `ANONYMOUS|TEST_ACCOUNT|UNKNOWN` |
| `findings[]` | 기본 엔진이 확인한 위험 신호 또는 검토 후보. 각 항목은 `id`, `type`, `status`, `stage`, `reason`, `ruleVersion`, `evidenceIds`를 포함 |
| `ruleCoverage[유형]` | 16개 유형 각각의 상태, 판정 담당, `decisionCriteria`, 이유, 근거 ID |
| `summary` | `ruleCoverage`의 상태별 집계. 네 값의 합은 16 |
| `snapshots[]`, `siteCrawl`, `surfaceObservations[]`, `interactions[]`, `priceLedger` | 화면·페이지·표면·상호작용·가격 관찰 근거. 구매 스냅샷에는 선택지 상태와 가격/수수료 추출 완료 여부, 식별 가능한 장바구니 행, 담기 전 장바구니 수량 및 기준 상태 검증 여부가 포함될 수 있음 |
| `phaseResults`, `coverage`, `surfaceCoverage`, `explorationMetrics`, `stageTimingsMs` | 실제 탐색 범위와 단계별 상태·시간 |
| `reviewCandidates[]` | 사람 또는 AI 맥락 검토용 후보. `ruleType`이 없는 메모는 특정 유형 판정이 아니다 |
| `aiEligible`, `aiReviewCandidateCount`, `aiReview` | 유료 AI 검토 가능 여부, 전달 후보 수, 별도 요청 작업의 진행/결과/비용 |
| `comparison` | 기준 진단과 비교한 결과. 비교 진단이 없으면 `null` |

프론트는 `findings` 개수를 16개 유형의 판정 수로 취급하지 않는다. 유형별 현황은 `ruleCoverage`와 `summary`를 사용하고, 개별 위험의 상세와 증거는 `findings` 및 `evidenceIds`로 연결한다.

`FORCED_ACTION`은 구매 중 로그인 차단 화면에 도달하면 대체 비회원 경로를 아직 배제하지 못했으므로 `REVIEW_NEEDED`로 기록한다. 비회원 상태로 주문서까지 도달하면 해당 구매 경로에서 인증 강제 신호가 없었다고 `NOT_OBSERVED`로 기록한다. 테스트 계정으로 로그인했거나 인증 맥락이 불명확하면 비회원 경로를 검증하지 않은 것이므로 `NOT_TESTED`를 유지한다. `authContext`는 비밀번호나 계정 식별자를 포함하지 않는다.

축약 응답 예시다. 아래 `ruleCoverage`는 한 유형만 발췌했으며, 실제 API와 전체 예시는 항상 16개 유형을 반환한다.

```json
{
  "scanId": "uuid",
  "shopId": "uuid",
  "scanStatus": "PARTIAL",
  "executionMode": "DYNAMIC",
  "viewport": "DESKTOP",
  "purchasePath": "CART",
  "authContext": "ANONYMOUS",
  "durationMs": 12000,
  "findings": [{ "id": "finding-id", "type": "PRESELECTION", "status": "SUSPECTED", "stage": "checkout", "reason": "유료 선택지가 조작 전부터 선택되어 있고 금액이 합계에 반영되었습니다.", "ruleVersion": "3", "evidenceIds": ["evidence:checkout"] }],
  "snapshots": [{ "evidenceId": "evidence:checkout", "stage": "checkout", "url": "https://shop.example/checkout", "screenshot": "checkout.png", "capturedAt": "ISO-8601", "priceLines": ["상품 10,000원", "총 결제 금액 12,000원"], "options": [], "fees": [], "precheckedSignals": [], "decisionControls": [] }],
  "coverage": { "product": "COVERED", "cart": "COVERED", "checkout": "COVERED" },
  "phaseResults": { "product": { "status": "COVERED", "startedAt": "ISO-8601", "finishedAt": "ISO-8601", "durationMs": 1200, "reason": null, "evidenceIds": ["evidence:product"] }, "site-crawl": { "status": "COVERED", "startedAt": "ISO-8601", "finishedAt": "ISO-8601", "durationMs": 4000, "reason": null, "evidenceIds": ["crawl:page-1"] } },
  "surfaceObservations": [],
  "siteCrawl": { "complete": true, "pages": [], "skippedLinks": [], "unexploredControls": [], "nonNavigatingControls": [], "skippedControls": [], "pendingUrls": [], "discoveredUrlCount": 1, "visitedUrlCount": 1, "discoveredStateCount": 1, "visitedStateCount": 1, "uniqueDiscoveredUrlCount": 1, "uniqueVisitedUrlCount": 1, "productCardCount": 0, "failedUrlCount": 0, "maxDepth": 0, "durationMs": 4000, "duplicateStates": [], "loginReplayed": false },
  "stageTimingsMs": { "product": 1200, "site-crawl": 4000, "total": 12000 },
  "explorationMetrics": { "productLinksFound": 0, "productLinksConsidered": 0, "productLinksUnselected": 0, "productLinksVisited": 0, "surfaceCandidates": 0, "surfaceCandidatesInspected": 0, "surfaceCandidatesUninspected": 0, "purchaseActions": 2, "priceResponses": 0 },
  "interactions": [],
  "priceLedger": { "version": 1, "currency": "KRW", "firstPriceExposure": { "status": "NOT_VERIFIED" }, "stages": [] },
  "ruleCoverage": { "PRESELECTION": { "status": "SUSPECTED", "decisionMode": "BASIC_ENGINE", "decisionCriteria": "사용자 조작 전에 비필수 유료 옵션 또는 마케팅 동의가 선택된 상태면 위험 신호.", "reason": "유료 선택지가 조작 전부터 선택되어 있고 금액이 합계에 반영되었습니다.", "evidenceIds": ["evidence:checkout"] } },
  "reviewCandidates": [{ "id": "review-id", "kind": "SEMANTIC_REVIEW", "stage": "surface", "ruleType": "URGENCY_SCARCITY", "text": "긴급성 표현의 실제 근거를 검토", "observedFacts": ["남은 시간 04:45"], "missingInformation": ["실제 재고 기록과 타이머 종료 후 조건 변화"], "reason": "의미 검토 필요", "evidenceIds": ["evidence-id"] }],
  "reviewClassifications": [],
  "networkPriceEvidence": [],
  "surfaceCoverage": { "AUTH": "NOT_FOUND", "SUBSCRIPTION": "NOT_FOUND", "CANCELLATION": "NOT_FOUND", "COUPON": "NOT_FOUND", "RECOMMENDATION": "NOT_FOUND", "POLICY": "NOT_FOUND", "CATALOG": "COVERED" },
  "summary": { "suspected": 1, "reviewNeeded": 1, "notObserved": 0, "notTested": 14 },
  "comparison": null,
  "aiEligible": false,
  "aiReviewCandidateCount": 0,
  "aiReview": null,
  "collectionFailure": null,
  "collectionFailureCode": null
}
```

예시는 구조를 설명하기 위한 값이며, 실제 진단의 상태·수치·배열 내용은 서버가 반환한 값을 사용한다. 스크린샷 주소는 보고서 파일명이므로 화면에서는 증거 조회 API를 이용해 이미지를 불러온다.

`ruleCoverage`는 16개 유형을 각각 `SUSPECTED|REVIEW_NEEDED|NOT_OBSERVED|NOT_TESTED`와 판정 담당 `decisionMode: BASIC_ENGINE|AI_CONTEXT`로 반환한다. 각 항목은 `decisionCriteria`, `reason`, `evidenceIds`를 포함한다. `decisionCriteria`는 바로미가 적용한 유형별 판정 기준이다. 완료된 크롤링에서 해당 기준의 신호가 없으면 `NOT_OBSERVED`로 기록한다. 크롤링 자체가 완료되지 않아 진단 결과를 만들 수 없는 경우에만 `NOT_TESTED`로 남긴다. 구조화된 선택 상태·금액처럼 규칙으로 확인된 사실은 `findings`에 별도로 반환하고, 맥락형 신호는 근거 증거 ID를 가진 유형 지정 `reviewCandidates` 및 `REVIEW_NEEDED`로 기록한다. 보고서의 `summary` 네 숫자는 `ruleCoverage`의 최종 상태 수를 각각 세며 합계는 항상 16이다. 발견 항목 수와 규칙별 상태 수는 서로 다른 값이다.

기본 엔진의 선택·가격·장바구니 판정은 관련 스냅샷의 `inspection` 추출 완료 표식과 `cartContentsVerified` 같은 비교 근거를 함께 사용한다. 화면이 존재한다는 사실만으로 음성 판정을 내리지 않는다. 장바구니 스냅샷의 `cartBaselineVerified`는 담기 전 장바구니 수량 또는 명시적인 빈 장바구니 상태를 실제 화면에서 읽었는지 나타낸다. `cartContentsVerified`가 없거나 `false`면 장바구니 품목 수만으로 `SNEAKY_CART_ADD`를 미관찰로 확정하지 않는다. `siteCrawl`은 방문 페이지별 DOM 텍스트·가시성·컨트롤·링크 및 실패/미방문 사유를 반환한다. 페이지의 `interactiveInventoryComplete`는 DOM 상호작용 목록을 빠짐없이 추출했는지 나타내며, 클릭 가능한 동작 수인 `interactiveCount`와는 다른 값이다. 이는 수집 범위를 설명하는 근거이며, 크롤러가 방문한 것만으로 각 가이드라인을 검사했다고 간주하지 않는다.

`AI_CONTEXT` 유형은 유형별 기준을 만족하는 맥락 신호가 관찰된 경우 `REVIEW_NEEDED`가 된다. 완료된 크롤링에서 그런 신호가 없으면 `NOT_OBSERVED`다. `reviewCandidates`에는 사람 확인용의 유형 없는 메모도 있을 수 있지만, 유료 AI provider에는 합의된 `AI_CONTEXT` 8개 중 `ruleType`이 고정되고 실제 증거가 연결된 항목만 전달한다. `BASIC_ENGINE` 후보나 유형 없는 메모는 AI 요청 payload에서 제외한다.

유형이 지정된 `reviewCandidates[]`에는 `observedFacts[]`와 `missingInformation[]`이 포함된다. AI에 전달하는 자료는 후보와 직접 관련된 화면 문구·상호작용 근거를 우선하며, 로그인 정보와 연락처는 가린다. `interactions[]`의 ID는 선택 전후 상태와 거부 직후 나타난 문구의 근거가 될 수 있다. `priceLedger.firstPriceExposure.evidenceId`는 목록에서 처음 본 가격·상품 카드 근거를 가리키며 관찰된 경우 `price:first-exposure`다. 판정 상태는 AI 결과와 별도로 유지된다.

판정 담당은 다음과 같다.

- `BASIC_ENGINE` (8): `PRESELECTION`, `DRIP_PRICING`, `SNEAKY_CART_ADD`, `FORCED_ACTION`, `BAIT_SELLING`, `MISDIRECTED_HIERARCHY`, `CANCELLATION_OBSTRUCTION`, `PRICE_COMPARISON_OBSTRUCTION`
- `AI_CONTEXT` (8): `URGENCY_SCARCITY`, `HIDDEN_INFO`, `FALSE_DISCOUNT`, `DISGUISED_AD`, `CONFIRM_SHAMING`, `HIDDEN_SUBSCRIPTION`, `FALSE_RECOMMENDATION`, `TRICK_QUESTION`

`decisionMode`는 판정 책임을 표현한다. 기본 엔진 8개도 필요한 비교 증거가 없으면 `NOT_TESTED`가 될 수 있으므로 사유와 증거 범위를 함께 확인해야 한다. `phaseResults`는 각 구매 단계·별도 영역·전체 크롤링의 상태/시간/사유/증거 ID를, `siteCrawl`은 방문한 URL·화면 상태·실패·대기·안전상 미방문 경로와 페이지별 DOM/컨트롤 관찰을 담는다. `snapshots`, `interactions`, `priceLedger`, `networkPriceEvidence`, `surfaceObservations`, `explorationMetrics`, `stageTimingsMs`는 수집된 사실 원장이다.

다운로드는 `GET /api/v1/scans/:scanId/report?download=1`이며 `Content-Disposition: attachment` 응답을 반환한다. SQLite와 Spring 권위 모드 모두 같은 최상위 JSON 계약을 사용한다. Spring 권위 모드에서는 Spring에 저장된 보고서에 SQLite의 소유자별 플랜·AI 작업 메타데이터를 합쳐 `summary`, `aiEligible`, `aiReviewCandidateCount`, `aiReview`를 구성한다. 로컬 AI 작업 메타데이터를 찾을 수 없으면 `aiReview: null`, `aiEligible: false`를 반환한다.

### `GET /api/v1/findings/:findingId`

특정 발견 항목의 상세 정보와 연결된 증거 정보를 반환한다.

### `GET /api/v1/evidences/:scanId-:stage`

증거 PNG를 반환한다. `Content-Type: image/png`.

## 6. 쇼핑몰 이력·삭제

### `GET /api/v1/shops/:shopId/scans`

해당 쇼핑몰의 최근 진단 목록(최대 50개)을 반환한다. 각 항목에 `scanId`, `status`, `executionMode`, `viewport`, `purchasePath`, `createdAt`, `durationMs`, `reportAvailable`, `summary`가 있다. `summary`는 `suspected`, `reviewNeeded`, `notTested` 개수다. 보고서가 만료되었거나 아직 생성되지 않았으면 `reportAvailable: false`다.

### `DELETE /api/v1/scans/:scanId`

소유자 본인의 진단 이력과 연결된 증거를 삭제한다. 진행 중(`QUEUED`, `RUNNING`)이면 `409`를 반환한다. 성공 응답은 `{ "deleted": true, "scanId": "..." }`다. 소유자가 다르거나 없는 ID는 `404`다.

### `DELETE /api/v1/shops/:shopId`

진단이 진행 중이지 않을 때 쇼핑몰과 모든 진단 이력·증거를 함께 삭제한다. 진행 중 진단이 하나라도 있으면 `409`이며 데이터는 삭제하지 않는다. 성공 응답은 `{ "deleted": true, "shopId": "...", "deletedScanCount": 2 }` 형식이다. 소유자가 다르거나 없는 ID는 `404`다.

삭제는 되돌릴 수 없다. 화면에서는 확인 절차를 제공하고, 진행 중 진단은 먼저 취소·종료한 뒤 삭제해야 한다.

## 7. 유료 AI 검토

### `POST /api/v1/scans/:scanId/ai-review`

유료 플랜에서 기본 보고서 생성 후 사용자가 명시적으로 요청한다. 실제 증거 ID로 연결되는 `AI_CONTEXT` 후보만 AI 검토 대상으로 센다. 유형 없는 메모와 `BASIC_ENGINE` 유형은 provider로 보내지 않는다. 연결된 스냅샷·크롤링 페이지·표면 관찰이 없으면 `409`와 `AI로 전달할 검토 후보와 확인 가능한 증거가 없습니다.`를 반환한다. 응답 `202`:

```json
{ "id": "uuid", "status": "QUEUED", "candidateCount": 6 }
```

`aiReviewCandidateCount`는 보고서의 일반 검토 메모를 제외하고, 유료 AI에 실제 전달 가능한 근거 연결 `AI_CONTEXT` 후보 수다. 프론트는 요청 버튼 조건을 `aiEligible && aiReviewCandidateCount > 0`으로 둘 수 있다. `POST`의 `candidateCount`는 해당 작업에 고정된 후보 수다. 같은 요청을 다시 보내면 기존 `QUEUED|RUNNING|COMPLETED` 작업 ID와 현재 후보 수를 돌려준다. 이후 `GET /api/v1/scans/:scanId/report`를 조회해 `aiReview.status`가 `QUEUED → RUNNING → COMPLETED|FAILED`로 끝나는지 확인한다. 완료 응답은 `aiReview.result.decisions[]`에 `candidateId`, `label`, `confidence`, `rationale`, `suggestedRule`을, `aiReview.usage`에 토큰·비용을 담는다. AI 검토 상태와 결과는 `ruleCoverage`와 기본 `findings`를 변경하지 않는다.

### `POST /api/v1/scans/:scanId/ai-review-labels`

각 라벨은 해당 진단 보고서의 `reviewCandidates[].id`에 존재하는 `candidateId`, `label`과 선택적 `adjudication`(`PENDING|AGREED`)을 받는다. 같은 후보를 중복 제출할 수 없으며, 생략하면 서버가 `PENDING`으로 저장한다. 합의되지 않은 라벨은 오프라인 모델 평가 지표에 포함되지 않는다.

운영자 라벨 저장:

```json
{ "labels": [{ "candidateId": "...", "label": "LIKELY_RISK|NEEDS_REVIEW|LIKELY_BENIGN|INSUFFICIENT_EVIDENCE" }] }
```

## 8. Spring/PostgreSQL 내부 API

아래 API는 브라우저가 직접 호출하지 않는다. Node API와 worker가 `X-Baromi-Owner` 또는 `X-Baromi-Worker` 헤더를 사용해 호출한다.

### `GET /api/v1/health/readiness`

PostgreSQL 연결 확인. 정상 응답:

```json
{ "status": "ready", "database": "ok" }
```

### `POST /api/v1/shops` (Spring)

헤더 `X-Baromi-Owner` 필수. 본문은 `{ "id": "uuid|null", "url": "https://...", "consent": true }`이며, Node에서 미러링할 때 사용한다.

### `GET /api/v1/shops/:shopId` (Spring)

헤더 `X-Baromi-Owner` 필수. 응답은 `{ "shopId": "uuid", "url": "https://..." }`.

### `GET /api/v1/shops` (Spring)

헤더 `X-Baromi-Owner` 필수. 응답은 Node 목록 API와 같은 `{ "limit": 50, "shops": [] }` 형식이며 각 상점은 `consentAt`, `verifiedAt`도 포함한다.

### `DELETE /api/v1/shops/:shopId` (Spring)

헤더 `X-Baromi-Owner` 필수. 본인 소유 쇼핑몰의 진단 이력을 함께 삭제한다. 진행 중 진단이 있으면 `409`; 성공 응답은 `{ "deleted": true, "shopId": "...", "deletedScanIds": [] }`다.

### `POST /api/v1/scans` (Spring)

헤더 `X-Baromi-Owner` 필수. 본문:

```json
{
  "id": "uuid|null",
  "shopId": "uuid",
  "targetUrl": "https://shop.example.com",
  "executionMode": "STATIC|DYNAMIC",
  "viewport": "DESKTOP|MOBILE",
  "purchasePath": "CART|DIRECT"
}
```

응답 `202`: `{ "scanId": "uuid", "status": "queued" }`.

### `GET /api/v1/scans/:scanId` (Spring)

헤더 `X-Baromi-Owner` 필수. 상태는 소문자 `queued|running|partial|succeeded|failed|cancelled`로 반환될 수 있다. 프론트 공개 API는 이를 대문자 상태로 정규화한다.

### `GET /api/v1/scans/:scanId/report` (Spring)

헤더 `X-Baromi-Owner` 필수. PostgreSQL에 저장된 원본 보고서 JSON을 반환한다.

### `GET /api/v1/scans/shop/:shopId` (Spring)

헤더 `X-Baromi-Owner` 필수. `limit`은 1~100이다.

각 항목은 `durationMs`, `reportAvailable`을 포함하며, 보고서가 저장된 경우 `summary`에 위험 신호·검토 필요·미검사 유형 수를 포함한다.

### `DELETE /api/v1/scans/:scanId` (Spring)

헤더 `X-Baromi-Owner` 필수. 본인 소유의 종료된 진단 이력을 삭제한다. 진행 중이면 `409`, 타인 소유거나 없는 ID면 `404`다.

### `POST /api/v1/scans/claim` (worker 전용)

헤더 `X-Baromi-Worker` 필수. 큐에서 가장 오래된 `queued` 작업을 원자적으로 가져와 `running`으로 바꾼다. 작업이 없으면 `204`.

### `PATCH /api/v1/scans/:scanId/status` (worker 전용)

헤더 `X-Baromi-Worker` 필수. 본문:

```json
{ "status": "queued|running|partial|succeeded|failed|cancelled", "stage": "product|cart|checkout|surface:AUTH|site-crawl|null", "phaseResults": { "product": { "status": "COVERED", "durationMs": 1200, "evidenceIds": ["evidence-id"] } }, "reportJson": "..." }
```

허용되지 않는 상태 전이는 `409`다. 단계 결과는 최대 256KiB이며 보고서 JSON은 최대 4MB다. 상태 조회는 저장된 `phaseResults`를 반환한다. 보관 기간은 서버 정책을 따른다.

### `POST /api/v1/scans/recover` (worker/운영 전용)

헤더 `X-Baromi-Worker` 필수. 본문 `{ "staleBefore": "ISO-8601" }`. 오래 멈춘 `running` 작업을 `failed`로 전환하고 `{ "recovered": 0, "staleBefore": "..." }`를 반환한다.

## 9. 프론트가 사용할 공개 API와 내부 API 구분

프론트 팀은 `POST /shops`, `GET /shops`, `GET /shops/:id`, `DELETE /shops/:id`, `POST /shops/:id/verify`, `POST /scans`, `GET /scans/:id`, `DELETE /scans/:id`, `GET /scans/:id/findings`, `GET /scans/:id/report`, `GET /shops/:id/scans`, `POST /scans/:id/cancel`, AI 검토 API만 사용한다. `X-Baromi-Owner`, `X-Baromi-Worker`, Spring 직접 호출은 프론트 코드에 넣지 않는다.

## 프론트 구현 주의

1. Supabase 설정이 켜진 환경에서 로그인 세션이 없거나 만료되면 `401`을 로그인 화면으로 처리한다. 로컬 Supabase 미설정 호환 모드에서는 기존 익명 세션 오류가 `404`일 수 있다.
2. `503`은 저장소/워커 장애, `409`는 검증·상태 충돌, `429`는 호출 제한으로 표시한다.
3. 보고서 화면은 `coverage`, `surfaceCoverage`, `summary.notTested`를 반드시 표시해 미검사와 위험 판정을 구분한다.
4. 결제·주문 확정 버튼을 누르는 API는 제공하지 않는다. 진단 엔진은 탐색·기록만 수행한다.
