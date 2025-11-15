const { test } = require('node:test');
const assert = require('assert');

const {
  normalizeCycloneFindings,
  normalizeMergedGraphFindings,
  dedupeFindings,
  normalizeSeverity,
  severityRank
} = require('../public/js/security/security-findings-utils.js');

test('normalizeCycloneFindings extracts severity, score and references', () => {
  const bom = {
    vulnerabilities: [
      {
        id: 'CVE-2024-0001',
        title: 'Prototype pollution',
        source: { name: 'NVD' },
        ratings: [{ severity: 'high', score: 8.8 }],
        affects: [{ ref: 'pkg:npm/lodash@4.17.20' }],
        description: 'Issue description',
        advisories: [{ url: 'https://example.com/advisory' }],
        recommendation: 'Upgrade to 4.17.21'
      }
    ]
  };

  const findings = normalizeCycloneFindings(bom);
  assert.strictEqual(findings.length, 1);
  const finding = findings[0];
  assert.strictEqual(finding.id, 'CVE-2024-0001');
  assert.strictEqual(finding.source, 'NVD');
  assert.strictEqual(finding.severity, 'HIGH');
  assert.strictEqual(finding.score, 8.8);
  assert.deepStrictEqual(finding.affects, ['pkg:npm/lodash@4.17.20']);
  assert.ok(finding.references.includes('https://example.com/advisory'));
});

test('normalizeMergedGraphFindings finds nested issues and normalizes severity', () => {
  const mergedGraph = {
    nodes: [
      {
        name: 'lodash',
        securityFindings: [
          {
            id: 'CVE-2023-1234',
            severity: 'critical',
            summary: 'Remote code execution',
            recommendation: 'Update package'
          }
        ]
      },
      {
        componentName: 'react',
        data: {
          security: {
            findings: [
              {
                issue: {
                  id: 'GHSA-xxxx',
                  rating: { severity: 'moderate', score: 5.1 },
                  details: 'Prototype pollution'
                }
              }
            ]
          }
        }
      }
    ]
  };

  const findings = normalizeMergedGraphFindings(mergedGraph);
  assert.strictEqual(findings.length, 2);
  const [first, second] = findings;
  assert.strictEqual(first.severity, 'CRITICAL');
  assert.deepStrictEqual(first.affects, ['lodash']);
  assert.strictEqual(second.severity, 'MEDIUM');
  assert.ok(second.description.includes('Prototype'));
});

test('dedupeFindings removes duplicate entries by source and id', () => {
  const list = dedupeFindings([
    { id: 'CVE-1', source: 'CycloneDX' },
    { id: 'CVE-1', source: 'CycloneDX' },
    { id: 'CVE-1', source: 'mergedGraph' }
  ]);
  assert.strictEqual(list.length, 2);
});

test('severity helpers normalize values consistently', () => {
  assert.strictEqual(normalizeSeverity('Moderate'), 'MEDIUM');
  assert.ok(severityRank('CRITICAL') < severityRank('LOW'));
});
