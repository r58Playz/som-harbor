import { createStore, type Stateful } from "dreamland/core";

export const wispServers = ["wss://anura.pro/"]; //, "wss://wisp.mercurywork.shop/"];//, "wss://wispserver.dev/wisp/"];

export const settings: Stateful<{
	token: string | null,
	epoxyVersion: string,
}> = createStore({
	token: null,
	epoxyVersion: "",
}, { backing: "localstorage", ident: "som-test-store", autosave: "auto" });
(globalThis as any).settings = settings;
