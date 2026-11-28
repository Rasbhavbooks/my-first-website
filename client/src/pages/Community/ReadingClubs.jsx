import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";

const meetingLabels = {
  gu: { next: "આગામી બેઠક", time: "બેઠકનો સમય (ભારતીય સમય)", note: "બેઠકની ટૂંકી નોંધ", save: "બેઠક સાચવો", clear: "બેઠક રદ કરો" },
  hi: { next: "अगली बैठक", time: "बैठक का समय (भारतीय समय)", note: "बैठक की संक्षिप्त जानकारी", save: "बैठक सहेजें", clear: "बैठक रद्द करें" },
  en: { next: "Next meeting", time: "Meeting time (India time)", note: "Short meeting note", save: "Save meeting", clear: "Cancel meeting" },
};

const rsvpLabels = {
  gu: { going: "હું આવીશ", cancel: "હાજરી પાછી ખેંચો", count: "હાજરી નોંધાવનાર" },
  hi: { going: "मैं आऊँगा", cancel: "उपस्थिति वापस लें", count: "आने वाले सदस्य" },
  en: { going: "I’m attending", cancel: "Withdraw RSVP", count: "Attending" },
};

const labels = {
  gu: { title: "વાંચન ક્લબ", empty: "હજુ કોઈ વાંચન ક્લબ નથી.", join: "જોડાઓ", leave: "ક્લબ છોડો", members: "સભ્યો", create: "ક્લબ બનાવો", book: "કેટલોગનું પુસ્તક ID", archive: "ક્લબ બંધ કરો", reopen: "ફરી ખોલો", error: "ક્લબનો ફેરફાર થઈ શક્યો નહીં." },
  hi: { title: "पठन क्लब", empty: "अभी कोई पठन क्लब नहीं है।", join: "जुड़ें", leave: "क्लब छोड़ें", members: "सदस्य", create: "क्लब बनाएँ", book: "कैटलॉग की पुस्तक ID", archive: "क्लब बंद करें", reopen: "फिर खोलें", error: "क्लब में बदलाव नहीं हो सका।" },
  en: { title: "Reading clubs", empty: "There are no reading clubs yet.", join: "Join club", leave: "Leave club", members: "Members", create: "Create club", book: "Catalogue book ID", archive: "Close club", reopen: "Reopen club", error: "Could not complete the club request." },
};

async function request(path, options) {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options });
  if (!response.ok) throw new Error("Club request failed.");
  return (await response.json()).data;
}

function json(method, body) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function MeetingEditor({ club, copy, busy, save }) {
  const date = club.meetingAt ? new Date(club.meetingAt) : null;
  const local = date ? new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 16) : "";
  return <form onSubmit={event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const proposed = new Date(values.get("meetingAt") + ":00+05:30");
    if (Number.isFinite(proposed.getTime())) save(proposed.toISOString(), values.get("meetingNote"));
  }}>
    <label>{copy.time}{" "}<input name="meetingAt" type="datetime-local" required defaultValue={local} /></label>{" "}
    <label>{copy.note}{" "}<input name="meetingNote" type="text" maxLength={240} defaultValue={club.meetingNote} /></label>{" "}
    <button disabled={busy} type="submit">{copy.save}</button>{" "}
    {date && <button disabled={busy} type="button" onClick={() => save(null, "")}>{copy.clear}</button>}
  </form>;
}

export function ReadingClubs({ admin = false }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const copy = labels[language] ?? labels.en;
  const rsvp = rsvpLabels[language] ?? rsvpLabels.en;
  const meeting = meetingLabels[language] ?? meetingLabels.en;
  const meetingDate = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  const endpoint = admin ? "/api/v1/admin/clubs" : "/api/v1/community/clubs";
  const listing = endpoint + (!admin && user ? "?personal=1" : "");
  const [clubs, setClubs] = useState(null);
  const [bookId, setBookId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request(listing, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setClubs(result.clubs); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [listing]);

  async function act(task) {
    setBusy(true);
    setError(false);
    try {
      await task();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function createClub(event) {
    event.preventDefault();
    void act(async () => {
      await request(endpoint, json("POST", { bookId }));
      setBookId("");
      setClubs((await request(listing)).clubs);
    });
  }

  function changeClub(club) {
    void act(async () => {
      const url = endpoint + "/" + club.id;
      if (admin) {
        const state = await request(url, json("PATCH", { active: !club.active }));
        setClubs(current => current.map(item => item.id === club.id ? { ...item, ...state } : item));
      } else {
        await request(url + "/membership", { method: club.joined ? "DELETE" : "PUT" });
        setClubs((await request(listing)).clubs);
      }
    });
  }

  function changeAttendance(club) {
    void act(async () => {
      const result = await request(endpoint + "/" + club.id + "/rsvp", json("PUT", {
        meetingId: club.meetingId, going: !club.going,
      }));
      setClubs(current => current.map(item => item.id === club.id ? { ...item, ...result } : item));
    });
  }

  function saveMeeting(club, meetingAt, meetingNote) {
    void act(async () => {
      const result = await request(endpoint + "/" + club.id + "/meeting", json("PATCH", { meetingAt, meetingNote }));
      setClubs(current => current.map(item => item.id === club.id ? { ...item, ...result } : item));
    });
  }

  return <section aria-labelledby="reading-clubs-title">
    <h2 id="reading-clubs-title">{copy.title}</h2>
    {admin && <form onSubmit={createClub}>
      <label>{copy.book}{" "}<input value={bookId} onChange={event => setBookId(event.target.value)} required maxLength={64} /></label>{" "}
      <button disabled={busy} type="submit">{copy.create}</button>
    </form>}
    {error && <p role="alert">{copy.error}</p>}
    {clubs?.length === 0 && <p>{copy.empty}</p>}
    {clubs?.length > 0 && <ul>{clubs.map(club => <li key={club.id}>
      <Link to={"/books/" + encodeURIComponent(club.bookId) + "#book-discussion-title"}>
        {club.title?.[language] || club.title?.en || club.bookId}
      </Link>{" · "}{copy.members} {new Intl.NumberFormat(language).format(club.memberCount)}{" "}
      {(user || admin) && <button type="button" disabled={busy} onClick={() => changeClub(club)}>
        {admin ? (club.active ? copy.archive : copy.reopen) : (club.joined ? copy.leave : copy.join)}
      </button>}
      {club.meetingAt && <p><strong>{meeting.next}</strong>{" · "}
        <time dateTime={club.meetingAt}>{meetingDate.format(new Date(club.meetingAt))} IST</time>
        {club.meetingNote && <>{" · "}{club.meetingNote}</>}
      </p>}
      {club.meetingId && <p>
        {rsvp.count} {new Intl.NumberFormat(language).format(club.attendanceCount)}{" "}
        {!admin && club.joined && <button type="button" disabled={busy} onClick={() => changeAttendance(club)}>
          {club.going ? rsvp.cancel : rsvp.going}
        </button>}
      </p>}
      {admin && <MeetingEditor key={club.meetingAt || "no-meeting"} club={club} copy={meeting} busy={busy}
        save={(at, note) => saveMeeting(club, at, note)} />}
    </li>)}</ul>}
  </section>;
}
