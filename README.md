# TutorStake — Course Syllabus

> **Course:** Paying a tutor without trusting one
> **Format:** Two enrolled wallets (one student, one tutor) and a contract that holds the money
> **Prerequisites:** A wallet on Arc testnet (chain `5042002`) and a little test USDC
> **Live section:** https://tutorstake-arc.vercel.app
> **Reading materials:** [`contracts/TutorStake.sol`](contracts/TutorStake.sol) · [`lib/tutorstake.ts`](lib/tutorstake.ts)

This is a syllabus, not a pitch. Read it the way you'd read a course outline: it tells you what you sign up for, what happens at each lesson, and exactly what the rules say when something goes wrong. The "instructor" here is a single contract — it never grades, it only bookkeeps.

---

## Course description

A private tutoring arrangement has an old, uncomfortable problem. Pay the whole course in advance and the student carries all the risk. Pay lesson-by-lesson by hand and the tutor chases money every week. Put a platform in the middle and it takes a cut and holds the float.

TutorStake replaces all three with one escrowed plan. The student deposits the full course up front, but the tutor is only paid **one lesson at a time, as each lesson is actually delivered and acknowledged**. Money the tutor hasn't earned stays withdrawable by the student. Money the tutor has earned can't be clawed back. There is no platform balance — the entire course sits in the contract, and every figure the app shows (deposited, paid, still held) is read directly from it.

The whole design rests on one assumption: that releasing a single lesson's fee — often only a few USDC — can be done over and over without the act of paying costing more than the lesson. That assumption is what places this course on Arc, and the rationale is spelled out under **Grading & settlement** below.

---

## Enrollment

Enrolling opens a plan. The student calls:

```
openPlan(tutor, subject, price, sessions) payable
```

and sends `price × sessions` in USDC with the call. That exact amount must match, or the contract rejects the enrollment (`"send price x sessions"`). The deposit is now escrowed; nothing else is needed to start.

The enrollment terms are fixed at this moment and recorded on-chain:

| Term | Value |
|---|---|
| Tutor | any wallet that is not the student (`"bad tutor"` otherwise) |
| Subject | 1–80 characters, free text (e.g. `German B1`) |
| Price per lesson | any positive USDC amount |
| Lesson count | a whole number, 1 to 1000 |
| Amount escrowed | `price × sessions`, locked at enrollment |
| Confirmation window | 1 day (`CONFIRM_WINDOW`) |

Once open, the student appears in `plansOf(student)` and the tutor in `teachingOf(tutor)`, so each side sees the plan from their own dashboard. The plan's `status` is `ACTIVE` (1).

---

## Each lesson

Lessons are released one at a time, in order. The cycle is two calls — one from each party — and it can only ever have **one** lesson in flight:

1. **The tutor marks the lesson taught.** After the session happens, the tutor calls `markDone(id)`. This is allowed only when no other lesson is already awaiting confirmation (`"session awaiting confirm"`) and lessons remain unpaid. The lesson is now *pending*, timestamped at `markedAt`.

2. **The student confirms it.** The student calls `confirm(id)`. The contract immediately transfers exactly `price` — one lesson's fee — to the tutor, ticks `paid` up by one, clears the pending flag, and credits `tutorEarned[tutor]`. When `paid` reaches `sessions`, the plan auto-closes.

That's the happy path: teach, confirm, paid. Repeat until the course is finished. No lesson can be marked while another is pending, so there is never an ambiguous "how much is owed right now" — the answer is always either zero or exactly one lesson.

---

## If a lesson is disputed

A lesson the student says did **not** happen is handled by `reject(id)`, callable only by the student while a lesson is pending.

Rejecting does three things: it refunds that lesson's `price` to the student, it **removes the lesson from the plan entirely** (`sessions` is decremented), and it clears the pending flag. Removing it — rather than merely un-marking it — is deliberate: it stops a tutor from marking, getting rejected, and re-marking the same lesson forever to wear the student down. A disputed lesson is simply gone, and the course is now one lesson shorter. If that drops the count to what's already been paid, the plan closes.

There is no arbitrator and no appeal built into the contract. Dispute resolution is binary and lives with the student, because the student is the one who escrowed the funds in the first place. The protection for the tutor against an unfair rejection is reputational and off-chain — and the protection against a *silent* student is the next section.

---

## If the student disappears

The asymmetry to guard against is a student who takes the lesson and then never confirms — leaving the tutor's fee frozen. The contract closes that gap with a timeout:

```
settle(id)   // callable by ANYONE, once block.timestamp > markedAt + 1 day
```

After the one-day confirmation window passes on a pending lesson, `settle` releases that lesson's fee to the tutor exactly as a confirmation would (the `Released` event records `autoSettled = true`). The student's silence no longer costs the tutor anything.

Crucially, `settle` has no caller restriction. The student, the tutor, or — most usefully — an unrelated third party can trigger it. That third party is what you'd call a **keeper**: a small script that watches for pending lessons past their window and calls `settle`. **No such keeper ships in this repository** — there is no server, no scheduled job, no autonomous agent here; `settle` is just left open so that one *could* run permissionlessly, or so the tutor can simply trigger it themselves. The contract guarantees the door; running something through it is left to whoever wants the payout to be hands-free.

---

## Refunds

Two paths return money to the student, and both are student-only:

- **Per-lesson refund** — `reject(id)`, covered above: refunds one disputed lesson and shortens the course.
- **Withdraw the rest** — `closePlan(id)` refunds **every lesson not yet taught**: `(sessions − paid) × price` goes back to the student and the plan is marked `CLOSED`. It's allowed whenever the plan is active and no lesson is mid-confirmation (`"session awaiting confirm"`).

You are never locked into lessons you haven't taken. Quit a course halfway and the unused half comes home. The only money that can't be recovered is money already released for lessons that were taught and confirmed (or settled) — which is the point.

---

## Grading & settlement

Here is why this course is taught on Arc specifically, and why it would be impractical anywhere the per-transaction cost is meaningful.

The unit of payment in TutorStake is *one lesson* — frequently a single-digit USDC amount. A finished eight-lesson plan is **eight separate on-chain releases**, plus a possible reject or a timeout settle scattered in between. The economics only work if each of those releases is effectively free and final the instant it lands; if settling a $5 lesson cost a dollar in a separate volatile gas token, the model collapses into "just pay the whole course up front and hope," which is exactly what we set out to avoid.

Arc settles in **native USDC**, so the fee a tutor receives is denominated in the same unit they're owed — $40 of teaching is $40, not $40 minus a swap minus a bridge minus a fee in some other coin. Releases clear in well under a second and are final on arrival, so "confirm" and "paid" are the same moment for the tutor, lesson after lesson. And because the permissionless `settle` is itself a cheap, final call, the timeout safety net costs a rounding error to operate — which is the only reason leaving it open to a keeper is a sensible design rather than a liability.

A repeated stream of tiny, final, same-unit payments between two people, with a free permissionless fallback, is the kind of money movement a USDC-native settlement layer makes ordinary. That is the entire reason for the venue.

---

## The instructor of record (the contract)

The contract is one file, [`TutorStake.sol`](contracts/TutorStake.sol), with no dependencies. It has no owner, no administrative role, no fee, and no upgrade path. Funds can only ever move to the tutor (on `confirm` / `settle`) or back to the student (on `reject` / `closePlan`); there is no function that lets anyone — including the author — extract escrowed money any other way. Every transfer follows checks-effects-interactions, and the single-pending-lesson rule keeps the owed balance unambiguous at all times.

- **Deployment:** `0xB5b45aE5D33b75F231C3945fe3538AF5a53000Ec`
- **Where to inspect it:** https://testnet.arcscan.app/address/0xB5b45aE5D33b75F231C3945fe3538AF5a53000Ec
- **Chain:** Arc testnet, id `5042002` · payments in native USDC (18 decimals)

Lifetime counters are public reads: `planCount`, `totalEscrowed`, `totalReleased`, `totalRefunded`, `sessionsPaid`, and per-address `tutorEarned`. The dashboard derives "in escrow now" as `totalEscrowed − totalReleased − totalRefunded` straight from these.

---

## Section materials (running it)

```bash
npm install
npm run dev        # opens on http://localhost:3000
```

The contract address is compiled into [`lib/tutorstake.ts`](lib/tutorstake.ts), so the page shows live on-chain state with no environment file. To act on a plan, connect a wallet on Arc testnet holding test USDC — the app offers to add the network. To rebuild the contract artifact, run `node scripts/compile.js`.

---

*One lesson taught, one lesson paid — and the part nobody confirmed still settles on its own.*
