# 바로미 운영 배포 구성

현재 운영 환경은 프론트엔드 Vercel, API와 진단 작업기 Google Cloud Run, 계정 Supabase Auth로 구성됩니다.

| 역할 | 운영 구성 |
|---|---|
| 프론트엔드 | [baromi-web-coral.vercel.app](https://baromi-web-coral.vercel.app), Vercel 프로젝트 루트 `web` |
| API | Cloud Run 서비스 `baromi-api`, 리전 `asia-northeast3` |
| 진단·AI 작업 | Cloud Run Job `baromi-scan-worker`; 요청이 있을 때 실행 |
| 데이터베이스·증거 | 서버 환경변수와 Secret Manager로 연결하는 운영 데이터베이스 및 비공개 Supabase Storage |
| 계정 | Supabase Auth |

브라우저 작업기는 계속 켜져 있지 않습니다. API가 진단 또는 AI 작업을 접수한 뒤 Cloud Run Job을 실행하고, Job은 해당 작업을 마치면 종료됩니다. 프론트엔드의 `BAROMI_API_ORIGIN`은 `https://baromi-api-zby54gcwwq-du.a.run.app`을 가리킵니다.

## 새 백엔드 커밋 배포

백엔드 파일은 `main`에 푸시하는 것만으로 Cloud Run에 자동 배포되지 않습니다. GitHub Actions는 웹과 Spring 백엔드 검사를 수행하며, 루트 API·진단 이미지 배포는 아래 Cloud Build와 Cloud Run 갱신 절차로 진행합니다. 현재 API URL은 유지되므로 프론트엔드 환경변수 변경은 필요하지 않습니다.

먼저 프로젝트 인증이 된 Google Cloud CLI에서 저장소 루트로 이동합니다. `cloudbuild.yaml`은 API, 데이터베이스 마이그레이션, 작업기 이미지를 Artifact Registry에 빌드합니다.

```sh
TAG="$(git rev-parse --short HEAD)"
gcloud builds submit \
  --project=baromi \
  --region=asia-northeast3 \
  --config=cloudbuild.yaml \
  --substitutions="_REGION=asia-northeast3,_REPOSITORY=baromi,_TAG=${TAG}" \
  .
```

빌드가 성공한 뒤 API와 작업기를 같은 태그로 갱신합니다.

```sh
gcloud run jobs update baromi-scan-worker \
  --project=baromi --region=asia-northeast3 \
  --image="asia-northeast3-docker.pkg.dev/baromi/baromi/baromi-worker:${TAG}" \
  --quiet

gcloud run services update baromi-api \
  --project=baromi --region=asia-northeast3 \
  --image="asia-northeast3-docker.pkg.dev/baromi/baromi/baromi-api:${TAG}" \
  --quiet
```

배포 상태와 실제 적용 이미지를 확인합니다.

```sh
gcloud run services describe baromi-api \
  --project=baromi --region=asia-northeast3 \
  --format='value(status.latestReadyRevisionName,status.url,spec.template.spec.containers[0].image)'

gcloud run jobs describe baromi-scan-worker \
  --project=baromi --region=asia-northeast3 \
  --format='value(status.conditions[0].status,spec.template.spec.template.spec.containers[0].image)'
```

Cloud Run 런타임 비밀값은 Secret Manager에서 관리합니다. 로컬 `.env` 파일이나 프론트엔드 환경변수에 `DATABASE_URL`, Supabase service-role key, AI API key를 복사하지 않습니다. 데이터베이스 스키마 변경이 포함된 경우에만 마이그레이션 작업을 별도로 갱신·실행하고, 기존 저장소를 백업한 뒤 적용합니다.

## AI 꼼꼼 점검

AI 제공자는 `BAROMI_AI_API_URL`, `BAROMI_AI_MODEL`, `BAROMI_AI_API_KEY`와 비용 상한 환경변수로 작업기에 설정합니다. API key는 Secret Manager에 저장하고 작업기 서비스 계정에만 읽기 권한을 줍니다. 기본 점검은 AI 키 없이 실행할 수 있습니다.

화면과 요금 안내에서는 AI 꼼꼼 점검을 유료 후속 기능으로 소개하지만, 현재 시연 기간에는 로그인한 모든 계정이 요청할 수 있습니다. 권한은 로그인과 사용자별 진단 소유권 확인 뒤 부여됩니다. AI 호출은 제공자 요금과 사용량 제한을 적용받습니다.

## 상태 확인과 제한

- Cloud Run 서비스와 Job의 `Ready` 상태는 각각 배포 준비 상태를 뜻합니다.
- `GET /api/v1/health`는 앱의 상태 점검입니다. 오래된 `RUNNING` 진단이 있으면 `503`과 `status: "degraded"`를 반환할 수 있으며, 이것만으로 Cloud Run 배포 실패를 뜻하지는 않습니다.
- 현재 앱은 기본 5분 이상 진행 중인 진단을 오래된 작업으로 집계합니다. Cloud Run Job 제한 시간은 최대 20분이라 오래 걸리는 진단이 상태 점검에서 먼저 오래된 작업으로 보일 수 있습니다. 상태 코드는 배포 상태와 구분해서 확인합니다.
- 배포 후에는 프론트 로그인과 실제 진단·AI 요청 E2E를 별도로 확인해야 합니다. 운영용 실제 AI 요청은 Gemini 사용량을 발생시킬 수 있습니다.
