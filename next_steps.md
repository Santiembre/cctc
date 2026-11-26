# Pasos para Desplegar Hub de Aprendizaje

## 1. Configurar Credenciales de Firebase/Google Cloud

### 1.1 Crear proyecto en Google Cloud Console
```bash
# O usar proyecto existente
gcloud projects create hub-aprendizaje-fes --name="Hub de Aprendizaje FES Acatlán"
```

### 1.2 Habilitar APIs requeridas
```bash
gcloud services enable \
  firebase.googleapis.com \
  firestore.googleapis.com \
  firebasestorage.googleapis.com \
  firebaseauth.googleapis.com \
  aiplatform.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 1.3 Configurar Firebase Authentication
1. En Firebase Console → Authentication → Sign-in method
2. Habilitar **Google** como proveedor
3. En configuración de Google, agregar dominio autorizado: `acatlan.unam.mx`
4. Copiar `Web API Key`, `Auth Domain`, `Project ID`, `Storage Bucket`, `Messaging Sender ID`, `App ID`

### 1.4 Crear Service Account para Firebase Admin
```bash
# En IAM → Service Accounts
gcloud iam service-accounts create hub-admin \
  --display-name="Hub Aprendizaje Admin" \
  --project=hub-aprendizaje-fes

# Descargar clave JSON
gcloud iam service-accounts keys create firebase-admin-key.json \
  --iam-account=hub-admin@hub-aprendizaje-fes.iam.gserviceaccount.com
```

### 1.5 Asignar roles al Service Account
```bash
gcloud projects add-iam-policy-binding hub-aprendizaje-fes \
  --member="serviceAccount:hub-admin@hub-aprendizaje-fes.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding hub-aprendizaje-fes \
  --member="serviceAccount:hub-admin@hub-aprendizaje-fes.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding hub-aprendizaje-fes \
  --member="serviceAccount:hub-admin@hub-aprendizaje-fes.iam.gserviceaccount.com" \
  --role="roles/firebaseauth.admin"

gcloud projects add-iam-policy-binding hub-aprendizaje-fes \
  --member="serviceAccount:hub-admin@hub-aprendizaje-fes.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### 1.6 Configurar Vertex AI / Gemini
```bash
# Verificar que el modelo está disponible en la región
gcloud ai models list --region=us-central1 --filter="displayName:gemini-2.5-flash"
```

---

## 2. Configurar Variables de Entorno

### 2.1 Editar `.env.local` con credenciales reales
```env
# Firebase Client (desde Firebase Console > Project Settings)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=hub-aprendizaje-fes.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=hub-aprendizaje-fes
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=hub-aprendizaje-fes.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc...

# Firebase Admin (desde service account JSON)
FIREBASE_ADMIN_PROJECT_ID=hub-aprendizaje-fes
FIREBASE_ADMIN_CLIENT_EMAIL=hub-admin@hub-aprendizaje-fes.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Vertex AI / Gemini
GOOGLE_CLOUD_PROJECT=hub-aprendizaje-fes
GOOGLE_CLOUD_LOCATION=us-central1
GEMINI_MODEL=gemini-2.5-flash

# Cloud Storage
STORAGE_BUCKET=hub-aprendizaje-fes.appspot.com

# App URL (para SSR fetching)
NEXT_PUBLIC_APP_URL=https://hub-aprendizaje-fes.web.app
```

---

## 3. Desplegar Reglas de Firestore y Storage

```bash
# Instalar Firebase CLI
pnpm add -g firebase-tools

# Login
firebase login

# Inicializar (si no se hizo)
firebase init

# Desplegar reglas e índices
firebase deploy --only firestore:rules,firestore:indexes,storage
```

---

## 4. Desplegar a Cloud Run (Backend API)

### 4.1 Build y push a Artifact Registry
```bash
# Crear repositorio
gcloud artifacts repositories create hub-aprendizaje \
  --location=us-central1 \
  --repository-format=docker

# Build con Cloud Build
gcloud builds submit --tag us-central1-docker.pkg.dev/hub-aprendizaje-fes/hub-aprendizaje/hub-aprendizaje:latest .
```

### 4.2 Desplegar a Cloud Run
```bash
gcloud run deploy hub-aprendizaje \
  --image=us-central1-docker.pkg.dev/hub-aprendizaje-fes/hub-aprendizaje/hub-aprendizaje:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=...,FIREBASE_ADMIN_PROJECT_ID=...,GOOGLE_CLOUD_PROJECT=...,GOOGLE_CLOUD_LOCATION=us-central1,GEMINI_MODEL=gemini-2.5-flash,STORAGE_BUCKET=..." \
  --set-secrets="FIREBASE_ADMIN_PRIVATE_KEY=firebase-admin-key:latest,FIREBASE_ADMIN_CLIENT_EMAIL=firebase-admin-email:latest" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=100
```

### 4.3 Obtener URL del servicio
```bash
CLOUD_RUN_URL=$(gcloud run services describe hub-aprendizaje --region=us-central1 --format='value(status.url)')
echo "Cloud Run URL: $CLOUD_RUN_URL"
```

---

## 5. Desplegar Frontend a Firebase Hosting

### 5.1 Actualizar NEXT_PUBLIC_APP_URL
```env
NEXT_PUBLIC_APP_URL=https://hub-aprendizaje-fes.web.app
```

### 5.2 Build estático (Next.js 16 con output: 'export' no compatible con dynamic routes)
**Opción A: Cloud Run para todo (recomendado)**
```bash
# El mismo servicio Cloud Run sirve tanto API como frontend
# No se necesita Firebase Hosting separado
```

**Opción B: Firebase Hosting + Cloud Run (para SSR)**
```bash
# Configurar rewrites en firebase.json para pasar a Cloud Run
firebase deploy --only hosting
```

---

## 6. Configurar Dominio Personalizado (Opcional)

```bash
# Firebase Hosting
firebase hosting:channel:deploy production

# O en Cloud Run
gcloud run domain-mappings create \
  --service=hub-aprendizaje \
  --domain=aprendizaje.acatlan.unam.mx \
  --region=us-central1
```

---

## 7. Configurar Alertas y Monitoreo

```bash
# Alerta de presupuesto ($10 y $20)
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Hub Aprendizaje Budget" \
  --budget-amount=10USD \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0

# Logs de errores
gcloud logging write "hub-aprendizaje-errors" \
  --payload='{"severity":"ERROR"}' \
  --severity=ERROR
```

---

## 8. Verificación Post-Despliegue

### 8.1 Checklist funcional
- [ ] Login con cuenta @acatlan.unam.mx funciona
- [ ] Estudiante ve catálogo y filtros
- [ ] Organizador sube PDF → IA extrae → revisa → publica
- [ ] Admin ve organizadores pendientes y aprueba
- [ ] Favoritos y recordatorios funcionan
- [ ] URLs firmadas de subida expiran a 15 min
- [ ] Reglas de Firestore bloquean acceso no autorizado

### 8.2 Pruebas de carga
```bash
# Simular 100 usuarios concurrentes
hey -n 1000 -c 50 https://hub-aprendizaje-fes.web.app/api/activities
```

---

## 9. Configuración de Producción Adicional

### 9.1 Headers de seguridad (ya en next.config.ts)
```typescript
// CSP, HSTS, etc. via middleware o next.config.ts headers()
```

### 9.2 CORS para APIs
```typescript
// En route handlers, agregar headers CORS si se consume desde otro dominio
```

### 9.3 Rate limiting (recomendado)
```bash
# Cloud Armor o middleware personalizado
```

---

## 10. Rollback y Mantenimiento

```bash
# Rollback Cloud Run
gcloud run services update-traffic hub-aprendizaje --to-revisions=PREVIOUS_REVISION=100 --region=us-central1

# Ver logs
gcloud run services logs read hub-aprendizaje --region=us-central1 --limit=50

# Actualizar secretos
gcloud secrets versions add firebase-admin-key --data-file=new-key.json
```

---

## Contactos y Soporte

- **Proyecto Cloud:** `hub-aprendizaje-fes`
- **Región:** `us-central1` (Iowa) - cambiar a `northamerica-south1` (Querétaro) si requiere datos en México
- **Equipo:** Diego Herrera Hernández, Samuel Herrera Franco
- **Docente:** Diego Romero Mora
- **Institución:** FES Acatlán - UNAM