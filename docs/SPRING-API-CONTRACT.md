# 바로미 Spring API 계약

이 문서는 프론트엔드 BFF와 탐색 워커가 Spring 백엔드와 연동할 때 사용하는 현재 계약이다. 브라우저는 Spring을 직접 호출하지 않는다. `X-Baromi-Owner` 값은 BFF가 검증한 로그인 사용자 ID이며 Spring은 이를 SHA-256 해시해 저장된 소유자 키와 비교한다.

`GET /api/v1/health`는 프로세스 liveness를, `GET /api/v1/health/readiness`는 PostgreSQL 연결을 확인한다. readiness가 `503`이면 트래픽을 보내지 않는다.

## 공통 규칙

- 모든 상점·진단 요청은 `X-Baromi-Owner`로 소유자 범위를 지정한다.
- 워커 전용 요청은 `X-Baromi-Worker`를 사용한다.
- 워커 토큰과 쇼핑몰 아이디·비밀번호는 응답·로그·Git에 포함하지 않는다.
- 등록 상점과 동일한 HTTPS 호스트의 URL만 진단 대상으로 허용한다.

## 상점

`GET /api/v1/shops?limit=50` — 소유자 범위의 최신 상점 목록. `limit`은 1~100으로 제한된다.

```json
{ "limit": 50, "shops": [{ "shopId": "shop-id", "url": "https://shop.example", "nickname": "우리 쇼핑몰", "consentAt": "2026-11-16T10:00:00Z", "verifiedAt": null }] }
```

`POST /api/v1/shops`

```json
{ "id": "optional-client-id", "url": "https://shop.example", "nickname": "우리 쇼핑몰", "consent": true }
```

응답: `201 { "shopId": "...", "url": "..." }`. 동일 계정의 정규화된 URL이 있으면 기존 ID를 `200` 응답으로 돌려준다.

`PATCH /api/v1/shops/{shopId}`에 `{ "nickname": "우리 쇼핑몰" }`을 보내 표시 이름을 변경한다. 이름은 공백 제외 1~80자다. 목록 조회 시 과거 중복 쇼핑몰이 발견되면 가장 먼저 등록한 ID를 유지하고 모든 진단 이력을 그 ID에 연결한 뒤 중복 항목을 제거한다.

`DELETE /api/v1/shops/{shopId}` — 해당 소유자의 쇼핑몰과 진단 이력을 함께 삭제한다. `queued` 또는 `running` 진단이 있으면 `409`이며 삭제하지 않는다. 성공 응답은 삭제된 진단 ID를 포함한 `{ "deleted": true, "shopId": "...", "deletedScanIds": ["..."] }`다.

## 진단 생성·조회

`POST /api/v1/scans`

```json
{
  "id": "optional-client-id",
  "shopId": "shop-id",
  "targetUrl": "https://shop.example/products/item",
  "executionMode": "DYNAMIC",
  "viewport": "DESKTOP",
  "purchasePath": "CART"
}
```

응답: `202 { "scanId": "...", "status": "queued" }`

- `executionMode`: `STATIC` 또는 `DYNAMIC`
- `viewport`: `DESKTOP` 또는 `MOBILE`
- `purchasePath`: `CART` 또는 `DIRECT`
- 동적 진단의 로그인 자격증명은 이 API로 전달하지 않는다. 자격증명은 워커가 접근하는 암호화 보관소에만 둔다.

`GET /api/v1/scans/{scanId}` — 소유자 범위의 단건 상태 조회. `phaseResults`는 구매 단계·별도 탐색 영역·전체 크롤링의 저장된 상태, 시간, 사유, 증거 ID를 담는다. 단계 결과가 없는 과거 진단은 빈 객체를 반환한다.

`GET /api/v1/scans/shop/{shopId}?limit=50` — 소유자 범위의 최신순 목록. `limit`은 1~100으로 제한된다.

```json
{
  "shopId": "shop-id",
  "limit": 50,
  "scans": [
    { "scanId": "scan-id", "status": "running", "currentStage": "cart", "createdAt": "2026-11-14T10:00:00Z", "updatedAt": "2026-11-14T10:01:00Z", "startedAt": "2026-11-14T10:00:05Z", "durationMs": null, "reportAvailable": false }
  ]
}
```

보고서가 생성된 진단은 `durationMs`, `reportAvailable: true`, `summary`(위험 신호·검토 필요·미검사 수)를 포함한다. 보고서 보관 기간이 끝나면 `reportAvailable`은 `false`다.

`DELETE /api/v1/scans/{scanId}` — 본인 소유의 종료된 진단 이력을 삭제한다. 진행 중이면 `409`, 타인 소유거나 없는 ID면 `404`다.

## 워커 큐

- `POST /api/v1/scans/claim` — `queued` 중 가장 오래된 진단을 원자적으로 `running`으로 변경
- `POST /api/v1/scans/recover` — 지정 시각보다 오래 실행 중인 작업을 `failed`로 복구
- `PATCH /api/v1/scans/{scanId}/status` — 워커 상태 콜백

상태 콜백 본문은 `{ "status": "queued|running|partial|succeeded|failed|cancelled", "stage": "product|cart|checkout|surface:<영역>|site-crawl|null", "phaseResults": { "product": { "status": "COVERED", "durationMs": 1200, "evidenceIds": ["evidence-id"] } }, "reportJson": "..." }` 형식이다. 단계 결과 JSON은 최대 256KiB, 보고서 JSON은 최대 4MB다. 크기 제한 초과 시 상태를 바꾸지 않고 `413`을 반환한다.

상태 전이:

`queued → running → partial|succeeded|failed|cancelled`

완료 상태에서 `running`으로 되돌리는 역전은 `409 Conflict`로 거부한다.
