import { css, type Component, type Delegate } from "dreamland/core";
import { dbBool, fetchDb, getProject, getUser, type ApiProject, type ApiUser } from "./api";
import { Card, Chip, TextFieldFilled } from "m3-dreamland";
import { Doxx } from "./utils";
import { settings } from "./store";

interface DbVote {
	id: number,
	ai_feedback: string,
	explanation: string,
	invalid_reason: string,
	marked_invalid_at: string,
	music_played: boolean,
	processed_at: string,
	project_1_demo_opened: boolean,
	project_1_repo_opened: boolean,
	project_2_demo_opened: boolean,
	project_2_repo_opened: boolean,
	status: string,
	time_spent_voting_ms: number,
	created_at: string,
	updated_at: string,
	marked_invalid_by_id: number | null,
	project_1_id: number,
	project_2_id: number,
	ship_event_1_id: number,
	ship_event_2_id: number,
	user_id: number,
}
interface DbVoteChange {
	id: number,
	elo_after: number,
	elo_before: number,
	elo_delta: number,
	project_vote_count: number,
	result: "win" | "loss" | "tie",
	created_at: string,
	updated_at: string,
	project_id: number,
	vote_id: number,
}

interface Vote {
	id: number,
	ai_feedback: string,
	explanation: string,
	invalid_reason: string,
	marked_invalid_at: string,
	music_played: boolean,
	processed_at: string,
	project_1_demo_opened: boolean,
	project_1_repo_opened: boolean,
	project_2_demo_opened: boolean,
	project_2_repo_opened: boolean,
	status: string,
	time_spent_voting_ms: number,
	created_at: string,
	updated_at: string,
	marked_invalid_by_id: number | null,
	project_1_id: number,
	project_2_id: number,
	ship_event_1_id: number,
	ship_event_2_id: number,
	user_id: number,

	elo_after: number,
	elo_before: number,
	elo_delta: number,
	project_vote_count: number,
	result: "win" | "loss" | "tie",
}

async function fetchDbVotes(project: number): Promise<DbVote[]> {
	let ret = await fetchDb(`SELECT * FROM votes WHERE project_1_id = ${project} OR project_2_id = ${project}`);
	return ret.map(x => {
		x.id = +x.id;
		x.music_played = dbBool(x.music_played || "false");
		x.project_1_demo_opened = dbBool(x.project_1_demo_opened);
		x.project_1_repo_opened = dbBool(x.project_1_repo_opened);
		x.project_2_demo_opened = dbBool(x.project_2_demo_opened);
		x.project_2_repo_opened = dbBool(x.project_2_repo_opened);
		x.time_spent_voting_ms = +x.time_spent_voting_ms;
		x.marked_invalid_by_id = x.marked_invalid_by_id ? +x.marked_invalid_by_id : null;
		x.project_1_id = +x.project_1_id;
		x.project_2_id = +x.project_2_id;
		x.ship_event_1_id = +x.ship_event_1_id;
		x.ship_event_2_id = +x.ship_event_2_id;
		x.user_id = +x.user_id;
		return x as DbVote;
	});
}
async function fetchDbVoteChanges(project: number): Promise<DbVoteChange[]> {
	let ret = await fetchDb(`SELECT * FROM vote_changes WHERE project_id = ${project}`);
	return ret.map(x => {
		x.id = +x.id;
		x.elo_after = +x.elo_after;
		x.elo_before = +x.elo_before;
		x.elo_delta = +x.elo_delta;
		x.project_vote_count = +x.project_vote_count;
		x.project_id = +x.project_id;
		x.vote_id = +x.vote_id;
		return x as DbVoteChange;
	});
}
async function fetchVotes(project: number): Promise<Vote[]> {
	let votes = await fetchDbVotes(project);
	let changes = await fetchDbVoteChanges(project);

	const map = new Map<number, DbVoteChange>();
	for (const change of changes) {
		map.set(change.vote_id, change);
	}

	const ret: Vote[] = [];
	for (const vote of votes) {
		const change = map.get(vote.id);

		if (change) {
			const combined: Vote = {
				...vote,
				elo_after: change.elo_after,
				elo_before: change.elo_before,
				elo_delta: change.elo_delta,
				project_vote_count: change.project_vote_count,
				result: change.result,
			};
			ret.push(combined);
		}
	}

	return ret;
}
(self as any).fetchVotes = fetchVotes;

let VoteView: Component<{ vote: Vote }, {
	project1: ApiProject | undefined;
	project2: ApiProject | undefined;
	user: ApiUser | undefined;
}> = function(cx) {
	cx.mount = async () => {
		if (settings.enableResolving) {
			this.project1 = await getProject(this.vote.project_1_id);
			this.project2 = await getProject(this.vote.project_2_id);
			this.user = await getUser(this.vote.user_id);
		}
	};

	let user = () => this.user && window.open(`https://hackclub.slack.com/app_redirect?channel=${this.user.slack_id}`, "_blank");
	let somUser = () => window.open(`https://summer.hackclub.com/admin/users/${this.vote.user_id}`, "_blank");

	let project1Name = use(this.project1).map(x => x?.title || this.vote.project_1_id);
	let project2Name = use(this.project2).map(x => x?.title || this.vote.project_2_id);

	return (
		<div>
			<Card variant="filled">
				<div class="m3dl-font-headline-small">
					<a href={`https://summer.hackclub.com/projects/${this.vote.project_1_id}`} target="_blank">{project1Name}</a>
					{' vs '}
					<a href={`https://summer.hackclub.com/projects/${this.vote.project_2_id}`} target="_blank">{project2Name}</a>
					{' '}
					({this.vote.result})
				</div>
				<div class="chips">
					<Chip variant="assist" on:click={() => { }}>{new Date(this.vote.created_at).toLocaleString()}</Chip>
					<Chip variant="assist" on:click={() => { }}>{this.vote.status}</Chip>
					<Chip variant="assist" on:click={() => { }}>{(this.vote.time_spent_voting_ms / 1000).toFixed(1)}s spent</Chip>
					<Chip variant="assist" on:click={() => { }}>
						{this.vote.elo_before} {this.vote.elo_delta > 0 ? "+" : "-"} {Math.abs(this.vote.elo_delta)} = {this.vote.elo_after}
					</Chip>
					<Doxx><Chip variant="assist" on:click={user}>Slack: {use(this.user).map(x => x && `${x.display_name} (${x.slack_id})` || "unknown")}</Chip></Doxx>
					<Doxx><Chip variant="assist" on:click={somUser}>SoM: {this.vote.user_id}</Chip></Doxx>
				</div>
				<div class="side">
					<Card variant="outlined">
						<div>
							{this.vote.explanation}
						</div>
						{this.vote.invalid_reason &&
							<div>
								<span class="m3dl-font-body-large"><b>Marked Invalid: </b></span>
								{this.vote.invalid_reason}
							</div>
						}
					</Card>
					<Card variant="outlined">
						<div>{project1Name} demo opened: {this.vote.project_1_demo_opened}</div>
						<div>{project1Name} repo opened: {this.vote.project_1_repo_opened}</div>
						<div>{project2Name} demo opened: {this.vote.project_2_demo_opened}</div>
						<div>{project2Name} repo opened: {this.vote.project_2_repo_opened}</div>
					</Card>
				</div>
			</Card>
		</div>
	)
}
VoteView.style = css`
	a {
		color: rgb(var(--m3dl-color-primary));
	}
	a:visited {
		color: rgb(var(--m3dl-color-secondary));
	}

	:scope > :global(.m3dl-card) {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.side {
		display: flex;
		gap: 0.5rem;
	}
	.side > :global(*) {
		flex: 1;
	}
`;

export let ProjectVotes: Component<{ fetch: Delegate<() => void> }, {
	project: string,
	user: ApiUser | undefined,
	votes: Vote[],
	elo: number,
	unfilteredElo: number,
}> = function(cx) {
	this.project = "";
	this.votes = [];
	this.elo = 0;
	this.unfilteredElo = 0;

	cx.mount = async () => {
		this.user = await getUser("me");
	}

	this.fetch.listen(async x => {
		this.votes = await fetchVotes(+this.project).then(x => x.sort((a, b) => b.project_vote_count - a.project_vote_count));
		console.log(this.votes);
		this.elo = this.votes.filter(x => x.status === "active").reduce((acc, x) => acc + x.elo_delta, 1100);
		this.unfilteredElo = this.votes[0].elo_after;
		x();
	});

	return (
		<div>
			<TextFieldFilled value={use(this.project)} placeholder="Project ID" />
			<div class="chips">
				{use(this.user).map(x => (x?.projects || []).sort((a, b) => a.id - b.id)).mapEach(x => (
					<Chip variant="suggestion" on:click={() => this.project = "" + x.id} value={use(this.project).map(y => +y === x.id)}>{x.title}</Chip>
				))}
			</div>
			<div>
				{use(this.votes).map(x => x.length)} ({use(this.votes).map(x=>x.filter(x => x.status === "active").length)} active) votes displayed{use(this.elo).andThen((x: number) => `, ${x} elo`)}{use(this.unfilteredElo).andThen((x: number) => `, ${x} unfiltered elo`)}
			</div>
			{use(this.votes).mapEach(x => <VoteView vote={x} />)}
		</div>
	)
}
ProjectVotes.style = css`
	:scope {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
`
