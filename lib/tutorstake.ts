import { ethers } from "ethers";
import { ARC_RPC } from "./arcNetwork";

// ─────────────────────────────────────────────────────────────
// TutorStake — escrow for tutoring, released a lesson at a time.
// One deployed contract; the single source of truth.
// ─────────────────────────────────────────────────────────────
export const CONTRACT_ADDRESS = "0xB5b45aE5D33b75F231C3945fe3538AF5a53000Ec";

export const TUTORSTAKE_ABI = [
  "function openPlan(address tutor, string subject, uint256 price, uint32 sessions) payable returns (uint256)",
  "function markDone(uint256 id)",
  "function confirm(uint256 id)",
  "function settle(uint256 id)",
  "function reject(uint256 id)",
  "function closePlan(uint256 id)",
  "function planCount() view returns (uint256)",
  "function totalEscrowed() view returns (uint256)",
  "function totalReleased() view returns (uint256)",
  "function totalRefunded() view returns (uint256)",
  "function sessionsPaid() view returns (uint256)",
  "function tutorEarned(address) view returns (uint256)",
  "function getPlan(uint256) view returns (tuple(uint256 id, address student, address tutor, string subject, uint256 price, uint32 sessions, uint32 paid, uint8 pending, uint64 markedAt, uint64 createdAt, uint8 status))",
  "function plansOf(address) view returns (uint256[])",
  "function teachingOf(address) view returns (uint256[])",
  "event Opened(uint256 indexed id, address indexed student, address indexed tutor, string subject, uint256 price, uint32 sessions)",
  "event Marked(uint256 indexed id, address indexed tutor, uint32 session)",
  "event Released(uint256 indexed id, address indexed tutor, uint32 session, uint256 amount, bool autoSettled)",
  "event Rejected(uint256 indexed id, address indexed student, uint32 session)",
  "event Closed(uint256 indexed id, uint256 refunded)",
];

export const ACTIVE = 1;
export const CLOSED = 2;
export const CONFIRM_WINDOW = 86400; // 1 day, mirrors the contract

export interface Plan {
  id: number;
  student: string;
  tutor: string;
  subject: string;
  price: bigint;
  sessions: number;
  paid: number;
  pending: number;
  markedAt: number;
  createdAt: number;
  status: number;
}

export interface Stats {
  plans: number;
  escrowed: bigint;
  released: bigint;
  refunded: bigint;
  sessions: number;
}

export const EMPTY_STATS: Stats = { plans: 0, escrowed: 0n, released: 0n, refunded: 0n, sessions: 0 };

export const MAX = 60;

// ── connection ───────────────────────────────────────────────
export function readProvider() {
  return new ethers.JsonRpcProvider(ARC_RPC);
}
export function readContract(provider?: ethers.Provider) {
  return new ethers.Contract(CONTRACT_ADDRESS, TUTORSTAKE_ABI, provider ?? readProvider());
}
export function hasContract(): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  const failed: T[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const settled = await Promise.allSettled(batch.map(fn));
    settled.forEach((s, j) => (s.status === "fulfilled" ? out.push(s.value) : failed.push(batch[j])));
  }
  const stillFailed: T[] = [];
  for (let i = 0; i < failed.length; i += limit) {
    const batch = failed.slice(i, i + limit);
    const settled = await Promise.allSettled(batch.map(fn));
    settled.forEach((s, j) => (s.status === "fulfilled" ? out.push(s.value) : stillFailed.push(batch[j])));
  }
  if (stillFailed.length) console.warn(`tutorstake: ${stillFailed.length} read(s) failed after retry`);
  return out;
}

type RawPlan = {
  id: bigint; student: string; tutor: string; subject: string; price: bigint;
  sessions: bigint; paid: bigint; pending: bigint; markedAt: bigint; createdAt: bigint; status: bigint;
};
function toPlan(p: RawPlan): Plan {
  return {
    id: Number(p.id),
    student: p.student,
    tutor: p.tutor,
    subject: p.subject,
    price: p.price,
    sessions: Number(p.sessions),
    paid: Number(p.paid),
    pending: Number(p.pending),
    markedAt: Number(p.markedAt),
    createdAt: Number(p.createdAt),
    status: Number(p.status),
  };
}

// ── reads ────────────────────────────────────────────────────
export async function fetchStats(contract?: ethers.Contract): Promise<Stats> {
  const c = contract ?? readContract();
  const [plans, escrowed, released, refunded, sessions] = await Promise.all([
    c.planCount(),
    c.totalEscrowed(),
    c.totalReleased(),
    c.totalRefunded(),
    c.sessionsPaid(),
  ]);
  return { plans: Number(plans), escrowed, released, refunded, sessions: Number(sessions) };
}

export async function fetchPlansOf(addr: string, contract?: ethers.Contract): Promise<Plan[]> {
  const c = contract ?? readContract();
  const ids: bigint[] = await c.plansOf(addr);
  const raw = await mapLimit(ids.slice(-MAX).map(Number), 8, async (id) => toPlan(await c.getPlan(id)));
  raw.sort((a, b) => b.id - a.id);
  return raw;
}

export async function fetchTeachingOf(addr: string, contract?: ethers.Contract): Promise<Plan[]> {
  const c = contract ?? readContract();
  const ids: bigint[] = await c.teachingOf(addr);
  const raw = await mapLimit(ids.slice(-MAX).map(Number), 8, async (id) => toPlan(await c.getPlan(id)));
  raw.sort((a, b) => b.id - a.id);
  return raw;
}

export async function fetchPlan(id: number, contract?: ethers.Contract): Promise<Plan | null> {
  const c = contract ?? readContract();
  try {
    const p = toPlan(await c.getPlan(id));
    return p.student === ethers.ZeroAddress ? null : p;
  } catch {
    return null;
  }
}

export async function fetchTutorEarned(addr: string, contract?: ethers.Contract): Promise<bigint> {
  const c = contract ?? readContract();
  return await c.tutorEarned(addr);
}

// ── formatting / helpers ─────────────────────────────────────
export function shortAddr(addr: string, lead = 6, tail = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export function fmtUsdc(wei: bigint, dp = 2): string {
  const n = parseFloat(ethers.formatEther(wei));
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  if (n < 0.01) {
    const s = n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    return s === "0" ? "<0.0001" : s;
  }
  const s = n.toFixed(dp);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

export function timeAgo(unixSeconds: number): string {
  if (!unixSeconds) return "";
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** True once a marked session can be settled by anyone (confirmation window passed). */
export function canSettle(plan: Plan): boolean {
  return plan.pending === 1 && Math.floor(Date.now() / 1000) > plan.markedAt + CONFIRM_WINDOW;
}

/** Human time left before a marked session can be settled (or "" if not pending / already settleable). */
export function settleIn(plan: Plan): string {
  if (plan.pending !== 1) return "";
  let diff = plan.markedAt + CONFIRM_WINDOW - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "";
  const h = Math.floor(diff / 3600);
  diff -= h * 3600;
  const m = Math.floor(diff / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
