#!/bin/bash
# Deploy djaber to Google Cloud Run
# Prerequisites: gcloud CLI installed + authenticated
#
# First time setup:
#   1. gcloud auth login
#   2. gcloud config set project YOUR_PROJECT_ID
#   3. gcloud services enable run.googleapis.com cloudbuild.googleapis.com sqladmin.googleapis.com
#   4. Create Cloud SQL MySQL instance (see below)
#   5. Set secrets in Cloud Run console or via gcloud
#
# Usage:
#   ./deploy.sh              # Deploy both
#   ./deploy.sh backend      # Deploy backend only
#   ./deploy.sh frontend     # Deploy frontend only

set -e

PROJECT_ID=$(gcloud config get-value project)
REGION="${GCP_REGION:-europe-west1}"
BACKEND_SERVICE="djaber-api"
FRONTEND_SERVICE="djaber-web"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo ""

deploy_backend() {
  echo "=== Building backend ==="
  cd backend
  gcloud builds submit \
    --tag "gcr.io/$PROJECT_ID/$BACKEND_SERVICE" \
    --timeout=600s
  cd ..

  echo "=== Deploying backend to Cloud Run ==="
  gcloud run deploy "$BACKEND_SERVICE" \
    --image "gcr.io/$PROJECT_ID/$BACKEND_SERVICE" \
    --region "$REGION" \
    --platform managed \
    --port 8080 \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3

  BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format='value(status.url)')
  echo ""
  echo "Backend deployed: $BACKEND_URL"
  echo ""
}

deploy_frontend() {
  # Get backend URL
  BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || echo "")

  if [ -z "$BACKEND_URL" ]; then
    echo "Warning: Backend not deployed yet. Deploy backend first."
    echo "Using placeholder URL — frontend API calls will fail."
    BACKEND_URL="https://djaber-api-placeholder.run.app"
  fi

  echo "=== Building frontend (API URL: $BACKEND_URL) ==="
  gcloud builds submit \
    --tag "gcr.io/$PROJECT_ID/$FRONTEND_SERVICE" \
    --timeout=600s \
    --substitutions="_NEXT_PUBLIC_API_URL=$BACKEND_URL"

  echo "=== Deploying frontend to Cloud Run ==="
  gcloud run deploy "$FRONTEND_SERVICE" \
    --image "gcr.io/$PROJECT_ID/$FRONTEND_SERVICE" \
    --region "$REGION" \
    --platform managed \
    --port 8080 \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3

  FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" --region "$REGION" --format='value(status.url)')
  echo ""
  echo "Frontend deployed: $FRONTEND_URL"
  echo ""
}

case "${1:-all}" in
  backend)
    deploy_backend
    ;;
  frontend)
    deploy_frontend
    ;;
  all)
    deploy_backend
    deploy_frontend
    ;;
  *)
    echo "Usage: ./deploy.sh [backend|frontend|all]"
    exit 1
    ;;
esac

echo "=== Done ==="
echo ""
echo "Next steps:"
echo "  1. Set env vars on backend:  gcloud run services update $BACKEND_SERVICE --region $REGION --set-env-vars KEY=VALUE"
echo "  2. Or use Secret Manager:    gcloud run services update $BACKEND_SERVICE --region $REGION --set-secrets DB_URL=db-url:latest"
