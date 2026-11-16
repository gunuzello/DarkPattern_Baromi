# AI 정밀 진단 — 프론트 초안 (백엔드 협의용)

프론트는 아래 구조의 **목 데이터**로 화면을 먼저 만들었어요. 필드 이름과 엔드포인트는 확정이 아니라 제안이에요. 타입은 `web/lib/aiDiagnosis.ts`에 있어요.

## 켜는 방법

| `NEXT_PUBLIC_AI_DIAGNOSIS` | 동작 |
|---|---|
| (없음) | 예시 결과(`/report/sample`)와 데모 모드만 새 화면, 실제 점검은 기존 AI 꼼꼼 점검 유지 |
| `mock` | 모든 점검에서 새 화면 + 목 데이터 (검토용 배포에서만) |
| `api` | 모든 점검에서 새 화면 + 아래 엔드포인트 호출 |

## 제안 엔드포인트

- `POST /api/v1/scans/{scanId}/ai-diagnosis` — 본문 `{ "ruleTypes": ["PRESELECTION", ...] }` (1~16개, 기본 판정과 무관하게 선택 가능)
- `GET /api/v1/scans/{scanId}/ai-diagnosis` — 가장 최근 요청, 없으면 `null`

## 제안 응답 (`AiDiagnosis`)

```jsonc
{
  "id": "ai-123",
  "scanId": "…",
  "status": "QUEUED | RUNNING | COMPLETED | FAILED",
  "requestedTypes": ["PRESELECTION"],
  "createdAt": "ISO", "completedAt": "ISO",
  "doneCount": 3,                 // RUNNING 중 진행 표시용
  "error": "실패 사유",            // FAILED
  "summary": { "overview": "…", "keyRisks": ["…"], "priorities": ["…"] },
  "items": [{
    "type": "PRESELECTION",
    "status": "ANALYZED | INSUFFICIENT",   // INSUFFICIENT = 분석 자료 부족 (네 번째 판정이 아님)
    "verdict": "RISK | PARTIAL | SAFE",    // ANALYZED일 때만
    "conclusion": "1~2문장 결론",
    "evidence": [{ "text": "수집한 문구·가격·선택 상태", "evidenceId": "ev_0142", "stage": "product" }],
    "screenshotStage": "product",          // 화면 모양이 판단에 필요할 때만, 실제 캡처가 있을 때만
    "reasoning": "판단 이유",
    "recommendations": [{ "title": "…", "reason": "…", "action": "구체적 조치" }]
  }]
}
```

## 지켜야 할 점

- AI 판정(`verdict`)과 기본 엔진 판정(`ruleCoverage.status`)은 다른 데이터로 다뤄요. AI 결과가 기본 결과를 덮어쓰지 않아요.
- `INSUFFICIENT` 항목에는 `verdict`를 넣지 않아요.
- 스크린샷은 `evidences/{scanId}-{stage}`에 있는 실제 캡처만 써요. 이미지를 만들어 넣지 않아요.
