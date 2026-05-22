# PickyMenu — Level 1 (Menu Chatbot)

## Project Overview

PickyMenu Level 1 is a multi-tenant SaaS platform that powers a WhatsApp-based menu chatbot for restaurants. Diners interact via WhatsApp in their preferred language; restaurant owners manage their menu from a web dashboard. The AI agent (Claude via n8n) reads the menu database before responding or recommending dishes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend / DB | Supabase (Postgres + Auth + Storage) |
| AI Orchestration | n8n (existing instance) |
| WhatsApp Integration | Kapso.ai (one account per restaurant) |
| Hosting | Vercel |
| Language | TypeScript |

---

## Architecture

```
Diner (WhatsApp)
    ↓
Kapso.ai (per-restaurant account)
    ↓  webhook POST /webhook/{restaurant_id}
n8n Workflow
    ↓  query menu DB
Supabase (menu items, categories, availability)
    ↓  Claude API (via n8n Anthropic node)
AI Response (multilingual)
    ↓
Kapso.ai → WhatsApp reply to diner
```

Web Admin Dashboard (React + Vite → Vercel) talks directly to Supabase via the JS client using Row Level Security (RLS).

---

## Roles & Permissions

| Role | Description | Permissions |
|---|---|---|
| `superadmin` | PickyMenu operator | Create/manage restaurants, assign admins and staff globally |
| `admin` | Restaurant owner | Full CRUD on their restaurant's menu, categories, items, images, schedules; assign staff |
| `staff` | Restaurant employee | Mark items as sold out / available; view menu; limited edits defined by admin |

All roles are enforced via Supabase RLS policies using a `profiles` table with a `role` column and a `restaurant_id` foreign key.

---

## Database Schema (Supabase / Postgres)

### `restaurants`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
name          text NOT NULL
slug          text UNIQUE NOT NULL         -- used in webhook URL
kapso_webhook_secret  text                -- to verify Kapso webhook signatures
timezone      text NOT NULL DEFAULT 'America/Los_Angeles'
created_at    timestamptz DEFAULT now()
```

### `profiles`
```sql
id            uuid PRIMARY KEY REFERENCES auth.users
restaurant_id uuid REFERENCES restaurants(id)  -- null for superadmin
role          text NOT NULL CHECK (role IN ('superadmin','admin','staff'))
full_name     text
created_at    timestamptz DEFAULT now()
```

### `categories`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id uuid REFERENCES restaurants(id) NOT NULL
name          text NOT NULL
sort_order    int DEFAULT 0
active        boolean DEFAULT true
created_at    timestamptz DEFAULT now()
```

### `menu_items`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id   uuid REFERENCES restaurants(id) NOT NULL
category_id     uuid REFERENCES categories(id)
name            text NOT NULL
description     text
price           numeric(10,2)
image_url       text                        -- Supabase Storage public URL
available       boolean DEFAULT true
chef_recommendation  boolean DEFAULT false
chef_note       text                        -- free text from chef
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### `item_schedules`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
item_id       uuid REFERENCES menu_items(id) NOT NULL
day_of_week   int[]                         -- 0=Sun … 6=Sat; empty = every day
time_start    time NOT NULL
time_end      time NOT NULL
```

### `conversations`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id uuid REFERENCES restaurants(id) NOT NULL
whatsapp_number  text NOT NULL
started_at    timestamptz DEFAULT now()
last_message_at  timestamptz
```

### `messages`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
conversation_id uuid REFERENCES conversations(id) NOT NULL
role            text CHECK (role IN ('user','assistant'))
content         text NOT NULL
created_at      timestamptz DEFAULT now()
```

---

## Supabase Storage

Bucket: `menu-images`  
Access: public read, authenticated write (admin/staff only via RLS)  
Path convention: `{restaurant_id}/{item_id}.webp`

Images should be uploaded as WebP, max 2MB, resized to 800×600px on the client before upload.

---

## Webhook Endpoint (n8n)

Each restaurant registers a unique n8n webhook:

```
POST https://{n8n-instance}/webhook/{restaurant_id}
```

Kapso sends a payload with the diner's message. n8n workflow:

1. Extract `restaurant_id` from URL path.
2. Query Supabase for the restaurant's active menu (categories + items + schedules).
3. Filter items by current day/time availability.
4. Retrieve last N messages from `conversations` / `messages` for context.
5. Build system prompt (see below) and call Claude API.
6. Save assistant reply to `messages`.
7. Return reply text to Kapso → WhatsApp.

---

## AI Agent System Prompt Template

```
You are a friendly restaurant assistant for {restaurant_name}.
Your only job is to help diners explore the menu and make recommendations.
You do NOT take orders.
Always respond in the same language the diner is using.
Supported languages: English, Spanish, German, French, Italian.

Today is {weekday}, {date}. Current time: {current_time} ({timezone}).

Available menu:
{menu_json}

Chef's recommendations are marked with ⭐.
Only recommend items that are currently available based on the time and day.
Keep responses warm, concise, and helpful.
```

---

## Conversation Memory & Knowledge Base

### Tenant isolation rule

All conversation history queries **must** filter by `restaurant_id`. A diner's messages from Restaurant A must never be visible to Restaurant B's Claude context. The `conversations` table carries `restaurant_id`; every query joins through it.

```sql
-- Correct pattern — always scope by restaurant
SELECT m.role, m.content, m.created_at
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.restaurant_id = :restaurant_id
  AND c.whatsapp_number = :whatsapp_number
ORDER BY m.created_at DESC
LIMIT 10;
```

---

### Option A — Recent-message history (active now)

Before each Claude call, n8n queries the last 10 messages from `conversations` / `messages` for the same `whatsapp_number` × `restaurant_id` pair and injects them as conversation history in the prompt.

**n8n workflow steps (expanded):**

1. Extract `restaurant_id` from webhook URL path and `whatsapp_number` from Kapso payload.
2. Upsert a row in `conversations` (find or create) using `(restaurant_id, whatsapp_number)`.
3. Query the last 10 messages for that conversation (scoped to `restaurant_id` — see query above).
4. Query the restaurant's active menu (categories + items + schedules, filtered by current day/time).
5. Build the Claude prompt — system prompt + menu JSON + conversation history + new user message.
6. Call Claude API (Anthropic node in n8n).
7. Save assistant reply to `messages`.
8. Return reply text to Kapso → WhatsApp.

**Prompt shape with history:**

```
[system prompt with menu]

Conversation so far:
User: {message_1}
Assistant: {reply_1}
User: {message_2}
Assistant: {reply_2}
…

User: {new_message}
```

**Characteristics:**

| Property | Value |
|---|---|
| Memory scope | Last 10 messages per diner per restaurant |
| Persistence | Across sessions (stored in DB, not in n8n memory) |
| Context window cost | ~10 turns × avg message length |
| Suitable for | Menus up to ~100 items; typical conversation lengths |
| Implementation effort | Low — two DB queries already in the workflow |

---

### Option B — Semantic search with pgvector (roadmap)

For larger menus or to enable FAQ-style learning, add vector embeddings alongside the message history approach.

**Setup:**

```sql
-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Embedding storage table
CREATE TABLE menu_embeddings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  source_type      text NOT NULL CHECK (source_type IN ('menu_item', 'conversation_summary')),
  source_id        uuid,                          -- menu_items.id or conversations.id
  content          text NOT NULL,                 -- the text that was embedded
  embedding        vector(1536),                  -- dimension matches the embedding model
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON menu_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Tenant isolation: RLS on menu_embeddings
ALTER TABLE menu_embeddings ENABLE ROW LEVEL SECURITY;
```

**n8n workflow additions:**

1. **Embed the incoming message** using an embedding model (e.g. `text-embedding-3-small`).
2. **Semantic search** — find the top-K most relevant menu items or conversation summaries:
   ```sql
   SELECT content, 1 - (embedding <=> :query_embedding) AS similarity
   FROM menu_embeddings
   WHERE restaurant_id = :restaurant_id
   ORDER BY embedding <=> :query_embedding
   LIMIT 5;
   ```
3. **Inject retrieved context** into the Claude prompt alongside the recent message history.
4. **Post-session** — generate a summary embedding for the completed conversation and store it as a `conversation_summary` row (useful for learning recurring questions).

**Characteristics:**

| Property | Value |
|---|---|
| Memory scope | Semantically relevant context across all conversations |
| Persistence | Permanent (embeddings stored in DB) |
| Context window cost | Lower — only top-K relevant chunks, not full history |
| Suitable for | Large menus (200+ items), FAQ pattern detection, long-term learning |
| Implementation effort | High — embedding pipeline, index maintenance, summary jobs |

**When to switch from A to B:**

- Menu exceeds ~150 items and the full JSON no longer fits comfortably in the Claude context window.
- Diners frequently ask the same questions and you want the agent to surface those FAQ answers proactively.
- You want to personalise responses based on a diner's long-term order history.

---

## n8n Workflow Detail

### Workflow map

```
[1] Webhook Trigger          POST /webhook/:restaurant_id
        │
[2] Extract & validate       Code node — parse URL, extract whatsapp_number
        │
[3] Fetch restaurant         Supabase — get name, timezone, kapso_webhook_secret
        │
[4] Verify signature         Code node — HMAC-SHA256 guard
        │
[5] Fetch active menu        Supabase — items + categories + schedules
        │
[6] Filter by day/time       Code node — timezone-aware availability check
        │
[7] Find/create conversation Supabase — upsert with 24 h session window
        │
[8] Save user message        Supabase — insert into messages (role: 'user')
        │
[9] Fetch history            Supabase — last 10 messages for this conversation
        │
[10] Build prompt            Code node — assemble system prompt + history
        │
[11] Call Claude             Anthropic node — claude-3-5-sonnet
        │
[12] Save assistant message  Supabase — insert into messages (role: 'assistant')
        │
[13] Respond to Webhook      n8n Respond node — return reply to Kapso
```

---

### Kapso webhook payload (incoming)

Kapso POSTs this JSON to `https://{n8n-instance}/webhook/{restaurant_id}` for every inbound WhatsApp message:

```json
{
  "message": {
    "id":   "wamid.abc123==",
    "from": "15551234567",
    "text": {
      "body": "What do you have for lunch today?"
    }
  },
  "conversation": {
    "id":              "kapso_conv_xyz789",
    "phone_number_id": "kapso_phone_abc123"
  }
}
```

| Field | Path | Description |
|---|---|---|
| Message text | `body.message.text.body` | The diner's WhatsApp message |
| Sender number | `body.message.from` | WhatsApp number, no `+` prefix |
| Kapso conversation ID | `body.conversation.id` | Kapso's own session tracker (distinct from our DB `conversations.id`) |
| Phone number ID | `body.conversation.phone_number_id` | Kapso's registered phone number identifier |

The webhook signature arrives in the HTTP header:

```
x-webhook-signature: <hex-digest>
```

The digest is `HMAC-SHA256(rawRequestBody, kapso_webhook_secret)`. The value is a raw hex string — **no** `sha256=` prefix.

---

### Response format Kapso expects

n8n's **Respond to Webhook** node (node 13) must reply within ~20 s with HTTP 200 and this body:

```json
{
  "reply": "Here's what we have for lunch today! …"
}
```

Kapso reads the `reply` field and forwards it as a WhatsApp text message back to the diner's number. Any non-200 status or missing `reply` field is treated as a delivery failure.

---

### Node-by-node configuration

#### Node 1 — Webhook Trigger

| Setting | Value |
|---|---|
| HTTP method | POST |
| Path | `/webhook/:restaurant_id` |
| Response mode | **Using "Respond to Webhook" node** (node 13) |
| Raw body | **on** — required so Node 4 can verify the HMAC signature |

The `:restaurant_id` path parameter is automatically exposed as `$json.params.restaurant_id` in downstream nodes. The raw request body is available at `$json.rawBody` when the Raw body option is enabled.

---

#### Node 2 — Extract & validate (Code)

Parses the confirmed Kapso payload and normalises the fields used throughout the rest of the workflow.

```javascript
const params  = $('Webhook Trigger').first().json.params;
const body    = $('Webhook Trigger').first().json.body;
const rawBody = $('Webhook Trigger').first().json.rawBody; // for HMAC verification

const restaurantId        = params.restaurant_id;
const whatsappNumber      = body.message?.from;              // confirmed path
const messageText         = body.message?.text?.body ?? '';  // confirmed path
const kapsoConversationId = body.conversation?.id;           // Kapso's session ID
const phoneNumberId       = body.conversation?.phone_number_id;

// Skip if no text content — image, audio, sticker, etc.
if (!messageText.trim()) {
  return [{ json: { skip: true } }];
}

// Validate restaurant_id is a UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(restaurantId)) {
  throw new Error(`Invalid restaurant_id in URL: ${restaurantId}`);
}

if (!whatsappNumber) {
  throw new Error('Missing body.message.from — cannot identify sender');
}

return [{ json: {
  restaurantId,
  whatsappNumber,
  messageText,
  kapsoConversationId,
  phoneNumberId,
  rawBody,
} }];
```

Add an **IF node** after this to stop the workflow when `skip === true`.

---

#### Node 3 — Fetch restaurant (Supabase / HTTP Request)

**Operation:** SELECT  
**Table:** `restaurants`  
**Filter:** `id` = `{{ $json.restaurantId }}`  
**Columns:** `id, name, timezone, kapso_webhook_secret`

Returns exactly one row. If zero rows → the restaurant_id in the URL is unknown; add error handling.

---

#### Node 4 — Verify webhook signature (Code)

```javascript
const crypto  = require('crypto');

const secret  = $('Fetch Restaurant').first().json.kapso_webhook_secret ?? '';
const rawBody = $('Extract and Validate').first().json.rawBody;
// Confirmed header name — raw hex digest, no 'sha256=' prefix
const header  = $('Webhook Trigger').first().json.headers['x-webhook-signature'] ?? '';

const expected = crypto
  .createHmac('sha256', secret)
  .update(rawBody, 'utf8')
  .digest('hex');

if (secret && header !== expected) {
  throw new Error('Webhook signature mismatch — request rejected');
}

// Pass through — signature valid (or secret not yet configured for this restaurant)
return [{ json: { verified: true } }];
```

> If `kapso_webhook_secret` is null the guard is skipped (fail-open). Set it on every restaurant in production.

---

#### Node 5 — Fetch active menu (Supabase / HTTP Request)

Use a Supabase HTTP Request node with the service role key to run this query via the REST API (`/rest/v1/rpc` or direct table endpoint). Alternatively, use the Postgres node with a raw SQL query:

```sql
SELECT
  mi.id,
  mi.name,
  mi.description,
  mi.price,
  mi.chef_recommendation,
  mi.chef_note,
  c.name            AS category,
  c.sort_order      AS category_order,
  COALESCE(
    json_agg(
      json_build_object(
        'day_of_week', s.day_of_week,
        'time_start',  s.time_start::text,
        'time_end',    s.time_end::text
      )
    ) FILTER (WHERE s.id IS NOT NULL),
    '[]'::json
  ) AS schedules
FROM   menu_items mi
JOIN   categories c  ON c.id = mi.category_id
LEFT JOIN item_schedules s ON s.item_id = mi.id
WHERE  mi.restaurant_id = '{{ $('Extract & Validate').first().json.restaurantId }}'
  AND  mi.available = true
  AND  c.active     = true
GROUP BY mi.id, mi.name, mi.description, mi.price,
         mi.chef_recommendation, mi.chef_note,
         c.name, c.sort_order
ORDER BY c.sort_order, mi.name;
```

---

#### Node 6 — Filter by day/time (Code)

Converts "now" into the restaurant's local time and removes items whose schedule windows don't include it.

```javascript
const timezone = $('Fetch Restaurant').first().json.timezone;  // e.g. 'America/Los_Angeles'
const items    = $('Fetch Active Menu').all().map(i => i.json);

// Resolve current local time in the restaurant's timezone
const now  = new Date();
const fmt  = new Intl.DateTimeFormat('en-US', {
  timeZone: timezone,
  weekday: 'short',    // 'Sun' … 'Sat'
  hour:    '2-digit',
  minute:  '2-digit',
  hour12:  false,
});
const parts   = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
const DOW_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const dayOfWeek = DOW_MAP[parts.weekday];                    // 0–6
const localTime = `${parts.hour.padStart(2,'0')}:${parts.minute}`;  // 'HH:MM'

const available = items.filter(item => {
  const schedules = item.schedules ?? [];
  if (schedules.length === 0) return true;  // no schedule = always available

  return schedules.some(s => {
    const dayOk  = s.day_of_week.length === 0 || s.day_of_week.includes(dayOfWeek);
    const timeOk = localTime >= s.time_start && localTime <= s.time_end;
    return dayOk && timeOk;
  });
});

// Also expose localTime and weekday for the system prompt
const weekdayName = parts.weekday;
return [{ json: { items: available, localTime, weekdayName, timezone } }];
```

---

#### Node 7 — Find or create conversation (Supabase)

A 24-hour session window: reuse the most recent conversation if the diner messaged within the past day; otherwise start a fresh one.

**Step 7a — Find recent conversation (SELECT):**

```sql
SELECT id
FROM   conversations
WHERE  restaurant_id   = '{{ $('Extract & Validate').first().json.restaurantId }}'
  AND  whatsapp_number = '{{ $('Extract & Validate').first().json.whatsappNumber }}'
  AND  last_message_at > now() - INTERVAL '24 hours'
ORDER BY last_message_at DESC
LIMIT 1;
```

**Step 7b — Create if not found (INSERT, run only when 7a returns 0 rows):**

```sql
INSERT INTO conversations (restaurant_id, whatsapp_number, started_at, last_message_at)
VALUES (
  '{{ $('Extract & Validate').first().json.restaurantId }}',
  '{{ $('Extract & Validate').first().json.whatsappNumber }}',
  now(), now()
)
RETURNING id;
```

**Step 7c — Update last_message_at (UPDATE, run when 7a returns a row):**

```sql
UPDATE conversations
SET    last_message_at = now()
WHERE  id = '{{ $('Find Conversation').first().json.id }}'
RETURNING id;
```

Merge the conversation `id` into a single output using a Code node or Merge node before proceeding.

---

#### Node 8 — Save user message (Supabase)

**Operation:** INSERT  
**Table:** `messages`

```json
{
  "conversation_id": "{{ $('Resolve Conversation').first().json.id }}",
  "role": "user",
  "content": "{{ $('Extract & Validate').first().json.messageText }}"
}
```

---

#### Node 9 — Fetch conversation history (Supabase)

```sql
SELECT   role, content, created_at
FROM     messages
WHERE    conversation_id = '{{ $('Resolve Conversation').first().json.id }}'
ORDER BY created_at DESC
LIMIT    10;
```

Results come back newest-first. The Code node in step 10 reverses them to chronological order before building the prompt.

---

#### Node 10 — Build system prompt (Code)

```javascript
const restaurant = $('Fetch Restaurant').first().json;
const filtered   = $('Filter by Day/Time').first().json;
const history    = $('Fetch History').all().map(i => i.json).reverse(); // oldest first
const userMsg    = $('Extract & Validate').first().json.messageText;

// Build menu JSON — group items by category
const byCategory = {};
for (const item of filtered.items) {
  if (!byCategory[item.category]) byCategory[item.category] = [];
  byCategory[item.category].push({
    name:        item.name,
    description: item.description,
    price:       item.price,
    chef_pick:   item.chef_recommendation,
    chef_note:   item.chef_note,
  });
}

const menuJson = JSON.stringify(byCategory, null, 2);

// Format history as alternating turns
const historyText = history
  .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
  .join('\n');

const now = new Date();
const dateStr = now.toLocaleDateString('en-US', {
  timeZone: restaurant.timezone,
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

const systemPrompt = `You are a friendly restaurant assistant for ${restaurant.name}.
Your only job is to help diners explore the menu and make recommendations.
You do NOT take orders.
Always respond in the same language the diner is using.
Supported languages: English, Spanish, German, French, Italian.

Today is ${dateStr}. Current time: ${filtered.localTime} (${restaurant.timezone}).

Available menu (JSON):
${menuJson}

Chef's recommendations are marked with chef_pick: true — highlight them with ⭐.
Only recommend items listed above (unavailable items have already been filtered out).
Keep responses warm, concise, and helpful.`;

const messages = [
  ...history.map(m => ({ role: m.role, content: m.content })),
  { role: 'user', content: userMsg },
];

return [{ json: { systemPrompt, messages } }];
```

---

#### Node 11 — Call Claude (Anthropic node)

| Setting | Value |
|---|---|
| Model | `claude-3-5-sonnet-20241022` (or `claude-3-haiku-20240307` for lower cost) |
| System prompt | `{{ $json.systemPrompt }}` |
| Messages | `{{ $json.messages }}` (array) |
| Max tokens | 1024 |
| Temperature | 0.7 |

The Anthropic node returns the assistant text in `$json.content[0].text` (native API shape) or `$json.text` depending on n8n node version — check the output and adjust node 12's reference accordingly.

---

#### Node 12 — Save assistant message (Supabase)

**Operation:** INSERT  
**Table:** `messages`

```json
{
  "conversation_id": "{{ $('Resolve Conversation').first().json.id }}",
  "role": "assistant",
  "content": "{{ $('Call Claude').first().json.text }}"
}
```

---

#### Node 13 — Respond to Webhook

**Response code:** 200  
**Response body:**

```json
{
  "reply": "{{ $('Call Claude').first().json.text }}"
}
```

Set **Content-Type** to `application/json`.

---

### Error handling

| Failure point | Strategy |
|---|---|
| Unknown `restaurant_id` | Node 3 returns 0 rows → IF node → Respond 404 `{"error":"restaurant not found"}` |
| Invalid signature | Node 4 throws → catch with Error Trigger → Respond 401 |
| Non-text message (image, audio) | Node 2 sets `skip:true` → IF node → Respond 200 `{"reply":""}` (silent ignore) |
| Claude API error | Anthropic node fails → catch → Respond 200 with fallback text so Kapso doesn't retry |
| DB write failure | Log to n8n execution log; Kapso will retry on timeout — idempotency key = `message.id` |

Fallback reply text (node 11 error branch):

```
"Sorry, I'm having a little trouble right now. Please try again in a moment! 🙏"
```

---

## Web Dashboard — Pages & Features

### Auth
- `/login` — Supabase Auth email/password
- `/forgot-password`

### Superadmin (`/superadmin/*`)
- Restaurants list — create, deactivate
- Users list — assign roles, link to restaurant
- Global stats (future)

### Admin & Staff (`/dashboard/*`)
- **Overview** — quick stats (items count, categories, last update)
- **Categories** — add / rename / reorder / deactivate categories
- **Menu Items** — CRUD table with image upload, chef note, price, availability toggle, schedule
- **Availability** — bulk toggle items (useful for staff: mark sold out)
- **Settings** — restaurant name, timezone, Kapso webhook URL display

### Staff restrictions (vs Admin)
- Cannot add/delete categories
- Cannot delete menu items
- Cannot change prices
- Can toggle `available` on items
- Can add/edit `chef_note`

---

## Image Upload Flow (Admin UI)

1. User selects image in form.
2. Client resizes to max 800×600, converts to WebP using `browser-image-compression`.
3. Upload to Supabase Storage: `menu-images/{restaurant_id}/{item_id}.webp`.
4. Save public URL to `menu_items.image_url`.

---

## Kapso.ai Setup (Per Restaurant)

1. Create account at kapso.ai.
2. Connect a WhatsApp Business number (Kapso provides a US number by default; custom number available later).
3. Configure webhook URL: `https://{n8n-instance}/webhook/{restaurant_id}`.
4. Copy webhook secret into `restaurants.kapso_webhook_secret`.
5. Test with a WhatsApp message.

---

## Multilingual Support

The AI agent auto-detects the diner's language from their message and responds accordingly. No configuration needed per restaurant. Supported: `en`, `es`, `de`, `fr`, `it`.

The admin dashboard UI will be in English (v1). Spanish localization is a v2 priority.

---

## Environment Variables

### Vercel (Frontend)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### n8n
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

---

## Project Structure

```
pickymenu-level1/
├── public/
├── src/
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── menu/             # MenuItemCard, CategoryList, ImageUpload
│   │   └── layout/           # Sidebar, Header, PageShell
│   ├── pages/
│   │   ├── auth/             # Login, ForgotPassword
│   │   ├── superadmin/       # Restaurants, Users
│   │   └── dashboard/        # Overview, Categories, MenuItems, Availability, Settings
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client
│   │   ├── storage.ts        # Image upload helpers
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useMenu.ts
│   │   ├── useCategories.ts
│   │   └── useAuth.ts
│   ├── types/
│   │   └── database.ts       # Generated Supabase types
│   └── App.tsx
├── supabase/
│   ├── migrations/           # SQL migration files
│   └── seed.sql              # Sample data for dev
├── .env.local
├── CLAUDE.md                 # ← this file
└── vite.config.ts
```

---

## Development Workflow

1. `npm create vite@latest pickymenu-level1 -- --template react-ts`
2. Install deps: `supabase-js`, `react-router-dom`, `@tanstack/react-query`, `shadcn/ui`, `browser-image-compression`, `date-fns`, `lucide-react`
3. Run Supabase locally: `supabase start`
4. Apply migrations: `supabase db push`
5. Generate types: `supabase gen types typescript --local > src/types/database.ts`
6. `npm run dev`

---

## Coding Conventions

- TypeScript strict mode.
- All Supabase queries go through custom hooks in `/hooks`.
- RLS is the single source of truth for permissions — never trust the frontend role alone.
- Use `date-fns` for all date/time logic; always work in the restaurant's timezone.
- Component file names: PascalCase. Hook files: camelCase prefixed with `use`.
- No `any` types.
- Prefer `async/await` over `.then()`.
- All forms use controlled components (no `<form>` for React artifacts).

---

## Key Constraints & Notes

- **RLS first**: Every Supabase table must have RLS enabled. Policies enforce `restaurant_id` isolation between tenants.
- **n8n is stateless per call**: Always pass conversation history in the prompt, not stored in n8n.
- **Kapso webhook verification**: Always validate the webhook signature before processing.
- **Availability is time-zone aware**: Use the restaurant's `timezone` field when filtering `item_schedules`.
- **Images are optional**: Items can exist without an image; the UI should handle `image_url = null` gracefully.
- **Staff cannot see other restaurants**: RLS + `restaurant_id` on `profiles` enforces this automatically.
