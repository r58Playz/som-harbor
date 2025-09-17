import { css, jsx, type Component } from "dreamland/core";
import { controlledFetch, controlledFetchRedirecting, state, vote, type VoteData } from "./api";
import { getCsrf, getProject, getUser, type ApiProject, type ApiUser } from "../api";
import { Button, Card, Chip, Icon, LinearProgress, LoadingIndicator, TextFieldFilled, ToggleButton } from "m3-dreamland";
import iconQuickReply from "@ktibow/iconset-material-symbols/quickreply-outline";
import iconMarkChatRead from "@ktibow/iconset-material-symbols/mark-chat-read-outline";
import iconChatError from "@ktibow/iconset-material-symbols/chat-error-outline";
import { settings } from "../store";

const ProjectLoading: Component = function() {
	return (
		<div>
			<Card variant="elevated">
				<LoadingIndicator center={true} size={120} />
			</Card>
		</div>
	)
}
ProjectLoading.style = css`
	:scope > :global(.m3dl-card) {
		height: 100%;
		display: flex;
	}
`;

function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	return [
		h ? `${h}h` : '',
		m ? `${m}m` : '',
		s || (!h && !m) ? `${s}s` : ''
	].filter(Boolean).join(' ');
}

async function imageToDataUrl(response: Response): Promise<string> {
	const blob = await response.blob();
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

const Image: Component<{ src: string, height?: string, }, { image: string | null }> = function(cx) {
	this.height ??= "16rem";
	this.image = null;
	cx.mount = async () => {
		let banner = await controlledFetchRedirecting(this.src);
		this.image = await imageToDataUrl(banner);
	}
	return <div>{use(this.image).andThen(((x: string) => jsx(x.split(";")[0].split(":")[1].startsWith("image") ? "img" : "video", { src: x })) as any, <div><LoadingIndicator center={true} size={96} /></div>)}</div>
}
Image.style = css<typeof Image>`
	:scope > * {
		height: ${x => use(x.height)};
		flex: 0 0 ${x => use(x.height)};
		width: 100%;
		display: flex;
		border-radius: var(--m3dl-shape-small);
		border: 1px solid rgb(var(--m3dl-color-outline-variant));

		object-fit: contain;
	}
`;

const ProjectView: Component<{ project: ApiProject, id: number }, { image: string | null, user: ApiUser | undefined }> = function(cx) {
	let open = (link: string, analytics?: "demo" | "repo") => async () => {
		window.open(link, "_blank");
		if (analytics) {
			let res = await controlledFetch(`https://summer.hackclub.com/votes/track_${analytics}/${this.id}`, {
				redirect: "manual",
				method: "POST",
				headers: { "X-Csrf-Token": await getCsrf() }
			});
			console.log("ANALYTICS", res, await res.text());
		}
	}
	let user = () => this.user && window.open(`https://hackclub.slack.com/app_redirect?channel=${this.user.slack_id}`, "_blank");

	cx.mount = async () => {
		this.user = await getUser(this.project.user_id);
	}

	return (
		<div>
			<Card variant="elevated">
				<div class="m3dl-font-headline-large">{this.project.title}</div>
				<div class="m3dl-font-body-large">{this.project.description}</div>
				<Image src={this.project.banner} />
				<div class="chips">
					<Chip variant="assist" on:click={user}>
						{use(this.user).map(x => x && `${x.display_name} (${x.slack_id} - ${this.project.user_id})` || this.project.user_id)}
					</Chip>
					<Chip variant="assist" on:click={() => { }}>{formatDuration(this.project.total_seconds_coded)} coded</Chip>
					<Chip variant="assist" on:click={() => { }}>{this.project.followers.length} followers</Chip>
					{this.project.repo_link ? <Chip variant="suggestion" on:click={open(this.project.repo_link, "repo")}>Repo</Chip> : null}
					{this.project.demo_link ? <Chip variant="suggestion" on:click={open(this.project.demo_link, "demo")}>Demo</Chip> : null}
				</div>
				<div />
				{this.project.devlogs.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)).map(x => (
					<Card variant="filled">
						{x.text}
						<div class="chips">
							<Chip variant="assist" on:click={() => { }}>{new Date(x.created_at).toLocaleString()}</Chip>
							<Chip variant="assist" on:click={() => { }}>{formatDuration(x.time_seconds)} coded</Chip>
							<Chip variant="assist" on:click={() => { }}>{x.likes_count} likes</Chip>
						</div>
						<Image src={x.attachment} />
					</Card>
				))}
			</Card>
		</div>
	)
}
ProjectView.style = css`
	:scope > :global(.m3dl-card) {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		overflow-y: scroll;
	}

	:scope > :global(.m3dl-card) > :global(.m3dl-card.variant-filled) {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
`;

export const Matchup: Component<{ vote: VoteData }, {
	user: ApiUser | null,
	p1: ApiProject | null,
	p2: ApiProject | null,

	id: number | "tie",
	reason: string,

	anon: boolean,
	sendToUser: boolean,

	submitting: boolean,
	ai: "used" | "error" | "loading" | undefined,

	timer: number,
}> = function(cx) {
	this.reason = "";
	this.id = "tie" as number | "tie";

	this.anon = settings.shareAnon;
	this.sendToUser = false;

	this.submitting = false;

	let TIMER_MAX = 45 * 1000;
	this.timer = TIMER_MAX;

	let setting = true;
	use(this.sendToUser, this.anon).listen(([sendToUser, anon]) => {
		if (setting) {
			setting = false;
			return;
		}
		console.log("share status", sendToUser, anon);
		if (sendToUser) {
			setting = true;
			this.anon = false;
		}
	});

	cx.mount = async () => {
		this.user = await getUser("me");
		let p1 = await getProject(this.vote.vote[0]);
		let p2 = await getProject(this.vote.vote[1]);
		console.log(p1, p2, this.vote.vote);
		this.p1 = p1;
		this.p2 = p2;

		let interval = setInterval(() => {
			this.timer -= 100;
			if (this.timer === 0) clearInterval(interval);
		}, 100);
	}

	const submit = () => {
		this.submitting = true;
		let reason = (this.ai === "used" ? "[SoM Harbor: THIS VOTE USED AI. PLEASE INVALIDATE IT.] " : "") + this.reason;
		vote({
			id: this.id,
			reason,
		});
		if (settings.shareToken) {
			let winner = this.id === this.vote.vote[0] ? this.p1 : this.p2;
			let loser = this.id === this.vote.vote[0] ? this.p2 : this.p1;

			fetch("https://api.saahild.com/api/som/vote", {
				method: "POST",
				headers: {
					Authorization: settings.shareToken,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message: reason,
					title: winner!.title,
					a_title: loser!.title,
					is_tie: this.id === "tie",
					anon: this.anon,
					send_it_to_user: this.sendToUser,
				}),
			});
		}
	};

	const ai = async () => {
		if (this.ai === "loading") return;

		this.ai = "loading";

		try {
			let res = await controlledFetch("https://ai.hackclub.com/chat/completions", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					messages: [
						{
							role: "system",
							content: `You are a reviewer for a program named Summer of Making. Your goal is to compare two projects and determine which one is a better ship. A good ship is technical, creative, and presented well so that others can understand and experience it. Return a json object. Provide a concise reason why in the reason field. If you use any durations, make sure to format them as human readable times instead of second counts. Make sure the vote field contains the project you voted for, as "project_1", "project_2", or "tie". Your user info is: { "id": ${this.user?.id}, "name": ${this.user?.display_name}, "slack_id": ${this.user?.slack_id} }`
						},
						{
							role: "user",
							content: `"${this.p1?.title || "Project 1"}": ${JSON.stringify(this.p1)}`,
						},
						{
							role: "user",
							content: `"${this.p2?.title || "Project 2"}": ${JSON.stringify(this.p2)}`,
						},
						{
							role: "user",
							content: "Vote for one of these two projects, or tie."
						}
					],
					model: "qwen/qwen3-32b",
					response_format: {
						type: "json_object",
						json_schema: {
							name: "vote",
							strict: true,
							schema: {
								type: "object",
								properties: {
									vote: {
										type: "string",
										description: "The project you voted for.",
										enum: ["project_1", "project_2", "tie"],
									},
									reason: {
										type: "string",
										description: "The reason why you voted."
									},
								},
								additionalProperties: false,
								required: ["vote", "reason"],
							}
						}
					}
				})
			}).then(r => r.json());
			let message = res.choices?.[0]?.message?.content;
			if (!message) throw new Error("ai failed");

			let vote = JSON.parse(message);
			console.log(vote);

			if (vote.vote === "project_1") this.id = this.vote.vote[0];
			else if (vote.vote === "project_2") this.id = this.vote.vote[1];
			else if (vote.vote === "tie") this.id = "tie";
			this.reason = vote.reason;
			this.ai = "used";
		} catch (err) {
			console.error(err);
			this.ai = "error";
		}
	};

	return (
		<div>
			<div class="status">
				<div>
					<span class="m3dl-font-display-medium">{this.vote.remaining} remaining</span>
					{!this.vote.accepted ? <span class="m3dl-font-headline-large rejected"> <b>Vote was rejected</b></span> : null}
				</div>
				<div class="expand" />
				<ToggleButton variant="outlined" value={use(this.anon)}>Send anonymously</ToggleButton>
				<ToggleButton variant="outlined" value={use(this.sendToUser)}>Send to user</ToggleButton>
				<Button variant="outlined" icon="full" on:click={ai} disabled={use(this.p1, this.p2, settings.ai).map(([a, b, c]) => !(a && b) || !c)}>
					{use(this.ai).map(x => {
						if (x === "used") return <Icon icon={iconMarkChatRead} />;
						if (x === "error") return <Icon icon={iconChatError} />;
						else if (x === "loading") return <LoadingIndicator />;
						else return <Icon icon={iconQuickReply} />
					})}
				</Button>
				<div class="turnstile-placeholder" />
			</div>
			<div class="matchup">
				{use(this.p1).andThen(((x: ApiProject) => <ProjectView project={x} id={1} />) as any, <ProjectLoading />)}
				{use(this.p2).andThen(((x: ApiProject) => <ProjectView project={x} id={2} />) as any, <ProjectLoading />)}
			</div>
			<div class="submit">
				<ToggleButton variant="tonal" value={use(this.id).map(x => x === this.vote.vote[0], _ => this.id = this.vote.vote[0])}>
					{use(this.p1).map(x => x?.title || this.vote.vote[0])}
				</ToggleButton>
				<ToggleButton variant="tonal" value={use(this.id).map(x => x === "tie", _ => this.id = "tie")}>
					Tie
				</ToggleButton>
				<ToggleButton variant="tonal" value={use(this.id).map(x => x === this.vote.vote[1], _ => this.id = this.vote.vote[1])}>
					{use(this.p2).map(x => x?.title || this.vote.vote[1])}
				</ToggleButton>
				<TextFieldFilled
					value={use(this.reason)}
					placeholder="Reason"
					supporting={use(this.reason).map(x => x.length < 100 ? `${100 - x.length} chars needed` : `${x.length} chars used`)}
					multiline={true}
				/>
				<Button
					variant="filled"
					disabled={use(this.submitting, this.reason, state.turnstileFinished).map(([submitting, reason, turnstile]) => submitting || !turnstile || reason.length < 100)}
					on:click={submit}
				>
					Submit
				</Button>
			</div>
			<LinearProgress progress={use(this.timer).map(x => x * 100 / TIMER_MAX)} />
		</div>
	)
}
Matchup.style = css`
	:scope {
		flex: 0 0 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.matchup {
		flex: 1;
		min-height: 0;
		display: flex;
		gap: 0.5rem;
	}

	.matchup > :global(*) {
		flex: 1;
		min-height: 0;
	}

	.status {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.submit {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.submit :global(.m3dl-textfield) {
		flex: 1;
	}

	.expand { flex: 1; }

	.turnstile-placeholder { flex: 0 0 302px; }

	.rejected { color: rgb(var(--m3dl-color-error)); }
`;
