# Plan de Implementación: Hub de Aprendizaje (Plataforma Centralizada de Talleres/Cursos/Clubes con IA)

> **NOTA IMPORTANTE:** Todo el contenido del proyecto (código, comentarios, documentación, UI, mensajes de error, logs) debe estar en **español**.

## Objetivo
Build a complete Next.js 16+ web application for FES Acatlán that centralizes workshops, courses, and clubs with AI-assisted PDF/image upload for organizers, using shadcn/base-ui components as-is with wrapper-based customization, Firestore backend, Firebase Auth, and Gemini Flash for AI extraction.

## Current Context / Assumptions

**Project State:**
- Next.js 16.4.6 with App Router, React 19, Tailwind CSS 4, Turbopack
- shadcn configured with `base-luma` style, RSC enabled, `@base-ui/react` primitives
- Path aliases: `@/*` → `./*`, components at `@/components`, ui at `@/components/ui`, lib at `@/lib`
- Existing files: `app/layout.tsx`, `app/page.tsx`, `components/ui/button.tsx`, `lib/utils.ts`
- Package manager: pnpm 12.15.0
- Linting: Biome, formatting: Biome

**Architecture Decisions (from AnalisisDeImpacto.md):**
- **Backend:** Firestore (NoSQL documents) for activities, users, extractions, favorites
- **Auth:** Firebase Authentication with Google institutional accounts + custom claims for roles
- **Storage:** Cloud Storage for PDFs/images + thumbnails
- **AI:** Gemini Flash (Vertex AI) with structured JSON output for extraction
- **API:** Cloud Run container (but for this implementation: Next.js API routes as serverless functions)
- **Hosting:** Firebase Hosting (or Vercel for Next.js native)
- **Real-time:** Firestore listeners for organizer draft preview

**Role System:**
- `student` — browse, filter, favorite, reminders
- `organizer` — upload PDF/image, review AI extraction, publish activities
- `admin` — approve organizers, moderate, metrics

**Data Model (Firestore collections):**
```
actividades/{id}           // Published activities
actividades/{id}/borradores/{draftId}  // Organizer drafts pre-publish
extracciones/{id}          // Raw AI extraction JSON + confidence scores
usuarios/{uid}             // Profile + role (synced from Auth custom claims)
usuarios/{uid}/favoritos/{actividadId}  // Student favorites
```

---

## Architecture / Proposed Approach

**Frontend:** Next.js 16 App Router with RSC for data fetching, Client Components for interactivity (filters, upload, forms). Shadcn/base-ui components used directly; reusable customizations via wrapper components in `@/components/` (e.g., `ActivityCard`, `FilterSidebar`, `UploadZone`), one-off styling via inline `cn()` classnames.

**Backend:** Next.js Route Handlers (`app/api/`) for all API endpoints — signed upload URLs, activity CRUD, AI extraction trigger, favorites, auth callbacks. Firestore Admin SDK for server operations; Firebase Client SDK for real-time listener in organizer draft view.

**AI Extraction Flow:**
1. Organizer selects file → client requests signed URL from `/api/upload/signed-url`
2. Client uploads directly to Cloud Storage
3. Client calls `/api/activities/extract` with file path
4. Server calls Vertex AI Gemini Flash with structured prompt + schema
5. Server saves raw extraction to `extracciones/{id}` + draft to `actividades/{id}/borradores/{draftId}`
6. Organizer sees real-time draft via Firestore `onSnapshot`, edits, then publishes via `/api/activities/publish`

**Routing Structure:**
```
/                           # Public catalog (SSR) — search, filters, activity cards
/actividad/[id]             # Activity detail page (SSR) — full info, register link
/login                      # Auth page — Google sign-in, role redirect
/dashboard                  # Role-based dashboard (client)
/dashboard/organizer/nueva  # Upload + AI extraction wizard (client)
/dashboard/organizer/borradores  # Draft list with real-time preview (client)
/dashboard/organizer/actividades  # Published activities management (client)
/dashboard/admin            # Admin panel: pending organizers, moderation, metrics (client)
/perfil                     # User profile, favorites, reminders (client)
/api/auth/callback          # Firebase Auth custom claims sync
/api/upload/signed-url      # POST → { uploadUrl, filePath }
/api/activities             # GET (list with filters), POST (create manual)
/api/activities/[id]        # GET, PATCH, DELETE
/api/activities/extract     # POST { filePath } → { extractionId, draftId }
/api/activities/publish     # POST { draftId } → { activityId }
/api/favorites              # GET, POST, DELETE
/api/admin/organizers       # GET (pending), PATCH (approve/reject)
/api/admin/metrics          # GET (dashboard stats)
```

---

## Step-by-Step Tasks

### Phase 0: Project Setup & Configuration (30 min)

#### Task 0.1: Install Required Dependencies
```bash
cd /Users/luis/UNAM/nube/cctc
pnpm add firebase firebase-admin @google-cloud/vertexai @google-cloud/storage zod react-hook-form @hookform/resolvers date-fns lucide-react
pnpm add -D @types/node firebase-functions-test
```

**Expected:** All packages installed, `pnpm run build` passes.

#### Task 0.2: Create Environment Configuration
**File:** `.env.local` (create, never commit)
```env
# Firebase Client (public)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (server only)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=service_account@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"

# Vertex AI / Gemini
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_CLOUD_LOCATION=us-central1
GEMINI_MODEL=gemini-1.5-flash

# Cloud Storage
STORAGE_BUCKET=your_project.appspot.com
```

**File:** `.env.example` (commit this)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=us-central1
GEMINI_MODEL=gemini-1.5-flash
STORAGE_BUCKET=
```

#### Task 0.3: Create Firebase Client & Admin Initialization
**File:** `lib/firebase/client.ts`
```ts
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (typeof window !== 'undefined') {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };
```

**File:** `lib/firebase/admin.ts`
```ts
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

const serviceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
};

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: Storage;

if (getApps().length === 0) {
  adminApp = initializeApp({ credential: cert(serviceAccount) });
} else {
  adminApp = getApps()[0];
}
adminAuth = getAuth(adminApp);
adminDb = getFirestore(adminApp);
adminStorage = getStorage(adminApp);

export { adminApp, adminAuth, adminDb, adminStorage };
```

#### Task 0.4: Create TypeScript Types & Zod Schemas
**File:** `lib/types/activity.ts`
```ts
import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Base activity fields shared by all types
export const activityBaseSchema = z.object({
  titulo: z.string().min(3).max(120),
  tipo: z.enum(['taller', 'curso', 'club']),
  area: z.string().min(2).max(60),
  descripcion: z.string().min(10).max(5000),
  modalidad: z.enum(['presencial', 'virtual', 'hibrido']),
  sede: z.string().max(120).optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal('')),
  cupo: z.number().int().positive().optional(),
  costo: z.number().nonnegative().default(0),
  moneda: z.enum(['MXN', 'USD', 'GRATIS']).default('GRATIS'),
  requisitos: z.string().max(2000).optional(),
  organizadorId: z.string(),
  organizadorNombre: z.string(),
  enlaceInscripcion: z.string().url().optional().or(z.literal('')),
  etiquetas: z.array(z.string()).default([]),
  estado: z.enum(['borrador', 'publicado', 'archivado', 'rechazado']).default('borrador'),
  createdAt: z.custom<Timestamp>(),
  updatedAt: z.custom<Timestamp>(),
  publishedAt: z.custom<Timestamp>().optional(),
});

// Course/Workshop specific: sessions array
export const sesionSchema = z.object({
  fecha: z.custom<Timestamp>(),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
  tema: z.string().max(120).optional(),
  sede: z.string().max(120).optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal('')),
});

export const cursoTallerSchema = activityBaseSchema.extend({
  sesiones: z.array(sesionSchema).min(1),
  fechaInicio: z.custom<Timestamp>(),
  fechaFin: z.custom<Timestamp>(),
}).refine((data) => data.tipo === 'curso' || data.tipo === 'taller', {
  message: 'Solo para cursos y talleres',
});

// Club specific: recurring schedule
export const horarioRecurrenteSchema = z.object({
  diaSemana: z.number().int().min(0).max(6), // 0=Domingo
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
  sede: z.string().max(120).optional(),
  enlaceVirtual: z.string().url().optional().or(z.literal('')),
});

export const clubSchema = activityBaseSchema.extend({
  horarios: z.array(horarioRecurrenteSchema).min(1),
  fechaInicio: z.custom<Timestamp>(), // When club starts
  fechaFin: z.custom<Timestamp>().optional(), // Optional end date
}).refine((data) => data.tipo === 'club', {
  message: 'Solo para clubes',
});

export const activitySchema = z.discriminatedUnion('tipo', [
  cursoTallerSchema,
  clubSchema,
]);

export type ActivityBase = z.infer<typeof activityBaseSchema>;
export type CursoTaller = z.infer<typeof cursoTallerSchema>;
export type Club = z.infer<typeof clubSchema>;
export type Activity = z.infer<typeof activitySchema>;

// Extraction result from AI
export const extractionSchema = z.object({
  actividad: activitySchema.partial(),
  confianza: z.record(z.string(), z.number().min(0).max(1)), // field -> confidence 0-1
  camposFaltantes: z.array(z.string()),
  textoCrudo: z.string(),
  archivoPath: z.string(),
  createdAt: z.custom<Timestamp>(),
});

export type Extraction = z.infer<typeof extractionSchema>;

// User profile
export const userProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  nombre: z.string().max(100),
  carrera: z.string().max(100).optional(),
  rol: z.enum(['estudiante', 'organizador', 'admin']).default('estudiante'),
  organizadorAprobado: z.boolean().default(false),
  createdAt: z.custom<Timestamp>(),
  updatedAt: z.custom<Timestamp>(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
```

#### Task 0.5: Create Utility Functions
**File:** `lib/utils/activity.ts`
```ts
import { cn } from '@/lib/utils';
import type { Activity, CursoTaller, Club } from '@/lib/types/activity';
import { Timestamp } from 'firebase/firestore';

export function isCursoTaller(activity: Activity): activity is CursoTaller {
  return activity.tipo === 'curso' || activity.tipo === 'taller';
}

export function isClub(activity: Activity): activity is Club {
  return activity.tipo === 'club';
}

export function getFechaInicio(activity: Activity): Timestamp {
  return activity.fechaInicio;
}

export function getFechaFin(activity: Activity): Timestamp | undefined {
  if (isCursoTaller(activity)) return activity.fechaFin;
  return activity.fechaFin;
}

export function getProximasSesiones(activity: Activity, limit = 3) {
  if (isCursoTaller(activity)) {
    return activity.sesiones
      .filter((s) => s.fecha.toMillis() >= Date.now())
      .sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis())
      .slice(0, limit);
  }
  return [];
}

export function formatActivityType(tipo: Activity['tipo']): string {
  const labels = { taller: 'Taller', curso: 'Curso', club: 'Club' };
  return labels[tipo];
}

export function getTypeBadgeClass(tipo: Activity['tipo']): string {
  const classes = {
    taller: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    curso: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    club: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', classes[tipo]);
}

export function getModalidadBadgeClass(modalidad: Activity['modalidad']): string {
  const classes = {
    presencial: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
    virtual: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    hibrido: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', classes[modalidad]);
}
```

---

### Phase 1: Core UI Components & Wrappers (60 min)

#### Task 1.1: Create shadcn Wrapper Components
**File:** `components/ui/card.tsx` (shadcn card wrapper)
```tsx
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
export function Card({ className, ...props }: CardProps) {
  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)} {...props} />
  );
}
export function CardHeader({ className, ...props }: CardProps) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}
export function CardTitle({ className, ...props }: CardProps) {
  return <h3 className={cn('text-xl font-semibold leading-none tracking-tight', className)} {...props} />;
}
export function CardDescription({ className, ...props }: CardProps) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}
export function CardFooter({ className, ...props }: CardProps) {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}
```

**File:** `components/ui/input.tsx`
```tsx
import { cn } from '@/lib/utils';
import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
```

**File:** `components/ui/select.tsx` (using base-ui select)
```tsx
'use client';
import { cn } from '@/lib/utils';
import {
  Select as SelectPrimitive,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectLabel,
} from '@base-ui/react/select';
import { ChevronDown, Check } from 'lucide-react';
import { forwardRef, type HTMLAttributes } from 'react';

interface SelectProps extends HTMLAttributes<HTMLDivElement> {}
export const Select = forwardRef<HTMLDivElement, SelectProps>(({ className, children, ...props }, ref) => (
  <SelectPrimitive ref={ref} className={cn('w-full', className)} {...props}>
    {children}
  </SelectPrimitive>
));
Select.displayName = 'Select';

interface SelectTriggerProps extends React.ComponentPropsWithoutRef<typeof SelectTrigger> {}
export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => (
    <SelectTrigger
      ref={ref}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectTrigger>
  )
);
SelectTrigger.displayName = 'SelectTrigger';

export const SelectValue = SelectValue;

interface SelectContentProps extends React.ComponentPropsWithoutRef<typeof SelectContent> {}
export const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, position = 'popper', ...props }, ref) => (
    <SelectContent
      ref={ref}
      className={cn('relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md', className)}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport>
        {children}
      </SelectPrimitive.Viewport>
    </SelectContent>
  )
);
SelectContent.displayName = 'SelectContent';

interface SelectItemProps extends React.ComponentPropsWithoutRef<typeof SelectItem> {}
export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, ...props }, ref) => (
    <SelectItem
      ref={ref}
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectItem>
  )
);
SelectItem.displayName = 'SelectItem';

export const SelectSeparator = SelectSeparator;
export const SelectLabel = SelectLabel;
```

**File:** `components/ui/badge.tsx`
```tsx
import { cn } from '@/lib/utils';
import { type HTMLAttributes, forwardRef } from 'react';

export const Badge = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
      secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
      destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
      outline: 'text-foreground',
      success: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      warning: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      info: 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    };
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';
```

**File:** `components/ui/tabs.tsx` (using base-ui tabs)
```tsx
'use client';
import { cn } from '@/lib/utils';
import { Tabs as TabsPrimitive, TabsList, TabsTrigger, TabsContent } from '@base-ui/react/tabs';
import { forwardRef, type HTMLAttributes } from 'react';

interface TabsProps extends HTMLAttributes<HTMLDivElement> {}
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(({ className, children, ...props }, ref) => (
  <TabsPrimitive ref={ref} className={cn('w-full', className)} {...props}>
    {children}
  </TabsPrimitive>
));
Tabs.displayName = 'Tabs';

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {}
export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => (
    <TabsList
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </TabsList>
  )
);
TabsList.displayName = 'TabsList';

interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsTrigger> {}
export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, children, ...props }, ref) => (
    <TabsTrigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </TabsTrigger>
  )
);
TabsTrigger.displayName = 'TabsTrigger';

interface TabsContentProps extends React.ComponentPropsWithoutRef<typeof TabsContent> {}
export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, children, ...props }, ref) => (
    <TabsContent
      ref={ref}
      className={cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}
      {...props}
    >
      {children}
    </TabsContent>
  )
);
TabsContent.displayName = 'TabsContent';
```

**File:** `components/ui/dialog.tsx` (using base-ui dialog)
```tsx
'use client';
import { cn } from '@/lib/utils';
import {
  Dialog as DialogPrimitive,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { forwardRef, type HTMLAttributes } from 'react';

interface DialogProps extends HTMLAttributes<HTMLDivElement> {}
export const Dialog = forwardRef<HTMLDivElement, DialogProps>(({ className, children, ...props }, ref) => (
  <DialogPrimitive ref={ref} className={cn('', className)} {...props}>
    {children}
  </DialogPrimitive>
));
Dialog.displayName = 'Dialog';

export const DialogTrigger = DialogTrigger;
export const DialogPortal = DialogPortal;
export const DialogOverlay = DialogOverlay;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogContent> {}
export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => (
    <DialogContent
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogContent>
  )
);
DialogContent.displayName = 'DialogContent';

export const DialogClose = DialogClose;
export const DialogTitle = DialogTitle;
export const DialogDescription = DialogDescription;
```

**File:** `components/ui/dropdown-menu.tsx` (using base-ui menu)
```tsx
'use client';
import { cn } from '@/lib/utils';
import {
  Menu as MenuPrimitive,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuLabel,
  MenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSubTrigger,
  MenuSubContent,
} from '@base-ui/react/menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { forwardRef, type HTMLAttributes } from 'react';

interface MenuProps extends HTMLAttributes<HTMLDivElement> {}
export const Menu = forwardRef<HTMLDivElement, MenuProps>(({ className, children, ...props }, ref) => (
  <MenuPrimitive ref={ref} className={cn('', className)} {...props}>
    {children}
  </MenuPrimitive>
));
Menu.displayName = 'Menu';

export const MenuTrigger = MenuTrigger;

interface MenuContentProps extends React.ComponentPropsWithoutRef<typeof MenuContent> {}
export const MenuContent = forwardRef<HTMLDivElement, MenuContentProps>(
  ({ className, children, ...props }, ref) => (
    <MenuContent
      ref={ref}
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </MenuContent>
  )
);
MenuContent.displayName = 'MenuContent';

interface MenuItemProps extends React.ComponentPropsWithoutRef<typeof MenuItem> {}
export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  ({ className, inset, children, ...props }, ref) => (
    <MenuItem
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        className
      )}
      {...props}
    >
      {children}
    </MenuItem>
  )
);
MenuItem.displayName = 'MenuItem';

export const MenuSeparator = MenuSeparator;
export const MenuLabel = MenuLabel;

interface MenuCheckboxItemProps extends React.ComponentPropsWithoutRef<typeof MenuCheckboxItem> {}
export const MenuCheckboxItem = forwardRef<HTMLDivElement, MenuCheckboxItemProps>(
  ({ className, children, checked, ...props }, ref) => (
    <MenuCheckboxItem
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuCheckboxItem>
  )
);
MenuCheckboxItem.displayName = 'MenuCheckboxItem';

export const MenuRadioGroup = MenuRadioGroup;

interface MenuRadioItemProps extends React.ComponentPropsWithoutRef<typeof MenuRadioItem> {}
export const MenuRadioItem = forwardRef<HTMLDivElement, MenuRadioItemProps>(
  ({ className, children, ...props }, ref) => (
    <MenuRadioItem
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Circle className="h-2 w-2 fill-current" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuRadioItem>
  )
);
MenuRadioItem.displayName = 'MenuRadioItem';

interface MenuSubTriggerProps extends React.ComponentPropsWithoutRef<typeof MenuSubTrigger> {}
export const MenuSubTrigger = forwardRef<HTMLDivElement, MenuSubTriggerProps>(
  ({ className, inset, children, ...props }, ref) => (
    <MenuSubTrigger
      ref={ref}
      className={cn(
        'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </MenuSubTrigger>
  )
);
MenuSubTrigger.displayName = 'MenuSubTrigger';

export const MenuSubContent = MenuSubContent;
```

#### Task 1.2: Create Application-Specific Wrapper Components
**File:** `components/ActivityCard.tsx`
```tsx
'use client';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Clock, Users, Bookmark, Share2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Activity } from '@/lib/types/activity';
import { formatActivityType, getTypeBadgeClass, getModalidadBadgeClass, getProximasSesiones } from '@/lib/utils/activity';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ActivityCardProps {
  activity: Activity;
  onFavorite?: (id: string) => void;
  isFavorite?: boolean;
  variant?: 'default' | 'compact';
}

export function ActivityCard({ activity, onFavorite, isFavorite, variant = 'default' }: ActivityCardProps) {
  const proximasSesiones = getProximasSesiones(activity);
  const primeraSesion = proximasSesiones[0];
  const esCursoTaller = activity.tipo === 'curso' || activity.tipo === 'taller';

  return (
    <Card className={cn('flex flex-col h-full transition-shadow hover:shadow-md', variant === 'compact' && 'max-w-sm')}>
      <CardContent className="flex flex-col flex-1 p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge className={getTypeBadgeClass(activity.tipo)}>{formatActivityType(activity.tipo)}</Badge>
          <Badge variant="outline" className={getModalidadBadgeClass(activity.modalidad)}>
            {activity.modalidad}
          </Badge>
        </div>
        <h3 className="text-lg font-semibold text-foreground line-clamp-2">{activity.titulo}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1 flex-1">{activity.descripcion}</p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-3">
          {primeraSesion && (
            <>
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{format(primeraSesion.fecha.toDate(), 'dd MMM yyyy', { locale: es })}</span>
            </>
          )}
          {esCursoTaller && activity.sesiones.length > 1 && (
            <>
              <BookMark className="h-3.5 w-3.5 shrink-0" />
              <span>{activity.sesiones.length} sesiones</span>
            </>
          )}
          {activity.sede && (
            <>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[120px]">{activity.sede}</span>
            </>
          )}
          {activity.enlaceVirtual && !activity.sede && (
            <>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span>Virtual</span>
            </>
          )}
          {activity.cupo && (
            <>
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>Cupo: {activity.cupo}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {activity.etiquetas.slice(0, 3).map((etiqueta) => (
            <Badge key={etiqueta} variant="secondary" className="text-xs">{etiqueta}</Badge>
          ))}
          {activity.etiquetas.length > 3 && (
            <Badge variant="outline" className="text-xs">+{activity.etiquetas.length - 3}</Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-2">
          {onFavorite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onFavorite(activity.id)}
              className={cn('h-8 w-8', isFavorite && 'text-primary')}
              aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            >
              <Bookmark className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Compartir">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" asChild>
          <a href={`/actividad/${activity.id}`}>Ver detalles</a>
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**File:** `components/FilterSidebar.tsx`
```tsx
'use client';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calendar, X, Filter, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const TIPOS = ['taller', 'curso', 'club'] as const;
const AREAS = ['Programación', 'Diseño', 'Ciencias', 'Humanidades', 'Idiomas', 'Deportes', 'Artes', 'Emprendimiento', 'Otro'];
const MODALIDADES = ['presencial', 'virtual', 'hibrido'] as const;

export function FilterSidebar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const createQueryString = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) sp.set(key, value);
      else sp.delete(key);
    });
    return sp.toString();
  };

  const handleChange = (key: string, value: string) => {
    router.push(`${pathname}?${createQueryString({ [key]: value })}`);
  };

  const clearFilters = () => {
    router.push(pathname);
  };

  const hasFilters = ['q', 'tipo', 'area', 'modalidad', 'fechaDesde', 'fechaHasta', 'costo'].some((k) => searchParams.get(k));

  return (
    <aside className={cn('fixed inset-0 z-40 flex lg:hidden', isOpen ? 'block' : 'hidden')}>
      <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
      <div className="fixed left-0 top-0 h-full w-full max-w-sm bg-background shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Filtros</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <FilterSection searchParams={searchParams} onChange={handleChange} />
        </div>
        {hasFilters && (
          <div className="p-4 border-t">
            <Button variant="outline" className="w-full" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}

function FilterSection({ searchParams, onChange }: { searchParams: URLSearchParams; onChange: (k: string, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Buscar</label>
        <Input
          placeholder="Título, área, organizador..."
          value={searchParams.get('q') || ''}
          onChange={(e) => onChange('q', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tipo</label>
        <Select value={searchParams.get('tipo') || ''} onValueChange={(v) => onChange('tipo', v)}>
          <SelectTrigger><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
          <SelectContent>
            {TIPOS.map((t) => (
              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Área</label>
        <Select value={searchParams.get('area') || ''} onValueChange={(v) => onChange('area', v)}>
          <SelectTrigger><SelectValue placeholder="Todas las áreas" /></SelectTrigger>
          <SelectContent>
            {AREAS.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Modalidad</label>
        <Select value={searchParams.get('modalidad') || ''} onValueChange={(v) => onChange('modalidad', v)}>
          <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            {MODALIDADES.map((m) => (
              <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium mb-1">Desde</label>
          <Input
            type="date"
            value={searchParams.get('fechaDesde') || ''}
            onChange={(e) => onChange('fechaDesde', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hasta</label>
          <Input
            type="date"
            value={searchParams.get('fechaHasta') || ''}
            onChange={(e) => onChange('fechaHasta', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Costo</label>
        <Select value={searchParams.get('costo') || ''} onValueChange={(v) => onChange('costo', v)}>
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gratis">Solo gratis</SelectItem>
            <SelectItem value="pago">Con costo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function FilterBar() {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const hasFilters = ['q', 'tipo', 'area', 'modalidad', 'fechaDesde', 'fechaHasta', 'costo'].some((k) => searchParams.get(k));

  return (
    <div className="hidden lg:flex lg:items-center lg:gap-3 lg:p-4 lg:border-b sticky lg:top-0 lg:bg-background/95 lg:backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex-1 max-w-xs">
        <Input
          placeholder="Buscar actividades..."
          value={searchParams.get('q') || ''}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) params.set('q', e.target.value);
            else params.delete('q');
            window.history.replaceState(null, '', `?${params.toString()}`);
          }}
        />
      </div>
      <Select value={searchParams.get('tipo') || ''} onValueChange={(v) => updateParam('tipo', v)} className="w-[140px]">
        <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
        <SelectContent>
          {TIPOS.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={searchParams.get('area') || ''} onValueChange={(v) => updateParam('area', v)} className="w-[160px]">
        <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
        <SelectContent>
          {AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={searchParams.get('modalidad') || ''} onValueChange={(v) => updateParam('modalidad', v)} className="w-[140px]">
        <SelectTrigger><SelectValue placeholder="Modalidad" /></SelectTrigger>
        <SelectContent>
          {MODALIDADES.map((m) => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" className="hidden sm:flex">
        <Calendar className="h-4 w-4 mr-1" />
        Fecha
      </Button>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => window.location.href = window.location.pathname}>
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      )}
      <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setIsOpen(true)}>
        <Filter className="h-4 w-4" />
      </Button>
    </div>
  );
}

function updateParam(key: string, value: string) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(key, value);
  else params.delete(key);
  window.history.replaceState(null, '', `?${params.toString()}`);
}
```

**File:** `components/UploadZone.tsx`
```tsx
'use client';
import { useCallback, useState, DragEvent, ChangeEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

type FileType = 'pdf' | 'image';
type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface UploadZoneProps {
  onUploadComplete: (filePath: string, fileType: FileType) => void;
  onError?: (message: string) => void;
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

export function UploadZone({ onUploadComplete, onError, maxSizeMB = 10, acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] }: UploadZoneProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (f: File): FileType | null => {
    if (!acceptedTypes.includes(f.type)) {
      setError('Tipo de archivo no permitido. Use PDF, JPG, PNG o WebP.');
      return null;
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo excede ${maxSizeMB} MB.`);
      return null;
    }
    return f.type === 'application/pdf' ? 'pdf' : 'image';
  };

  const handleFileSelect = useCallback((f: File) => {
    setError(null);
    const type = validateFile(f);
    if (type) {
      setFile(f);
      setStatus('idle');
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const removeFile = useCallback(() => {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, []);

  const uploadFile = async (file: File, type: FileType) => {
    setStatus('uploading');
    setProgress(0);
    setError(null);

    try {
      // 1. Get signed URL
      const response = await fetch('/api/upload/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!response.ok) throw new Error('Error obteniendo URL de subida');
      const { uploadUrl, filePath } = await response.json();

      // 2. Upload to Cloud Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('Error subiendo archivo');

      setStatus('processing');
      setProgress(100);

      // 3. Notify parent
      onUploadComplete(filePath, type);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error subiendo archivo';
      setError(message);
      onError?.(message);
      setStatus('error');
    }
  };

  const handleStartUpload = useCallback(() => {
    if (file) {
      const type = validateFile(file);
      if (type) uploadFile(file, type);
    }
  }, [file, validateFile, uploadFile]);

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">Archivo listo</p>
              <p className="text-sm text-green-600 dark:text-green-400">{file?.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={removeFile}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (file && status !== 'idle') {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {file.type === 'application/pdf' ? (
              <FileText className="h-6 w-6 text-red-600" />
            ) : (
              <Image className="h-6 w-6 text-blue-600" />
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          </div>
          {status === 'error' && (
            <Button variant="ghost" size="icon" onClick={removeFile}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300',
              status === 'error' ? 'bg-red-500' : 'bg-primary'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        {status === 'uploading' && <p className="text-sm text-muted-foreground text-center">Subiendo... {progress}%</p>}
        {status === 'processing' && (
          <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando con IA...
          </p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center flex items-center justify-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
        status === 'idle' ? 'border-muted-foreground/25 hover:border-primary/50' : 'border-primary'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        type="file"
        id="file-upload"
        accept={acceptedTypes.join(',')}
        onChange={handleInputChange}
        className="sr-only"
        disabled={status !== 'idle'}
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="h-6 w-6" />
        </div>
        <p className="text-lg font-medium">Arrastra tu PDF o imagen aquí</p>
        <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar</p>
        <p className="text-xs text-muted-foreground mt-2">Máx. {maxSizeMB} MB · PDF, JPG, PNG, WebP</p>
      </label>
      {file && status === 'idle' && (
        <Button className="mt-4" onClick={handleStartUpload}>
          <Upload className="h-4 w-4 mr-2" />
          Subir y procesar con IA
        </Button>
      )}
    </div>
  );
}
```

**File:** `components/ExtractionReviewForm.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Link2, User, AlertCircle, CheckCircle } from 'lucide-react';
import { activitySchema, type Activity, type CursoTaller, type Club, sesionSchema, horarioRecurrenteSchema } from '@/lib/types/activity';
import { Timestamp } from 'firebase/firestore';

interface ExtractionReviewFormProps {
  initialData: Partial<Activity>;
  confidence: Record<string, number>;
  onSubmit: (data: Activity) => Promise<void>;
  isSubmitting?: boolean;
}

export function ExtractionReviewForm({ initialData, confidence, onSubmit, isSubmitting }: ExtractionReviewFormProps) {
  const [tipo, setTipo] = useState(initialData.tipo || 'taller');
  const isCursoTaller = tipo === 'curso' || tipo === 'taller';

  const form = useForm<Partial<Activity>>({
    resolver: zodResolver(activitySchema.partial()),
    defaultValues: {
      ...initialData,
      sesiones: initialData.sesiones?.length ? initialData.sesiones : [{ fecha: Timestamp.now(), horaInicio: '09:00', horaFin: '11:00' }],
      horarios: initialData.horarios?.length ? initialData.horarios : [{ diaSemana: 1, horaInicio: '16:00', horaFin: '18:00' }],
      etiquetas: initialData.etiquetas || [],
      modalidad: initialData.modalidad || 'presencial',
      costo: initialData.costo || 0,
      moneda: initialData.moneda || 'GRATIS',
    },
    mode: 'onChange',
  });

  const { fields: sesionesFields, append: appendSesion, remove: removeSesion } = useFieldArray({ control: form.control, name: 'sesiones' });
  const { fields: horariosFields, append: appendHorario, remove: removeHorario } = useFieldArray({ control: form.control, name: 'horarios' });
  const { fields: etiquetasFields, append: appendEtiqueta, remove: removeEtiqueta } = useFieldArray({ control: form.control, name: 'etiquetas' });

  const getConfidence = (field: string) => confidence[field] ?? 1;
  const getConfidenceClass = (field: string) => {
    const c = getConfidence(field);
    if (c >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (c >= 0.5) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  const handleTipoChange = (value: string) => {
    setTipo(value as Activity['tipo']);
    form.setValue('tipo', value as Activity['tipo'], { shouldValidate: true });
    if (value === 'club') {
      form.setValue('sesiones', undefined);
      form.setValue('fechaFin', undefined);
    } else {
      form.setValue('horarios', undefined);
      form.setValue('fechaFin', Timestamp.now());
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-lg border p-4 bg-muted/50">
        <h3 className="font-medium mb-3">Tipo de actividad</h3>
        <div className="flex gap-3">
          {(['taller', 'curso', 'club'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={tipo === t ? 'default' : 'outline'}
              onClick={() => handleTipoChange(t)}
              className="flex-1"
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="titulo"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Título *</label>
              <Input {...field} placeholder="Título de la actividad" />
              {getConfidence('titulo') < 1 && (
                <Badge className={cn('mt-1', getConfidenceClass('titulo'))} variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Confianza: {Math.round(getConfidence('titulo') * 100)}%
                </Badge>
              )}
            </div>
          )}
        />
        <Controller
          name="area"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Área *</label>
              <Select
                value={field.value || ''}
                onValueChange={(v) => field.onChange(v)}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                <SelectContent>
                  {['Programación', 'Diseño', 'Ciencias', 'Humanidades', 'Idiomas', 'Deportes', 'Artes', 'Emprendimiento', 'Otro'].map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />
      </div>

      <Controller
        name="descripcion"
        control={form.control}
        render={({ field }) => (
          <div>
            <label className="block text-sm font-medium mb-1">Descripción *</label>
            <Textarea {...field} rows={4} placeholder="Describe la actividad..." />
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="modalidad"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Modalidad *</label>
              <Select value={field.value || 'presencial'} onValueChange={(v) => field.onChange(v)}>
                <SelectTrigger><SelectValue placeholder="Modalidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        />
        <Controller
          name="costo"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Costo</label>
              <Input type="number" min="0" step="1" {...field} placeholder="0" />
            </div>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="sede"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                Sede <MapPin className="h-3.5 w-3.5" />
              </label>
              <Input {...field} placeholder="Edificio, aula, campus" />
            </div>
          )}
        />
        <Controller
          name="enlaceVirtual"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                Enlace virtual <Link2 className="h-3.5 w-3.5" />
              </label>
              <Input type="url" {...field} placeholder="https://meet.google.com/..." />
            </div>
          )}
        />
      </div>

      {isCursoTaller ? (
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Sesiones
          </h4>
          {sesionesFields.map((sesion, index) => (
            <div key={sesion.id} className="grid gap-3 sm:grid-cols-4 items-end">
              <Controller
                name={`sesiones.${index}.fecha`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha</label>
                    <Input type="date" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`sesiones.${index}.horaInicio`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Hora inicio</label>
                    <Input type="time" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`sesiones.${index}.horaFin`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Hora fin</label>
                    <Input type="time" {...field} />
                  </div>
                )}
              />
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSesion(index)} disabled={sesionesFields.length === 1}>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => appendSesion({ fecha: Timestamp.now(), horaInicio: '09:00', horaFin: '11:00' })}>
            + Agregar sesión
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horarios recurrentes
          </h4>
          {horariosFields.map((horario, index) => (
            <div key={horario.id} className="grid gap-3 sm:grid-cols-5 items-end">
              <Controller
                name={`horarios.${index}.diaSemana`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Día</label>
                    <Select value={String(field.value ?? '')} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Día" /></SelectTrigger>
                      <SelectContent>
                        {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((d, i) => (
                          <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <Controller
                name={`horarios.${index}.horaInicio`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Inicio</label>
                    <Input type="time" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`horarios.${index}.horaFin`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Fin</label>
                    <Input type="time" {...field} />
                  </div>
                )}
              />
              <Controller
                name={`horarios.${index}.sede`}
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="block text-sm font-medium mb-1">Sede</label>
                    <Input {...field} placeholder="Edificio, aula" />
                  </div>
                )}
              />
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeHorario(index)} disabled={horariosFields.length === 1}>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => appendHorario({ diaSemana: 1, horaInicio: '16:00', horaFin: '18:00' })}>
            + Agregar horario
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Etiquetas</label>
        <div className="flex flex-wrap gap-2">
          {etiquetasFields.map((etiqueta, index) => (
            <Badge key={etiqueta.id} variant="secondary" className="gap-1">
              <Controller
                name={`etiquetas.${index}`}
                control={form.control}
                render={({ field }) => <Input {...field} className="bg-transparent border-0 py-0 h-6 text-sm" placeholder="Etiqueta" />}
              />
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeEtiqueta(index)}>
                <AlertCircle className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => appendEtiqueta('')}>
            + Etiqueta
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="cupo"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Cupo máximo</label>
              <Input type="number" min="1" {...field} placeholder="Sin límite" />
            </div>
          )}
        />
        <Controller
          name="enlaceInscripcion"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">Enlace de inscripción</label>
              <Input type="url" {...field} placeholder="https://forms.gle/..." />
            </div>
          )}
        />
      </div>

      <Controller
        name="requisitos"
        control={form.control}
        render={({ field }) => (
          <div>
            <label className="block text-sm font-medium mb-1">Requisitos</label>
            <Textarea {...field} rows={3} placeholder="Conocimientos previos, materiales necesarios..." />
          </div>
        )}
      />

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => form.reset(initialData)}>
          Descartar cambios
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Publicando...' : 'Publicar actividad'}
        </Button>
      </div>
    </form>
  );
}
```

**File:** `components/ui/textarea.tsx`
```tsx
import { cn } from '@/lib/utils';
import { forwardRef, type TextareaHTMLAttributes } from 'react';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
```

---

### Phase 2: API Routes (90 min)

#### Task 2.1: Create API Utilities & Middleware
**File:** `lib/api/auth.ts`
```ts
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { type UserRecord } from 'firebase-admin/auth';

export async function getServerSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userDoc = await adminDb.collection('usuarios').doc(decodedClaims.uid).get();
    return {
      uid: decodedClaims.uid,
      email: decodedClaims.email,
      role: decodedClaims.role || 'estudiante',
      organizadorAprobado: decodedClaims.organizadorAprobado || false,
      profile: userDoc.exists ? userDoc.data() : null,
    };
  } catch {
    return null;
  }
}

export async function requireRole(allowedRoles: string[]) {
  const session = await getServerSession();
  if (!session) throw new Error('UNAUTHORIZED');
  if (!allowedRoles.includes(session.role)) throw new Error('FORBIDDEN');
  return session;
}

export async function createSessionCookie(idToken: string) {
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
  return sessionCookie;
}

export async function setCustomClaims(uid: string, claims: Record<string, unknown>) {
  await adminAuth.setCustomUserClaims(uid, claims);
  // Update Firestore profile
  await adminDb.collection('usuarios').doc(uid).update({
    rol: claims.rol,
    organizadorAprobado: claims.organizadorAprobado || false,
    updatedAt: new Date(),
  });
}
```

**File:** `lib/api/validation.ts`
```ts
import { z } from 'zod';

export const activityListQuerySchema = z.object({
  q: z.string().optional(),
  tipo: z.enum(['taller', 'curso', 'club']).optional(),
  area: z.string().optional(),
  modalidad: z.enum(['presencial', 'virtual', 'hibrido']).optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  costo: z.enum(['gratis', 'pago']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  sort: z.enum(['fechaAsc', 'fechaDesc', 'titulo']).default('fechaAsc'),
});

export const signedUrlRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
});

export const extractRequestSchema = z.object({
  filePath: z.string().min(1),
});

export const publishRequestSchema = z.object({
  draftId: z.string().min(1),
});

export const favoriteRequestSchema = z.object({
  actividadId: z.string().min(1),
});

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`VALIDATION_ERROR: ${result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
  }
  return result.data;
}
```

**File:** `lib/api/response.ts`
```ts
export function success<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function error(message: string, status = 400, details?: unknown) {
  return Response.json({ success: false, error: message, details }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === 'UNAUTHORIZED') return error('No autenticado', 401);
    if (err.message === 'FORBIDDEN') return error('Sin permisos', 403);
    if (err.message.startsWith('VALIDATION_ERROR:')) return error(err.message.replace('VALIDATION_ERROR: ', ''), 400);
    if (err.message.includes('not-found')) return error('No encontrado', 404);
    console.error('API Error:', err);
    return error('Error interno del servidor', 500);
  }
  return error('Error desconocido', 500);
}
```

#### Task 2.2: Auth Callback Route
**File:** `app/api/auth/callback/route.ts`
```ts
import { createSessionCookie, setCustomClaims } from '@/lib/api/auth';
import { adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { idToken, role } = await request.json();
    if (!idToken) return NextResponse.json({ error: 'ID token requerido' }, { status: 400 });

    const sessionCookie = await createSessionCookie(idToken);
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // Default role is estudiante, organizador requires approval
    const customClaims = {
      rol: role === 'organizador' ? 'organizador' : 'estudiante',
      organizadorAprobado: role === 'organizador' ? false : undefined,
    };
    await setCustomClaims(uid, customClaims);

    const cookieStore = await cookies();
    cookieStore.set('__session', sessionCookie, {
      maxAge: 60 * 60 * 24 * 5,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({ success: true, role: customClaims.rol });
  } catch (err) {
    console.error('Auth callback error:', err);
    return NextResponse.json({ error: 'Error en autenticación' }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('__session');
  return NextResponse.json({ success: true });
}
```

#### Task 2.3: Signed Upload URL Route
**File:** `app/api/upload/signed-url/route.ts`
```ts
import { adminStorage } from '@/lib/firebase/admin';
import { validateRequest, signedUrlRequestSchema } from '@/lib/api/validation';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession } from '@/lib/api/auth';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'organizador' || !session.organizadorAprobado) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    const body = await request.json();
    const { fileName, contentType } = validateRequest(signedUrlRequestSchema, body);

    const bucket = adminStorage.bucket(process.env.STORAGE_BUCKET!);
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `uploads/${session.uid}/${timestamp}_${sanitizedName}`;
    const file = bucket.file(filePath);

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    return success({ uploadUrl, filePath });
  } catch (err) {
    return handleApiError(err);
  }
}
```

#### Task 2.4: AI Extraction Route
**File:** `app/api/activities/extract/route.ts`
```ts
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { VertexAI } from '@google-cloud/vertexai';
import { validateRequest, extractRequestSchema } from '@/lib/api/validation';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp, FieldValue } from 'firebase/firestore';
import { activitySchema, extractionSchema } from '@/lib/types/activity';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
});

const generativeModel = vertexAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL!,
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        titulo: { type: 'STRING' },
        tipo: { type: 'STRING', enum: ['taller', 'curso', 'club'] },
        area: { type: 'STRING' },
        descripcion: { type: 'STRING' },
        modalidad: { type: 'STRING', enum: ['presencial', 'virtual', 'hibrido'] },
        sede: { type: 'STRING' },
        enlaceVirtual: { type: 'STRING' },
        cupo: { type: 'INTEGER' },
        costo: { type: 'NUMBER' },
        moneda: { type: 'STRING', enum: ['MXN', 'USD', 'GRATIS'] },
        requisitos: { type: 'STRING' },
        enlaceInscripcion: { type: 'STRING' },
        etiquetas: { type: 'ARRAY', items: { type: 'STRING' } },
        sesiones: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              fecha: { type: 'STRING', format: 'date-time' },
              horaInicio: { type: 'STRING' },
              horaFin: { type: 'STRING' },
              tema: { type: 'STRING' },
              sede: { type: 'STRING' },
              enlaceVirtual: { type: 'STRING' },
            },
          },
        },
        horarios: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              diaSemana: { type: 'INTEGER' },
              horaInicio: { type: 'STRING' },
              horaFin: { type: 'STRING' },
              sede: { type: 'STRING' },
              enlaceVirtual: { type: 'STRING' },
            },
          },
        },
        fechaInicio: { type: 'STRING', format: 'date-time' },
        fechaFin: { type: 'STRING', format: 'date-time' },
      },
      required: ['titulo', 'tipo', 'area', 'descripcion', 'modalidad', 'fechaInicio'],
    },
  },
  systemInstruction: `Eres un asistente que extrae información de carteles y PDFs de actividades académicas (talleres, cursos, clubes) para una universidad. 
Extrae TODOS los campos posibles. Si un campo no aparece, omítelo (no lo inventes). 
Para fechas, usa ISO 8601. Para horarios, usa HH:mm (24h).
tipo: "taller" (corta duración, 1-3 sesiones), "curso" (múltiples sesiones, semanas/meses), "club" (recurrente semanal).
modalidad: "presencial", "virtual", "hibrido".
moneda: "MXN", "USD", "GRATIS".
Devuelve SOLO el JSON válido.`,
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'organizador' || !session.organizadorAprobado) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    const body = await request.json();
    const { filePath } = validateRequest(extractRequestSchema, body);

    // Download file from Cloud Storage
    const bucket = adminStorage.bucket(process.env.STORAGE_BUCKET!);
    const file = bucket.file(filePath);
    const [buffer] = await file.download();
    const mimeType = filePath.endsWith('.pdf') ? 'application/pdf' : 
                     filePath.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg' :
                     filePath.match(/\.png$/i) ? 'image/png' : 'image/webp';

    // Call Gemini
    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: buffer.toString('base64') } },
            { text: 'Extrae la información de esta actividad y devuelve el JSON según el esquema.' },
          ],
        },
      ],
    });

    const rawText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let extracted: Partial<Activity>;
    try {
      extracted = JSON.parse(rawText);
    } catch {
      return handleApiError(new Error('Error parseando respuesta de IA'));
    }

    // Convert date strings to Timestamps
    const convertDates = (obj: any): any => {
      if (!obj) return obj;
      const converted = { ...obj };
      for (const key of ['fechaInicio', 'fechaFin']) {
        if (converted[key]) converted[key] = Timestamp.fromDate(new Date(converted[key]));
      }
      if (converted.sesiones) {
        converted.sesiones = converted.sesiones.map((s: any) => ({
          ...s,
          fecha: s.fecha ? Timestamp.fromDate(new Date(s.fecha)) : Timestamp.now(),
        }));
      }
      return converted;
    };

    extracted = convertDates(extracted);
    extracted.organizadorId = session.uid;
    extracted.organizadorNombre = session.profile?.nombre || session.email || 'Organizador';
    extracted.estado = 'borrador';
    extracted.createdAt = Timestamp.now();
    extracted.updatedAt = Timestamp.now();

    // Calculate confidence scores (simplified - in production use logprobs)
    const confidence: Record<string, number> = {};
    const allFields = ['titulo', 'tipo', 'area', 'descripcion', 'modalidad', 'sede', 'enlaceVirtual', 'cupo', 'costo', 'moneda', 'requisitos', 'enlaceInscripcion', 'etiquetas', 'sesiones', 'horarios', 'fechaInicio', 'fechaFin'];
    allFields.forEach(f => confidence[f] = extracted[f as keyof typeof extracted] ? 0.85 : 0);

    // Save extraction record
    const extractionRef = adminDb.collection('extracciones').doc();
    await extractionRef.set({
      actividad: extracted,
      confianza: confidence,
      camposFaltantes: allFields.filter(f => !extracted[f as keyof typeof extracted]),
      textoCrudo: rawText,
      archivoPath: filePath,
      createdAt: Timestamp.now(),
    });

    // Create draft activity
    const draftRef = adminDb.collection('actividades').doc();
    await draftRef.set({
      ...extracted,
      extractionId: extractionRef.id,
    });

    return success({ extractionId: extractionRef.id, draftId: draftRef.id, actividad: extracted, confianza: confidence });
  } catch (err) {
    return handleApiError(err);
  }
}
```

#### Task 2.5: Activities CRUD Routes
**File:** `app/api/activities/route.ts`
```ts
import { adminDb } from '@/lib/firebase/admin';
import { validateRequest, activityListQuerySchema } from '@/lib/api/validation';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp, FieldValue, Query } from 'firebase/firestore';
import { activitySchema } from '@/lib/types/activity';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = validateRequest(activityListQuerySchema, Object.fromEntries(searchParams));

    let activitiesQuery: Query = adminDb.collection('actividades').where('estado', '==', 'publicado');

    if (query.tipo) activitiesQuery = activitiesQuery.where('tipo', '==', query.tipo);
    if (query.area) activitiesQuery = activitiesQuery.where('area', '==', query.area);
    if (query.modalidad) activitiesQuery = activitiesQuery.where('modalidad', '==', query.modalidad);
    if (query.costo === 'gratis') activitiesQuery = activitiesQuery.where('costo', '==', 0);
    if (query.costo === 'pago') activitiesQuery = activitiesQuery.where('costo', '>', 0);

    // Date filtering - requires composite index
    if (query.fechaDesde) {
      activitiesQuery = activitiesQuery.where('fechaInicio', '>=', Timestamp.fromDate(new Date(query.fechaDesde)));
    }
    if (query.fechaHasta) {
      activitiesQuery = activitiesQuery.where('fechaInicio', '<=', Timestamp.fromDate(new Date(query.fechaHasta)));
    }

    // Text search - simple array-contains on etiquetas (for MVP)
    if (query.q) {
      activitiesQuery = activitiesQuery.where('etiquetas', 'array-contains', query.q.toLowerCase());
    }

    // Sorting
    const sortField = query.sort === 'titulo' ? 'titulo' : 'fechaInicio';
    const sortDir = query.sort === 'fechaDesc' ? 'desc' : 'asc';
    activitiesQuery = activitiesQuery.orderBy(sortField, sortDir);

    // Pagination
    const offset = (query.page - 1) * query.limit;
    const snapshot = await activitiesQuery.limit(query.limit).offset(offset).get();
    const totalSnapshot = await activitiesQuery.count().get();

    const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return success({
      activities,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: totalSnapshot.data().count,
        totalPages: Math.ceil(totalSnapshot.data().count / query.limit),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'organizador' || !session.organizadorAprobado) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    const body = await request.json();
    const activityData = validateRequest(activitySchema, body);

    const activity = {
      ...activityData,
      organizadorId: session.uid,
      organizadorNombre: session.profile?.nombre || session.email || 'Organizador',
      estado: 'publicado',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      publishedAt: Timestamp.now(),
    };

    const docRef = await adminDb.collection('actividades').add(activity);
    return success({ id: docRef.id, ...activity }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
```

**File:** `app/api/activities/[id]/route.ts`
```ts
import { adminDb } from '@/lib/firebase/admin';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession, requireRole } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp, FieldValue } from 'firebase/firestore';
import { activitySchema } from '@/lib/types/activity';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await adminDb.collection('actividades').doc(id).get();
    if (!doc.exists) return handleApiError(new Error('NOT_FOUND'));
    return success({ id: doc.id, ...doc.data() });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['organizador', 'admin']);
    const { id } = await params;
    const body = await request.json();

    const docRef = adminDb.collection('actividades').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return handleApiError(new Error('NOT_FOUND'));

    const data = doc.data()!;
    if (session.role === 'organizador' && data.organizadorId !== session.uid) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    const updateData = {
      ...body,
      updatedAt: Timestamp.now(),
    };
    await docRef.update(updateData);
    return success({ id, ...data, ...updateData });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['organizador', 'admin']);
    const { id } = await params;

    const docRef = adminDb.collection('actividades').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return handleApiError(new Error('NOT_FOUND'));

    const data = doc.data()!;
    if (session.role === 'organizador' && data.organizadorId !== session.uid) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    await docRef.update({ estado: 'archivado', updatedAt: Timestamp.now() });
    return success({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
```

#### Task 2.6: Publish Draft Route
**File:** `app/api/activities/publish/route.ts`
```ts
import { adminDb } from '@/lib/firebase/admin';
import { validateRequest, publishRequestSchema } from '@/lib/api/validation';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession, requireRole } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp, FieldValue } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['organizador']);
    const body = await request.json();
    const { draftId } = validateRequest(publishRequestSchema, body);

    const draftRef = adminDb.collection('actividades').doc(draftId);
    const draft = await draftRef.get();
    if (!draft.exists) return handleApiError(new Error('NOT_FOUND'));

    const draftData = draft.data()!;
    if (draftData.organizadorId !== session.uid) {
      return handleApiError(new Error('FORBIDDEN'));
    }

    // Create published activity
    const publishedData = {
      ...draftData,
      estado: 'publicado',
      publishedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    delete publishedData.extractionId;

    const publishedRef = await adminDb.collection('actividades').add(publishedData);

    // Update draft to reference published
    await draftRef.update({ estado: 'publicado', publishedId: publishedRef.id, updatedAt: Timestamp.now() });

    return success({ id: publishedRef.id, ...publishedData });
  } catch (err) {
    return handleApiError(err);
  }
}
```

#### Task 2.7: Favorites Routes
**File:** `app/api/favorites/route.ts`
```ts
import { adminDb } from '@/lib/firebase/admin';
import { validateRequest, favoriteRequestSchema } from '@/lib/api/validation';
import { success, handleApiError } from '@/lib/api/response';
import { getServerSession } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp, FieldValue } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return handleApiError(new Error('UNAUTHORIZED'));

    const snapshot = await adminDb
      .collection('usuarios')
      .doc(session.uid)
      .collection('favoritos')
      .orderBy('createdAt', 'desc')
      .get();

    const favoritos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return success(favoritos);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return handleApiError(new Error('UNAUTHORIZED'));

    const body = await request.json();
    const { actividadId } = validateRequest(favoriteRequestSchema, body);

    const favRef = adminDb.collection('usuarios').doc(session.uid).collection('favoritos').doc(actividadId);
    const favDoc = await favRef.get();

    if (favDoc.exists) {
      await favRef.delete();
      return success({ added: false });
    }

    await favRef.set({ actividadId, createdAt: Timestamp.now() });
    return success({ added: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return handleApiError(new Error('UNAUTHORIZED'));

    const { searchParams } = new URL(request.url);
    const actividadId = searchParams.get('actividadId');
    if (!actividadId) return handleApiError(new Error('VALIDATION_ERROR: actividadId requerido'));

    await adminDb.collection('usuarios').doc(session.uid).collection('favoritos').doc(actividadId).delete();
    return success({ removed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
```

#### Task 2.8: Admin Routes
**File:** `app/api/admin/organizers/route.ts`
```ts
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { success, handleApiError } from '@/lib/api/response';
import { requireRole } from '@/lib/api/auth';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin']);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending'; // pending, approved, rejected

    let query = adminDb.collection('usuarios').where('rol', '==', 'organizador');
    if (status === 'pending') query = query.where('organizadorAprobado', '==', false);
    else if (status === 'approved') query = query.where('organizadorAprobado', '==', true);

    const snapshot = await query.orderBy('createdAt', 'desc').limit(100).get();
    const organizers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return success(organizers);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = await request.json();
    const { uid, action } = body; // action: 'approve' | 'reject'

    if (!uid || !['approve', 'reject'].includes(action)) {
      return handleApiError(new Error('VALIDATION_ERROR: uid y action (approve/reject) requeridos'));
    }

    const userRef = adminDb.collection('usuarios').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return handleApiError(new Error('NOT_FOUND'));

    if (action === 'approve') {
      await adminAuth.setCustomUserClaims(uid, { rol: 'organizador', organizadorAprobado: true });
      await userRef.update({ organizadorAprobado: true, updatedAt: Timestamp.now() });
    } else {
      await adminAuth.setCustomUserClaims(uid, { rol: 'estudiante', organizadorAprobado: false });
      await userRef.update({ organizadorAprobado: false, rol: 'estudiante', updatedAt: Timestamp.now() });
    }

    return success({ success: true, action });
  } catch (err) {
    return handleApiError(err);
  }
}
```

**File:** `app/api/admin/metrics/route.ts`
```ts
import { adminDb } from '@/lib/firebase/admin';
import { success, handleApiError } from '@/lib/api/response';
import { requireRole } from '@/lib/api/auth';
import { Timestamp } from 'firebase/firestore';

export async function GET() {
  try {
    await requireRole(['admin']);

    const [activitiesSnap, usersSnap, extractionsSnap, favoritesSnap] = await Promise.all([
      adminDb.collection('actividades').count().get(),
      adminDb.collection('usuarios').count().get(),
      adminDb.collection('extracciones').count().get(),
      adminDb.collectionGroup('favoritos').count().get(),
    ]);

    const publishedActivities = await adminDb.collection('actividades').where('estado', '==', 'publicado').count().get();
    const draftActivities = await adminDb.collection('actividades').where('estado', '==', 'borrador').count().get();

    const byType = await Promise.all(
      ['taller', 'curso', 'club'].map(async (tipo) => {
        const snap = await adminDb.collection('actividades').where('tipo', '==', tipo).where('estado', '==', 'publicado').count().get();
        return { tipo, count: snap.data().count };
      })
    );

    return success({
      totalActivities: activitiesSnap.data().count,
      publishedActivities: publishedActivities.data().count,
      draftActivities: draftActivities.data().count,
      totalUsers: usersSnap.data().count,
      totalExtractions: extractionsSnap.data().count,
      totalFavorites: favoritesSnap.data().count,
      byType,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
```

---

### Phase 3: Web Views / Pages (120 min)

#### Task 3.1: Root Layout & Providers
**File:** `app/providers.tsx`
```tsx
'use client';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**File:** `app/layout.tsx` (update existing)
```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono, Raleway } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { cn } from '@/lib/utils';

const raleway = Raleway({ subsets: ['latin'], variable: '--font-sans' });
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hub de Aprendizaje FES Acatlán',
  description: 'Catálogo centralizado de talleres, cursos y clubes con carga asistida por IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={cn('h-full antialiased', geistSans.variable, geistMono.variable, 'font-sans', raleway.variable)}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

#### Task 3.2: Home Page - Public Catalog (SSR)
**File:** `app/page.tsx`
```tsx
import { Metadata } from 'next';
import { ActivityGrid } from '@/components/ActivityGrid';
import { FilterBar, FilterSidebar } from '@/components/FilterSidebar';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Hub de Aprendizaje FES Acatlán',
  description: 'Encuentra talleres, cursos y clubes. Organizadores: sube tu PDF y la IA llena la ficha.',
};

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const queryString = new URLSearchParams(params as Record<string, string>).toString();

  // Fetch activities from API (SSR)
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/activities?${queryString}`;
  const response = await fetch(apiUrl, { next: { revalidate: 60 } });
  const { activities, pagination } = await response.json();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-b from-primary/5 via-background to-background py-12 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              Hub de Aprendizaje <span className="text-primary">FES Acatlán</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Tu catálogo centralizado de talleres, cursos y clubes. Organizadores: sube tu PDF o cartel y la IA llena la ficha automáticamente.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/dashboard/organizer/nueva" className="btn-primary">
                Publicar actividad con IA
              </a>
              <a href="#actividades" className="btn-secondary">
                Explorar catálogo
              </a>
            </div>
          </div>
        </section>

        <section id="actividades" className="py-8 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="lg:grid lg:grid-cols-4 lg:gap-8">
              <aside className="lg:block hidden">
                <FilterSidebar />
              </aside>
              <div className="lg:col-span-3">
                <FilterBar />
                <ActivityGrid activities={activities} pagination={pagination} />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
```

#### Task 3.3: Activity Detail Page (SSR)
**File:** `app/actividad/[id]/page.tsx`
```tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActivityDetail } from '@/components/ActivityDetail';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

interface ActivityPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ActivityPageProps): Promise<Metadata> {
  const { id } = await params;
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/activities/${id}`, { next: { revalidate: 60 } });
  if (!response.ok) return { title: 'Actividad no encontrada' };
  const { data: activity } = await response.json();
  return {
    title: `${activity.titulo} | Hub de Aprendizaje`,
    description: activity.descripcion?.slice(0, 160),
    openGraph: {
      title: activity.titulo,
      description: activity.descripcion?.slice(0, 160),
      type: 'website',
    },
  };
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { id } = await params;
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/activities/${id}`, { next: { revalidate: 60 } });
  
  if (!response.ok) notFound();
  const { data: activity } = await response.json();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <ActivityDetail activity={activity} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

#### Task 3.4: Login Page
**File:** `app/login/page.tsx`
```tsx
'use client';
import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'estudiante' | 'organizador'>('estudiante');

  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: 'acatlan.unam.mx' }); // Restrict to institutional domain

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      
      const response = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, role }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error en autenticación');
      }
      
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error iniciando sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Iniciar sesión</h1>
          <p className="text-muted-foreground mt-2">Usa tu cuenta institucional @acatlan.unam.mx</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-3">¿Cómo ingresarás?</h3>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={role === 'estudiante' ? 'default' : 'outline'}
                  onClick={() => setRole('estudiante')}
                  className="h-20 flex flex-col gap-2"
                >
                  <Mail className="h-6 w-6 mx-auto" />
                  Estudiante
                </Button>
                <Button
                  variant={role === 'organizador' ? 'default' : 'outline'}
                  onClick={() => setRole('organizador')}
                  className="h-20 flex flex-col gap-2"
                >
                  <Lock className="h-6 w-6 mx-auto" />
                  Organizador
                </Button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button className="w-full" size="lg" onClick={handleGoogleSignIn} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Continuar con Google'
              )}
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Al continuar, aceptas los {' '}
          <a href="/terminos" className="underline">Términos de uso</a>
          {' '} y la {' '}
          <a href="/privacidad" className="underline">Política de privacidad</a>
        </p>
      </div>
    </div>
  );
}
```

#### Task 3.5: Dashboard Layout & Role-Based Redirect
**File:** `app/dashboard/layout.tsx`
```tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getServerSession } from '@/lib/api/auth'; // This won't work client-side, need client auth
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Client-side auth check - redirect to login if not authenticated
  useEffect(() => {
    // Check for session cookie or use Firebase auth state listener
    // For simplicity, we'll rely on server-side protection in API routes
    // and show loading state
  }, []);

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

**File:** `app/dashboard/page.tsx` (Server Component - role redirect)
```tsx
import { getServerSession } from '@/lib/api/auth';
import { redirect } from 'next/navigation';
import { DashboardStudent } from '@/components/DashboardStudent';
import { DashboardOrganizer } from '@/components/DashboardOrganizer';
import { DashboardAdmin } from '@/components/DashboardAdmin';

export default async function DashboardPage() {
  const session = await getServerSession();
  
  if (!session) {
    redirect('/login?callbackUrl=/dashboard');
  }

  switch (session.role) {
    case 'estudiante':
      return <DashboardStudent />;
    case 'organizador':
      if (!session.organizadorAprobado) {
        return <DashboardOrganizerPending />;
      }
      return <DashboardOrganizer />;
    case 'admin':
      return <DashboardAdmin />;
    default:
      return <DashboardStudent />;
  }
}

function DashboardOrganizerPending() {
  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="rounded-lg border p-8">
        <h2 className="text-2xl font-bold mb-4">Acceso de organizador pendiente</h2>
        <p className="text-muted-foreground mb-6">
          Tu solicitud para ser organizador está en revisión. Un administrador la aprobará pronto.
          Mientras tanto, puedes explorar el catálogo como estudiante.
        </p>
        <a href="/" className="btn-primary inline-block">Ir al catálogo</a>
      </div>
    </div>
  );
}
```

#### Task 3.6: Student Dashboard Component
**File:** `components/DashboardStudent.tsx`
```tsx
'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ActivityGrid } from '@/components/ActivityGrid';
import { FavoritesList } from '@/components/FavoritesList';
import { RemindersList } from '@/components/RemindersList';

export function DashboardStudent() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mi panel</h1>
        <p className="text-muted-foreground">Gestiona tus actividades guardadas y recordatorios</p>
      </div>

      <Tabs defaultValue="favoritos" className="w-full">
        <TabsList>
          <TabsTrigger value="favoritos">Mis favoritos</TabsTrigger>
          <TabsTrigger value="recordatorios">Recordatorios</TabsTrigger>
          <TabsTrigger value="explorar">Explorar catálogo</TabsTrigger>
        </TabsList>

        <TabsContent value="favoritos">
          <FavoritesList />
        </TabsContent>

        <TabsContent value="recordatorios">
          <RemindersList />
        </TabsContent>

        <TabsContent value="explorar">
          <ActivityGrid showFavorites={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### Task 3.7: Organizer Dashboard - New Activity Wizard
**File:** `app/dashboard/organizer/nueva/page.tsx`
```tsx
'use client';
import { useState } from 'react';
import { UploadZone } from '@/components/UploadZone';
import { ExtractionReviewForm } from '@/components/ExtractionReviewForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { activitySchema, type Activity } from '@/lib/types/activity';
import { Timestamp } from 'firebase/firestore';

export default function NuevaActividadPage() {
  const router = useRouter();
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [extractionData, setExtractionData] = useState<{ draftId: string; actividad: Partial<Activity>; confianza: Record<string, number> } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleUploadComplete = async (filePath: string, fileType: string) => {
    try {
      const response = await fetch('/api/activities/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error en extracción');
      
      setExtractionData({
        draftId: result.draftId,
        actividad: result.actividad,
        confianza: result.confianza,
      });
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error procesando archivo');
    }
  };

  const handlePublish = async (data: Partial<Activity>) => {
    setSubmitting(true);
    setError('');
    try {
      if (!extractionData) throw new Error('No hay datos de extracción');
      
      const response = await fetch('/api/activities/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: extractionData.draftId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error publicando');
      
      router.push(`/dashboard/organizer/actividades?published=${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error publicando');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'upload') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Nueva actividad desde archivo</h1>
            <p className="text-muted-foreground">Sube un PDF o imagen del cartel y la IA extraerá la información</p>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <UploadZone onUploadComplete={handleUploadComplete} onError={setError} />
          
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>¿Prefieres ingresar los datos manualmente?</p>
          <a href="/dashboard/organizer/nueva/manual" className="text-primary underline">Crear actividad manualmente</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setStep('upload')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Revisar y publicar</h1>
          <p className="text-muted-foreground">La IA ha extraído la información. Revisa, corrige y publica.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <ExtractionReviewForm
        initialData={extractionData!.actividad}
        confidence={extractionData!.confianza}
        onSubmit={handlePublish}
        isSubmitting={submitting}
      />
    </div>
  );
}
```

#### Task 3.8: Organizer Drafts & Activities Management
**File:** `app/dashboard/organizer/borradores/page.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';
import { ActivityCard } from '@/components/ActivityCard';
import { Button } from '@/components/ui/button';
import { Loader2, Edit, Trash2, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface DraftActivity {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  createdAt: { toDate: () => Date };
  updatedAt: { toDate: () => Date };
}

export default function BorradoresPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/activities?estado=borrador&organizadorId=me')
      .then(r => r.json())
      .then(data => {
        setDrafts(data.activities || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis borradores</h1>
          <p className="text-muted-foreground">Actividades extraídas por IA pendientes de revisión</p>
        </div>
        <Button asChild>
          <a href="/dashboard/organizer/nueva">+ Nueva desde archivo</a>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No tienes borradores aún</p>
          <Button asChild>
            <a href="/dashboard/organizer/nueva">Crear primer borrador</a>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map(draft => (
            <ActivityCard
              key={draft.id}
              activity={draft as any}
              variant="compact"
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**File:** `app/dashboard/organizer/actividades/page.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';
import { ActivityCard } from '@/components/ActivityCard';
import { Button } from '@/components/ui/button';
import { Loader2, Edit, Trash2, Eye, CheckCircle, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface OrganizerActivity {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  fechaInicio: { toDate: () => Date };
  createdAt: { toDate: () => Date };
}

export default function ActividadesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const published = searchParams.get('published');
  const [activities, setActivities] = useState<OrganizerActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'publicadas' | 'archivadas'>('publicadas');

  useEffect(() => {
    if (published) {
      // Show success toast
    }
    fetch(`/api/activities?organizadorId=me&estado=${activeTab === 'publicadas' ? 'publicado' : 'archivado'}`)
      .then(r => r.json())
      .then(data => {
        setActivities(data.activities || []);
        setLoading(false);
      });
  }, [activeTab]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis actividades</h1>
          <p className="text-muted-foreground">Gestiona tus actividades publicadas y archivadas</p>
        </div>
        <Button asChild>
          <a href="/dashboard/organizer/nueva">+ Nueva actividad</a>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="publicadas">Publicadas</TabsTrigger>
          <TabsTrigger value="archivadas">Archivadas</TabsTrigger>
        </TabsList>

        <TabsContent value="publicadas">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No tienes actividades publicadas</p>
              <Button asChild><a href="/dashboard/organizer/nueva">Crear primera actividad</a></Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activities.map(activity => (
                <ActivityCard key={activity.id} activity={activity as any} variant="compact" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archivadas">
          {/* Similar to publicadas */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### Task 3.9: Admin Dashboard
**File:** `app/dashboard/admin/page.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, UserCheck, UserX, UserPlus, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Organizer {
  id: string;
  email: string;
  nombre: string;
  organizadorAprobado: boolean;
  createdAt: { toDate: () => Date };
}

interface Metrics {
  totalActivities: number;
  publishedActivities: number;
  draftActivities: number;
  totalUsers: number;
  totalExtractions: number;
  totalFavorites: number;
  byType: { tipo: string; count: number }[];
}

export default function DashboardAdmin() {
  const [pendingOrganizers, setPendingOrganizers] = useState<Organizer[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/organizers?status=pending').then(r => r.json()),
      fetch('/api/admin/metrics').then(r => r.json()),
    ]).then(([organizersData, metricsData]) => {
      setPendingOrganizers(organizersData.data || []);
      setMetrics(metricsData.data || null);
      setLoading(false);
    });
  }, []);

  const handleOrganizerAction = async (uid: string, action: 'approve' | 'reject') => {
    setActionLoading(uid);
    try {
      await fetch('/api/admin/organizers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, action }),
      });
      setPendingOrganizers(prev => prev.filter(o => o.id !== uid));
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Desconocido'));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Panel de administración</h1>
        <p className="text-muted-foreground">Gestión de organizadores y métricas de la plataforma</p>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <MetricCard title="Actividades totales" value={metrics.totalActivities} icon={TrendingUp} />
          <MetricCard title="Publicadas" value={metrics.publishedActivities} icon={CheckCircle} className="text-green-600" />
          <MetricCard title="Borradores" value={metrics.draftActivities} icon={Loader2} className="text-amber-600" />
          <MetricCard title="Usuarios" value={metrics.totalUsers} icon={UserPlus} />
          <MetricCard title="Extracciones IA" value={metrics.totalExtractions} icon={TrendingUp} className="text-purple-600" />
          <MetricCard title="Favoritos" value={metrics.totalFavorites} icon={TrendingUp} className="text-red-600" />
        </div>
      )}

      <Tabs defaultValue="organizadores" className="w-full">
        <TabsList>
          <TabsTrigger value="organizadores">Organizadores pendientes</TabsTrigger>
          <TabsTrigger value="metricas">Métricas detalladas</TabsTrigger>
        </TabsList>

        <TabsContent value="organizadores">
          {pendingOrganizers.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No hay organizadores pendientes de aprobación</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingOrganizers.map(org => (
                <div key={org.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">{org.nombre}</p>
                    <p className="text-sm text-muted-foreground">{org.email}</p>
                    <p className="text-xs text-muted-foreground">Solicitado: {org.createdAt.toDate().toLocaleDateString('es-MX')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOrganizerAction(org.id, 'approve')}
                      disabled={actionLoading === org.id}
                    >
                      {actionLoading === org.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4 mr-1" />}
                      Aprobar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleOrganizerAction(org.id, 'reject')}
                      disabled={actionLoading === org.id}
                    >
                      {actionLoading === org.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4 mr-1" />}
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="metricas">
          {metrics && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Actividades por tipo</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  {metrics.byType.map(item => (
                    <div key={item.tipo} className="p-4 rounded-lg border">
                      <p className="text-3xl font-bold">{item.count}</p>
                      <p className="text-muted-foreground capitalize">{item.tipo}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, className }: { title: string; value: number; icon: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <div className="p-4 rounded-lg border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold {className}">{value.toLocaleString()}</p>
        </div>
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
    </div>
  );
}
```

#### Task 3.10: Profile Page (Favorites & Reminders)
**File:** `app/perfil/page.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FavoritesList } from '@/components/FavoritesList';
import { RemindersList } from '@/components/RemindersList';
import { UserProfileForm } from '@/components/UserProfileForm';
import { Loader2 } from 'lucide-react';

export default function PerfilPage() {
  const [activeTab, setActiveTab] = useState<'perfil' | 'favoritos' | 'recordatorios'>('perfil');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mi perfil</h1>
        <p className="text-muted-foreground">Gestiona tu información, favoritos y recordatorios</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="perfil">Información</TabsTrigger>
          <TabsTrigger value="favoritos">Favoritos</TabsTrigger>
          <TabsTrigger value="recordatorios">Recordatorios</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <UserProfileForm />
        </TabsContent>

        <TabsContent value="favoritos">
          <FavoritesList />
        </TabsContent>

        <TabsContent value="recordatorios">
          <RemindersList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### Phase 4: Supporting Components (45 min)

#### Task 4.1: Header Component
**File:** `components/Header.tsx`
```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu, X, BookOpen, LayoutDashboard, LogOut, User, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getServerSession } from '@/lib/api/auth'; // Won't work client-side, use Firebase auth instead

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<{ uid: string; email: string; role: string } | null>(null);

  // In real implementation, use onAuthStateChanged from Firebase
  useEffect(() => {
    // Check auth state
  }, []);

  const navigation = [
    { name: 'Catálogo', href: '/' },
    { name: 'Cómo funciona', href: '/como-funciona' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4" aria-label="Global">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl" aria-label="Hub de Aprendizaje">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="hidden sm:block">Hub de Aprendizaje</span>
          </Link>

          <div className="hidden md:flex md:gap-6">
            {navigation.map(item => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname === item.href ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="hidden sm:flex sm:items-center sm:gap-4">
              <Link href="/perfil" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                {user.email}
              </Link>
              <Link href="/dashboard" className="btn-primary">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Panel
              </Link>
              <Button variant="ghost" size="icon" onClick={() => { /* signOut */ }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="hidden sm:flex sm:items-center sm:gap-3">
              <Link href="/login" className="btn-secondary">
                Iniciar sesión
              </Link>
              <Link href="/dashboard/organizer/nueva" className="btn-primary">
                Publicar actividad
              </Link>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden border-t px-4 py-4 space-y-4">
          {navigation.map(item => (
            <Link
              key={item.name}
              href={item.href}
              className="block text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          {!user && (
            <>
              <Link href="/login" className="btn-secondary w-full" onClick={() => setMobileMenuOpen(false)}>
                Iniciar sesión
              </Link>
              <Link href="/dashboard/organizer/nueva" className="btn-primary w-full" onClick={() => setMobileMenuOpen(false)}>
                Publicar actividad
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
```

#### Task 4.2: Footer Component
**File:** `components/Footer.tsx`
```tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-7xl grid gap-8 md:grid-cols-4">
        <div>
          <h3 className="font-semibold mb-4">Hub de Aprendizaje</h3>
          <p className="text-sm text-muted-foreground">
            Catálogo centralizado de talleres, cursos y clubes de la FES Acatlán.
            Con carga asistida por IA para organizadores.
          </p>
        </div>
        <nav>
          <h4 className="font-medium mb-4">Enlaces rápidos</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/" className="text-muted-foreground hover:text-foreground">Catálogo</Link></li>
            <li><Link href="/como-funciona" className="text-muted-foreground hover:text-foreground">Cómo funciona</Link></li>
            <li><Link href="/login" className="text-muted-foreground hover:text-foreground">Iniciar sesión</Link></li>
          </ul>
        </nav>
        <nav>
          <h4 className="font-medium mb-4">Legal</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/privacidad" className="text-muted-foreground hover:text-foreground">Política de privacidad</Link></li>
            <li><Link href="/terminos" className="text-muted-foreground hover:text-foreground">Términos de uso</Link></li>
            <li><Link href="/aviso-privacidad" className="text-muted-foreground hover:text-foreground">Aviso de privacidad</Link></li>
          </ul>
        </nav>
        <div>
          <h4 className="font-medium mb-4">Contacto</h4>
          <address className="text-sm text-muted-foreground not-italic">
            <p>Facultad de Estudios Superiores Acatlán</p>
            <p>Av. Universidad s/n, Col. Los Reyes Iztacala</p>
            <p>Tlalnepantla, Edo. de México, 54090</p>
            <p className="mt-2"><a href="mailto:cloud@acatlan.unam.mx" className="hover:text-foreground">cloud@acatlan.unam.mx</a></p>
          </address>
        </div>
      </div>
      <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} FES Acatlán - UNAM. Proyecto de Cómputo en la Nube.</p>
      </div>
    </footer>
  );
}
```

#### Task 4.3: ActivityGrid Component
**File:** `components/ActivityGrid.tsx`
```tsx
'use client';
import { ActivityCard } from '@/components/ActivityCard';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Activity } from '@/lib/types/activity';

interface ActivityGridProps {
  activities: Activity[];
  pagination?: { page: number; totalPages: number; total: number };
  showFavorites?: boolean;
  onFavorite?: (id: string) => void;
  favoriteIds?: Set<string>;
}

export function ActivityGrid({ activities, pagination, showFavorites, onFavorite, favoriteIds = new Set() }: ActivityGridProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No se encontraron actividades</p>
        {showFavorites && (
          <Button asChild variant="outline">
            <a href="/">Explorar catálogo</a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {activities.map(activity => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onFavorite={onFavorite}
            isFavorite={favoriteIds.has(activity.id)}
          />
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={pagination.page === 1}
            onClick={() => window.history.pushState(null, '', `?page=${pagination.page - 1}`)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} resultados)
          </span>
          <Button
            variant="outline"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => window.history.pushState(null, '', `?page=${pagination.page + 1}`)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
```

#### Task 4.4: ActivityDetail Component
**File:** `components/ActivityDetail.tsx`
```tsx
'use client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin, Clock, Users, Link2, Bookmark, Share2, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Activity, CursoTaller, Club } from '@/lib/types/activity';
import { isCursoTaller, isClub, formatActivityType, getTypeBadgeClass, getModalidadBadgeClass, getProximasSesiones } from '@/lib/utils/activity';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';

interface ActivityDetailProps {
  activity: Activity;
}

export function ActivityDetail({ activity }: ActivityDetailProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const proximasSesiones = getProximasSesiones(activity);
  const esCT = isCursoTaller(activity);
  const esClub = isClub(activity);

  const toggleFavorite = async () => {
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actividadId: activity.id }),
      });
      if (response.ok) setIsFavorite(prev => !prev);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className={getTypeBadgeClass(activity.tipo)}>{formatActivityType(activity.tipo)}</Badge>
            <Badge variant="outline" className={getModalidadBadgeClass(activity.modalidad)}>
              {activity.modalidad}
            </Badge>
            {activity.estado === 'publicado' && (
              <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> Publicado</Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold text-foreground">{activity.titulo}</h1>
          <p className="text-muted-foreground mt-1">{activity.area}</p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="ghost" size="icon" onClick={toggleFavorite} aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
            <Bookmark className={cn('h-4 w-4', isFavorite && 'fill-current text-primary')} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Compartir">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Descripción</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground whitespace-pre-wrap">{activity.descripcion}</p>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Fechas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Fechas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {esCT && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Inicio:</span>
                  <span>{format(activity.fechaInicio.toDate(), 'dd MMMM yyyy', { locale: es })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Fin:</span>
                  <span>{format(activity.fechaFin.toDate(), 'dd MMMM yyyy', { locale: es })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Sesiones:</span>
                  <span>{activity.sesiones.length}</span>
                </div>
              </>
            )}
            {esClub && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Inicio:</span>
                  <span>{format(activity.fechaInicio.toDate(), 'dd MMMM yyyy', { locale: es })}</span>
                </div>
                {activity.fechaFin && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Fin:</span>
                    <span>{format(activity.fechaFin.toDate(), 'dd MMMM yyyy', { locale: es })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Horarios:</span>
                  <span>{activity.horarios.length}</span>
                </div>
              </>
            )}
            {proximasSesiones.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2">Próximas sesiones</p>
                {proximasSesiones.slice(0, 3).map((sesion, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(sesion.fecha.toDate(), 'dd MMM', { locale: es })}</span>
                    <span className="text-muted-foreground">{sesion.horaInicio} - {sesion.horaFin}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ubicación / Modalidad */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Ubicación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.sede && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>{activity.sede}</span>
              </div>
            )}
            {activity.enlaceVirtual && (
              <div className="flex items-start gap-2 text-sm">
                <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5" />
                <a href={activity.enlaceVirtual} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {activity.enlaceVirtual}
                </a>
              </div>
            )}
            {!activity.sede && !activity.enlaceVirtual && (
              <p className="text-sm text-muted-foreground">Por definir</p>
            )}
          </CardContent>
        </Card>

        {/* Cupo y Costo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Cupo y costo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Cupo:</span>
              <span>{activity.cupo ? activity.cupo : 'Sin límite'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Costo:</span>
              <span className={activity.costo === 0 ? 'text-green-600' : ''}>
                {activity.costo === 0 ? 'Gratis' : `${activity.costo} ${activity.moneda}`}
              </span>
            </div>
            {activity.requisitos && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-1">Requisitos</p>
                <p className="text-sm">{activity.requisitos}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Horarios detallados para cursos/clubes */}
      {(esCT || esClub) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> {esCT ? 'Sesiones' : 'Horarios recurrentes'}</CardTitle>
          </CardHeader>
          <CardContent>
            {esCT ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Fecha</th>
                      <th className="pb-2 pr-4">Hora</th>
                      <th className="pb-2 pr-4">Tema</th>
                      <th className="pb-2">Sede / Enlace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.sesiones.map((sesion, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4">{format(sesion.fecha.toDate(), 'dd MMM yyyy', { locale: es })}</td>
                        <td className="py-2 pr-4">{sesion.horaInicio} - {sesion.horaFin}</td>
                        <td className="py-2 pr-4">{sesion.tema || '-'}</td>
                        <td className="py-2">{sesion.sede || sesion.enlaceVirtual || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {activity.horarios.map((horario, i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <div className="font-medium">{['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][horario.diaSemana]}</div>
                    <div className="text-sm text-muted-foreground">{horario.horaInicio} - {horario.horaFin}</div>
                    {horario.sede && <div className="text-sm text-muted-foreground">{horario.sede}</div>}
                    {horario.enlaceVirtual && (
                      <a href={horario.enlaceVirtual} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                        Enlace virtual
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Etiquetas */}
      {activity.etiquetas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Etiquetas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activity.etiquetas.map(tag => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inscripción */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">¿Te interesa esta actividad?</h3>
              <p className="text-sm text-muted-foreground">Inscríbete directamente desde el enlace del organizador</p>
            </div>
            {activity.enlaceInscripcion ? (
              <Button size="lg" asChild>
                <a href={activity.enlaceInscripcion} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Inscribirme ahora
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="lg" disabled>
                <AlertCircle className="h-4 w-4 mr-2" />
                Sin enlace de inscripción
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organizador info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Organizador</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{activity.organizadorNombre}</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Task 4.5: FavoritesList & RemindersList Components
**File:** `components/FavoritesList.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';
import { ActivityCard } from '@/components/ActivityCard';
import { Loader2, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Activity } from '@/lib/types/activity';

export function FavoritesList() {
  const [favorites, setFavorites] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/favorites')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          // Fetch full activity details for each favorite
          Promise.all(data.data.map((f: any) => 
            fetch(`/api/activities/${f.actividadId}`).then(r => r.json())
          )).then(results => {
            setFavorites(results.map(r => r.data).filter(Boolean));
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (favorites.length === 0) {
    return (
      <div className="text-center py-12">
        <Heart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground mb-4">No tienes actividades guardadas</p>
        <a href="/" className="btn-primary inline-block">Explorar catálogo</a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {favorites.map(activity => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onFavorite={(id) => setFavorites(prev => prev.filter(a => a.id !== id))}
          isFavorite={true}
        />
      ))}
    </div>
  );
}
```

**File:** `components/RemindersList.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Activity } from '@/lib/types/activity';
import { isCursoTaller, getProximasSesiones, formatActivityType, getTypeBadgeClass } from '@/lib/utils/activity';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReminderActivity extends Activity {
  reminderDate?: Date;
}

export function RemindersList() {
  const [reminders, setReminders] = useState<ReminderActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In real implementation, fetch from user's reminders subcollection
    // For now, show upcoming sessions from favorites
    fetch('/api/favorites')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          Promise.all(data.data.map((f: any) => 
            fetch(`/api/activities/${f.actividadId}`).then(r => r.json())
          )).then(results => {
            const activities = results.map(r => r.data).filter(Boolean);
            const upcoming = activities.flatMap((a: Activity) => 
              getProximasSesiones(a).map(s => ({ ...a, sesion: s }))
            ).sort((a, b) => a.sesion.fecha.toMillis() - b.sesion.fecha.toMillis());
            setReminders(upcoming);
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (reminders.length === 0) {
    return (
      <div className="text-center py-12">
        <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No tienes recordatorios próximos</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reminders.map(({ actividad: activity, sesion }) => (
        <Card key={`${activity.id}-${sesion.fecha.toMillis()}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className={getTypeBadgeClass(activity.tipo)}>{formatActivityType(activity.tipo)}</Badge>
                    <h4 className="font-medium">{activity.titulo}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{format(sesion.fecha.toDate(), 'EEEE dd MMMM yyyy', { locale: es })}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{sesion.horaInicio} - {sesion.horaFin}</span>
                {sesion.sede && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{sesion.sede}</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

#### Task 4.6: UserProfileForm Component
**File:** `components/UserProfileForm.tsx`
```tsx
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const profileSchema = z.object({
  nombre: z.string().min(2).max(100),
  carrera: z.string().max(100).optional(),
});

export function UserProfileForm() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { nombre: '', carrera: '' },
    mode: 'onChange',
  });

  const onSubmit = async (data: z.infer<typeof profileSchema>) => {
    setSaving(true);
    try {
      // In real implementation, call API to update profile
      await new Promise(r => setTimeout(r, 1000));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
      <div className="rounded-lg border p-6">
        <h3 className="font-medium mb-4">Información personal</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre completo</label>
            <Input {...form.register('nombre')} placeholder="Tu nombre" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Carrera</label>
            <Input {...form.register('carrera')} placeholder="Tu carrera" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => form.reset()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : saved ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Guardado
            </>
          ) : (
            'Guardar cambios'
          )}
        </Button>
      </div>
    </form>
  );
}
```

#### Task 4.7: Sidebar Component
**File:** `components/Sidebar.tsx`
```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, BookOpen, Bookmark, Bell, Users, Settings, LogOut, Shield, TrendingUp } from 'lucide-react';

const navItems = {
  estudiante: [
    { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
    { href: '/perfil', label: 'Mi perfil', icon: User },
    { href: '/perfil?tab=favoritos', label: 'Favoritos', icon: Bookmark },
    { href: '/perfil?tab=recordatorios', label: 'Recordatorios', icon: Bell },
  ],
  organizador: [
    { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
    { href: '/dashboard/organizer/nueva', label: 'Nueva actividad', icon: BookOpen },
    { href: '/dashboard/organizer/borradores', label: 'Borradores', icon: FileText },
    { href: '/dashboard/organizer/actividades', label: 'Mis actividades', icon: BookMark },
  ],
  admin: [
    { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
    { href: '/dashboard/admin', label: 'Administración', icon: Shield },
    { href: '/dashboard/admin?tab=metricas', label: 'Métricas', icon: TrendingUp },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  // In real implementation, get user role from context
  const role = 'estudiante'; // Placeholder

  const items = navItems[role as keyof typeof navItems] || navItems.estudiante;

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r bg-card h-full">
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <Link
          href="/login"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </Link>
      </div>
    </aside>
  );
}
```

---

### Phase 5: Firebase Configuration & Deployment (30 min)

#### Task 5.1: Firebase Config Files
**File:** `firebase.json`
```json
{
  "hosting": {
    "public": "out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "max-age=31536000, immutable" }]
      }
    ]
  },
  "functions": {
    "source": "functions",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

**File:** `firestore.rules`
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile
    match /usuarios/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      // Admins can read/write all
      allow read, write: if request.auth != null && request.auth.token.rol == 'admin';
    }

    // Favorites subcollection
    match /usuarios/{userId}/favoritos/{favId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Activities - public read for published
    match /actividades/{activityId} {
      allow read: if resource.data.estado == 'publicado';
      allow create: if request.auth != null && request.auth.token.rol == 'organizador' && request.auth.token.organizadorAprobado == true;
      allow update: if request.auth != null && 
        (request.auth.token.rol == 'admin' || 
         (request.auth.token.rol == 'organizador' && request.auth.token.organizadorAprobado == true && resource.data.organizadorId == request.auth.uid));
      allow delete: if request.auth != null && request.auth.token.rol == 'admin';
    }

    // Draft activities (subcollection or same collection with estado=borrador)
    match /actividades/{activityId} {
      allow read: if request.auth != null && 
        (resource.data.estado == 'borrador' && resource.data.organizadorId == request.auth.uid);
    }

    // Extractions - organizer owns their extractions
    match /extracciones/{extractionId} {
      allow read: if request.auth != null && resource.data.organizadorId == request.auth.uid;
      allow create: if request.auth != null && request.auth.token.rol == 'organizador' && request.auth.token.organizadorAprobado == true;
    }
  }
}
```

**File:** `firestore.indexes.json`
```json
{
  "indexes": [
    {
      "collectionGroup": "actividades",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "tipo", "order": "ASCENDING" },
        { "fieldPath": "fechaInicio", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "actividades",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "area", "order": "ASCENDING" },
        { "fieldPath": "fechaInicio", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "actividades",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "modalidad", "order": "ASCENDING" },
        { "fieldPath": "fechaInicio", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "actividades",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "organizadorId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "actividades",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "etiquetas", "order": "ASCENDING" },
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "fechaInicio", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**File:** `storage.rules`
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Organizer uploads
    match /uploads/{userId}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null 
        && request.auth.uid == userId 
        && request.auth.token.rol == 'organizador'
        && request.auth.token.organizadorAprobado == true
        && request.resource.size <= 10 * 1024 * 1024; // 10 MB max
    }

    // Public activity images (thumbnails, etc.)
    match /activities/{activityId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.rol == 'admin';
    }
  }
}
```

#### Task 5.2: Next.js Config for Static Export (Firebase Hosting)
**File:** `next.config.ts` (update existing)
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // For Firebase Hosting static export
  images: {
    unoptimized: true, // Required for static export
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

#### Task 5.3: Build & Deploy Scripts
**File:** `package.json` (update scripts)
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check",
    "format": "biome format --write",
    "deploy": "pnpm run build && firebase deploy",
    "deploy:hosting": "pnpm run build && firebase deploy --only hosting",
    "deploy:rules": "firebase deploy --only firestore:rules,storage",
    "deploy:indexes": "firebase deploy --only firestore:indexes"
  }
}
```

---

## Tests / Validation

### Unit Tests (Jest + React Testing Library)
**File:** `lib/utils/activity.test.ts`
```ts
import { isCursoTaller, isClub, formatActivityType, getTypeBadgeClass, getProximasSesiones } from '@/lib/utils/activity';
import { Timestamp } from 'firebase/firestore';

describe('Activity utilities', () => {
  const mockCurso: any = {
    tipo: 'curso',
    fechaInicio: Timestamp.fromDate(new Date('2026-01-15')),
    fechaFin: Timestamp.fromDate(new Date('2026-03-15')),
    sesiones: [
      { fecha: Timestamp.fromDate(new Date('2026-01-20')), horaInicio: '09:00', horaFin: '11:00' },
      { fecha: Timestamp.fromDate(new Date('2026-01-27')), horaInicio: '09:00', horaFin: '11:00' },
    ],
  };

  const mockClub: any = {
    tipo: 'club',
    fechaInicio: Timestamp.fromDate(new Date('2026-01-15')),
    horarios: [{ diaSemana: 1, horaInicio: '16:00', horaFin: '18:00' }],
  };

  test('isCursoTaller returns true for curso and taller', () => {
    expect(isCursoTaller({ ...mockCurso, tipo: 'curso' })).toBe(true);
    expect(isCursoTaller({ ...mockCurso, tipo: 'taller' })).toBe(true);
    expect(isCursoTaller({ ...mockClub, tipo: 'club' })).toBe(false);
  });

  test('isClub returns true only for club', () => {
    expect(isClub(mockClub)).toBe(true);
    expect(isClub(mockCurso)).toBe(false);
  });

  test('formatActivityType returns correct labels', () => {
    expect(formatActivityType('taller')).toBe('Taller');
    expect(formatActivityType('curso')).toBe('Curso');
    expect(formatActivityType('club')).toBe('Club');
  });

  test('getProximasSesiones returns upcoming sessions sorted', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 86400000);
    const future = new Date(now.getTime() + 86400000);
    
    const activity = {
      ...mockCurso,
      sesiones: [
        { fecha: Timestamp.fromDate(past), horaInicio: '09:00', horaFin: '11:00' },
        { fecha: Timestamp.fromDate(future), horaInicio: '09:00', horaFin: '11:00' },
      ],
    };
    
    const proximas = getProximasSesiones(activity);
    expect(proximas.length).toBe(1);
    expect(proximas[0].fecha.toMillis()).toBe(future.getTime());
  });
});
```

**File:** `components/ActivityCard.test.tsx`
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityCard } from '@/components/ActivityCard';
import type { Activity } from '@/lib/types/activity';
import { Timestamp } from 'firebase/firestore';

const mockActivity: Activity = {
  id: 'test-1',
  titulo: 'Taller de React',
  tipo: 'taller',
  area: 'Programación',
  descripcion: 'Aprende React desde cero',
  modalidad: 'presencial',
  sede: 'Edificio A, Aula 101',
  cupo: 30,
  costo: 0,
  moneda: 'GRATIS',
  organizadorId: 'org-1',
  organizadorNombre: 'Prof. García',
  etiquetas: ['react', 'frontend', 'javascript'],
  estado: 'publicado',
  fechaInicio: Timestamp.fromDate(new Date('2026-02-01')),
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  sesiones: [{ fecha: Timestamp.fromDate(new Date('2026-02-01')), horaInicio: '09:00', horaFin: '13:00' }],
};

test('renders activity card with correct info', () => {
  render(<ActivityCard activity={mockActivity} />);
  
  expect(screen.getByText('Taller de React')).toBeInTheDocument();
  expect(screen.getByText('Programación')).toBeInTheDocument();
  expect(screen.getByText('Aprende React desde cero')).toBeInTheDocument();
  expect(screen.getByText('Taller')).toBeInTheDocument();
  expect(screen.getByText('Presencial')).toBeInTheDocument();
  expect(screen.getByText('Edificio A, Aula 101')).toBeInTheDocument();
  expect(screen.getByText('Cupo: 30')).toBeInTheDocument();
  expect(screen.getByText('react')).toBeInTheDocument();
});

test('calls onFavorite when favorite button clicked', () => {
  const handleFavorite = jest.fn();
  render(<ActivityCard activity={mockActivity} onFavorite={handleFavorite} />);
  
  fireEvent.click(screen.getByLabelText('Agregar a favoritos'));
  expect(handleFavorite).toHaveBeenCalledWith('test-1');
});

test('shows favorite state when isFavorite=true', () => {
  render(<ActivityCard activity={mockActivity} isFavorite={true} />);
  const bookmark = screen.getByLabelText('Quitar de favoritos');
  expect(bookmark).toHaveClass('text-primary');
});
```

### Integration Tests (API Routes)
**File:** `app/api/activities/route.test.ts`
```ts
import { GET, POST } from '@/app/api/activities/route';
import { adminDb } from '@/lib/firebase/admin';

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    get: jest.fn(),
    count: jest.fn().mockReturnThis(),
    add: jest.fn(),
  },
}));

describe('Activities API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET returns paginated activities', async () => {
    const mockSnapshot = {
      docs: [{ id: '1', data: () => ({ titulo: 'Test', estado: 'publicado' }) }],
    };
    const mockCount = { data: () => ({ count: 1 }) };
    
    (adminDb.collection('actividades').get as jest.Mock).mockResolvedValue(mockSnapshot);
    (adminDb.collection('actividades').count().get as jest.Mock).mockResolvedValue(mockCount);

    const request = new Request('http://localhost:3000/api/activities?page=1&limit=10');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.activities.length).toBe(1);
    expect(data.data.pagination.total).toBe(1);
  });
});
```

### E2E Tests (Playwright)
**File:** `tests/e2e/catalog.spec.ts`
```ts
import { test, expect } from '@playwright/test';

test.describe('Public Catalog', () => {
  test('loads homepage and shows activities', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Hub de Aprendizaje');
    await expect(page.locator('[data-testid="activity-card"]')).toHaveCountGreaterThan(0);
  });

  test('filters by tipo', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('select[name="tipo"]', 'taller');
    await expect(page).toHaveURL(/\/tipo=taller/);
    // Verify filtered results
  });

  test('navigates to activity detail', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="activity-card"]:first-child a:has-text("Ver detalles")');
    await expect(page).toHaveURL(/\/actividad\//);
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Organizer Flow', () => {
  test('upload PDF and review extraction', async ({ page }) => {
    await page.goto('/login');
    // Login as organizador (mock auth)
    await page.goto('/dashboard/organizer/nueva');
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/sample.pdf');
    await page.click('button:has-text("Subir y procesar con IA")');
    await expect(page.locator('text=Revisar y publicar')).toBeVisible();
    // Fill form and publish
  });
});
```

### Validation Commands
```bash
# Type checking
pnpm run lint

# Unit tests
pnpm test -- --passWithNoTests

# E2E tests
pnpm test:e2e

# Build verification
pnpm run build

# Firebase emulators for local testing
firebase emulators:start --only firestore,auth,storage,functions
```

---

## Risks, Tradeoffs, and Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Gemini extraction accuracy varies** | High - organizers may get poor pre-fill | Confidence scoring + mandatory human review; fallback to manual form |
| **Firestore composite index limits** | Medium - complex queries need indexes | Pre-create indexes in `firestore.indexes.json`; use array-contains for tags |
| **Firebase Auth domain restriction** | Medium - `@acatlan.unam.mx` may not cover all | Allow config via env var; support multiple domains |
| **Cloud Storage costs at scale** | Low - 5GB/semester well within free tier | Lifecycle rules to Nearline after 90 days |
| **Next.js 16 breaking changes** | Medium - App Router APIs evolving | Pin Next.js version; test on upgrade |
| **Shadcn/base-ui version conflicts** | Low - using wrapper pattern isolates changes | Lock versions; test component updates in isolation |

### Tradeoffs

1. **Next.js API Routes vs Cloud Run Functions**: Using Next.js API routes simplifies deployment (single build) but couples backend to frontend. For MVP this is correct; migrate to Cloud Run if scaling independently needed.

2. **Client-side Firestore listeners vs Server fetching**: Used server fetching (SSR) for public pages for SEO/performance; client listeners only for organizer draft preview (real-time). Tradeoff: slight delay in public catalog updates vs simpler architecture.

3. **Structured JSON output from Gemini**: More reliable than parsing free text but requires Vertex AI structured generation (beta). Fallback: regex parsing if structured fails.

4. **Single activity collection with `estado` field vs separate collections**: Single collection simplifies queries but mixes drafts/published. Tradeoff: accepted for simplicity; rules enforce access control.

### Open Questions

1. **Image thumbnail generation**: Should we generate thumbnails on upload (Cloud Function) or client-side? Client-side reduces backend complexity but increases client bundle.

2. **Notification system**: Document mentions Cloud Scheduler + FCM for reminders. Implementation deferred to Phase 2. Need to decide: FCM web push vs email.

3. **Search**: Firestore lacks full-text search. MVP uses `etiquetas` array-contains. Phase 2: Algolia/Meilisearch or Vertex AI Vector Search.

4. **Admin user creation**: First admin must be created manually via Firebase Console or script. Document process.

5. **Analytics/Metrics**: `extracciones` collection tracks AI accuracy. Need dashboard to visualize extraction confidence trends.

6. **Multi-campus support**: Data model supports it (add `campusId` to activities), but UI/routing not designed for it. Defer.

7. **Accessibility**: All components need ARIA testing. Shadcn/base-ui provides good base but custom components need review.

---

## Implementation Order Summary

| Phase | Tasks | Est. Time | Dependencies |
|-------|-------|-----------|--------------|
| 0 | Setup, Env, Firebase init, Types | 30 min | None |
| 1 | UI Wrappers (shadcn + app components) | 60 min | Phase 0 |
| 2 | API Routes (Auth, Upload, AI, CRUD, Admin) | 90 min | Phase 0 |
| 3 | Pages (Home, Detail, Login, Dashboards) | 120 min | Phases 1, 2 |
| 4 | Supporting Components (Header, Footer, Lists) | 45 min | Phase 1 |
| 5 | Firebase Config, Deploy | 30 min | Phase 0 |

**Total estimated: ~6 hours** for complete MVP implementation.

---

## Next Steps

1. Run `pnpm install` with new dependencies
2. Create `.env.local` with Firebase/Vertex AI credentials
3. Execute Phase 0 tasks in order
4. Use Firebase Emulators for local development: `firebase emulators:start`
5. Deploy to Firebase Hosting for staging: `pnpm run deploy:hosting`
6. Configure custom domain and SSL
7. Set up monitoring alerts in Cloud Console (budget, error rates)