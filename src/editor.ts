export function isEditorEnvironment(): boolean {
  const env = process.env
  if (
    env.CI
    || env.GIT_PARAMS
    || env.VSCODE_GIT_COMMAND
    || env.npm_lifecycle_script?.startsWith('lint-staged')
  )
    return false
  return Boolean(
    env.VSCODE_PID
    || env.VSCODE_CWD
    || env.JETBRAINS_IDE
    || env.VIM
    || env.NVIM
    || (env.ZED_ENVIRONMENT && !env.ZED_TERM),
  )
}
