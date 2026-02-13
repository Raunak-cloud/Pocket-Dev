'use server';

import { Sandbox } from '@e2b/code-interpreter';

export async function createSandboxServer(files: Record<string, string>) {
  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY!,
    timeoutMs: 15 * 60 * 1000, // 15 min auto-cleanup
  });

  // Upload all files at once
  const fileEntries = Object.entries(files).map(([path, content]) => ({
    path: `/home/user/${path}`,
    data: content,
  }));
  await sandbox.files.write(fileEntries);

  // Install dependencies
  await sandbox.commands.run('npm install', { cwd: '/home/user' });

  // Start dev server in background
  await sandbox.commands.run('npm run dev', {
    cwd: '/home/user',
    background: true,
  });

  // Get URL and wait for server to be ready
  const url = sandbox.getHost(3000);

  // Poll URL until responding
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`https://${url}`, { method: 'HEAD' });
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!ready) throw new Error('Dev server timeout');

  return { sandboxId: sandbox.sandboxId, url: `https://${url}` };
}

export async function updateSandboxFiles(
  sandboxId: string,
  filesToWrite: Array<{ path: string; data: string }>,
  filesToDelete: string[]
) {
  const sandbox = await Sandbox.connect(sandboxId, {
    apiKey: process.env.E2B_API_KEY!,
  });

  if (filesToWrite.length > 0) {
    await sandbox.files.write(
      filesToWrite.map(f => ({
        path: `/home/user/${f.path}`,
        data: f.data
      }))
    );
  }

  for (const path of filesToDelete) {
    await sandbox.files.remove(`/home/user/${path}`);
  }
}

export async function closeSandbox(sandboxId: string) {
  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY!,
    });
    await sandbox.kill();
  } catch (err) {
    // Sandbox might already be closed or timed out
    console.error('Error closing sandbox:', err);
  }
}
