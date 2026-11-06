# AI-Powered Collaborative Event Photo Gallery

A modern web application where attendees of weddings, college events, tournaments, and trips can upload photos to a single shared gallery, browse at high speed with thumbnail-first previews, and discover moments and people effortlessly.

---

## 1. Quick Start & Setup

### Prerequisites
- **Node.js**: v20+ (tested on Node v24)
- **Database**: PostgreSQL (Cloud or Local Docker)

### Step 1: Clone & Install Dependencies
```bash
npm install
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your `.env` variables:
* **DATABASE_URL**: PostgreSQL connection string.
  - *Option A (Cloud - Recommended $0 setup)*: Create a free database in 30 seconds at [Neon](https://neon.tech) or [Supabase](https://supabase.com).
    ```env
    DATABASE_URL="postgresql://<user>:<password>@<neon-host>/photo_event_gallery?sslmode=require"
    ```
  - *Option B (Local Docker)*:
    ```bash
    docker run --name photo-event-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=photo_event_gallery -p 5432:5432 -d postgres:16-alpine
    ```
    ```env
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/photo_event_gallery?schema=public"
    ```
* **AUTH_SECRET**: Generate with `openssl rand -base64 32`
* **AUTH_GOOGLE_ID** & **AUTH_GOOGLE_SECRET**: Google OAuth credentials from Google Cloud Console.
* **ENABLE_DEV_AUTH_SHORTCUT**: Set to `"true"` for local development without live Google credentials. (Strictly disabled and rejected with 403 in production).

### Step 3: Run Database Migrations
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### Step 4: Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. Architecture & Data Model (Phase 1)

### Role & Identity Security Model
- **OWNER**: Full administrative control over the event, permissions, member invitations, and deletion.
- **MEMBER**: Can view permitted gallery photos, upload photos, and leave the event. Leaving an event revokes access but safely retains uploaded photos in the event gallery.
- **GUEST**: Modeled separately via `GuestIdentity` with cryptographically secure temporary tokens (`crypto.randomBytes(32)`), separate from registered user accounts.
- **Server-Side Enforcement**: All permissions are verified directly against the database on every sensitive operation (`checkEventAccess()`, `requireEventRole()`). Client-supplied roles or user IDs are never trusted.

### Physical vs. Logical Asset Separation
- `PhotoAsset`: Represents the physical file on disk (or private S3 bucket), uniquely identified by SHA-256 `fileHash`.
- `Photo`: Represents the logical presence of a photo inside a specific event (`@@unique([eventId, assetId])`).
- `PhotoUploadReference`: Tracks each user who uploaded the asset, preserving provenance and safe deletion rules.

### Private Storage Abstraction
- All original and preview photos are kept outside public web roots (`storage/originals/`, `storage/previews/`, `storage/thumbnails/`).
- Files are accessed only via authenticated streaming API routes with permission verification.
- Local filesystem provider is used for zero-cost local development, ready for S3/MinIO cloud adapter in production.

---

## 3. Verified Verification Commands

| Command | Description |
| :--- | :--- |
| `npm run lint` | Runs ESLint checks across all TypeScript components and APIs |
| `npx tsc --noEmit` | Strict TypeScript compiler type validation |
| `npm run build` | Full Next.js production build with static/dynamic route verification |

---

## 4. Phase Status & Next Milestones

- [x] **Phase 0**: Repository Inspection & Architecture Planning
- [x] **Phase 1**: Reliable Foundation (Prisma ORM, Google OAuth + Isolated Dev Auth, Event CRUD, Role-based permissions, Responsive UI)
- [x] **Phase 2**: Collaborative Upload Pipeline (Multi-upload progress, Sharp thumbnail & 1600px preview WebP generation, duplicate SHA-256 deduplication, deletion rules)
- [ ] **Phase 3**: Fast Gallery Experience & Viewer (Cursor pagination, responsive grid, full-screen lightbox, EXIF metadata, original downloads)
- [ ] **Phase 4**: Hybrid Sharing, QR Codes & 7-Day Lifecycle Recovery
- [ ] **Phase 5**: AI Face Grouping & Discovery (Decoupled Python worker, face detection, clustering, manual corrections, opt-out)
- [ ] **Phase 6**: Personalized Collections & Batch ZIP Downloads (ALL/ANY filters, saved collections, async ZIP generation)
- [ ] **Phase 7**: End-to-End Multi-User Demonstration
