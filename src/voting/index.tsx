import { css, type Component } from "dreamland/core";
import { ApiFrame, state } from "./api";
import { argbFromHex, Card, DynamicScheme, Hct, SchemeStyles, Switch, Variant } from "m3-dreamland";

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
		<div id="app">
			<SchemeStyles scheme={scheme} motion="expressive">
				<div class="frame" class:hidden={use(state.loggedIn, this.unhide).map(([a, b]) => a && !b)}>
					<ApiFrame />
				</div>
				<Card variant="outlined">
					<div class="settings">
						<div class="m3dl-font-headline-medium">Controlled Frame Status</div>
						<div>Logged in: {use(state.loggedIn)}</div>
						<div class="switch"><Switch value={use(this.unhide)} /> Unhide</div>
					</div>
				</Card>
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
		height: 32rem;
	}
	.frame.hidden {
		height: 0;
	}

	.settings {
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
