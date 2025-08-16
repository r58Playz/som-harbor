import { createStore, type Stateful } from "dreamland/core";

export const wispServers = ["wss://anura.pro/"]; //, "wss://wisp.mercurywork.shop/"];//, "wss://wispserver.dev/wisp/"];

export const settings: Stateful<{
	token: string,
	shareToken: string,
	shareAnon: boolean,
	epoxyVersion: string,
	enableDoxxing: boolean,
	enableResolving: boolean,
	ai: boolean,
}> = createStore({
	token: "",
	shareToken: "",
	shareAnon: true,
	epoxyVersion: "",
	enableDoxxing: false,
	enableResolving: true,
	ai: false,
}, { backing: "localstorage", ident: "som-test-store", autosave: "auto" });
(globalThis as any).settings = settings;
