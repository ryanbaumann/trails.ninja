import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export function listSkillDirectories(skillsRoot) {
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(skillsRoot, entry.name, 'SKILL.md')))
    .map((entry) => join(skillsRoot, entry.name))
    .sort();
}

export function validateSkillDirectory(skillDirectory) {
  const raw = readFileSync(join(skillDirectory, 'SKILL.md'), 'utf8');
  const errors = [];
  const frontmatter = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const skillName = basename(skillDirectory);
  if (!frontmatter) return ['SKILL.md must start with YAML frontmatter'];

  const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (name !== skillName) errors.push(`frontmatter name must equal directory name (${skillName})`);
  if (!description || description.includes('TODO') || description.includes('[')) {
    errors.push('frontmatter description must be a completed trigger description');
  }
  if (/TODO:/i.test(raw)) errors.push('remove template TODO markers before publishing a skill');
  if (raw.split('\n').length > 500) errors.push('SKILL.md exceeds the 500-line progressive-disclosure limit');

  const agentConfig = join(skillDirectory, 'agents', 'openai.yaml');
  if (existsSync(agentConfig)) {
    if (!existsSync(join(skillDirectory, 'manifest.json'))) {
      errors.push('skills with agents/openai.yaml must include a vendor-neutral manifest.json');
    }
    if (!readFileSync(agentConfig, 'utf8').includes(`$${skillName}`)) {
      errors.push('agents/openai.yaml default prompt must name the skill');
    }
  }

  const evalFile = join(skillDirectory, 'evals', 'evals.json');
  if (existsSync(evalFile)) {
    let suite;
    try {
      suite = JSON.parse(readFileSync(evalFile, 'utf8'));
    } catch {
      errors.push('evals/evals.json must contain valid JSON');
      return errors;
    }

    if (suite.skill_name !== skillName) {
      errors.push(`evals skill_name must equal directory name (${skillName})`);
    }
    if (!Array.isArray(suite.evals) || suite.evals.length === 0) {
      errors.push('evals/evals.json must contain at least one eval');
      return errors;
    }

    const ids = new Set();
    let developmentCases = 0;
    let selectionCases = 0;
    for (const [index, evaluation] of suite.evals.entries()) {
      const label = `eval ${index + 1}`;
      if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
        errors.push(`${label} must be an object`);
        continue;
      }
      if (!['string', 'number'].includes(typeof evaluation.id) || evaluation.id === '') {
        errors.push(`${label} must have a non-empty string or number id`);
      } else if (ids.has(evaluation.id)) {
        errors.push(`${label} id must be unique (${evaluation.id})`);
      } else {
        ids.add(evaluation.id);
      }
      if (!['development', 'selection'].includes(evaluation.split)) {
        errors.push(`${label} split must be development or selection`);
      }
      if (evaluation.split === 'development') developmentCases += 1;
      if (evaluation.split === 'selection') selectionCases += 1;
      if (typeof evaluation.prompt !== 'string' || !evaluation.prompt.trim()) {
        errors.push(`${label} must include a prompt`);
      }
      if (typeof evaluation.expected_output !== 'string' || !evaluation.expected_output.trim()) {
        errors.push(`${label} must include expected_output`);
      }
      if (!Array.isArray(evaluation.expectations) || evaluation.expectations.length === 0
        || evaluation.expectations.some((expectation) => typeof expectation !== 'string' || !expectation.trim())) {
        errors.push(`${label} must include non-empty string expectations`);
      }
    }
    if (developmentCases === 0) {
      errors.push('evals/evals.json must contain at least one development case');
    }
    if (selectionCases === 0) {
      errors.push('evals/evals.json must preserve at least one frozen selection case');
    }
  }
  return errors;
}
