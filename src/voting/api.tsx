import { createState, css, type Component, type Stateful } from "dreamland/core";
import { scheme } from ".";
import { settings } from "../store";
import { setFetchCookieBackend } from "../api";

let decoder = new TextDecoder();

export interface VoteData {
	remaining: number,
	vote: [number, number],
}

export interface VoteProjectRes {
	demo: boolean,
	repo: boolean,
}
export interface VoteRes {
	id: number | "tie",
	reason: string,

	project: [VoteProjectRes, VoteProjectRes],
	musicPlayed: boolean,
}

export let state: Stateful<{
	loggedIn: boolean,
	voteData: VoteData | null,
}> = createState({
	loggedIn: false,
	voteData: null,
});

// @ts-expect-error
function voteContentScript(inject: boolean) {
	if (inject)
		return () =>
			document.addEventListener("DOMContentLoaded", () => {
				let script = document.createElement("script");
				script.innerText = "(" + voteContentScript.toString() + ")()";
				document.head.appendChild(script);
			});

	if (location.pathname === "/votes/new") {
		function getVoteData() {
			let ids = [...document.querySelectorAll<HTMLInputElement>(`[name='fraud_report[suspect_id]']`)].map(x => +x.value);
			let remainingText = document.querySelector<HTMLParagraphElement>(`[data-sidebar-target="mainContent"] p.text-nice-blue`)?.innerText || "";
			let remaining = +(/vote ([0-9]*) more times/.exec(remainingText)?.[1] || '0');
			return { remaining, vote: ids };
		}

		let data = getVoteData();

		console.log("vote data", data);
		try {
			fetch("https://som-voting/vote", {
				method: "POST",
				body: JSON.stringify(data),
			});
		} catch { }

		(window as any).harborSubmitVote = (res: VoteRes) => {
			const form = document.querySelector<HTMLFormElement>(`[action="/votes"]`)!;

			function handleProject(project: VoteProjectRes, number: number) {
				let repo = form.querySelector<HTMLInputElement>(`input[name="vote[project_${number}_repo_opened]"]`)!;
				let demo = form.querySelector<HTMLInputElement>(`input[name="vote[project_${number}_demo_opened]"]`)!;
				repo.value = "" + project.repo;
				demo.value = "" + project.demo;
			}

			handleProject(res.project[0], 1);
			handleProject(res.project[1], 2);

			let music = form.querySelector<HTMLInputElement>(`input[name="vote[music_played]"]`)!;
			music.value = "" + res.musicPlayed;

			let project = form.querySelector<HTMLInputElement>(`input[name="vote[winning_project_id]"][value="${res.id}"]`)!;
			project.click();

			let reason = form.querySelector<HTMLTextAreaElement>(`textarea[name="vote[explanation]"]`)!;
			reason.value = res.reason;

			let submit = form.querySelector<HTMLButtonElement>(`button[data-form-target="submitButton"]`)!;
			submit.click();

			let interval = setInterval(() => {
				let newData = getVoteData();
				if (JSON.stringify(data) !== JSON.stringify(newData)) {
					location.reload();
					clearInterval(interval);
				}
			}, 100);
		}
	}
}

let frame: HTMLControlledFrameElement;

let argbToString = (argb: number) => `${(argb >> 16) & 255} ${(argb >> 8) & 255} ${argb & 255}`;
export let ApiFrame: Component = function(cx) {
	cx.mount = () => {
		frame = cx.root as any as HTMLControlledFrameElement;
		let som = frame.request.createWebRequestInterceptor({
			urlPatterns: ["*://summer.hackclub.com/*"],
			includeHeaders: "all",
			includeRequestBody: true,
			blocking: true,
		});
		som.addEventListener("beforerequest", ev => {
			let e = ev as any as WebRequestBeforeRequestEvent;
			let url = new URL(e.request.url)

			if (e.request.method === "POST" && url.host === "summer.hackclub.com" && url.pathname === "/logout")
				state.loggedIn = false;
		});
		som.addEventListener("completed", ev => {
			let e = ev as any as WebRequestCompletedEvent;
			if (e.frameType === "outermost-frame" && e.request.type === "main-frame") {
				let url = new URL(e.request.url)
				if (url.host === "summer.hackclub.com" && url.pathname === "/campfire")
					state.loggedIn = true;

				if (url.host === "summer.hackclub.com") {
					let setCookie = e.response.headers!.getSetCookie().find(x => x.includes("_journey_session"));
					if (setCookie) {
						settings.token = decodeURIComponent(setCookie.split(";")[0].split("=")[1]);
					}
				}
			}
		});
		let voter = frame.request.createWebRequestInterceptor({
			urlPatterns: ["https://som-voting/*"],
			includeHeaders: "all",
			includeRequestBody: true,
			blocking: true,
		});
		voter.addEventListener("beforerequest", ev => {
			let e = ev as any as WebRequestBeforeRequestEvent;
			e.preventDefault();

			let body = e.request.body?.raw?.[0]?.bytes;
			if (!body) throw new Error("invalid voting response");
			let res = JSON.parse(decoder.decode(body));
			console.log(res);
			state.voteData = res;
		});

		frame.addContentScripts([{
			name: "voter",
			urlPatterns: ["*://summer.hackclub.com/*"],
			js: {
				code: "(" + voteContentScript.toString() + ")(true)();",
			},
			runAt: "document-start",
		}]);

		frame.src = "https://summer.hackclub.com/campfire";
		(self as any).frame = frame;

		setFetchCookieBackend(controlledFetch);
	};

	let bg = argbToString(scheme.background);
	let fg = argbToString(scheme.onBackground);
	return (
		<controlledframe
			class="apiframe"
			partition="persist:som-harbor"
			src={`data:text/html,<html style="background: rgb(${bg});color: rgb(${fg});">Controlled Frame loading...</html>`}
		/>
	)
}
ApiFrame.style = css`
	:scope {
		width: 100%;
		height: 100%;
	}
`;

export function setApiFrameUrl(url: string) {
	frame.src = url;
}

export function vote(vote: VoteRes) {
	function voteInternal(inject: boolean, serialized: string) {
		if (inject)
			return () => {
				let script = document.createElement("script");
				script.innerText = "(" + voteInternal.toString() + `)(false, ${JSON.stringify(serialized)})`;
				document.head.appendChild(script);
			}

		let vote = JSON.parse(serialized);
		(window as any).harborSubmitVote(vote);
	}

	frame.executeScript({
		code: "(" + voteInternal.toString() + `)(true, ${JSON.stringify(JSON.stringify(vote))})()`
	});
}
(self as any).vote = vote;

let fetcherFrames: Map<string, Promise<HTMLControlledFrameElement>> = new Map();

function getFetcherFrame(origin: string): Promise<HTMLControlledFrameElement> {
	if (!fetcherFrames.has(origin)) {
		let fetcherFrame: Promise<HTMLControlledFrameElement> = new Promise(r => {
			let frame = document.createElement('controlledframe') as any as HTMLControlledFrameElement;
			frame.partition = "persist:som-harbor";
			frame.src = `${origin}/`;
			frame.style.display = "block";
			frame.style.height = "0px";
			document.body.appendChild(frame);
			console.log("loading exfil frame for origin:", origin);
			frame.addEventListener("contentload", () => {
				console.log("loaded exfil frame for origin:", origin, frame);
				r(frame);
			});
		});
		fetcherFrames.set(origin, fetcherFrame);
	}
	return fetcherFrames.get(origin)!;
}

/**
 * Executes a fetch request within a headless frame that has the same origin as `url` with arbitrary options.
 *
 * @param url The URL to fetch, absolute or relative.
 * @param options The standard `RequestInit` options for the fetch call.
 * @returns A promise that resolves with the reconstructed `Response` object.
 */
export async function controlledFetch(
	url: string,
	options?: RequestInit
): Promise<Response> {
	const request = new Request(url, options);
	const parsedUrl = new URL(request.url, window.location.href);

	const frame = await getFetcherFrame(parsedUrl.origin);
	const exfilUrl = `https://data-exfil.internal/${crypto.randomUUID()}`;

	return await new Promise(async (resolve, reject) => {
		const interceptor = frame.request.createWebRequestInterceptor({
			urlPatterns: [exfilUrl, url],
			blocking: true,
			includeRequestBody: true,
		});

		let redirect: string | null = null;
		let redirectStatus: number | null = null;
		interceptor.addEventListener("beforeredirect", ((e: WebRequestBeforeRedirectEvent) => {
			if (options?.redirect === "manual")
				redirectStatus = e.response.statusCode;
			redirect = e.response.redirectURL!;
		}) as any);

		interceptor.addEventListener("beforerequest", ((e: WebRequestBeforeRequestEvent) => {
			if (e.request.url !== exfilUrl) return;

			e.preventDefault();
			try {
				const buffer = e.request.body?.raw?.[0]?.bytes;
				if (!buffer) throw new Error("No data received from frame.");

				// Check the first byte to see if the payload is a JSON error object.
				if (new Uint8Array(buffer, 0, 1)[0] === 0x7b /* '{' */) {
					const err = JSON.parse(new TextDecoder().decode(buffer));
					reject(new Error(err.message));
				} else {
					// Otherwise, reconstruct the Response object from the byte stream.
					const view = new DataView(buffer);
					const metaLen = view.getUint32(0, true);
					const meta = JSON.parse(new TextDecoder().decode(buffer.slice(4, 4 + metaLen)));
					const body = buffer.slice(4 + metaLen);

					let bodyUsed = false;
					const customResponse: any = {
						headers: new Headers(meta.headers),
						ok: meta.ok,
						redirected: meta.redirected,
						status: redirectStatus || meta.status,
						statusText: meta.statusText,
						type: meta.type,
						url: redirect || meta.url,
						get bodyUsed() { return bodyUsed; },
						arrayBuffer: () => {
							if (bodyUsed) return Promise.reject(new TypeError("Body already used"));
							bodyUsed = true;
							return Promise.resolve(body);
						},
						blob: () => customResponse.arrayBuffer().then(b => new Blob([b], { type: meta.contentType })),
						text: () => customResponse.arrayBuffer().then(b => new TextDecoder().decode(b)),
						json: () => customResponse.text().then(JSON.parse),
					};
					resolve(customResponse);
				}
			} catch (error) {
				reject(error);
			}
		}) as any);

		// Serialize the body into a Uint8Array.
		const bodyBytes = options?.body ? new Uint8Array(await request.arrayBuffer()) : null;

		// The new injected code now accepts a `bodyBytes` argument.
		const injectedCode = `
				(async (bodyBytes) => {
					try {
						const options = ${JSON.stringify(Object.assign({}, options, { body: undefined }))};
						if (bodyBytes) options.body = bodyBytes;

						const response = await fetch(${JSON.stringify(request.url)}, options);
						const metadata = {
							headers: Object.fromEntries(response.headers.entries()),
							ok: response.ok,
							redirected: response.redirected,
							status: response.status,
							statusText: response.statusText,
							type: response.type,
							url: response.url,
							contentType: response.headers.get("content-type"),
						};
						const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
						const resBytes = new Uint8Array(await response.arrayBuffer());
						const lengthBuffer = new Uint8Array(4);
						new DataView(lengthBuffer.buffer).setUint32(0, metadataBytes.byteLength, true);

						const payload = new Uint8Array(metadataBytes.length + resBytes.length + lengthBuffer.length);
						payload.set(lengthBuffer);
						payload.set(metadataBytes, lengthBuffer.length);
						payload.set(resBytes, lengthBuffer.length + metadataBytes.length);
						fetch('${exfilUrl}', { method: 'POST', body: payload });
					} catch (err) {
						// If the fetch fails, send back a JSON error object.
						const errorPayload = JSON.stringify({ message: err.message });
						fetch('${exfilUrl}', { method: 'POST', body: new TextEncoder().encode(errorPayload) });
					}
				})(${bodyBytes ? 'new Uint8Array([' + Array.from(bodyBytes).join(',') + '])' : 'null'});
			`;

		frame.executeScript({ code: injectedCode }).catch(reject);
	});
}
(self as any).controlledFetch = controlledFetch;

export async function controlledFetchRedirecting(
	initialUrl: string,
	options?: RequestInit,
	maxRedirects: number = 5
): Promise<Response> {
	let currentUrl = initialUrl;
	let redirectCount = 0;

	const fetchOptions = {
		...options,
		redirect: 'manual' as const
	};

	while (redirectCount <= maxRedirects) {
		let response = await controlledFetch(currentUrl, fetchOptions);

		if (response.status >= 300 && response.status < 400) {
			redirectCount++;
			if (redirectCount > maxRedirects) {
				throw new Error(`Exceeded maximum redirects (${maxRedirects}) for URL: ${initialUrl}`);
			}

			const newLocation = response.url;
			currentUrl = new URL(newLocation, currentUrl).toString();
		} else {
			return response;
		}
	}

	// This part should ideally not be reached if maxRedirects is handled correctly,
	// but acts as a fallback for unexpected scenarios.
	throw new Error(`Failed to get a final response after ${maxRedirects} redirects.`);
}
