const utils = window.securityFindingsUtils;

if (utils) {
  const {
    normalizeCycloneFindings,
    normalizeMergedGraphFindings,
    dedupeFindings,
    normalizeSeverity,
    severityRank
  } = utils;

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('sbom-findings');
    if (!container) return;
    const statusEl = container.querySelector('[data-role="sbom-status"]');
    const listEl = container.querySelector('[data-role="sbom-list"]');
    const summaryEl = container.querySelector('[data-role="sbom-summary"]');

    init();

    async function init() {
      const { data: cycloneData, loaded: cycloneLoaded } = await loadJSON('./CycloneDX.json');
      const { data: mergedGraphData, loaded: mergedGraphLoaded } = await loadJSON('./mergedGraph.json');

      if (!cycloneLoaded && !mergedGraphLoaded) {
        container.hidden = true;
        return;
      }

      container.hidden = false;
      setStatus('Loading security findings…');

      const findings = dedupeFindings([
        ...normalizeCycloneFindings(cycloneData),
        ...normalizeMergedGraphFindings(mergedGraphData)
      ]);

      if (!findings.length) {
        container.classList.add('sbom-findings--empty');
        summaryEl.innerHTML = '';
        listEl.innerHTML = '';
        setStatus('No security findings were provided for this SBOM.');
        return;
      }

      container.classList.remove('sbom-findings--empty');
      setStatus(`${findings.length} security ${findings.length === 1 ? 'finding' : 'findings'} detected`);
      renderSummary(findings);
      renderList(findings);
    }

    function setStatus(message) {
      if (!statusEl) return;
      statusEl.textContent = message;
    }

    function renderSummary(findings) {
      if (!summaryEl) return;
      const counts = findings.reduce((acc, finding) => {
        const severity = normalizeSeverity(finding.severity);
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, {});
      const severities = Object.keys(counts).sort((a, b) => severityRank(a) - severityRank(b));
      summaryEl.innerHTML = '';
      severities.forEach(severity => {
        const chip = document.createElement('span');
        chip.className = `sbom-findings__chip sbom-findings__chip--${severity.toLowerCase()}`;
        chip.textContent = `${severity}: ${counts[severity]}`;
        summaryEl.appendChild(chip);
      });
    }

    function renderList(findings) {
      if (!listEl) return;
      listEl.innerHTML = '';
      const sorted = findings.slice().sort((a, b) => {
        const severityDiff = severityRank(a.severity) - severityRank(b.severity);
        if (severityDiff !== 0) return severityDiff;
        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (a.id || '').localeCompare(b.id || '');
      });

      sorted.forEach(finding => {
        const item = document.createElement('li');
        item.className = 'sbom-findings__item';

        const header = document.createElement('div');
        header.className = 'sbom-findings__item-header';
        const title = document.createElement('h4');
        title.textContent = finding.title || finding.id || 'Security issue';
        header.appendChild(title);

        const badge = document.createElement('span');
        const severity = normalizeSeverity(finding.severity);
        badge.className = `sbom-findings__badge sbom-findings__badge--${severity.toLowerCase()}`;
        badge.textContent = formatSeverityLabel(severity, finding.score);
        header.appendChild(badge);
        item.appendChild(header);

        const metaBits = [];
        if (finding.id) metaBits.push(`ID: ${finding.id}`);
        if (finding.source) metaBits.push(`Source: ${finding.source}`);
        if (finding.affects && finding.affects.length) {
          metaBits.push(`Affects: ${finding.affects.join(', ')}`);
        }
        if (metaBits.length) {
          const meta = document.createElement('p');
          meta.className = 'sbom-findings__meta';
          meta.textContent = metaBits.join(' • ');
          item.appendChild(meta);
        }

        if (finding.description) {
          const description = document.createElement('p');
          description.textContent = finding.description;
          item.appendChild(description);
        }

        if (finding.recommendation) {
          const rec = document.createElement('p');
          rec.className = 'sbom-findings__recommendation';
          rec.textContent = `Recommendation: ${finding.recommendation}`;
          item.appendChild(rec);
        }

        if (finding.references && finding.references.length) {
          const heading = document.createElement('p');
          heading.className = 'sbom-findings__references-heading';
          heading.textContent = 'References:';
          const refs = document.createElement('ul');
          refs.className = 'sbom-findings__references';
          finding.references.forEach(ref => {
            const li = document.createElement('li');
            const link = createSafeLink(ref);
            if (link) {
              li.appendChild(link);
            } else {
              li.textContent = ref;
            }
            refs.appendChild(li);
          });
          item.appendChild(heading);
          item.appendChild(refs);
        }

        listEl.appendChild(item);
      });
    }

    function formatSeverityLabel(severity, score) {
      return score ? `${severity} (${score})` : severity;
    }

    function createSafeLink(url) {
      if (!url) return null;
      try {
        const safeUrl = new URL(url, window.location.href);
        const anchor = document.createElement('a');
        anchor.href = safeUrl.href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = safeUrl.href;
        return anchor;
      } catch (err) {
        console.warn('Invalid reference URL', url, err);
        return null;
      }
    }

    async function loadJSON(path) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
          return { data: null, loaded: false };
        }
        return { data: await response.json(), loaded: true };
      } catch (err) {
        console.warn(`Failed to load ${path}`, err);
        return { data: null, loaded: false };
      }
    }
  });
} else {
  console.warn('securityFindingsUtils was not initialized.');
}
