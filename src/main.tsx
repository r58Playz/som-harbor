import { css, type Component } from "dreamland/core";
import "./api";

// @ts-expect-error
import "m3-dreamland/styles";
import { argbFromHex, Button, DynamicScheme, Hct, SchemeStyles, TextFieldFilled, Variant } from "m3-dreamland";
import "./style.css";
import { getDevlogs, type ApiDevlog } from "./api";
import { settings } from "./store";

let scheme = new DynamicScheme({
	sourceColorHct: Hct.fromInt(argbFromHex("CBA6F7")),
	contrastLevel: 0,
	specVersion: "2025",
	variant: Variant.TONAL_SPOT,
	isDark: true,
});

const App: Component<{}, {}> = function() {
	return (
		<div id="app">
			<SchemeStyles scheme={scheme} motion="expressive">
				<div class="m3dl-font-display-medium">Harbor Doxxing</div>
				<div class="controls">
					<TextFieldFilled placeholder="_journey_session cookie" value={use(settings.token)} />
					<Button variant="tonal" on:click={() => { }}>Fetch!</Button>
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
	.controls > :global(.m3dl-textfield) {
		flex: 1;
	}
`;

document.querySelector("#app")!.replaceWith(<App />);
