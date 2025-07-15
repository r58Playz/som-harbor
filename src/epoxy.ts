import epoxyInit, {
	EpoxyClient,
	EpoxyClientOptions,
	info as epoxyInfo,
} from "@mercuryworkshop/epoxy-tls/minimal-epoxy";
import { settings } from "./store";
import EPOXY_PATH from "../node_modules/@mercuryworkshop/epoxy-tls/minimal/epoxy.wasm?url";

export { EpoxyClient };

export let epoxyVersion = epoxyInfo.version;

let cache: Cache;
let initted: boolean = false;

async function evictEpoxy() {
	if (!cache) cache = await window.caches.open("epoxy");
	await cache.delete(EPOXY_PATH);
	console.log(cache);
}

async function instantiateEpoxy() {
	if (!cache) cache = await window.caches.open("epoxy");
	if (!(await cache.match(EPOXY_PATH))) {
		await cache.add(EPOXY_PATH);
	}
	const module = await cache.match(EPOXY_PATH);
	await epoxyInit({ module_or_path: module });
	initted = true;
}

export async function init() {
	if (initted) return;

	if (epoxyVersion === settings.epoxyVersion) {
		await instantiateEpoxy();
	} else {
		await evictEpoxy();
		await instantiateEpoxy();
		console.log(
			`evicted epoxy "${settings.epoxyVersion}" from cache because epoxy "${epoxyVersion}" is available`
		);
		settings.epoxyVersion = epoxyVersion;
	}
}

export async function createEpoxy(wisp: string): Promise<EpoxyClient> {
	if (!initted) {
		throw new Error("please init");
	}

	let options = new EpoxyClientOptions();
	options.user_agent = navigator.userAgent + " Not/GoogleBot";
	options.udp_extension_required = false;

	return new EpoxyClient(wisp, options);
}
