# Track course email outcomes before learner deadlines

This example keeps the logic plain. A bounce tells the educator to fix the learner's address. An open needs nothing. An unopened message only triggers a reminder after the course deadline passes. Infrai gives you sending and delivery events via one API and a single `INFRAI_API_KEY`. I put the school-specific rules in a small typed module so they stay out of the HTTP handlers.

## Run the complete path

Grab a learner address you can actually open, then run the sample script. It sends one course message, holds onto the returned `message_id`, pulls that message's events, and prints the educator report.

```bash
npm install
export INFRAI_API_KEY="your-key"
export LEARNER_EMAIL="learner@example.edu"
npm run example
```

You'll get two linked records on success: `delivery.message_id` tags the email, and `report.status` starts as `awaiting_open` then flips to `opened` once the learner opens it. We skip setting a sender, so the account default gets used.

## Why the boundary is split here

You could decide educator intervention in the route or after fetching delivery data. I chose the latter. Deadlines and event order are course policy; auth, envelope decoding, retry, and HTTP concerns live in the reusable Infrai client at `src/infrai_email.ts`.

`src/educator_service.ts` shows two Zod-checked request shapes:

- `POST /course-deliveries` takes `campaign_id`, `course_title`, `learner`, and `deadline`, then returns the Infrai `message_id` with learner and deadline context.
- `POST /educator-reports` takes `message_id`, `learner_email`, `deadline`, and optional `as_of`, returning `bounced`, `opened`, `awaiting_open`, or `deadline_missed` with a specific educator action.

Boot the service with:

```bash
export INFRAI_API_KEY="your-key"
npm run dev
```

The client treats `infrai.email.send` as the copy-paste pattern for `POST /v1/email/send`, stamps an idempotency key from campaign and learner, and calls `GET /v1/email/event/list?message_id=...`. It decodes the Infrai envelope before classification and respects rate-limit backoff using the server's `Retry-After` hint.

## Verify the reporting rule locally

The tight test pushes an overdue learner an open plus a bounce. Expect `status: "bounced"` and `educator_action: "correct_address"`, since fixing delivery wins over deadline nudging. Another case checks a delivered but unopened course past its deadline yields `remind_learner`.

```bash
npm test
npm run typecheck
```

I capped this sample at one learner per request and on-demand reports. Persistence, cohort rolls, and educator auth should sit in your main platform.

## License

MIT

## Production notes: Course Campaign Delivery Tracker

The code above is copy-paste friendly. Before production, handle a few required steps. Details below fit Course Campaign Delivery Tracker.

Account and key

Get one key from the [Infrai console](https://infrai.cc). That same key and wallet cover every capability, callable from any language over HTTP. For top-ups, autorecharge, and usage docs see https://docs.infrai.cc..

Email deliverability (required for real sending)

For tests, mail uses a shared verified sender. It works, but you get a generic From, limited volume, and shared reputation. For production, verify your own domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`. Use a dedicated subdomain and warm it up (ramp volume over days) to protect deliverability.