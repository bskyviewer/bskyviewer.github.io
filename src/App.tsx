import classNames from 'classnames'
import { Set } from 'immutable'
import { Context, FormEvent, createContext, useEffect, useMemo, useReducer, useState } from 'react'
import { Tooltip } from 'react-tooltip'
import './App.css'
import FriendlyError from './components/FriendlyError'
import { Record } from './components/Record'
import Spinner from './components/Spinner'
import User from './components/User'
import { Profile, fetchPosts, fetchProfile } from './utils/api'
import { DEFAULT_SERVICE, WEB_APP } from './utils/constants'

type Posts = Awaited<ReturnType<typeof fetchPosts>>['records']

const collections = {
  posts: 'app.bsky.feed.post',
  shares: 'app.bsky.feed.repost',
  likes: 'app.bsky.feed.like',
  follows: 'app.bsky.graph.follow',
  blocks: 'app.bsky.graph.block',
}

const cleanHandle = (handle: string, service: string) => {
  if (!handle.includes('.') && !handle.includes(':')) {
    handle = handle + '.' + new URL(service).host
  }
  return handle.toLowerCase().trim().replace(/^@/, '')
}

export const Filter: Context<[Set<string>, (value: Set<string>) => void]> = createContext([Set(), (_) => { }])

function App() {
  const [isLoading, setIsLoading] = useState(false)
  const [profileHandle, setProfileHandle] = useState('')
  const [profile, setProfile] = useState<Profile>()
  const [service, setService] = useState(DEFAULT_SERVICE)
  const filterState = useState(Set<string>())
  const [collection, setCollection] = useState({
    name: 'posts',
    id: 'app.bsky.feed.post',
  })
  const [error, setError] = useState<string>()
  const [cursor, setCursor] = useState<string>()
  const [records, addEntries] = useReducer(
    (state: Posts, { cursor, records }: { cursor?: string; records: Posts }) =>
      cursor ? [...state, ...records] : records,
    [],
  )
  const [count, increment] = useReducer((state) => state + 1, 0)

  const load = useMemo(
    () => (abort: AbortController, cursor?: string) => {
      if (!profileHandle) {
        return
      }

      setError(undefined)
      if (!cursor) {
        setIsLoading(true)
        filterState[1](Set())
      }

      return fetchPosts({
        service,
        handle: cleanHandle(profileHandle, service),
        collection: collection.id,
        cursor,
      })
        .then(({ records, cursor: newCursor }) => {
          if (!abort.signal.aborted) {
            addEntries({ cursor, records })
            setCursor(newCursor)
            setIsLoading(false)
          }
        })
        .catch((error) => {
          if (!abort.signal.aborted) {
            addEntries({ records: [] })
            setCursor(undefined)
            setError(error.message)
            setIsLoading(false)
          }
        })
    },
    [collection.id, profileHandle, service],
  )

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    increment()
  }

  useEffect(() => {
    if (!count) {
      return
    }

    const abort = new AbortController()

    load(abort)

    return () => abort.abort()
  }, [load, count])

  useEffect(() => {
    if (!count || !profileHandle) {
      return
    }

    return fetchProfile(
      service,
      cleanHandle(profileHandle, service),
      setProfile,
      setError,
    )
  }, [count, profileHandle, service])

  useEffect(() => {
    if (!cursor) {
      return
    }
    const abort = new AbortController()

    let fetchingMore = false

    function onScroll() {
      if (!fetchingMore && document.body.scrollHeight - window.scrollY < 2000) {
        fetchingMore = true
        load(abort, cursor)
        // The cursor will change and the effect will run again
      }
    }

    onScroll()

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      abort.abort()
      window.removeEventListener('scroll', onScroll)
    }
  }, [cursor, load])

  return (
    <Filter.Provider value={filterState}>
      <header className="App__header">
        <p className="App__credits">
          <a href="https://github.com/bskyviewer/bskyviewer.github.io">
            source code
          </a>
          {' • '}
          based on{' '}
          <a href="https://handlerug.github.io/bluesky-liked-posts/">
            bluesky-liked-posts
          </a>{' '}
          by{' '}
          <a href={`${WEB_APP}/profile/did:plc:uowmeg4dqtanpmjuknadqjqc`}>
            @handlerug.bsky.social
          </a>
        </p>
      </header>

      <main>
        <form onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="profile-handle">username</label>
            <input
              id="profile-handle"
              type="text"
              name="handle"
              placeholder="jesopo.bsky.social"
              value={profileHandle}
              onChange={(ev) => setProfileHandle(ev.target.value)}
            />
          </div>

          <div className="form-field">
            <details>
              <summary>Advanced settings</summary>

              <label htmlFor="service-url">ATProto service URL</label>
              <input
                id="service-url"
                type="text"
                name="service"
                placeholder={DEFAULT_SERVICE}
                value={service}
                onChange={(ev) => setService(ev.target.value)}
              />
            </details>
          </div>

          {profile && (
            <div className="form-field">
              <User service={service} profile={profile} />
            </div>
          )}

          <div className="form-field buttons">
            {Object.entries(collections).map(([name, id]) => (
              <button
                key={id}
                type="submit"
                className={name === collection.name ? 'active' : undefined}
                onClick={() => setCollection({ name, id })}
              >
                {name}
              </button>
            ))}
          </div>
        </form>

        <div
          className={classNames(
            'App__loading-card',
            isLoading && 'App__loading-card--visible',
          )}
          aria-hidden={!isLoading}
        >
          <div className="App__loading-card__inner">
            <Spinner />
            Loading {collection.name}…
          </div>
        </div>

        {error ? (
          <FriendlyError
            className="App__like-error"
            heading={`Error fetching ${collection.name}`}
            message={error}
          />
        ) : records.length > 0 ? (
          <div
            className={classNames(
              'App__post-timeline',
              isLoading && 'App__post-timeline--loading',
            )}
          >
            {records.map((record) => (
              <Record key={record.uri} record={record} service={service} />
            ))}
            {cursor ? (
              <div
                className="App__post-loading-card"
                aria-label="Loading more posts"
              >
                <Spinner />
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
      <Tooltip
        id="image"
        opacity={1}
        style={{ zIndex: 100 }}
        render={({ content }) => (
          <img className="App__tooltip" src={content || undefined} />
        )}
      />
      <Tooltip id="profile" opacity={1} style={{ zIndex: 100 }} />
    </Filter.Provider>
  )
}

export default App
