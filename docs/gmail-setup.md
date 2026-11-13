# Connecting Gmail: one-off setup (Eric + Lars, about 15 minutes)

Mission Control reads Lars's inbox and saves reply drafts in his Gmail Drafts
folder. It never sends email. To allow that, Brandboy needs its own small
"app" registered with Google. Because Brandboy uses Google Workspace, the app
can be **Internal**: only brandboy.com.au accounts can use it, and Google
doesn't need to review it.

Do steps 1–4 **signed in as a brandboy.com.au account** (Lars's, or an admin).
Use a private/incognito window so you're not mixed up with your own Google
account.

## 1. Create the project

1. Go to https://console.cloud.google.com. Lars signs in himself (his password stays with him).
2. Accept the terms if asked. At the top, **Select a project → New project**.
   - Name: `Brandboy Mission Control`. Organisation: `brandboy.com.au`. **Create**.
3. Make sure the new project is selected at the top.

## 2. Turn on the Gmail API

1. Menu → **APIs & Services → Library**.
2. Search **Gmail API** → open it → **Enable**.

## 3. The consent screen (what Lars sees when connecting)

1. Menu → **APIs & Services → OAuth consent screen** (may be called
   **Google Auth Platform → Branding**). **Get started**.
2. App name: `Brandboy Mission Control`. Support email: Lars's.
3. Audience: **Internal**. (If Internal isn't offered, the account isn't a
   Workspace account; stop and check.)
4. Contact email: Lars's (or yours). Agree and **Create**.
5. **Data access → Add or remove scopes**, tick these two, then **Update → Save**:
   - `.../auth/gmail.readonly` (read email)
   - `.../auth/gmail.compose` (manage drafts)

## 4. The client ID and secret

1. **Clients** (or **APIs & Services → Credentials**) → **Create client** /
   **Create credentials → OAuth client ID**.
2. Application type: **Web application**. Name: `Mission Control`.
3. **Authorised redirect URIs → Add URI**:
   - `https://dreamy-taffy-27a291.netlify.app/api/gmail/callback`
   - (optional, for testing on a computer) `http://localhost:8888/api/gmail/callback`
4. **Create**. Copy the **Client ID** and **Client secret** straight into
   Netlify (step 5). Don't email or chat them.

## 5. Netlify settings

Netlify → Site configuration → Environment variables → Add:

| Name                   | Value                                              | Secret? |
| ---------------------- | -------------------------------------------------- | ------- |
| `GOOGLE_CLIENT_ID`     | the Client ID (ends `.apps.googleusercontent.com`) | No      |
| `GOOGLE_CLIENT_SECRET` | the Client secret                                  | **Yes** |

## 6. Supabase

Supabase → SQL Editor → New query → paste `docs/supabase/gmail_connection.sql` → **Run**.
Then do the same with `docs/supabase/inbox_items.sql` (where the inbox agent keeps the
emails it has sorted).

## 7. Lars connects

Once this is live: Mission Control → **📥 Inbox** → **Connect Gmail** → sign in
as lars@brandboy.com.au → leave both boxes ticked → **Continue**. He lands back
on the Inbox tab showing his newest emails.

Connecting only works from the main site (dreamy-taffy-27a291.netlify.app),
not from preview links, because Google only accepts the address in step 4.

**To disconnect:** Inbox tab → **Disconnect**, or in Google: myaccount.google.com →
Security → Your connections to third-party apps.

## 8. Using the inbox agent

On the Inbox tab, press **✉️ Check inbox now**. COMPOSER reads up to 8 new emails
from the last 3 days, sorts them (🔥 new lead, ❓ enquiry, customer, supplier,
other), writes a one-line summary, and saves a reply draft in Gmail where
someone is waiting for an answer. **Nothing is sent.** Lars opens the draft
("Reply draft ready: open in Gmail"), changes anything in [square brackets],
and presses Send himself. Unknown senders get **＋ Add as prospect**.
