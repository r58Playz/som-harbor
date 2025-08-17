import { css, type Component } from "dreamland/core";
import { ApiFrame, state, type VoteData, setApiFrameUrl } from "./api";
import { argbFromHex, Card, DynamicScheme, Hct, SchemeStyles, Switch, Variant, Button, TextFieldFilled } from "m3-dreamland";
import { Matchup } from "./Matchup";
import { settings } from "../store";

export let scheme = new DynamicScheme({
	sourceColorHct: Hct.fromInt(argbFromHex("CBA6F7")),
	contrastLevel: 0,
	specVersion: "2025",
	variant: Variant.TONAL_SPOT,
	isDark: true,
});

export let Voting: Component<{}, { unhide: boolean }> = function() {
	this.unhide = false;

	return (
		<div id="app" class="m3dl-font-body-medium">
			<SchemeStyles scheme={scheme} motion="expressive">
				{use(state.voteData).andThen(((x: VoteData) => <Matchup vote={x} />) as any, (
					<div class="loading">
						<div>Loading matchup...</div>
						<div>
							<Button variant="tonal" on:click={() => setApiFrameUrl("https://summer.hackclub.com/votes/new")}>Attempt to force-reload controlled frame</Button>
						</div>
					</div>
				))}
				<Card variant="outlined">
					<div class="settings">
						<div class="m3dl-font-headline-medium">SoM Share Votes Status</div>
						<TextFieldFilled value={use(settings.shareToken)} placeholder="SoM Share Votes token" supporting="https://api.saahild.com/api/som/slack/oauth" type="password" />
						<div class="switch"><Switch value={use(settings.shareAnon)} /> Share anonymously</div>
					</div>
				</Card>
				<Card variant="outlined">
					<div class="settings">
						<div class="m3dl-font-headline-medium">Controlled Frame Status</div>
						<div>Logged in: {use(state.loggedIn)}</div>
						<div class="switch"><Switch value={use(this.unhide)} /> Unhide</div>
					</div>
				</Card>
				<div class="frame" class:hidden={use(state.loggedIn, this.unhide).map(([a, b]) => a && !b)}>
					<div class="placeholder">
						Controlled Frame loading...
					</div>
					<ApiFrame />
				</div>
			</SchemeStyles>
		</div>
	)
}
Voting.style = css`
	:scope :global(.m3dl-scheme-styles) {
		font: var(--m3dl-font);

		height: calc(100% - 2em);
		background: rgb(var(--m3dl-color-background));
		color: rgb(var(--m3dl-color-on-background));

		padding: 1em;

		overflow-y: scroll;

		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.frame {
		flex: 0 0 75%;
		overflow: hidden;
		position: relative;

		border: 1px solid rgb(var(--m3dl-color-outline-variant));
		border-radius: var(--m3dl-shape-medium);
	}
	.frame.hidden {
		display: none;
	}
	.frame > :global(*) {
		position: absolute;
		inset: 0;
	}
	.placeholder {
		padding: 0.5rem;
	}

	.settings, .loading {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.switch {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
`;
