"""Find every citation in a piece of text and decide whether it exists.

Round four invented `arxiv.org/abs/24606.24282`. A linter catches a hype adjective in
a second; nothing catches a plausible arXiv link except someone clicking it. This is
that click, automated.

Two layers, because they fail differently:

    format    offline, deterministic, free. An arXiv ID is YYMM.NNNNN, so a month of
              "606" or a date in the future is a fabrication with no network needed.
    resolve   online, cached. A well-formed ID that 404s is also a fabrication.

An unreachable network is reported as `unknown`, never as `ok`. The scorecard says
which of the two happened, so a green run offline is not mistaken for a verified one.
"""

import json
import os
import re
import socket
import time
import urllib.error
import urllib.request
from datetime import date

USER_AGENT = "fieldwork-voice-eval/1.0 (+https://ryanbaumann.dev)"
TIMEOUT_SECONDS = 12
CACHE_TTL_SECONDS = 14 * 24 * 3600

URL_RE = re.compile(r"https?://[^\s<>\"'`\)\]\},]+", re.IGNORECASE)
MD_LINK_RE = re.compile(r"\[[^\]]*\]\((?P<target>[^)\s]+)")
ARXIV_RE = re.compile(
    r"(?:arxiv\.org/(?:abs|pdf)/|arxiv[:\s]*)(?P<id>\d{2,6}\.\d{3,6})(?P<version>v\d+)?",
    re.IGNORECASE,
)
ARXIV_LEGACY_RE = re.compile(r"arxiv\.org/(?:abs|pdf)/(?P<id>[a-z\-]+(?:\.[A-Z]{2})?/\d{7})", re.IGNORECASE)
DOI_RE = re.compile(r"\b(?:doi:\s*|https?://(?:dx\.)?doi\.org/)?(?P<doi>10\.\d{4,9}/[^\s<>\"'`\)\]\},]+)", re.IGNORECASE)
RFC_RE = re.compile(r"\bRFC\s?(?P<num>\d{1,5})\b")

# Hosts that only ever appear in examples. A model citing one has not invented a
# source, it has left a placeholder, which is a different and lesser sin.
PLACEHOLDER_HOSTS = frozenset([
    "example.com", "example.org", "example.net", "localhost", "yourdomain.com",
    "site.com", "url.com", "link.com",
])

TRAILING_PUNCTUATION = ".,;:!?'\"”’)]}"


def _strip_trailing(value):
    while value and value[-1] in TRAILING_PUNCTUATION:
        value = value[:-1]
    return value


def extract(text):
    """Every citation in `text`, de-duplicated, in order of appearance.

    Returns dicts of {kind, raw, target} where `target` is what actually gets
    resolved: a URL for links, a canonical abs page for arXiv, doi.org for DOIs.
    """
    text = text or ""
    found = []
    seen = set()

    def add(kind, raw, target):
        key = (kind, target.lower())
        if key in seen:
            return
        seen.add(key)
        found.append({"kind": kind, "raw": raw, "target": target})

    for match in ARXIV_RE.finditer(text):
        arxiv_id = match.group("id")
        add("arxiv", match.group(0), "https://arxiv.org/abs/%s" % arxiv_id)
    for match in ARXIV_LEGACY_RE.finditer(text):
        add("arxiv", match.group(0), "https://arxiv.org/abs/%s" % match.group("id"))
    for match in DOI_RE.finditer(text):
        doi = _strip_trailing(match.group("doi"))
        add("doi", match.group(0), "https://doi.org/%s" % doi)
    for match in RFC_RE.finditer(text):
        add("rfc", match.group(0), "https://www.rfc-editor.org/rfc/rfc%s" % int(match.group("num")))

    urls = [m.group(0) for m in URL_RE.finditer(text)]
    urls += [m.group("target") for m in MD_LINK_RE.finditer(text) if m.group("target").startswith("http")]
    for url in urls:
        url = _strip_trailing(url)
        if not url:
            continue
        if "arxiv.org/" in url.lower() or "doi.org/" in url.lower():
            continue  # already captured in canonical form
        add("url", url, url)

    return found


def _host(url):
    match = re.match(r"https?://([^/:?#]+)", url or "", re.IGNORECASE)
    return match.group(1).lower() if match else ""


def check_format(citation, today=None):
    """Offline validity. Returns (status, reason) with status in ok/invalid/placeholder."""
    today = today or date.today()
    kind, target = citation["kind"], citation["target"]

    if kind == "arxiv":
        arxiv_id = target.split("/abs/", 1)[-1]
        if "/" in arxiv_id:
            return "ok", "legacy arXiv identifier"
        if not re.match(r"^\d{4}\.\d{4,5}$", arxiv_id):
            return "invalid", "arXiv IDs are YYMM.NNNNN; %r is not" % arxiv_id
        year, month = int(arxiv_id[:2]), int(arxiv_id[2:4])
        if not 1 <= month <= 12:
            return "invalid", "arXiv ID month %02d does not exist" % month
        full_year = 2000 + year
        if full_year < 2007 or (full_year, month) > (today.year, today.month):
            return "invalid", "arXiv ID dated %04d-%02d, which is not a month that has produced papers" % (full_year, month)
        return "ok", ""

    if kind == "doi":
        doi = target.split("doi.org/", 1)[-1]
        if not re.match(r"^10\.\d{4,9}/\S+$", doi):
            return "invalid", "DOI prefix must be 10.NNNN/suffix; %r is not" % doi
        return "ok", ""

    host = _host(target)
    if not host:
        return "invalid", "no host in %r" % target
    if host in PLACEHOLDER_HOSTS or host.endswith(".example"):
        return "placeholder", "%s is a placeholder host, not a source" % host
    if "." not in host or host.endswith("."):
        return "invalid", "%r is not a resolvable hostname" % host
    return "ok", ""


class Resolver(object):
    """Resolves citation targets over HTTP, with a disk cache.

    The cache is keyed on the target URL and gitignored. Re-grading a stored results
    file costs nothing after the first run, which matters because the point is to run
    this on every round rather than once at the end.
    """

    def __init__(self, cache_path=None, offline=False, ttl=CACHE_TTL_SECONDS, timeout=TIMEOUT_SECONDS):
        self.cache_path = str(cache_path) if cache_path else None
        self.offline = offline
        self.ttl = ttl
        self.timeout = timeout
        self.cache = self._load_cache()
        self.dirty = False

    def _load_cache(self):
        if not self.cache_path or not os.path.exists(self.cache_path):
            return {}
        try:
            with open(self.cache_path, "r", encoding="utf-8") as handle:
                return json.load(handle)
        except (ValueError, OSError):
            return {}

    def save(self):
        if not self.cache_path or not self.dirty:
            return
        directory = os.path.dirname(self.cache_path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        with open(self.cache_path, "w", encoding="utf-8") as handle:
            json.dump(self.cache, handle, indent=2, sort_keys=True)
        self.dirty = False

    def _fetch(self, url, method):
        request = urllib.request.Request(url, method=method, headers={
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
        })
        response = urllib.request.urlopen(request, timeout=self.timeout)
        try:
            return response.getcode()
        finally:
            response.close()

    def resolve(self, target):
        """Return {status, code, reason}. status is ok / missing / unknown."""
        if self.offline:
            return {"status": "unknown", "code": None, "reason": "offline mode; not checked"}

        cached = self.cache.get(target)
        if cached and (time.time() - cached.get("checked_at", 0)) < self.ttl:
            if cached.get("status") != "unknown":
                return {k: cached[k] for k in ("status", "code", "reason")}

        result = self._resolve_uncached(target)
        entry = dict(result)
        entry["checked_at"] = time.time()
        self.cache[target] = entry
        self.dirty = True
        return result

    def _resolve_uncached(self, target):
        for method in ("HEAD", "GET"):
            try:
                code = self._fetch(target, method)
                return {"status": "ok", "code": code, "reason": ""}
            except urllib.error.HTTPError as error:
                code = error.code
                if code in (404, 410):
                    return {"status": "missing", "code": code, "reason": "HTTP %d" % code}
                if code in (403, 405, 429, 501) and method == "HEAD":
                    continue  # some hosts refuse HEAD; try GET
                if 200 <= code < 400:
                    return {"status": "ok", "code": code, "reason": ""}
                return {"status": "unknown", "code": code, "reason": "HTTP %d" % code}
            except urllib.error.URLError as error:
                reason = getattr(error, "reason", error)
                if isinstance(reason, socket.gaierror):
                    # Name resolution failed. Either the host does not exist or there
                    # is no DNS at all; the caller decides via --require-network.
                    return {"status": "unknown", "code": None,
                            "reason": "hostname did not resolve (%s)" % reason}
                return {"status": "unknown", "code": None, "reason": str(reason)}
            except (socket.timeout, OSError) as error:
                return {"status": "unknown", "code": None, "reason": str(error)}
        return {"status": "unknown", "code": None, "reason": "no response"}


def audit(text, resolver=None, today=None):
    """Full citation audit of a block of text.

    Every citation gets a verdict:
        ok           format is valid and, if checked, the target exists
        invented     provably not a real source
        placeholder  an example URL, which is a draft marker rather than a claim
        unverified   well-formed but not checked, or checked and inconclusive
    """
    results = []
    for citation in extract(text):
        status, reason = check_format(citation, today=today)
        record = dict(citation)
        if status == "invalid":
            record.update({"verdict": "invented", "reason": reason, "http": None})
        elif status == "placeholder":
            record.update({"verdict": "placeholder", "reason": reason, "http": None})
        elif resolver is None:
            record.update({"verdict": "unverified", "reason": "no resolver", "http": None})
        else:
            resolved = resolver.resolve(citation["target"])
            record["http"] = resolved["code"]
            if resolved["status"] == "ok":
                record.update({"verdict": "ok", "reason": ""})
            elif resolved["status"] == "missing":
                record.update({"verdict": "invented", "reason": resolved["reason"]})
            else:
                record.update({"verdict": "unverified", "reason": resolved["reason"]})
        results.append(record)
    return results
