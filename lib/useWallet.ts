"use client";

import { ethers } from "ethers";
import { useCallback, useEffect, useRef, useState } from "react";

import { ensureDiscovered, pickDetail, pickProvider, setChosenRdns, type Eip1193Provider } from "./wallet";
import { ARC_CHAIN_HEX, ARC_RPC, switchToArc } from "./arcNetwork";

// Flag (in localStorage) that the user deliberately disconnected, so we don't
// silently re-attach on the next page load. Key is built from a base + suffix.
const SESSION_BASE = "ts";
const DISCONNECT_KEY = `${SESSION_BASE}/walletClosed`;

// Normalise a hex chainId reported by a wallet against the ARC chain id.
function isArcChain(id: unknown): boolean {
  return (id as string).toLowerCase() === ARC_CHAIN_HEX.toLowerCase();
}

export function useWallet() {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("");
  const [chainOk, setChainOk] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const optedOutRef = useRef(false);
  const subRef = useRef<{ provider: Eip1193Provider; cleanup: () => void } | null>(null);

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      const rpc = new ethers.JsonRpcProvider(ARC_RPC);
      const wei = await rpc.getBalance(addr);
      setBalance(parseFloat(ethers.formatEther(wei)).toFixed(3));
    } catch {
      setBalance("—");
    }
  }, []);

  const subscribe = useCallback(
    (inj: Eip1193Provider) => {
      if (!inj?.on) return;
      if (subRef.current?.provider === inj) return;
      subRef.current?.cleanup();

      const onAcc = (a: unknown) => {
        if (optedOutRef.current) return;
        const list = a as string[];
        if (list.length) {
          setAccount(list[0]);
          refreshBalance(list[0]);
        } else {
          setAccount("");
          setBalance("");
          setChainOk(false);
        }
      };
      const onChain = (c: unknown) => setChainOk(isArcChain(c));

      inj.on("accountsChanged", onAcc);
      inj.on("chainChanged", onChain);
      subRef.current = {
        provider: inj,
        cleanup: () => {
          inj.removeListener?.("accountsChanged", onAcc);
          inj.removeListener?.("chainChanged", onChain);
        },
      };
    },
    [refreshBalance]
  );

  const connect = useCallback(async () => {
    optedOutRef.current = false;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(DISCONNECT_KEY);
      } catch {
        /* ignore */
      }
    }
    await ensureDiscovered();
    const detail = pickDetail();
    const inj = detail?.provider;
    if (!inj) return;
    setChosenRdns(detail.rdns);
    setConnecting(true);
    try {
      const accs = (await inj.request({ method: "eth_requestAccounts" })) as string[];
      if (!accs?.length) return;
      setAccount(accs[0]);
      subscribe(inj);
      try {
        await switchToArc(inj);
      } catch {
        /* user declined the network switch */
      }
      try {
        const id = (await inj.request({ method: "eth_chainId" })) as string;
        setChainOk(isArcChain(id));
      } catch {
        setChainOk(false);
      }
      refreshBalance(accs[0]);
    } catch {
      /* user rejected */
    } finally {
      setConnecting(false);
    }
  }, [refreshBalance, subscribe]);

  const disconnect = useCallback(() => {
    optedOutRef.current = true;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DISCONNECT_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setAccount("");
    setBalance("");
    setChainOk(false);
  }, []);

  // On mount: respect a previous opt-out, otherwise try a silent reconnect.
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(DISCONNECT_KEY) === "1") {
      optedOutRef.current = true;
    }
    (async () => {
      await ensureDiscovered();
      const inj = pickProvider();
      if (!inj) return;
      if (!optedOutRef.current) {
        try {
          const accs = (await inj.request({ method: "eth_accounts" })) as string[];
          if (accs.length) {
            setAccount(accs[0]);
            refreshBalance(accs[0]);
            inj
              .request({ method: "eth_chainId" })
              .then((id) => setChainOk(isArcChain(id)))
              .catch(() => {});
          }
        } catch {
          /* ignore */
        }
      }
      subscribe(inj);
    })();
    return () => {
      subRef.current?.cleanup();
      subRef.current = null;
    };
  }, [refreshBalance, subscribe]);

  return { account, balance, chainOk, connecting, connect, disconnect, refreshBalance };
}
