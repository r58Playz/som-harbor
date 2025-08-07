import { createStore, type Stateful } from "dreamland/core";

export const wispServers = ["wss://anura.pro/"]; //, "wss://wisp.mercurywork.shop/"];//, "wss://wispserver.dev/wisp/"];

export const settings: Stateful<{
	token: string,
	epoxyVersion: string,
	enableDoxxing: boolean,
	enableResolving: boolean,
}> = createStore({
	token: "",
	epoxyVersion: "",
	enableDoxxing: false,
	enableResolving: true,
}, { backing: "localstorage", ident: "som-test-store", autosave: "auto" });
(globalThis as any).settings = settings;
