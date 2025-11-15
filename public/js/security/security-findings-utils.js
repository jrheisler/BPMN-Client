(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.securityFindingsUtils = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const SEVERITY_MAP = {
    CRITICAL: 'CRITICAL',
    CRIT: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    MODERATE: 'MEDIUM',
    LOW: 'LOW',
    INFO: 'INFO',
    INFORMATIONAL: 'INFO',
    NEGLIGIBLE: 'LOW'
  };

  const ISSUE_ARRAY_KEYS = [
    'securityFindings',
    'securityIssues',
    'issues',
    'vulnerabilities',
    'findings',
    'alerts'
  ];

  const SINGLE_ISSUE_KEYS = ['issue', 'finding', 'vulnerability', 'alert'];
  const NESTED_CONTAINER_KEYS = ['security', 'metadata', 'data'];

  function normalizeSeverity(value) {
    if (value === undefined || value === null) return 'UNKNOWN';
    const normalized = String(value).trim().toUpperCase();
    if (!normalized) return 'UNKNOWN';
    if (SEVERITY_MAP[normalized]) return SEVERITY_MAP[normalized];
    if (!Number.isNaN(Number(normalized))) {
      const score = Number(normalized);
      if (score >= 9) return 'CRITICAL';
      if (score >= 7) return 'HIGH';
      if (score >= 4) return 'MEDIUM';
      if (score > 0) return 'LOW';
    }
    return SEVERITY_MAP[normalized] || 'UNKNOWN';
  }

  function severityRank(value) {
    const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'UNKNOWN'];
    const normalized = normalizeSeverity(value);
    const idx = order.indexOf(normalized);
    return idx === -1 ? order.length : idx;
  }

  function toNumber(value) {
    if (value === undefined || value === null) return null;
    const num = Number(value);
    return Number.isFinite(num) ? Number(num.toFixed(1)) : null;
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function extractAffects(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    const refs = list
      .map(entry => {
        if (!entry) return null;
        if (typeof entry === 'string') return entry;
        if (typeof entry !== 'object') return null;
        return (
          entry.ref ||
          entry.name ||
          entry.componentName ||
          entry.purl ||
          entry.id ||
          entry.packageName ||
          null
        );
      })
      .filter(Boolean);
    return unique(refs);
  }

  function extractReferences(vuln) {
    const refs = [];
    if (Array.isArray(vuln?.references)) {
      vuln.references.forEach(ref => {
        if (!ref) return;
        if (typeof ref === 'string') {
          refs.push(ref);
        } else if (typeof ref === 'object' && ref.url) {
          refs.push(ref.url);
        }
      });
    }
    if (Array.isArray(vuln?.advisories)) {
      vuln.advisories.forEach(advisory => {
        if (advisory?.url) refs.push(advisory.url);
      });
    }
    return unique(refs);
  }

  function pickBestRating(vuln) {
    if (!Array.isArray(vuln?.ratings) || !vuln.ratings.length) return null;
    return [...vuln.ratings].sort((a, b) => {
      const severityDiff = severityRank(a.severity) - severityRank(b.severity);
      if (severityDiff !== 0) return severityDiff;
      return (b.score || 0) - (a.score || 0);
    })[0];
  }

  function normalizeCycloneFindings(bom) {
    if (!bom || typeof bom !== 'object' || !Array.isArray(bom.vulnerabilities)) {
      return [];
    }
    return bom.vulnerabilities
      .map(vuln => {
        if (!vuln || typeof vuln !== 'object') return null;
        const rating = pickBestRating(vuln);
        const severity = rating?.severity || vuln.severity;
        const score = rating?.score ?? vuln.score;
        const affects = extractAffects(vuln.affects);
        const references = extractReferences(vuln);
        const title = vuln.title || vuln.id || affects[0] || 'Security issue';
        const recommendation =
          vuln.recommendation ||
          (Array.isArray(vuln.analysis?.response)
            ? vuln.analysis.response.join(', ')
            : vuln.analysis?.response || '');
        return {
          id: vuln.id || title,
          title,
          source: vuln.source?.name || 'CycloneDX',
          severity: normalizeSeverity(severity),
          score: toNumber(score),
          description: vuln.description || vuln.detail || vuln.summary || '',
          recommendation,
          affects,
          references
        };
      })
      .filter(Boolean);
  }

  function getComponentName(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    return (
      candidate.name ||
      candidate.componentName ||
      candidate.label ||
      candidate.packageName ||
      candidate.library ||
      candidate.purl ||
      candidate.id ||
      null
    );
  }

  function extractIssueCandidates(value, seen = new Set()) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.flat().filter(Boolean);
    }
    if (typeof value !== 'object') return [];
    if (seen.has(value)) return [];
    seen.add(value);

    let issues = [];
    ISSUE_ARRAY_KEYS.forEach(key => {
      if (Array.isArray(value[key])) {
        issues = issues.concat(value[key]);
      }
    });
    SINGLE_ISSUE_KEYS.forEach(key => {
      if (value[key] && typeof value[key] === 'object') {
        issues.push(value[key]);
      }
    });
    NESTED_CONTAINER_KEYS.forEach(key => {
      if (value[key] && typeof value[key] === 'object') {
        issues = issues.concat(extractIssueCandidates(value[key], seen));
      }
    });
    return issues;
  }

  function normalizeMergedGraphIssue(issue, meta = {}) {
    if (!issue || typeof issue !== 'object') return null;
    if (issue.issue && typeof issue.issue === 'object') {
      return normalizeMergedGraphIssue(issue.issue, {
        source: issue.source || meta.source,
        componentName:
          meta.componentName ||
          getComponentName(issue.component) ||
          issue.componentName ||
          issue.subject ||
          null
      });
    }
    const componentName =
      meta.componentName ||
      getComponentName(issue.component) ||
      issue.componentName ||
      issue.subject ||
      issue.packageName ||
      issue.libraryName ||
      null;

    const affects = extractAffects(issue.affects || issue.components || componentName);
    const severity =
      issue.severity ||
      issue.level ||
      issue.rating?.severity ||
      issue.cvss?.severity ||
      issue.cvssV3?.baseSeverity ||
      issue.cvssV2?.baseSeverity;
    const score =
      issue.score ||
      issue.cvss?.score ||
      issue.cvss?.baseScore ||
      issue.cvssV3?.baseScore ||
      issue.cvssV2?.baseScore ||
      issue.rating?.score ||
      issue.cvssScore;

    const description =
      issue.description ||
      issue.details ||
      issue.detail ||
      issue.summary ||
      issue.message ||
      issue.reason ||
      '';

    const recommendation =
      issue.recommendation ||
      issue.remediation ||
      issue.action ||
      issue.solution ||
      issue.fixVersion ||
      '';

    const title = issue.title || issue.name || issue.id || componentName || 'Security issue';

    return {
      id:
        issue.id ||
        issue.vulnerabilityId ||
        issue.externalId ||
        issue.cve ||
        issue.issueId ||
        title,
      title,
      source: issue.source?.name || issue.source || meta.source || 'mergedGraph.json',
      severity: normalizeSeverity(severity),
      score: toNumber(score),
      description,
      recommendation,
      affects: affects.length ? affects : componentName ? [componentName] : [],
      references: extractReferences(issue)
    };
  }

  function normalizeMergedGraphFindings(graph) {
    if (!graph || typeof graph !== 'object') return [];
    const findings = [];

    const rootIssues = extractIssueCandidates(graph);
    rootIssues.forEach(issue => {
      const normalized = normalizeMergedGraphIssue(issue, {
        source: graph.source || 'mergedGraph.json'
      });
      if (normalized) findings.push(normalized);
    });

    const nodeCollections = [
      graph.nodes,
      graph.graph && graph.graph.nodes,
      graph.components,
      graph.packages,
      graph.vertices,
      graph.artifacts,
      graph.services
    ].filter(Array.isArray);

    nodeCollections.forEach(collection => {
      collection.forEach(node => {
        const componentName =
          getComponentName(node) ||
          node.subject ||
          node.packageName ||
          node.libraryName ||
          null;
        const issues = extractIssueCandidates(node);
        issues.forEach(issue => {
          const normalized = normalizeMergedGraphIssue(issue, {
            source: node.source || metaSource(node) || graph.source || 'mergedGraph.json',
            componentName
          });
          if (normalized) findings.push(normalized);
        });
      });
    });

    return findings;
  }

  function metaSource(node) {
    if (!node || typeof node !== 'object') return null;
    return node.provider || node.analyzer || node.tool || null;
  }

  function dedupeFindings(findings = []) {
    const store = new Map();
    findings.forEach(finding => {
      if (!finding) return;
      const key = `${finding.source || 'unknown'}|${finding.id || finding.title || finding.description}`;
      if (!store.has(key)) {
        store.set(key, finding);
      }
    });
    return Array.from(store.values());
  }

  return {
    normalizeCycloneFindings,
    normalizeMergedGraphFindings,
    dedupeFindings,
    normalizeSeverity,
    severityRank
  };
});
