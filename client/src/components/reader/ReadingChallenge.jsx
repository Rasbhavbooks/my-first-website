import { useEffect, useState } from "react";
import { getReadingChallenge, getReadingCompletion, setReadingCompletion, setReadingReminder } from "../../services/readerLibraryService.js";

const copy = {
  gu: { heading: "માસિક વાંચન લક્ષ્ય", mark: "વાંચી લીધું", undo: "વાંચ્યાની નોંધ દૂર કરો", error: "વાંચનની નોંધ મેળવી કે સાચવી શકાઈ નહીં." },
  hi: { heading: "मासिक पढ़ने का लक्ष्य", mark: "पढ़ लिया", undo: "पढ़ने की प्रविष्टि हटाएँ", error: "पढ़ने की प्रविष्टि लोड या सेव नहीं हो सकी।" },
  en: { heading: "Monthly reading goal", mark: "Mark as read", undo: "Remove completion", error: "Could not load or save your reading progress." },
};

export function ReadingChallengeSummary({ language, onCompletionRemoved }) {
  const [summary, setSummary] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const [error, setError] = useState(false);
  const labels = copy[language] ?? copy.en;
  useEffect(() => {
    let active = true;
    getReadingChallenge().then(result => { if (active) setSummary(result); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  async function removeBook(bookId) {
    setError(false);
    setRemoving(bookId);
    try {
      await setReadingCompletion(bookId, false);
      setSummary(current => ({
        ...current,
        completed: Math.max(0, current.completed - 1),
        books: current.books.filter(book => book.bookId !== bookId),
      }));
      onCompletionRemoved?.();
      setSummary(await getReadingChallenge());
    } catch {
      setError(true);
    } finally {
      setRemoving(null);
    }
  }
  async function changeReminder(enabled) {
    setError(false);
    setSavingReminder(true);
    try {
      setSummary(await setReadingReminder(enabled));
    } catch {
      setError(true);
    } finally {
      setSavingReminder(false);
    }
  }
  if (!summary && !error) return null;
  const reminderLabels = {
    gu: ["લાઇબ્રેરીમાં વાંચન લક્ષ્ય યાદ અપાવો", "આ મહિનાનું લક્ષ્ય પૂરું કરવા હજી સમય છે."],
    hi: ["लाइब्रेरी में पढ़ने का लक्ष्य याद दिलाएँ", "इस महीने का लक्ष्य पूरा करने के लिए अभी समय है।"],
    en: ["Remind me in the library", "There is still time to reach this month's goal."],
  }[language] ?? ["Remind me in the library", "There is still time to reach this month's goal."];
  const streakLabels = {
    gu: ["હાલના સતત દિવસ", "સૌથી લાંબો સળંગ ગાળો", "સાત દિવસ સતત વાંચન"],
    hi: ["अभी लगातार दिन", "सबसे लंबा सिलसिला", "सात दिन लगातार पढ़ा"],
    en: ["Current streak", "Longest streak", "Seven days of reading"],
  }[language];
  const number = new Intl.NumberFormat(language);
  return <section aria-labelledby="reading-challenge-title">
    <h2 id="reading-challenge-title">{labels.heading}</h2>
    {summary && <>
      <p>{number.format(summary.completed)} / {number.format(summary.target)}</p>
      <progress aria-labelledby="reading-challenge-title" value={Math.min(summary.completed, summary.target)} max={summary.target} />
      <p><label>
        <input type="checkbox" checked={Boolean(summary.reminderEnabled)} disabled={savingReminder || removing !== null}
          onChange={event => changeReminder(event.target.checked)} />
        {" "}{reminderLabels[0]}
      </label></p>
      {summary.reminderDue && <p role="status">{reminderLabels[1]}</p>}
      {summary.streak && <>
        <dl className="reading-streak">
          <div><dt>{streakLabels[0]}</dt><dd>{number.format(summary.streak.current)}</dd></div>
          <div><dt>{streakLabels[1]}</dt><dd>{number.format(summary.streak.longest)}</dd></div>
        </dl>
        {summary.streak.longest >= 7 && <p>{streakLabels[2]}</p>}
      </>}
      {summary.books?.length > 0 && <>
        <h3>{{ gu: "આ મહિને તાજેતરમાં વાંચેલી બુક", hi: "इस महीने हाल में पढ़ी गई किताबें", en: "Recently finished this month" }[language]}</h3>
        <ul>{summary.books.map(book => {
          const title = book.title?.[language] || book.title?.en || book.title?.gu || book.title?.hi || book.bookId;
          return <li key={book.bookId}>
            {title}{" "}
            <button type="button" aria-label={labels.undo + " · " + title} disabled={savingReminder || removing !== null} onClick={() => removeBook(book.bookId)}>
              {labels.undo}
            </button>
          </li>;
        })}</ul>
      </>}
    </>}
    {error && <p role="alert">{labels.error}</p>}
  </section>;
}

export function ReadingCompletionButton({ bookId, language }) {
  const [completed, setCompleted] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const labels = copy[language] ?? copy.en;
  useEffect(() => {
    let active = true;
    getReadingCompletion(bookId).then(result => { if (active) setCompleted(result.completed); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [bookId]);

  async function toggleCompletion() {
    setSaving(true);
    setError(false);
    try {
      const result = await setReadingCompletion(bookId, !completed);
      setCompleted(result.completed);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return <div>
    {completed !== null && <button type="button" className="reader-open-link" disabled={saving} onClick={toggleCompletion}>
      {completed ? labels.undo : labels.mark}
    </button>}
    {error && <p role="alert">{labels.error}</p>}
  </div>;
}
