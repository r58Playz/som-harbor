import { css, type Component } from "dreamland/core";
import "./api";

// @ts-expect-error
import "m3-dreamland/styles";
import { argbFromHex, Button, Card, DynamicScheme, Hct, LinearProgress, SchemeStyles, Variant } from "m3-dreamland";
import "./style.css";
import { getDevlogs, type ApiDevlog } from "./api";

let scheme = new DynamicScheme({
	sourceColorHct: Hct.fromInt(argbFromHex("CBA6F7")),
	contrastLevel: 0,
	specVersion: "2025",
	variant: Variant.TONAL_SPOT,
	isDark: true,
});

const DevlogCard: Component<{ project: ApiDevlog }> = function() {
	return (
		<Card variant="elevated">
			{this.project.text}
		</Card>
	)
}

const App: Component<{}, { progress: number, devlogs: ApiDevlog[] }> = function() {
	this.progress = 0;
	this.devlogs = [];

	let fetch = async () => {
		this.devlogs = await getDevlogs(x => this.progress = x);
		setTimeout(() => this.progress = 0, 100);
	}

	return (
		<div id="app">
			<SchemeStyles scheme={scheme} motion="expressive">
				<div class="m3dl-font-display-medium">Harbor Devlogs</div>
				<div class="controls">
					<Button variant="tonal" on:click={fetch}>Fetch!</Button>
					<span>{use(this.devlogs).map(x => x.length)} devlogs displayed</span>
				</div>
				<LinearProgress progress={use(this.progress)} thickness={8} />
				<div class="projects">
					{use(this.devlogs).mapEach(x => <DevlogCard project={x} />)}
				</div>
			</SchemeStyles>
		</div>
	)
}
App.style = css`
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

	.projects {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
`;

document.querySelector("#app")!.replaceWith(<App />);
