# Ledger — Personal Budget App

A beautiful, AI-powered personal budgeting app built with Next.js, Supabase, and Claude. Upload screenshots or PDFs of your bank statements and let AI extract, categorize, and organize your transactions automatically.

## ✨ Features

- **AI Statement Import** — Upload PNG/JPG screenshots or PDFs of bank/credit card statements. Claude vision AI extracts every transaction automatically.
- **Smart Categorization** — Transactions are auto-categorized with 16 built-in categories. The app learns from your corrections and creates merchant rules.
- **Import Review Flow** — See all detected transactions before importing. Approve, reject, edit categories, or flag transfers/duplicates.
- **Beautiful Dashboard** — Spending rings, budget progress bars, account balances, and monthly trends at a glance.
- **Budget Tracking** — Set monthly budgets per category. Visual progress indicators show spending vs. budget in real time.
- **Recurring Detection** — Automatically detects subscriptions and recurring bills from transaction patterns.
- **Analytics** — Category breakdowns, 6-month spending trends, and recurring expense tracking.
- **iPhone PWA** — Add to home screen for a native app feel. Designed mobile-first with safe area support.
- **Dark Mode** — Apple-inspired dark UI, always on.
- **Canadian Bank Support** — Tuned for TD, RBC, BMO, Scotiabank, CIBC, Tangerine, EQ Bank, and major credit cards.

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/budget-app.git
cd budget-app
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Go to **SQL Editor** and paste the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Run it — this creates all tables, indexes, and seeds default categories

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Where to find these:**
- Supabase keys: Project Settings → API
- Gemini key: Go to aistudio.google.com → Get API Key → free, no credit card needed

### 4. Run Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the dashboard.

---

## 📱 iPhone PWA Setup

1. Open Safari on your iPhone and navigate to your deployed URL
2. Tap the Share button → **Add to Home Screen**
3. Name it "Ledger" and tap Add
4. Launch from your home screen — it opens full screen like a native app

---

## 🗂 Project Structure

```
budget-app/
├── src/
│   ├── app/
│   │   ├── (app)/                    # App shell with nav
│   │   │   ├── layout.tsx            # Bottom nav + top bar
│   │   │   ├── dashboard/page.tsx    # Main overview
│   │   │   ├── transactions/page.tsx # Transaction list + search
│   │   │   ├── upload/page.tsx       # Statement upload
│   │   │   ├── budgets/page.tsx      # Budget management
│   │   │   ├── analytics/page.tsx    # Charts & trends
│   │   │   ├── accounts/page.tsx     # Account details
│   │   │   └── settings/page.tsx     # Accounts, categories, rules
│   │   └── api/
│   │       ├── upload/route.ts       # AI statement extraction
│   │       ├── upload/import/route.ts # Transaction import
│   │       ├── transactions/route.ts  # CRUD
│   │       ├── accounts/route.ts      # CRUD
│   │       ├── budgets/route.ts       # CRUD
│   │       ├── categories/route.ts    # CRUD
│   │       └── rules/route.ts         # Merchant rules
│   ├── components/
│   │   ├── layout/                   # TopBar, BottomNav
│   │   ├── dashboard/                # Dashboard widgets
│   │   ├── transactions/             # TransactionEditModal
│   │   └── upload/                   # ImportReview
│   ├── lib/
│   │   ├── supabase/                 # client.ts, server.ts, db.ts
│   │   ├── types/                    # TypeScript types
│   │   └── utils/                    # Helpers, formatters
│   └── styles/
│       └── globals.css               # Design tokens, dark mode
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Full DB schema + seed data
├── public/
│   └── manifest.json                 # PWA manifest
└── .env.example
```

---

## 🗄 Database Schema

| Table | Purpose |
|-------|---------|
| `accounts` | Checking, savings, credit card accounts |
| `categories` | System + custom spending categories |
| `transactions` | All financial transactions |
| `transaction_splits` | Split transaction support |
| `budgets` | Monthly budget limits per category |
| `merchant_rules` | AI learning — merchant → category mappings |
| `recurring_transactions` | Detected recurring bills/subscriptions |

---

## 🤖 How AI Import Works

1. **Upload** — Drop a PNG, JPG, or PDF of your bank statement
2. **Extract** — Claude vision AI reads every transaction: date, merchant, amount
3. **Categorize** — Merchant rules are applied first; AI categorizes the rest
4. **Flag** — Transfers and potential duplicates are automatically flagged
5. **Review** — You approve/reject each transaction and fix any categories
6. **Import** — Approved transactions are saved; merchant rules are updated for next time

**Supported statements:**
- Any Canadian bank or credit card (TD, RBC, BMO, Scotiabank, CIBC, Tangerine, EQ Bank, PC Financial, etc.)
- Screenshots from mobile banking apps
- Downloaded PDF statements
- Multiple files in one upload session

---

## 🚢 Deployment

### Vercel (Recommended — Free)

```bash
npm install -g vercel
vercel
```

Add your environment variables in the Vercel dashboard under Project → Settings → Environment Variables.

### Self-Hosted (Docker)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t ledger .
docker run -p 3000:3000 --env-file .env.local ledger
```

---

## 📤 Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial commit — Ledger budget app"
git remote add origin https://github.com/yourusername/budget-app.git
git branch -M main
git push -u origin main
```

---

## 🔧 Customization

### Add a New Category
Go to Settings → Categories, or insert directly in Supabase:
```sql
insert into categories (name, color, icon, is_system)
values ('Pet Care', '#f59e0b', '🐾', false);
```

### Add Merchant Rules
Any time you recategorize a transaction, a rule is created automatically. You can also add manually in Settings → Rules.

### Change Default Currency
Currently set to `CAD`. To change, update `formatCurrency()` in `src/lib/utils/index.ts`.

---

## 🔒 Security Notes

- RLS (Row Level Security) is **disabled by default** for simplicity on personal use
- Your data stays in your own Supabase project — nothing is shared
- API keys are server-side only (never exposed to the browser)
- To add authentication, re-enable RLS in the SQL migration and add auth policies

---

## 📋 Monthly Workflow

1. **Download statements** from your bank (PDF or screenshot)
2. **Open Ledger** on your phone
3. **Tap Upload** → Select your account → Drop files
4. **Review** the extracted transactions (30 seconds)
5. **Import** — done! Dashboard updates instantly

---

## License

MIT — use it, fork it, make it your own.
