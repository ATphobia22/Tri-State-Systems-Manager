import { useState } from 'react';
import history from '../data/community-flood-history.json';

type StationId = keyof (typeof history.events)[number]['crests'];

export default function CommunityFloodHistory(): JSX.Element {
  const [eventIndex, setEventIndex] = useState(history.events.length - 1);
  const event = history.events[eventIndex];

  return (
    <section aria-labelledby="tsm-flood-history-heading">
      <h2 id="tsm-flood-history-heading">Historic flood crests</h2>
      <p>Compare local gage heights at four Wabash and Ohio River stations. Each station uses its own gage datum.</p>
      <label htmlFor="tsm-history-record">Flood event</label>
      <select
        id="tsm-history-record"
        value={eventIndex}
        onChange={(change) => setEventIndex(Number(change.target.value))}
      >
        {history.events.map((entry, index) => (
          <option key={entry.id} value={index}>{entry.label}</option>
        ))}
      </select>
      <div className="tsm-atlas-draft-actions" role="group" aria-label="Historical event navigation">
        <button type="button" disabled={eventIndex === 0} onClick={() => setEventIndex(eventIndex - 1)}>
          Earlier event
        </button>
        <button
          type="button"
          disabled={eventIndex === history.events.length - 1}
          onClick={() => setEventIndex(eventIndex + 1)}
        >
          Later event
        </button>
      </div>
      <div className="tsm-atlas-history-grid" aria-live="polite">
        {history.stations.map((station) => {
          const crest = event.crests[station.nwsId as StationId];
          return (
            <article className="tsm-atlas-history-record" key={station.nwsId}>
              <h3>{station.location}</h3>
              <p>
                NWS {station.nwsId}
                {station.usgsId && ` · USGS ${station.usgsId}`}
              </p>
              {crest ? (
                <p>
                  <strong>{crest.gageHeightFt.toFixed(2)} ft</strong>
                  {' · '}<time dateTime={crest.sourceDate}>{crest.sourceDate}</time>
                  {crest.sourceFlag === 'P' && ' · Preliminary'}
                  {crest.sourceFlag === 'R' && ' · Record crest'}
                  {crest.olderDatum && ' · Older station datum'}
                </p>
              ) : <p>No crest listed for this event window.</p>}
              <a href={station.sourceUrl} target="_blank" rel="noopener noreferrer">
                NOAA station record
              </a>
            </article>
          );
        })}
      </div>
      <p className="tsm-atlas-note">
        NOAA snapshot retrieved {history.retrievedOn}. These point readings describe crests at the stations.
        Flood depth at a parcel requires separate terrain and hydraulic evidence.
      </p>
      <a href="https://pubs.usgs.gov/publication/wsp838" target="_blank" rel="noopener noreferrer">
        USGS archival report on the 1937 flood
      </a>
    </section>
  );
}
