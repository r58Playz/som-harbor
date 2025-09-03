// Controlled Frame API typings
// No imports or exports here—just ambient declarations.

// === Event and Info Types ===
interface LoadInfo { readonly url: string; readonly isTopLevel: boolean; }
interface LoadAbortInfo extends LoadInfo { readonly code: number; readonly reason: string; }
interface LoadRedirectInfo { readonly oldUrl: string; readonly newUrl: string; readonly isTopLevel: boolean; }

interface LoadAbortEvent extends Event { readonly loadAbortInfo: LoadAbortInfo; }
interface LoadCommitEvent extends Event { readonly loadInfo: LoadInfo; }
interface LoadStartEvent extends Event { readonly loadInfo: LoadInfo; }
interface LoadStopEvent extends Event { }
interface LoadRedirectEvent extends Event { readonly loadRedirectInfo: LoadRedirectInfo; }

interface ConsoleMessageEvent extends Event { readonly message: string; readonly line?: number; readonly level?: string; }
interface DialogEvent extends Event { readonly message: string; readonly type: 'alert' | 'confirm' | 'prompt'; readonly defaultValue?: string; accept(response?: any): void; }
interface NewWindowEvent extends Event { readonly url: string; accept(): void; deny(): void; }
interface PermissionRequestEvent extends Event { readonly permission: string; allow(): void; deny(): void; }
interface SizeChangedEvent extends Event { readonly width: number; readonly height: number; }
interface ZoomChangeEvent extends Event { readonly oldZoom: number; readonly newZoom: number; }
interface ContentLoadEvent extends Event { }

interface ClearDataOptions { since: number; }
interface ClearDataTypeSet { cache?: boolean; cookies?: boolean; fileSystems?: boolean; indexedDB?: boolean; localStorage?: boolean; persistentCookies?: boolean; sessionCookies?: boolean; }

// --- WebRequest Enums & Types ---
type ResourceType =
	| 'main-frame' | 'sub‑frame' | 'stylesheet' | 'script'
	| 'image' | 'font' | 'object' | 'xmlhttprequest'
	| 'ping' | 'csp‑report' | 'media' | 'websocket' | 'other';

/// same-origin and cross-origin are removed from latest
type RequestedHeaders = 'none' | 'cors' | 'all' | "same-origin" | "cross-origin";

interface WebRequestInterceptorOptions {
	urlPatterns: (URLPattern | string)[];
	resourceTypes?: ResourceType[];
	blocking?: boolean;
	includeRequestBody?: boolean;
	includeHeaders?: RequestedHeaders;
}

interface UploadData {
	readonly bytes?: ArrayBuffer;
	readonly file?: string;
}

interface RequestBody {
	readonly error?: string;
	readonly formData?: any;
	readonly raw?: UploadData[];
}

interface WebRequestRequest {
	readonly method: string;
	readonly id: string;
	readonly type: ResourceType;
	readonly url: string;
	readonly initiator?: string;
	readonly headers?: Headers;
	readonly body?: RequestBody;
}

interface AuthChallenger {
	readonly host: string;
	readonly port: number;
}

interface WebRequestAuthDetails {
	readonly challenger: AuthChallenger;
	readonly isProxy: boolean;
	readonly scheme: string;
	readonly realm?: string;
}

interface WebRequestResponse {
	readonly statusCode: number;
	readonly statusLine: string;
	readonly fromCache: boolean;
	readonly headers?: Headers;
	readonly ip?: string;
	readonly redirectURL?: string;
	readonly auth?: WebRequestAuthDetails;
}

enum DocumentLifecycle {
	prerender = "prerender",
	active = "active",
	cached = "cached",
	pendingDeletion = "pending-deletion",
}

enum FrameType {
	outermostFrame = "outermost-frame",
	fencedFrame = "fenced-frame",
	subFrame = "sub-frame",
}

// --- Shared base event: WebRequestEvent ---
interface WebRequestEvent extends Event {
	readonly request: WebRequestRequest;
	readonly frameId: number;
	readonly frameType?: FrameType;
	readonly documentId?: string;
	readonly documentLifecycle?: DocumentLifecycle;
	readonly parentDocumentId?: string;
	readonly parentFrameId?: number;
}

// --- Specific event types extending WebRequestEvent ---
interface WebRequestAuthRequiredEvent extends WebRequestEvent {
	readonly response: WebRequestResponse;
	setCredentials(
		credentials: Promise<{ username: string; password: string }>,
		options?: { signal?: AbortSignal }
	): void;
}

interface WebRequestBeforeRedirectEvent extends WebRequestEvent {
	readonly response: WebRequestResponse;
}

interface WebRequestBeforeRequestEvent extends WebRequestEvent {
	redirect(redirectURL: string): void;
}

interface WebRequestBeforeSendHeadersEvent extends WebRequestEvent {
	setRequestHeaders(requestHeaders: Headers | HeadersInit): void;
}

interface WebRequestCompletedEvent extends WebRequestEvent {
	readonly response: WebRequestResponse;
}

interface WebRequestErrorOccurredEvent extends WebRequestEvent {
	readonly error: string;
}

interface WebRequestHeadersReceivedEvent extends WebRequestEvent {
	readonly response: WebRequestResponse;
	redirect(redirectURL: string): void;
	setResponseHeaders(responseHeaders: Headers | HeadersInit): void;
}

interface WebRequestResponseStartedEvent extends WebRequestEvent {
	readonly response: WebRequestResponse;
}

interface WebRequestSendHeadersEvent extends WebRequestEvent { }

interface WebRequestInterceptor extends EventTarget {
	readonly urlPatterns: (URLPattern | string)[];
	readonly resourceTypes: ResourceType[];
	readonly blocking: boolean;
	readonly includeRequestBody: boolean;
	readonly includeHeaders: RequestedHeaders;
	readonly frameId: number;
	readonly frameType: 'outermost-frame' | 'fenced-frame' | 'sub-frame' | null;
	readonly documentId: string | null;
	readonly parentDocumentId: string | null;
	readonly parentFrameId: number | null;
	readonly documentLifecycle: 'prerender' | 'active' | 'cached' | 'pending-deletion' | null;

	onauthrequired?: (ev: WebRequestAuthRequiredEvent) => void;
	onbeforerequest?: (ev: WebRequestRequest) => void;
	onbeforesendheaders?: (ev: WebRequestSendHeadersEvent) => void;
	onheadersreceived?: (ev: WebRequestHeadersReceivedEvent) => void;
	onresponsestarted?: (ev: WebRequestResponseStartedEvent) => void;
	oncompleted?: (ev: WebRequestCompletedEvent) => void;
	onerroroccurred?: (ev: WebRequestErrorOccurredEvent) => void;
}

interface WebRequest { createWebRequestInterceptor(options: WebRequestInterceptorOptions): WebRequestInterceptor; }

interface InjectDetails { code?: string; files?: string[]; }
type RunAt = 'document-start' | 'document-end' | 'document-idle';
interface ContentScriptDetails {
	name: string;
	js?: InjectDetails;
	css?: InjectDetails;
	urlPatterns: (URLPattern | string)[];
	excludeURLPatterns?: (URLPattern | string)[];
	allFrames?: boolean;
	matchAboutBlank?: boolean;
	runAt?: RunAt;
}

interface HTMLControlledFrameElement extends HTMLElement {
  // Reflects the content "src" attribute (must be http/https/data URI)
  src: string;

  // Represents the "partition" attribute
  partition?: string;

  // Clears partitioned storage
  clearData(types: ClearDataTypeSet, options: ClearDataOptions): Promise<void>;

  // WebRequest API
  readonly request: WebRequest;

  addContentScripts(details: ContentScriptDetails[]): Promise<void>;
  executeScript(details: InjectDetails);

  // Optional utilities
  captureVisibleRegion?(options?: ImageDetails): Promise<string>;
  print?(): void;

  // Event handlers
  onconsolemessage?: (ev: ConsoleMessageEvent) => void;
  oncontentload?: (ev: ContentLoadEvent) => void;
  ondialog?: (ev: DialogEvent) => void;
  onloadabort?: (ev: LoadAbortEvent) => void;
  onloadcommit?: (ev: LoadCommitEvent) => void;
  onloadstart?: (ev: LoadStartEvent) => void;
  onloadstop?: (ev: LoadStopEvent) => void;
  onloadredirect?: (ev: LoadRedirectEvent) => void;
  onnewwindow?: (ev: NewWindowEvent) => void;
  onpermissionrequest?: (ev: PermissionRequestEvent) => void;
  onsizechanged?: (ev: SizeChangedEvent) => void;
  onzoomchange?: (ev: ZoomChangeEvent) => void;
}
