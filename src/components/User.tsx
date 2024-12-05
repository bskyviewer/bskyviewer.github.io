import { AtUri } from '@atproto/api'
import { useMemo } from 'react'
import { Profile, getBlobURL } from '../utils/api'
import { WEB_APP } from '../utils/constants'
import { getRelativeDateString } from '../utils/datetime'
import './User.css'

function User({
  service,
  profile: { uri, handle, profile },
  verb,
  verbedAt,
}: {
  service: string
  profile: Profile
  verb?: string
  verbedAt?: string
}) {
  const fullHandle = (handle?.includes('.') || handle?.includes(':')) ? handle :`${handle}.${service.replace(/^https?:\/\//, '')}`;
  const atUri = useMemo(() => new AtUri(uri), [uri])

  const profileImage = useMemo(() => {
    if (!profile.avatar) {
      return null
    }

    return getBlobURL(service, atUri.hostname, profile.avatar)
  }, [atUri.hostname, profile, service])

  const bannerImage = useMemo(() => {
    if (!profile.banner) {
      return null
    }

    return getBlobURL(service, atUri.hostname, profile.banner)
  }, [atUri.hostname, profile, service])

  const [date, relativeDate] = useMemo(() => {
    if (verb && verbedAt) {
      const date = new Date(verbedAt)
      return [date, `${verb} ${getRelativeDateString(date)}`]
    }
    return [null, null]
  }, [verb, verbedAt])

  return (
    <article
      className="User"
      style={
        bannerImage ? { backgroundImage: `url(${bannerImage})` } : undefined
      }
      data-tooltip-id={bannerImage ? 'image' : undefined}
      data-tooltip-content={bannerImage}
    >
      {profileImage ? (
        <img
          className="User__avatar"
          src={profileImage}
          data-tooltip-id="image"
          data-tooltip-content={profileImage}
        />
      ) : (
        <div className="User__avatar-placeholder" />
      )}
      <div className="User__content">
        <a
          className="User__name"
          href={`${WEB_APP}/profile/${fullHandle ?? atUri.hostname}`}
        >
          {profile.displayName ?? fullHandle ?? atUri.hostname}
        </a>
        <br />
        {handle ? <span className="User__handle">@{fullHandle}</span> : null}
        <br />
        {profile.description ? (
          <div className="User__bio">{profile.description}</div>
        ) : null}
      </div>
      <div>
        {date && (
          <time
            className="User__relative-date"
            dateTime={date.toISOString()}
            title={date.toLocaleString()}
          >
            {relativeDate}
          </time>
        )}
      </div>
    </article>
  )
}

export default User
