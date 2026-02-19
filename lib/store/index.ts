import { promises as fs } from 'fs'
import path from 'path'
import { migrateLegacyData } from './migrate'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_EXAMPLE_DIR = path.join(process.cwd(), 'data.example')

export async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR)
  } catch {
    // Copy from data.example/ if it exists, otherwise create empty
    try {
      await fs.access(DATA_EXAMPLE_DIR)
      await copyDir(DATA_EXAMPLE_DIR, DATA_DIR)
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.mkdir(path.join(DATA_DIR, 'memory'), { recursive: true })
    }
  }

  // Auto-migrate legacy flat data into project directories
  await migrateLegacyData(DATA_DIR)
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

export async function readJSON<T>(filename: string): Promise<T> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    throw new Error(`Failed to read ${filename}`)
  }
}

export async function writeJSON(filename: string, data: unknown): Promise<void> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function readMarkdown(filename: string): Promise<string> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

export async function writeMarkdown(filename: string, content: string): Promise<void> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}

export async function listFiles(subdir: string): Promise<string[]> {
  await ensureDataDir()
  const dirPath = path.join(DATA_DIR, subdir)
  try {
    const entries = await fs.readdir(dirPath)
    return entries.filter(e => !e.startsWith('.'))
  } catch {
    return []
  }
}

export async function fileExists(filename: string): Promise<boolean> {
  try {
    await fs.access(path.join(DATA_DIR, filename))
    return true
  } catch {
    return false
  }
}

// ── Project-scoped helpers ──

export function projectPath(projectId: string, filename: string): string {
  return path.join('projects', projectId, filename)
}

export async function readProjectJSON<T>(projectId: string, filename: string): Promise<T> {
  return readJSON<T>(projectPath(projectId, filename))
}

export async function writeProjectJSON(projectId: string, filename: string, data: unknown): Promise<void> {
  return writeJSON(projectPath(projectId, filename), data)
}

export async function getActiveProjectId(): Promise<string> {
  const config = await readJSON<{ activeProjectId?: string }>('config.json')
  if (!config.activeProjectId) {
    throw new Error('No active project selected. Please select a project first.')
  }
  return config.activeProjectId
}
