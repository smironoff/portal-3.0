import type { Breadcrumb, ErrorEvent } from '@sentry/react'

// ---------------------------------------------------------------------------
// PII / identifier scrubbing
// ---------------------------------------------------------------------------

// Account/customer/client/user/wallet identifiers attached to a key. Anchored
// on the field name so that timestamps, build numbers, port numbers, trace IDs
// and other diagnostic 6+ digit runs stay readable in Sentry. Matches forms
// like `accountId: 12345678`, `"customerNo":"00099"`, `user_id=42`, `wallet
// number = 87654321`. The previous unanchored `\b\d{6,}\b` pattern destroyed
// signal needed for triage (every release tag, every timestamp).
const ID_KEY_DIGIT_PATTERN =
    /\b(?:account|customer|client|user|wallet)[-_ ]?(?:id|no|number)\b["']?\s*[:=]\s*["']?\d+/gi

// Fallback for bare 7+ digit runs that appear without a keyword prefix --
// free-form error strings like "withdrawal failed for 12345678" or URL
// fragments like "/accounts/12345678/balance". The 7-digit floor keeps
// years (4 digits) and TCP ports (<=5 digits) readable; ThinkTrader account
// numbers are well above this threshold.
const BARE_LONG_DIGITS = /\b\d{7,}\b/g

const piiPatterns = [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,    // email
    ID_KEY_DIGIT_PATTERN,                                   // <field>=<digits> identifiers
    /(\+?\d[\d\s\-()]{7,}\d)/g,                            // phone numbers
    BARE_LONG_DIGITS,                                       // bare 7+ digit runs (account-number fallback)
]

export const scrubString = (s: string): string =>
    piiPatterns.reduce((str, re) => str.replace(re, '[Filtered]'), s)

// ---------------------------------------------------------------------------
// URL query-param scrubbing
//
// Strips sensitive query parameters from any URL string. Covers the password-
// reset link (/account/reset/new?token=...) and any login/password/userId
// params that might appear in XHR breadcrumb URLs.
// ---------------------------------------------------------------------------

const SENSITIVE_PARAMS = ['token', 'password', 'login', 'userId']

// Handles both absolute URLs and relative paths (e.g. /account/reset/new?token=...).
// For relative paths a dummy base is used to parse the query string; only the
// path+search portion is returned so the dummy origin never leaks.
export const stripSensitiveParams = (url: string): string => {
    const isRelative = url.startsWith('/')
    const base = isRelative ? 'https://x' : undefined
    try {
        const u = base ? new URL(url, base) : new URL(url)
        let changed = false
        for (const p of SENSITIVE_PARAMS) {
            if (u.searchParams.has(p)) {
                u.searchParams.delete(p)
                changed = true
            }
        }
        if (!changed) return url
        return isRelative ? u.pathname + (u.search || '') : u.toString()
    } catch {
        return url
    }
}

// ---------------------------------------------------------------------------
// beforeBreadcrumb
// ---------------------------------------------------------------------------

export const beforeBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb | null => {
    // Drop console breadcrumbs entirely -- they capture verbatim
    // log output that frequently contains user/error text we don't
    // want sent to Sentry.
    if (breadcrumb.category === 'console') return null

    // Scrub PII from any remaining breadcrumb message / URL.
    if (breadcrumb.message)
        breadcrumb.message = scrubString(breadcrumb.message)

    const d = breadcrumb.data as Record<string, unknown> | undefined
    if (d) {
        if (typeof d.url === 'string') d.url = scrubString(stripSensitiveParams(d.url))
        if (typeof d.to === 'string') d.to = stripSensitiveParams(d.to)
        if (typeof d.from === 'string') d.from = stripSensitiveParams(d.from)
    }

    return breadcrumb
}

// ---------------------------------------------------------------------------
// beforeSend -- noise filtering
//
// Every entry below is a "drop this event" rule. Rather than one hand-written
// `if (event.exception?.values?.some(...)) return null` block per rule (which
// is what made this file unwieldy), each rule is a declarative NoiseRule and a
// single evaluator (`ruleMatches`) walks the event once. Adding a new filter is
// now one appended object plus its rationale comment -- no new control flow.
//
// A rule fires when, after the optional `noPortalFrame` event-level gate:
//   - `custom` returns true (escape hatch for bespoke logic), OR
//   - `message` matches `event.message`, OR
//   - SOME exception value satisfies every exception-level field that is set
//     (`type`, `value`, `fn`, `filename`). Those fields are ANDed *within one
//     exception*, which preserves the original same-exception coupling (e.g.
//     "value X with a frame whose function is checkPerfReady").
//
// `noPortalFrame` is the authoritative "no first-party code on the stack" gate:
// a genuine first-party error always carries a `/static/js/` frame, so gating on
// its absence keeps real bugs reportable even when the message/value looks like
// a known third-party string. Localisation note: Error.message / DOMException
// .message are emitted in English by V8 / JavaScriptCore / SpiderMonkey
// regardless of browser UI locale, so these string patterns are stable across
// users; the real drift risk is browser *version* updates tweaking wording, so
// prefer `type` matches where the exception type is unique.
// ---------------------------------------------------------------------------

type SentryException = NonNullable<NonNullable<ErrorEvent['exception']>['values']>[number]

type NoiseRule = {
    id: string                               // PORTAL-20 id(s) for triage cross-reference
    note: string                             // one-line "why this is not actionable"
    noPortalFrame?: boolean                  // require absence of any /static/js/ frame
    message?: RegExp                         // tested against event.message
    type?: string                            // require exception.type to equal this
    value?: RegExp                           // tested against exception.value
    fn?: RegExp                              // some frame.function in that exception
    filename?: RegExp                        // some frame.filename in that exception
    custom?: (event: ErrorEvent) => boolean  // bespoke predicate (combined with noPortalFrame)
}

const RANGE_ERROR_VALUE = /Maximum call stack size exceeded/
const JSON_PARSE_VALUE = /is not valid JSON/
const TRANSLATE_DISABLED_VALUE = 'translateDisabled'
const SET_CONTACT_AUTOFILL_FN = /setContactAutofillValuesFromBridge/
const READONLY_PROPERTY_VALUE = /Attempted to assign to readonly property/
const PERFECT_SCROLLBAR_TARGET = /ps__(?:thumb|rail)-[xy]|scrollbar-container/
const BRAINTREE_VALUE = /_savedBodyProperties/
const DOM_INTERACTIVE_VALUE = /reading 'domInteractive'/
const CHECK_PERF_READY_FN = /checkPerfReady/
// endsWith('autoFillCallback' | 'insertInput') or exactly 'execute_auto_fill'
const AUTOFILL_BRIDGE_FN = /(?:autoFillCallback|insertInput)$|^execute_auto_fill$/
const BLOCKED_FRAME_VALUE = /Blocked a frame with origin/
const HTML_DOCUMENT_INJECTED_FN = /^HTMLDocument\.\w{1,3}$/
const CHROME_EXTENSION_FILENAME = /^chrome-extension:\/\//
const ADD_LISTENER_VALUE = /reading 'addListener'/
const BLOB_SCRIPT_FILENAME = /^blob:/
const CRAWLER_INJECTED_FN = /^(?:ClickSimulator|startLinkCollector|runCollectionFlow|scanAllElements|scanDocument|getSelectorPath)\b/
const BODY_TOUCHED_VALUE = /properties of undefined \(setting 'bodyTouched'\)/
const APM_RUM_FETCH_PATCH_FILENAME = /@elastic\/apm-rum-core\/.*\/fetch-patch\.js/
const APM_RUM_FETCH_PATCH_VALUE = /did not match the expected pattern/
const REMOVE_CHILD_NOT_A_CHILD_VALUE = /Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node/
// Externally hosted vendor bundles whose filename is visible directly in the
// frame (Zendesk CDN, Cloudflare RUM, Trading Central). `includes`-style
// substrings plus the hashed Zendesk-classic `/modules.<hash>.js` chunk. Uses
// substring (not anchored) matching because beforeSend receives absolute URLs
// (https://portal.../Widgets/lib/...); the Sentry UI only normalises to a relative
// path for display, so anchored checks miss in production (PORTAL-20-70 leaked).
const VENDOR_FILENAME = /\/ekr\/|\/web_widget\/|\/beacon\.min\.js(?:$|\?|\/)|\/Widgets\/lib\/|\/modules\.[a-f0-9]{8,}\.js$/
// The big message/value alternation. Every token here is a pure string match
// with NO frame gating -- third-party globals, transient network noise, and
// in-app-browser/webview bridge shims whose strings never collide with our code.
const NOISY = /ResizeObserver loop|ChunkLoadError|Loading (?:CSS )?chunk \d+ failed|Failed to fetch dynamically imported module|NetworkError when attempting|Network request failed|^fetchOk attempt timed out$|^Load failed(?: \([^)]*\))?$|^Failed to fetch(?: \([^)]*\))?$|^cancelled$|Non-Error promise rejection|^Object captured as promise rejection with keys: \[object has no keys\]$|^The operation is insecure\.?$|zaloJSV2|google is not defined|Can't find variable: google\b|reading 'postMessage'|evaluating '[^']*\.postMessage'|\.postMessage is not a function|webkit\.messageHandlers|Java object is gone|Error invoking (?:post|postEvent|batch): Method not found|window\.android\.\w+ is not a function|runtime\.sendMessage|LIDNotifyId is not defined|userScripts is not defined|swbrowser is not defined|SCDynimacBridge|UCShellJava|new \w+\.InboundFilters|Unexpected token '<'|^Unexpected EOF$|^Unexpected end of script$|^Unexpected end of input$|^missing \) after argument list$|ifameElement\.contentDocument|TradingViewApi is not defined/i

// Pre-auth route paths (used in 5P rule below). Inline constants to avoid
// importing from the router, keeping this module free of React-tree deps.
const PRE_AUTH_LOGIN = '/account/login'
const PRE_AUTH_CHECK = '/account/login/check'
const PRE_AUTH_REGISTER_PREFIX = '/account/register'

const NOISE_RULES: NoiseRule[] = [
    {
        id: 'NOT_AUTHORIZED',
        note: 'Expected expired-session / revoked-token rejection, not an actionable error',
        message: /NOT_AUTHORIZED/,
        value: /NOT_AUTHORIZED/,
    },
    {
        id: '17',
        note: 'Third-party recursion (GTM/hCaptcha/Google Translate/perf-RUM/iOS-Chrome autofill) outside the React tree; iOS Chrome wraps the RangeError in a plain Error so match the value, gated on no portal frame',
        noPortalFrame: true,
        value: RANGE_ERROR_VALUE,
    },
    {
        id: '7G',
        note: 'Native/in-app WebView hosts post non-JSON into our window; their injected handler JSON.parse throws SyntaxError. First-party keycloakAuth wraps response.json() with a distinct message and carries a portal frame, so it stays reportable',
        noPortalFrame: true,
        type: 'SyntaxError',
        value: JSON_PARSE_VALUE,
    },
    {
        id: '7F',
        note: 'iOS Live Translate raises bare-string "translateDisabled" via onunhandledrejection (message-only, no values) or as an exception value; first-party Error("translateDisabled") carries a portal frame and stays reportable',
        noPortalFrame: true,
        custom: (event) =>
            (event.message === TRANSLATE_DISABLED_VALUE && !event.exception?.values?.length)
            || (event.exception?.values?.some(ex => ex.value === TRANSLATE_DISABLED_VALUE) ?? false),
    },
    {
        id: 'FB-IAB',
        note: 'Facebook in-app browser injects setContactAutofillValuesFromBridge on an <anonymous> frame; crashes iterating form elements',
        fn: SET_CONTACT_AUTOFILL_FN,
    },
    {
        id: '3N',
        note: 'perfect-scrollbar (vendor) assigns e.pageX/Y on a TouchEvent; iOS Safari 18+ throws readonly-property. Fingerprint = readonly value + the captured DOM target (extra.arguments[0].currentTarget) being a perfect-scrollbar selector. Bundle URL defeats filename/function scoping',
        custom: (event) => {
            if (!event.exception?.values?.some(ex => READONLY_PROPERTY_VALUE.test(ex.value ?? '')))
                return false
            const extraArgs = (event.extra as { arguments?: unknown } | undefined)?.arguments
            const firstArg = Array.isArray(extraArgs) ? extraArgs[0] : undefined
            const currentTarget = (firstArg as { currentTarget?: unknown } | undefined)?.currentTarget
            return typeof currentTarget === 'string' && PERFECT_SCROLLBAR_TARGET.test(currentTarget)
        },
    },
    {
        id: '6R',
        note: 'Braintree Web SDK Modal teardown race reads this._savedBodyProperties after it was wiped (re-entrant close on iOS WKWebView). Property name survives terser (no property mangling) and is unique to Braintree internals',
        value: BRAINTREE_VALUE,
    },
    {
        id: '2E',
        note: 'GTM-injected perf-RUM SDK reads performance.timing.domInteractive when timing is undefined; signature is the checkPerfReady function on the eval-injected frame. Function-scoped so first-party domInteractive reads stay reportable',
        value: DOM_INTERACTIVE_VALUE,
        fn: CHECK_PERF_READY_FN,
    },
    {
        id: '4W / 6A',
        note: 'TikTok IAB autofill bridge (autoFillCallback / insertInput) and Android Chrome password-manager extension (execute_auto_fill) on <anonymous> frames dispatch synthetic events into first-party handlers',
        fn: AUTOFILL_BRIDGE_FN,
    },
    {
        id: '5P',
        note: '"Blocked a frame with origin" SecurityError from third-party iframes/inline scripts. Dropped only on pre-auth routes (portal owns no cross-origin iframes there) or for HTML inline <script> ("global code" frames in a non-.js file). Real SecurityErrors from our payment/KYC iframes carry /static/js/ frames and stay reportable',
        custom: (event) => {
            if (!event.exception?.values?.some(ex => BLOCKED_FRAME_VALUE.test(ex.value ?? '')))
                return false
            const isPreAuthRoute = event.transaction === PRE_AUTH_LOGIN
                || event.transaction === PRE_AUTH_CHECK
                || (typeof event.transaction === 'string' && event.transaction.startsWith(PRE_AUTH_REGISTER_PREFIX))
            const isHtmlInlineScript = event.exception?.values?.some(ex => {
                const frames = ex.stacktrace?.frames
                if (!frames || frames.length === 0) return false
                return frames.every(f =>
                    f.function === 'global code'
                    && typeof f.filename === 'string'
                    && !f.filename.endsWith('.js'))
            }) ?? false
            return isPreAuthRoute || isHtmlInlineScript
        },
    },
    {
        id: '27 / 5H',
        note: 'Miui (Xiaomi) / Vivo browsers inject autofill handlers on HTMLDocument with single-char minified property names ("HTMLDocument.c"); portal never extends HTMLDocument that way',
        fn: HTML_DOCUMENT_INJECTED_FN,
    },
    {
        id: '7R',
        note: 'Crypto-wallet extensions (MetaMask) throw EIP-1193 disconnect via unhandledrejection; every frame is chrome-extension://. Gated on no portal frame so first-party rejections interacting with an extension stay reportable',
        noPortalFrame: true,
        filename: CHROME_EXTENSION_FILENAME,
    },
    {
        id: '7Y',
        note: 'Extension/userscript content scripts injected as a Blob worker reference chrome.runtime/browser.runtime (undefined in the blob) and crash reading addListener; every frame is a blob: URL. Gated so a first-party MediaQueryList addListener read stays reportable',
        noPortalFrame: true,
        value: ADD_LISTENER_VALUE,
        filename: BLOB_SCRIPT_FILENAME,
    },
    {
        id: '7Q',
        note: 'Bot / link-collector / accessibility-scanner scripts inject classes (ClickSimulator, startLinkCollector, scanAllElements, ...) that crash introspecting selectors; none of these identifiers exist in the bundle',
        fn: CRAWLER_INJECTED_FN,
    },
    {
        id: '7P',
        note: 'Quark browser IAB injects an obfuscated touch shim that crashes setting bodyTouched on a missing target; no first-party property is called bodyTouched',
        value: BODY_TOUCHED_VALUE,
    },
    {
        id: 'M',
        note: '@elastic/apm-rum-core fetch-patch re-throws JSON.parse failures on WebKit as "did not match the expected pattern"; throw site is always inside fetch-patch.js, never imported by portal',
        value: APM_RUM_FETCH_PATCH_VALUE,
        filename: APM_RUM_FETCH_PATCH_FILENAME,
    },
    {
        id: '2Z',
        note: 'React 17 removeChild reconciler race: external DOM mutation (page translation, ad blockers, IAB overlays) removes a node React still owns. Stack is fully inside react-dom/scheduler min bundles; a first-party flawed update carries a portal frame and stays reportable',
        noPortalFrame: true,
        value: REMOVE_CHILD_NOT_A_CHILD_VALUE,
    },
    {
        id: 'NOISY',
        note: 'Pure message/value string noise -- third-party globals, transient network, webview-bridge shims. See the NOISY token notes above',
        message: NOISY,
        value: NOISY,
    },
    {
        id: '18 / 70',
        note: 'Externally hosted vendor bundles (Zendesk /ekr/ + /web_widget/ + /modules.<hash>.js, Cloudflare /beacon.min.js/, Acuity/Trading Central /Widgets/lib/) whose crashes are not actionable from portal; never imported so first-party regressions never share the stack',
        filename: VENDOR_FILENAME,
    },
]

const someFrame = (
    ex: SentryException,
    pred: (f: NonNullable<NonNullable<SentryException['stacktrace']>['frames']>[number]) => boolean,
): boolean => ex.stacktrace?.frames?.some(pred) ?? false

// A rule's exception-level fields (type/value/fn/filename) are ANDed within a
// single exception. A rule with none of those set never matches via this path
// (it must rely on `message` or `custom`).
const exceptionMatches = (rule: NoiseRule, ex: SentryException): boolean => {
    if (rule.type === undefined && rule.value === undefined
        && rule.fn === undefined && rule.filename === undefined)
        return false
    if (rule.type !== undefined && ex.type !== rule.type) return false
    if (rule.value && !rule.value.test(ex.value ?? '')) return false
    const fnRe = rule.fn
    if (fnRe && !someFrame(ex, f => typeof f.function === 'string' && fnRe.test(f.function)))
        return false
    const fileRe = rule.filename
    if (fileRe && !someFrame(ex, f => typeof f.filename === 'string' && fileRe.test(f.filename)))
        return false
    return true
}

const ruleMatches = (rule: NoiseRule, event: ErrorEvent, noPortalBundleFrame: boolean): boolean => {
    if (rule.noPortalFrame && !noPortalBundleFrame) return false
    if (rule.custom) return rule.custom(event)
    if (rule.message && rule.message.test(event.message ?? '')) return true
    return event.exception?.values?.some(ex => exceptionMatches(rule, ex)) ?? false
}

export const beforeSend = (event: ErrorEvent): ErrorEvent | null => {
    // Authoritative "no first-party code on the stack" signal: a genuine
    // first-party error always carries a /static/js/ frame. Computed once and
    // reused by every noPortalFrame-gated rule.
    const noPortalBundleFrame = !event.exception?.values?.some(ex =>
        ex.stacktrace?.frames?.some(f =>
            typeof f.filename === 'string' && f.filename.includes('/static/js/')))

    if (NOISE_RULES.some(rule => ruleMatches(rule, event, noPortalBundleFrame)))
        return null

    // Scrub URL query params from request URL
    if (event.request?.url)
        event.request.url = stripSensitiveParams(event.request.url)

    if (event.message)
        event.message = scrubString(event.message)
    if (event.exception?.values) {
        for (const ex of event.exception.values) {
            if (ex.value)
                ex.value = scrubString(ex.value)
        }
    }
    return event
}
