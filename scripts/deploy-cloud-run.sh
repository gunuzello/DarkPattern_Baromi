#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="baromi"
REGION="asia-northeast3"
REPOSITORY="baromi"
API_SERVICE="baromi-api"
WORKER_JOB="baromi-scan-worker"
MIGRATION_JOB="baromi-db-migrate"
STORAGE_JOB="baromi-storage-setup"
API_ACCOUNT="baromi-api"
WORKER_ACCOUNT="baromi-worker"
IMAGE_TAG="${BAROMI_IMAGE_TAG:-bootstrap-20261117b}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://baromi-web.vercel.app}"
SUPABASE_STORAGE_BUCKET="${SUPABASE_STORAGE_BUCKET:-baromi-evidence}"

if [[ -f web/.env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source web/.env.local
  set +a
fi
SUPABASE_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" ]]; then
  echo "web/.env.local에 Supabase URL과 공개 anon key가 필요합니다." >&2
  exit 1
fi

gcloud config set project "$PROJECT_ID" >/dev/null
for secret in DATABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  if ! gcloud secrets describe "$secret" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Secret Manager에 $secret 시크릿을 먼저 만들어 주세요." >&2
    exit 1
  fi
done

if ! gcloud secrets describe BAROMI_CREDENTIAL_KEY --project="$PROJECT_ID" >/dev/null 2>&1; then
  openssl rand -base64 32 | gcloud secrets create BAROMI_CREDENTIAL_KEY --project="$PROJECT_ID" --data-file=- >/dev/null
fi

ensure_account() {
  local account="$1"
  if ! gcloud iam service-accounts describe "${account}@${PROJECT_ID}.iam.gserviceaccount.com" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$account" --project="$PROJECT_ID" --display-name="Baromi ${account}"
  fi
}
ensure_account "$API_ACCOUNT"
ensure_account "$WORKER_ACCOUNT"
API_PRINCIPAL="serviceAccount:${API_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
WORKER_PRINCIPAL="serviceAccount:${WORKER_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"

for secret in DATABASE_URL SUPABASE_SERVICE_ROLE_KEY BAROMI_CREDENTIAL_KEY; do
  gcloud secrets add-iam-policy-binding "$secret" --project="$PROJECT_ID" --member="$API_PRINCIPAL" --role=roles/secretmanager.secretAccessor --quiet >/dev/null
  gcloud secrets add-iam-policy-binding "$secret" --project="$PROJECT_ID" --member="$WORKER_PRINCIPAL" --role=roles/secretmanager.secretAccessor --quiet >/dev/null
done

API_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/baromi-api:${IMAGE_TAG}"
MIGRATION_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/baromi-migrate:${IMAGE_TAG}"
WORKER_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/baromi-worker:${IMAGE_TAG}"
COMMON_ENV="BAROMI_REPORT_STORAGE=postgres,SUPABASE_URL=${SUPABASE_URL},SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY},SUPABASE_STORAGE_BUCKET=${SUPABASE_STORAGE_BUCKET}"
COMMON_SECRETS="DATABASE_URL=DATABASE_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,BAROMI_CREDENTIAL_KEY=BAROMI_CREDENTIAL_KEY:latest"

# Reach Supabase from Cloud Run instead of the local machine: the local network
# may not be able to open the PostgreSQL pooler connection.
gcloud run jobs deploy "$MIGRATION_JOB" \
  --project="$PROJECT_ID" --region="$REGION" --image="$MIGRATION_IMAGE" \
  --service-account="${WORKER_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --command=./node_modules/.bin/prisma --args=migrate,deploy \
  --set-env-vars=PRISMA_PROVIDER=postgresql --set-secrets=DATABASE_URL=DATABASE_URL:latest \
  --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=5m --cpu=1 --memory=1Gi --quiet
gcloud run jobs execute "$MIGRATION_JOB" --project="$PROJECT_ID" --region="$REGION" --wait

# Create the private evidence bucket from the same outbound network path.
gcloud run jobs deploy "$STORAGE_JOB" \
  --project="$PROJECT_ID" --region="$REGION" --image="$WORKER_IMAGE" \
  --service-account="${WORKER_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --command=./node_modules/.bin/tsx --args=scripts/ensure-storage.ts \
  --set-env-vars="SUPABASE_URL=${SUPABASE_URL},SUPABASE_STORAGE_BUCKET=${SUPABASE_STORAGE_BUCKET}" \
  --set-secrets=SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest \
  --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=5m --cpu=1 --memory=512Mi --quiet
gcloud run jobs execute "$STORAGE_JOB" --project="$PROJECT_ID" --region="$REGION" --wait

gcloud run jobs deploy "$WORKER_JOB" \
  --project="$PROJECT_ID" --region="$REGION" --image="$WORKER_IMAGE" \
  --service-account="${WORKER_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=20m --cpu=2 --memory=2Gi \
  --set-env-vars="${COMMON_ENV}" --set-secrets="${COMMON_SECRETS}" --quiet

gcloud run jobs add-iam-policy-binding "$WORKER_JOB" \
  --project="$PROJECT_ID" --region="$REGION" --member="$API_PRINCIPAL" --role=roles/run.jobsExecutorWithOverrides --quiet >/dev/null

gcloud run deploy "$API_SERVICE" \
  --project="$PROJECT_ID" --region="$REGION" --image="$API_IMAGE" \
  --service-account="${API_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --port=8080 --cpu=1 --memory=1Gi --concurrency=40 --max=2 --min=0 --timeout=600s \
  --allow-unauthenticated \
  --set-env-vars="${COMMON_ENV},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},CLOUD_RUN_REGION=${REGION},BAROMI_CLOUD_RUN_JOB_NAME=${WORKER_JOB},BAROMI_SPRING_AUTHORITATIVE=false,BAROMI_WEB_ORIGINS=${FRONTEND_ORIGIN}" \
  --set-secrets="${COMMON_SECRETS}" --quiet

gcloud run services describe "$API_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)'
