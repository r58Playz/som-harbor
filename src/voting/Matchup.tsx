import { css, jsx, NO_CHANGE, type Component } from "dreamland/core";
import { controlledFetch, controlledFetchRedirecting, vote, type VoteData } from "./api";
import { getProject, getUser, type ApiProject, type ApiUser } from "../api";
import { Button, Card, Chip, LoadingIndicator, TextFieldFilled, ToggleButton } from "m3-dreamland";

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

const ProjectView: Component<{ project: ApiProject, demo: boolean, repo: boolean, }, { image: string | null, user: ApiUser | undefined }> = function(cx) {
	let open = (link: string, analytics?: "demo" | "repo") => () => {
		window.open(link, "_blank");
		if (analytics) this[analytics] = true;
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
				{this.project.devlogs.sort((a, b) => +new Date(a.created_at) - new Date(b.created_at)).map(x => (
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
	p1: ApiProject | null,
	p2: ApiProject | null,
	p1demo: boolean,
	p1repo: boolean,
	p2demo: boolean,
	p2repo: boolean,

	id: number | "tie",
	reason: string,

	submitting: boolean,
}> = function(cx) {
	this.reason = "";
	this.id = "tie" as number | "tie";
	this.p1demo = false;
	this.p1repo = false;
	this.p2demo = false;
	this.p2repo = false;
	this.submitting = false;

	cx.mount = async () => {
		this.p1 = await getProject(this.vote.vote[0]);
		this.p2 = await getProject(this.vote.vote[1]);
		console.log(this.p1, this.p2);
	}

	const submit = () => {
		this.submitting = true;
		vote({
			id: this.id,
			reason: this.reason,
			project: [{ repo: this.p1repo, demo: this.p1demo }, { repo: this.p2repo, demo: this.p2demo }],
			musicPlayed: true,
		});
	};

	return (
		<div>
		<div class="status">
			<div class="m3dl-font-display-medium">Matchup</div>
			{this.vote.remaining ? <div class="m3dl-font-headline-large">{this.vote.remaining} remaining</div> : null }
			</div>
			<div class="matchup">
				{use(this.p1).andThen(((x: ApiProject) => <ProjectView project={x} demo={use(this.p1demo)} repo={use(this.p1repo)} />) as any, <ProjectLoading />)}
				{use(this.p2).andThen(((x: ApiProject) => <ProjectView project={x} demo={use(this.p2demo)} repo={use(this.p2repo)} />) as any, <ProjectLoading />)}
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
				<TextFieldFilled value={use(this.reason)} placeholder="Reason" multiline={true} />
				<Button variant="filled" disabled={use(this.submitting)} on:click={submit}>Submit</Button>
			</div>
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
		align-items: flex-end;
	}

	.submit {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.submit :global(.m3dl-textfield) {
		flex: 1;
	}
`;
