import { createState, css, type Component, type Stateful } from "dreamland/core";
import { scheme } from ".";

let decoder = new TextDecoder();

interface VoteData {
	remaining: number,
	vote: [number, number],
}

interface VoteProjectRes {
	demo: boolean,
	repo: boolean,
}
interface VoteRes {
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

function voter(inject: boolean) {
	if (inject)
		return () =>
			document.addEventListener("DOMContentLoaded", () => {
				let script = document.createElement("script");
				script.innerText = "(" + voter.toString() + ")()";
				document.head.appendChild(script);
			});

	if (location.pathname === "/votes/new") {
		let ids = [...document.querySelectorAll<HTMLInputElement>(`[name='fraud_report[suspect_id]']`)].map(x => +x.value);
		let remainingText = document.querySelector<HTMLParagraphElement>(`[data-sidebar-target="mainContent"] p.text-nice-blue`)?.innerText || "";
		let remaining = +(/vote ([0-9]*) more times/.exec(remainingText)?.[1] || '0');

		console.log("vote data", ids);
		try {
			fetch("https://som-voting/vote", {
				method: "POST",
				body: JSON.stringify({
					remaining,
					vote: ids,
				}),
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

			form.submit();
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
			}
		});
		let fetcher = frame.request.createWebRequestInterceptor({
			urlPatterns: ["https://som-voting/*"],
			includeHeaders: "all",
			includeRequestBody: true,
			blocking: true,
		});
		fetcher.addEventListener("beforerequest", ev => {
			let e = ev as any as WebRequestBeforeRequestEvent;
			e.preventDefault();

			let body = e.request.body?.raw?.[0]?.bytes;
			if (!body) throw new Error("invalid voting response");
			let res = JSON.parse(decoder.decode(body));
			console.log(res);
		});

		frame.addContentScripts([{
			name: "voter",
			urlPatterns: ["*://summer.hackclub.com/*"],
			js: {
				code: "(" + voter.toString() + ")(true)();",
			},
			runAt: "document-start",
		}]);

		frame.src = "https://summer.hackclub.com/campfire";
		(self as any).frame = frame;
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

use(state.loggedIn).listen(x => {
});

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
