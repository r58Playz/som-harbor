import { createDelegate, css, type Component } from "dreamland/core";
import "./api";

// @ts-expect-error
import "m3-dreamland/styles";
import { argbFromHex, Button, Card, DynamicScheme, Hct, SchemeStyles, TextFieldFilled, ToggleButton, Variant } from "m3-dreamland";
import "./style.css";
import { settings } from "./store";
import "./ProjectVotes";
import { ProjectVotes } from "./ProjectVotes";
import { Voting } from "./voting";

let scheme = new DynamicScheme({
	sourceColorHct: Hct.fromInt(argbFromHex("CBA6F7")),
	contrastLevel: 0,
	specVersion: "2025",
	variant: Variant.TONAL_SPOT,
	isDark: true,
});

const App: Component<{}, { fetching: boolean }> = function() {
	this.fetching = false;
	let fetch = createDelegate<() => void>();

	return (
		<div id="app">
			<SchemeStyles scheme={scheme} motion="expressive">
				<div class="m3dl-font-display-medium">SoM Harbor</div>
				<Card variant="filled">
					<div class="m3dl-font-title-large"><b>Looking for the voting client?</b></div>
					<p>
						The voting client is an Isolated Web App so that it can take advantage of the Controlled Frame API to act exactly like a regular browser.{' '}
						You must use Chrome to install and use it.
					</p>
					<ol>
						<li>Enable the flags "Enable Isolated Web Apps", "Enable Isolated Web App Developer Mode", and potentially "Enable Controlled Frame".</li>
						<li>Go to "chrome://web-app-internals".</li>
						<li>Install this webpage as an Isolated Web App by typing in this page's URL as the "Dev Mode Proxy URL".</li>
					</ol>
				</Card>
				<div class="controls">
					<TextFieldFilled placeholder="_journey_session cookie" value={use(settings.token)} type="password" />
					<Button variant="tonal" on:click={() => (this.fetching = true, fetch(() => this.fetching = false))} disabled={use(this.fetching)}>Fetch!</Button>
					<ToggleButton variant="outlined" value={use(settings.enableDoxxing)}>Enable Doxxing</ToggleButton>
					<ToggleButton variant="outlined" value={use(settings.enableResolving)}>Enable Resolving</ToggleButton>
				</div>
				<ProjectVotes fetch={fetch} />
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
	.controls > :global(.m3dl-textfield) {
		flex: 1;
	}

	ol { margin: 0; }
`;

// @ts-ignore
if (window.trustedTypes && window.trustedTypes.createPolicy) {
	// @ts-ignore
	window.trustedTypes.createPolicy('default', {
		createHTML: (string: string) => string,
		createScriptURL: (string: string) => string
	});
}

let app;
if (location.protocol === "isolated-app:")
	app = <Voting />
else
	app = <App />;
document.querySelector("#app")!.replaceWith(app);
