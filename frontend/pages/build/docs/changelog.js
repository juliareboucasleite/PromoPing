// changelog.js - Load the changelog dynamically from GitHub releases.

const GITHUB_OWNER = 'juliareboucasleite';
const GITHUB_REPO = 'PromoPing';
const API_BASE_URL = window.location.origin.includes('localhost')
  ? 'http://127.0.0.1:3000'
  : window.location.origin;
const GITHUB_API_URL = `${API_BASE_URL}/api/github/releases?owner=${GITHUB_OWNER}&repo=${GITHUB_REPO}&limit=20`;
const MAX_RELEASES = 20;

function markdownToHtml(text) {
  if (!text) return '';

  return text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" style="color: #ff9800;">$1</a>')
    .replace(/`([^`]+)`/gim, '<code style="background: #232326; padding: 0.2rem 0.4rem; border-radius: 4px; color: #ff9800;">$1</code>')
    .replace(/\n/gim, '<br>');
}

function getReleaseType(tagName, body) {
  const tag = tagName.toLowerCase();

  if (tag.includes('major') || tag.match(/v\d+\.0\.0/) || body?.toLowerCase().includes('major')) {
    return 'major';
  }
  if (tag.includes('minor') || tag.match(/v\d+\.\d+\.0/) || body?.toLowerCase().includes('minor')) {
    return 'minor';
  }
  if (tag.includes('patch') || tag.match(/v\d+\.\d+\.\d+/) || body?.toLowerCase().includes('patch')) {
    return 'patch';
  }
  if (tag.match(/v1\.0\.0/)) {
    return 'initial';
  }

  const versionMatch = tag.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (versionMatch) {
    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    const patch = parseInt(versionMatch[3], 10);

    if (major > 0 && minor === 0 && patch === 0) return 'major';
    if (minor > 0 && patch === 0) return 'minor';
    return 'patch';
  }

  return 'minor';
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function getBadgeClass(type) {
  const badges = {
    major: 'major',
    minor: 'minor',
    patch: 'patch',
    initial: 'initial',
    planned: 'planned'
  };
  return badges[type] || 'minor';
}

function processReleaseBody(body) {
  if (!body) {
    return {
      features: [],
      improvements: [],
      fixes: [],
      security: [],
      other: []
    };
  }

  const sections = {
    features: [],
    improvements: [],
    fixes: [],
    security: [],
    other: []
  };

  const lines = body.split('\n').filter((line) => line.trim());
  let currentSection = 'other';

  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();

    if (lowerLine.includes('nova') || lowerLine.includes('feature') || lowerLine.includes('funcionalidade')) {
      currentSection = 'features';
    } else if (lowerLine.includes('melhoria') || lowerLine.includes('improvement') || lowerLine.includes('melhor')) {
      currentSection = 'improvements';
    } else if (lowerLine.includes('correção') || lowerLine.includes('correcao') || lowerLine.includes('fix') || lowerLine.includes('bug') || lowerLine.includes('corrig')) {
      currentSection = 'fixes';
    } else if (lowerLine.includes('segurança') || lowerLine.includes('seguranca') || lowerLine.includes('security') || lowerLine.includes('vulnerabilidade')) {
      currentSection = 'security';
    }

    if (line.match(/^[\-\*\+]\s+|^\d+\.\s+/)) {
      sections[currentSection].push(line.replace(/^[\-\*\+\d\.]\s+/, '').trim());
    } else if (line.trim() && !line.match(/^#/)) {
      sections[currentSection].push(line.trim());
    }
  }

  return sections;
}

function createReleaseHTML(release) {
  const type = getReleaseType(release.tag_name, release.body);
  const badgeClass = getBadgeClass(type);
  const date = formatDate(release.published_at || release.created_at);
  const sections = processReleaseBody(release.body);

  let html = `
    <div class="changelog-version">
      <h2>${release.tag_name} <span class="version-date">- ${date}</span></h2>
      <div class="version-badge ${badgeClass}">${type.toUpperCase()}</div>
  `;

  if (release.html_url) {
    html += `
      <p style="margin-top: 0.5rem;">
        <a href="${release.html_url}" target="_blank" rel="noopener noreferrer" style="color: #ff9800; text-decoration: none;">
          View on GitHub <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle; margin-left: 0.25rem;">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </p>
    `;
  }

  if (sections.features.length > 0) {
    html += '<h3>New Features</h3><ul>';
    sections.features.forEach((item) => {
      html += `<li>${markdownToHtml(item)}</li>`;
    });
    html += '</ul>';
  }

  if (sections.improvements.length > 0) {
    html += '<h3>Improvements</h3><ul>';
    sections.improvements.forEach((item) => {
      html += `<li>${markdownToHtml(item)}</li>`;
    });
    html += '</ul>';
  }

  if (sections.security.length > 0) {
    html += '<h3>Security Improvements</h3><ul>';
    sections.security.forEach((item) => {
      html += `<li>${markdownToHtml(item)}</li>`;
    });
    html += '</ul>';
  }

  if (sections.fixes.length > 0) {
    html += '<h3>Fixes</h3><ul>';
    sections.fixes.forEach((item) => {
      html += `<li>${markdownToHtml(item)}</li>`;
    });
    html += '</ul>';
  }

  if (
    sections.features.length === 0 &&
    sections.improvements.length === 0 &&
    sections.security.length === 0 &&
    sections.fixes.length === 0 &&
    sections.other.length === 0 &&
    release.body
  ) {
    html += `<div style="line-height: 1.8; color: #ccc;">${markdownToHtml(release.body)}</div>`;
  } else if (sections.other.length > 0 && sections.features.length === 0 && sections.improvements.length === 0) {
    html += '<h3>Changes</h3><ul>';
    sections.other.forEach((item) => {
      html += `<li>${markdownToHtml(item)}</li>`;
    });
    html += '</ul>';
  }

  html += '</div>';
  return html;
}

async function loadChangelogFromGitHub() {
  const changelogContainer = document.getElementById('changelog-container');
  if (!changelogContainer) {
    console.error('Changelog container not found');
    return;
  }

  changelogContainer.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: #ccc;">
      <p>Loading changelog from GitHub...</p>
      <p style="font-size: 0.9rem; margin-top: 1rem;">If it does not load, check your internet connection.</p>
    </div>
  `;

  try {
    const response = await fetch(GITHUB_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      mode: 'cors'
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (_) {
      }

      if (response.status === 404) {
        changelogContainer.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: #f44336;">
            <p>Repository not found or no releases available.</p>
            <p style="font-size: 0.9rem; margin-top: 1rem; color: #ccc;">
              PromoPing could not load the releases. Possible reasons:
            </p>
            <ul style="text-align: left; display: inline-block; margin-top: 1rem; color: #ccc; font-size: 0.9rem;">
              <li>The repository does not exist: <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}" target="_blank" style="color: #ff9800;">github.com/${GITHUB_OWNER}/${GITHUB_REPO}</a></li>
              <li>The repository is private and no token is configured</li>
              <li>No GitHub releases have been created yet</li>
              <li>There is a connection issue with the GitHub API</li>
            </ul>
            <p style="font-size: 0.8rem; margin-top: 1rem; color: #888;">
              <strong>Tip:</strong> If the repository is private, configure the <code style="background: #232326; padding: 0.2rem 0.4rem; border-radius: 4px;">GITHUB_TOKEN</code> variable in the backend <code style="background: #232326; padding: 0.2rem 0.4rem; border-radius: 4px;">.env</code> file.
            </p>
            <p style="font-size: 0.9rem; margin-top: 1.5rem;">
              <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases" target="_blank" style="color: #ff9800; font-weight: 600;">
                Check releases on GitHub ->
              </a>
            </p>
          </div>
        `;
        return;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    const releases = data.releases || data;

    if (!releases || releases.length === 0) {
      changelogContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #ccc;">
          <p>No GitHub releases were found.</p>
          <p style="font-size: 0.9rem; margin-top: 1rem;">
            <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases" target="_blank" style="color: #ff9800;">
              View releases on GitHub
            </a>
          </p>
          <p style="font-size: 0.8rem; margin-top: 1rem; color: #888;">
            The repository may not have any releases yet. Create a GitHub release to show it here.
          </p>
          ${data.message ? `<p style="font-size: 0.8rem; margin-top: 0.5rem; color: #888;">${data.message}</p>` : ''}
        </div>
      `;
      return;
    }

    const recentReleases = releases.slice(0, MAX_RELEASES);
    let html = '';

    recentReleases.forEach((release) => {
      html += createReleaseHTML(release);
    });

    html += `
      <div style="text-align: center; margin-top: 2rem; padding: 1.5rem; background: #18181a; border-radius: 8px; border: 1px solid #232326;">
        <p style="color: #ccc; margin-bottom: 1rem;">Want to see every release?</p>
        <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases"
           target="_blank"
           rel="noopener noreferrer"
           style="color: #ff9800; text-decoration: none; font-weight: 600;">
          View all releases on GitHub ->
        </a>
      </div>
    `;

    changelogContainer.innerHTML = html;
  } catch (error) {
    console.error('Error loading GitHub releases:', error);
    changelogContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: #f44336;">
        <p>Error loading the GitHub changelog.</p>
        <p style="font-size: 0.9rem; margin-top: 1rem; color: #ccc;">
          The releases could not be loaded automatically.
        </p>
        <p style="font-size: 0.9rem; margin-top: 1rem;">
          <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases" target="_blank" style="color: #ff9800;">
            View releases on GitHub
          </a>
        </p>
        <p style="font-size: 0.8rem; margin-top: 1rem; color: #888;">
          Error details: ${error.message}
        </p>
        <p style="font-size: 0.8rem; margin-top: 0.5rem; color: #888;">
          Check whether the repository exists and is accessible:
          <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}" target="_blank" style="color: #ff9800;">
            github.com/${GITHUB_OWNER}/${GITHUB_REPO}
          </a>
        </p>
      </div>
    `;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadChangelogFromGitHub);
} else {
  loadChangelogFromGitHub();
}
