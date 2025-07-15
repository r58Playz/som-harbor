import { createEpoxy, init, type EpoxyClient } from "./epoxy";
import { settings, wispServers } from "./store";

let currentVisitor: string | null = null;
let currentVisit: string | null = null;

interface FetchRes {
	res: Response,
	banish: () => void,
}

interface BackloggedRequest {
	resolve: (r: FetchRes) => void,
	reject: (e: any) => void,
	path: string,
	options: RequestInit,
}

interface Epoxy {
	wisp: string,
	client: EpoxyClient
	ratelimited: boolean,
	backlog: BackloggedRequest[],
}

let clients: Epoxy[] = null!;

async function buildClients() {
	await init();

	clients = await Promise.all(wispServers.map(async wisp => {
		let epoxy = await createEpoxy(wisp);
		return {
			wisp,
			client: epoxy,
			ratelimited: false,
			backlog: [],
		} satisfies Epoxy;
	}));
}
(self as any).buildClients = buildClients;

async function fetch(path: string, options: RequestInit): Promise<FetchRes> {
	if (!clients) await buildClients();

	let client = clients.map(x => [x, Math.random()] as const).sort(([_a, x], [_b, y]) => x - y).map(([x, _]) => x).find(x => !x.ratelimited);
	let promise;
	if (client) {
		let real = client;
		promise = (async () => {
			let res;
			while (!res) {
				try {
					res = await client.client.fetch(path, options);
				} catch (err) {
					console.warn(err);
				}
			}

			return {
				res,
				banish: () => {
					console.warn("CRITICAL ratelimited");
					real.ratelimited = true;
					if (!clients.find(x => !x.ratelimited)) console.error("CRITICAL all ratelimited");
					setTimeout(async () => {
						real.ratelimited = false;
						let req;
						while (req = real.backlog.shift()) {
							try {
								req.resolve(await fetch(req.path, req.options));
							} catch (err) {
								req.reject(err);
							}
						}
					}, 60000);
				}
			};
		})();
	} else {
		client = clients.slice().sort((a, b) => a.backlog.length - b.backlog.length)[0];
		if (!client) throw new Error("can't find client");
		let real = client;
		promise = new Promise((r, e) => {
			real.backlog.push({
				resolve: r,
				reject: e,
				path,
				options,
			});
		});
	}

	return await promise as FetchRes;
}
(self as any).fetch = fetch;

function buildCookie() {
	if (!settings.token) throw "no token";
	let cookie = `_journey_session=${encodeURIComponent(settings.token)}; `;
	if (currentVisitor)
		cookie += `ahoy_visitor=${encodeURIComponent(currentVisitor)}; `;
	if (currentVisit)
		cookie += `ahoy_visit=${encodeURIComponent(currentVisit)}; `;
	return cookie + "ahoy_client=toshit-som";
}

export async function fetchCookie(path: string, options?: RequestInit): Promise<Response> {
	options ??= {};
	options.headers ??= {};
	(options.headers as any)["Cookie"] = buildCookie();
	options.redirect = "manual";

	let { res, banish } = await fetch(new URL(path, "https://summer.hackclub.com").toString(), options);
	let raw: Record<string, string | string[]> = (res as any).rawHeaders;
	console.log(res);
	let cookieHeader = raw["set-cookie"];
	let cookies = new Map((cookieHeader instanceof Array ? cookieHeader : [cookieHeader]).map(x => (x || "").split(";")[0].split("=").map(x => decodeURIComponent(x))) as [string, string][]);

	if (!cookies.has("_journey_session") && res.status === 500) {
		banish();
		return await fetchCookie(path, options);
	}
	if (!cookies.has("_journey_session")) throw new Error("CRITICAL auth rejected");
	settings.token = cookies.get("_journey_session")!;

	if (cookies.has("ahoy_visitor"))
		currentVisitor = cookies.get("ahoy_visitor")!;

	if (cookies.has("ahoy_visit"))
		currentVisit = cookies.get("ahoy_visit")!;

	if (raw["location"]) {
		let res = await fetchCookie(raw["location"] as string);
		if (raw["location"] === "https://summer.hackclub.com/") {
			let text = await res.text();
			let status = getFlashStatus(text, true);
			if (!status.ok)
				throw new Error(status.message);
			console.log("SOFT auth rejected", text);
			throw new Error("auth rejected");
		}
		return res;
	}

	return res;
}

let dom = new DOMParser();

export async function getCsrf(): Promise<string> {
	let page = dom.parseFromString(await fetchCookie("my_projects").then(r => r.text()), "text/html");

	let csrf = page.querySelector("meta[name='csrf-token']") as HTMLMetaElement | null;
	if (!csrf) throw new Error("no csrf found");
	return csrf.content;
}

function getFlashStatus(res: string | Document, required: true): { ok: boolean, message: string };
function getFlashStatus(res: string | Document, required?: false): { ok: boolean, message: string } | null;
function getFlashStatus(res: string | Document, required?: boolean): { ok: boolean, message: string } | null {
	let page = res instanceof Document ? res : dom.parseFromString(res, "text/html");

	let flash = page.querySelector<HTMLDivElement>(`[data-controller="flash"] > div`);
	if (!flash) {
		if (required) throw new Error("no flash found");
		return null;
	}
	let ok = flash.classList.contains("bg-forest");

	let ret = { ok, message: flash.querySelector<HTMLParagraphElement>("p.text-sm")?.innerText || "" };
	console.log(ret);
	return ret;
}

export async function postDevlog(project: number, contents: string, file: { contents: Uint8Array | string, name: string }) {
	let body = new FormData();
	body.set("devlog[use_hackatime]", "true");
	body.set("devlog[text]", contents);
	body.set("devlog[file]", new File([file.contents], file.name));
	body.set("commit", "Post Devlog");

	let res = await fetchCookie(`projects/${project}/devlogs`, {
		method: "POST",
		headers: { "X-CSRF-Token": await getCsrf() },
		body,
	}).then(r => r.text());

	let status = getFlashStatus(res, true);
	if (!status.ok)
		throw new Error(status.message);
}
(globalThis as any).postDevlog = postDevlog;

export async function deleteDevlog(project: number, devlog: number) {
	let body = new URLSearchParams();
	body.set("_method", "delete");

	let res = await fetchCookie(`projects/${project}/devlogs/${devlog}`, {
		method: "POST",
		headers: { "X-CSRF-Token": await getCsrf() },
		body,
	}).then(r => r.text());

	let status = getFlashStatus(res, true);
	if (!status.ok)
		throw new Error(status.message);
}
(globalThis as any).deleteDevlog = deleteDevlog;

export interface ApiFollower {
	id: number,
	name: string
}

export interface ApiProject {
	id: number,
	title: string,
	description: string,
	category: string | null,
	devlogs_count: number,
	devlogs: number[],
	total_seconds_coded: number,
	is_shipped: boolean,
	readme_link: string,
	demo_link: string,
	repo_link: string,
	slack_id: string,
	x: number,
	y: number,
	created_at: string,
	updated_at: string,
	banner: number,
	followers: ApiFollower[],
}

interface Pagination {
	page: number,
	pages: number,
	count: number,
	items: number,
}

let parallel = 50;
async function fastPaginate<T>(start: number, end: number, fetcher: (x: number) => Promise<T>, progress: (x: number) => void): Promise<T[]> {
	let ret: T[] = [];
	let done = 0;
	let total = end - start + 1;

	let arrays = Array.from(Array(parallel), () => []) as number[][];
	for (let i = start; i <= end; i++) {
		arrays[(i - start) % parallel].push(i);
	}

	await Promise.all(arrays.map(async x => {
		for (let i of x) {
			let res = await fetcher(i);
			ret.push(res);
			done++;
			progress(done / total * 100);
		}
	}));

	return ret;
}

export async function getProjects(progress: (x: number) => void) {
	progress(-1);
	type ApiResponse = { projects: ApiProject[], pagination: Pagination };
	let projects = [];
	let res = await fetchCookie("api/v1/projects?page=1").then(r => r.json()) as ApiResponse;
	projects.push(...res.projects);
	progress(0);

	for (let page of await fastPaginate<ApiResponse>(
		res.pagination.page + 1,
		res.pagination.pages,
		x => fetchCookie(`api/v1/projects?page=${x}`).then(r => r.json()),
		progress,
	)) {
		projects.push(...page.projects);
	}
	return projects.sort((a, b) => b.id - a.id);
}
(self as any).getProjects = getProjects;

export interface ApiDevlog {
	text: string,
	id: number,
	attachment: null,
	project_id: number,
	slack_id: string,
	created_at: string,
	updated_at: string,
}

export async function getDevlogs(progress: (x: number) => void) {
	progress(-1);
	type ApiResponse = { devlogs: ApiDevlog[], pagination: Pagination };
	let devlogs = [];
	let res = await fetchCookie("api/v1/devlogs?page=1").then(r => r.json()) as ApiResponse;
	devlogs.push(...res.devlogs);
	progress(0);

	for (let page of await fastPaginate<ApiResponse>(
		res.pagination.page + 1,
		res.pagination.pages,
		x => fetchCookie(`api/v1/devlogs?page=${x}`).then(r => r.json()),
		progress
	)) {
		devlogs.push(...page.devlogs);
	}
	return devlogs.sort((a, b) => b.id - a.id);
}
(self as any).getDevlogs = getDevlogs;

interface PartialShopItem {
	id: number,
	name: string,
	cost: number,
}
interface ShopItem extends PartialShopItem {
	image: string,
	description: string,
}

export async function getShop(id: number): Promise<ShopItem | PartialShopItem> {
	let res = dom.parseFromString(await fetchCookie(`shop/items/${id}/buy`).then(r => r.text()), "text/html");

	let status = getFlashStatus(res);
	if (status && !status.ok) {
		let partial = /to purchase (?<name>.*)\. You need (?<needed>[0-9.]*) more/.exec(status.message);
		if (partial) {
			let shells = res.querySelector<HTMLSpanElement>(`div.items-center.justify-center.rounded-full:has(img[src="/shell.png"]) span.ml-1`)?.innerText;

			let cost = 0;
			if (partial.groups?.needed && shells)
				cost = +partial.groups.needed + +shells;

			return {
				id,
				name: partial.groups?.name || "",
				cost,
			} satisfies PartialShopItem;
		} else {
			throw new Error(status.message);
		}
	}

	let root = res.querySelector<HTMLDivElement>("div.bg-soft-bone.card-pixel");
	if (!root) throw new Error("shop item not found");

	let script = res.querySelector<HTMLScriptElement>("main > script");
	let price = /const itemPrice = "(?<price>[0-9.]*)";\n/.exec(script?.innerText || "")?.groups?.price || "0";

	return {
		id,
		image: root.querySelector<HTMLImageElement>("div.space-y-6 img.object-contain")?.src || "",
		name: root.querySelector<HTMLHeadingElement>("div.space-y-6 h1.text-3xl.font-bold.text-darker-taupe")?.innerText || "",
		description: root.querySelector<HTMLParagraphElement>("div.space-y-6 p.text-lg.text-saddle-taupe")?.innerText || "",
		cost: +price,
	} satisfies ShopItem;
}
(self as any).getShop = getShop;

export async function probeShop(start: number, end: number) {
	return await fastPaginate(start, end, async x => {
		try {
			let res = await getShop(x);
			return res;
		} catch {
			return null;
		}
	}, () => {}).then(x => x.filter(x => x));
}
(self as any).probeShop = probeShop;

export async function spamViews(type: string, id: number, count: number) {
	await fastPaginate(0, count, async _ => {
		console.log(await fetchCookie('/track_view', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRF-Token': await getCsrf(),
			},
			body: JSON.stringify({
				viewable_type: type,
				viewable_id: id
			})
		}).then(r=>r.text()))
	}, () => {});
}
(self as any).spamViews = spamViews;
