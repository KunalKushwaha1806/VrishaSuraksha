#!/usr/bin/env bash
# Deploy VridhaSuraksha to Google Cloud Run with Firestore, Secret Manager and Cloud Scheduler.
#
# Usage:
#   export PROJECT_ID=your-project REGION=asia-south1
#   export GEMINI_API_KEY=... SMTP_USER=you@gmail.com SMTP_PASS=app-password   # optional but recommended
#   export DEMO_INBOX=you@gmail.com                                            # optional
#   bash scripts/deploy.sh
#
# Safe to re-run: existing secrets are kept unless you pass new values.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-vridhasuraksha}"
SA_NAME="${SERVICE}-run"
SA="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com \
  texttospeech.googleapis.com

echo "==> Firestore (Native mode)"
if ! gcloud firestore databases describe --database="(default)" >/dev/null 2>&1; then
  gcloud firestore databases create --location="$REGION" --type=firestore-native
fi
gcloud firestore indexes composite create --collection-group=jobs \
  --field-config=field-path=status,order=ascending --field-config=field-path=dueAt,order=ascending \
  --async >/dev/null 2>&1 || true
gcloud firestore indexes composite create --collection-group=jobs \
  --field-config=field-path=status,order=ascending --field-config=field-path=leaseUntil,order=ascending \
  --async >/dev/null 2>&1 || true
# Expire used single-use email tokens automatically.
gcloud firestore fields ttls update expiresAt --collection-group=usedActionTokens --enable-ttl --async >/dev/null 2>&1 || true

echo "==> Service account"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA_NAME" --display-name="VridhaSuraksha Cloud Run"
for role in roles/datastore.user roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role="$role" \
    --condition=None >/dev/null
done

put_secret() { # name value
  local name="$1" value="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    [ -n "$value" ] && printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  else
    [ -z "$value" ] && return 0
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic >/dev/null
  fi
}
has_secret() { gcloud secrets describe "$1" >/dev/null 2>&1; }

echo "==> Secrets"
has_secret vs-jwt-secret || put_secret vs-jwt-secret "$(openssl rand -base64 48)"
has_secret vs-encryption-key || put_secret vs-encryption-key "$(openssl rand -base64 32)"
has_secret vs-cron-secret || put_secret vs-cron-secret "$(openssl rand -hex 32)"
put_secret vs-gemini-key "${GEMINI_API_KEY:-}"
put_secret vs-smtp-pass "${SMTP_PASS:-}"

SECRETS="JWT_SECRET=vs-jwt-secret:latest,ENCRYPTION_KEY=vs-encryption-key:latest,CRON_SECRET=vs-cron-secret:latest"
has_secret vs-gemini-key && SECRETS="$SECRETS,GEMINI_API_KEY=vs-gemini-key:latest"
has_secret vs-smtp-pass && SECRETS="$SECRETS,SMTP_PASS=vs-smtp-pass:latest"

ENV_VARS="DATA_BACKEND=firestore,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,TTS_ENABLED=true,DEMO_MODE=${DEMO_MODE:-true}"
[ -n "${SMTP_USER:-}" ] && ENV_VARS="$ENV_VARS,SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,SMTP_USER=$SMTP_USER,EMAIL_FROM=VridhaSuraksha <$SMTP_USER>"
[ -n "${DEMO_INBOX:-}" ] && ENV_VARS="$ENV_VARS,DEMO_INBOX=$DEMO_INBOX"

echo "==> Building and deploying to Cloud Run"
gcloud run deploy "$SERVICE" --source . --region "$REGION" --service-account "$SA" \
  --allow-unauthenticated --port 8080 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 \
  --concurrency 80 --timeout 60 \
  --set-env-vars "^|^${ENV_VARS//,/|}" --set-secrets "$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
gcloud run services update "$SERVICE" --region "$REGION" --update-env-vars "APP_URL=$URL" >/dev/null

echo "==> Cloud Scheduler: reminder engine every minute"
CRON_SECRET="$(gcloud secrets versions access latest --secret=vs-cron-secret)"
JOB_ARGS=(--location "$REGION" --schedule "* * * * *" --time-zone "Asia/Kolkata"
  --uri "$URL/api/cron/tick" --http-method POST
  --headers "Authorization=Bearer $CRON_SECRET,Content-Type=application/json" --message-body "{}"
  --attempt-deadline 60s)
if gcloud scheduler jobs describe vs-tick --location "$REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http vs-tick "${JOB_ARGS[@]}" >/dev/null
else
  gcloud scheduler jobs create http vs-tick "${JOB_ARGS[@]}" >/dev/null
fi

echo
echo "Deployed: $URL"
echo "Health:   $URL/api/health"
echo "Demo:     $URL/demo"
