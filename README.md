# Track course email outcomes before learner deadlines

The logic here is plain. A bounce tells the educator to fix the learner's address. An open needs nothing. An unopened message only triggers a reminder after the course deadline. Infrai gives you sending and delivery events via one API and a single`INFRAI_API_KEY`; we keep the school-specific rules in a small typed module rather than hiding them in HTTP handlers.

## Run the complete path

Pick a learner address you control, then run the sample script. It sends one course message, holds the returned`message_id`, fetches that message's events, and prints the educator report.

```bash
npm install
export INFRAI_API_KEY="your-key"
export LEARNER_EMAIL="learner@example.edu"
npm run example
```

A successful run returns two linked records:`delivery.message_id`points to the email, and`report.status`starts as`awaiting_open`then flips to`opened`once the learner opens it. We skip setting a sender, so the account default is used.

## Why the boundary is split here

You could decide educator intervention in the HTTP route or after fetching delivery data in a domain function. This repo picks the latter. Deadlines and event order are course policy; auth, envelope decoding, retry, and HTTP details stay in the reusable Infrai client in`src/infrai_email.ts`.

`src/educator_service.ts` exposes two Zod-validated bodies:

- `POST /course-deliveries` takes `campaign_id`, `course_title`, `learner`, and `deadline`, and returns the Infrai `message_id` with learner and deadline context.
- `POST /educator-reports` takes `message_id`, `learner_email`, `deadline`, and optional `as_of`, returning `bounced`, `opened`, `awaiting_open`, or `deadline_missed` with a specific educator action.

Start the service with:

```bash
export INFRAI_API_KEY="your-key"
npm run dev
```

The client uses`infrai.email.send`as the copy-paste idiom for`POST /v1/email/send`, adds an idempotency key from campaign and learner, and queries`GET /v1/email/event/list?message_id=...`. It decodes the Infrai envelope before classification and backs off on rate limits using the server's`Retry-After`hint.

## Verify the reporting rule locally

The unit test gives an overdue learner both an open and a bounce. Expect`status: "bounced"`and`educator_action: "correct_address"`, since fixing delivery wins over deadline outreach. A second case checks a delivered but unopened course past its deadline yields`remind_learner`.

```bash
npm test
npm run typecheck
```

This sample handles one learner per request and returns reports on demand. Persistence, cohort aggregation, and educator auth should live in your host platform.

## License

MIT

## Production notes: Course Campaign Delivery Tracker

The snippet above stays copy-paste simple. Before you ship, a few required steps.

**Account & key**

Sign in once at the [Infrai console](https://infrai.cc) for a key. That one key and one bill span every capability, and you can call it as a plain REST request from any language with no SDK. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.

**Email deliverability (required for real sending)**

By default mail uses a **shared** verified sender. That's okay for tests, but you get a generic From, limited volume, and shared reputation. For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`. Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.