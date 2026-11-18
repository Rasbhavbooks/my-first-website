export default function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" />{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
