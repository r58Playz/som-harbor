import type { Component, ComponentChild } from "dreamland/core";
import { settings } from "./store";

export let Doxx: Component<{ children: ComponentChild }> = function(cx) {
	return <>{use(settings.enableDoxxing).andThen(cx.children)}</>;
}
