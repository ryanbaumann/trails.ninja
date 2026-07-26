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
  return errors;
}
