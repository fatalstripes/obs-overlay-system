/**
 * Thin, typed wrappers over the obs-websocket requests behind the Layout and Media Swap panels. They take the client
 * as an argument (anything with `call`), so they run against the real connection in the app and against the mock OBS
 * server in tests.
 */
import type { OBSRequestTypes, OBSResponseTypes } from 'obs-websocket-js'
import { buildMediaSettings, isMediaKind, mediaKindInfo, readMediaPath } from './media.ts'
import { buildTransformPayload, parseTransform, type Transform, type TransformInfo } from './layout.ts'

export type ObsCaller = {
  call<T extends keyof OBSRequestTypes>(
    requestType: T,
    requestData?: OBSRequestTypes[T],
  ): Promise<OBSResponseTypes[T]>
}

// ---- scene items / transforms --------------------------------------------------------------------------------------

export type SceneItemInfo = { sceneItemId: number; sourceName: string; inputKind: string | null; isGroup: boolean }

/** The items of a scene, topmost first (as OBS lists them, reversed from its bottom-up order). */
export async function listSceneItems(obs: ObsCaller, sceneName: string): Promise<SceneItemInfo[]> {
  const { sceneItems } = await obs.call('GetSceneItemList', { sceneName })
  return sceneItems
    .map((i) => ({
      sceneItemId: Number(i.sceneItemId),
      sourceName: String(i.sourceName ?? ''),
      inputKind: typeof i.inputKind === 'string' ? i.inputKind : null,
      isGroup: i.isGroup === true,
    }))
    .filter((i) => Number.isInteger(i.sceneItemId) && i.sourceName)
    .reverse()
}

/** The id OBS gave `sourceName` in `sceneName` (rejects if the source isn't in the scene). */
export async function getSceneItemId(obs: ObsCaller, sceneName: string, sourceName: string): Promise<number> {
  const { sceneItemId } = await obs.call('GetSceneItemId', { sceneName, sourceName })
  return sceneItemId
}

export async function getTransform(
  obs: ObsCaller,
  sceneName: string,
  sceneItemId: number,
): Promise<{ transform: Transform; info: TransformInfo }> {
  const { sceneItemTransform } = await obs.call('GetSceneItemTransform', { sceneName, sceneItemId })
  const parsed = parseTransform(sceneItemTransform)
  if (!parsed) throw new Error('OBS returned a transform this dashboard cannot read')
  return parsed
}

/** Sends only the valid fields of `patch`; returns what was sent (empty: nothing valid, nothing sent). */
export async function setTransform(
  obs: ObsCaller,
  sceneName: string,
  sceneItemId: number,
  patch: Partial<Record<keyof Transform, unknown>>,
): Promise<Partial<Transform>> {
  const sceneItemTransform = buildTransformPayload(patch)
  if (Object.keys(sceneItemTransform).length === 0) return sceneItemTransform
  await obs.call('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform: sceneItemTransform as OBSRequestTypes['SetSceneItemTransform']['sceneItemTransform'] })
  return sceneItemTransform
}

// ---- media inputs --------------------------------------------------------------------------------------------------

export type MediaInput = { name: string; kind: string }

/** The Image and Media sources in OBS. */
export async function listMediaInputs(obs: ObsCaller): Promise<MediaInput[]> {
  const { inputs } = await obs.call('GetInputList')
  return inputs
    .filter((i) => isMediaKind(i.inputKind))
    .map((i) => ({ name: String(i.inputName), kind: String(i.inputKind) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getMediaPath(obs: ObsCaller, input: MediaInput): Promise<string> {
  const { inputSettings } = await obs.call('GetInputSettings', { inputName: input.name })
  return readMediaPath(input.kind, inputSettings)
}

/**
 * Points an Image/Media source at `path`. Other settings of the source are kept (`overlay`). A Media source can be
 * restarted so the new file starts playing from the top. Returns the normalized path that was set.
 */
export async function swapMedia(
  obs: ObsCaller,
  input: MediaInput,
  path: unknown,
  { restart = false }: { restart?: boolean } = {},
): Promise<string> {
  const inputSettings = buildMediaSettings(input.kind, path)
  if (!inputSettings) {
    throw new Error(mediaKindInfo(input.kind) ? 'Enter a file path first' : `"${input.name}" is not an Image or Media source`)
  }
  await obs.call('SetInputSettings', { inputName: input.name, inputSettings, overlay: true })
  if (restart && input.kind === 'ffmpeg_source') {
    await obs.call('TriggerMediaInputAction', {
      inputName: input.name,
      mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
    })
  }
  return String(inputSettings[mediaKindInfo(input.kind)!.pathKey])
}
