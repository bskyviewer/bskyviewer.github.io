import {
  AppBskyActorProfile,
  AppBskyFeedPost,
  AtUri,
  AtpAgent,
  BlobRef,
} from '@atproto/api'
import memoize from 'fast-memoize'

export const getBlobURL = memoize(
  (service: string, did: string, ref: BlobRef) => {
    return `${service}/xrpc/com.atproto.sync.getBlob?${new URLSearchParams({
      did,
      cid: ref.ref,
    }).toString()}`
  },
)

export async function fetchPosts({
  service,
  handle,
  cursor,
  collection,
}: {
  service: string
  handle: string
  cursor?: string
  collection: string
}) {
  const agent = new AtpAgent({ service })
  const { data } = await agent.api.com.atproto.repo.listRecords({
    repo: handle,
    collection,
    limit: 5,
    cursor,
  })
  return data
}

const getRecord = memoize((service, args) => {
  const agent = new AtpAgent({ service })
  return agent.api.com.atproto.repo.getRecord(args)
})

const describeRepo = memoize((service, args) => {
  const agent = new AtpAgent({ service })
  return agent.api.com.atproto.repo.describeRepo(args)
})

export type Profile = {
  uri: string
  handle: string
  profile: AppBskyActorProfile.Record
}

export const fetchProfile = function fetchProfile(
  service: string,
  handle: string,
  onSuccess: (profile: Profile) => void,
  onError: (error: string) => void,
) {
  const abortController = new AbortController()

  describeRepo(service, {
    repo: handle,
  })
    .then(({ data: { handle } }) => {
      if (abortController.signal.aborted) {
        return
      }
      getRecord(service, {
        repo: handle,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
      }).then(({ data: { uri, value } }) => {
        if (abortController.signal.aborted) {
          return
        }

        if (AppBskyActorProfile.isRecord(value)) {
          onSuccess({ uri, handle, profile: value })
          return { uri, value }
        } else {
          abortController.signal.aborted ||
            onError(`Invalid profile record ${uri}`)
        }
      })
    })
    .catch(
      (error) =>
        abortController.signal.aborted ||
        onError(error?.message ?? String(error)),
    )

  return () => {
    abortController.abort()
  }
}

export function fetchPost(
  service: string,
  uri: string,
  cid: string,
  onSuccess: (post: AppBskyFeedPost.Record) => void,
  onError: (error: string) => void,
) {
  const atUri = new AtUri(uri)

  const abortController = new AbortController()

  getRecord(service, {
    repo: atUri.hostname,
    collection: atUri.collection,
    rkey: atUri.rkey,
    cid: cid,
  })
    .then(({ data: { value } }) => {
      if (!abortController.signal.aborted) {
        if (AppBskyFeedPost.isRecord(value)) {
          onSuccess(value)
        } else {
          console.log(value)
          onError(`Invalid post record ${uri}`)
        }
      }
    })
    .catch(
      (error) =>
        abortController.signal.aborted ||
        onError(error?.message || String(error)),
    )

  return () => {
    abortController.abort()
  }
}
