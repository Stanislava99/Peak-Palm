import { brand } from "@/lib/brand";
import type { Review } from "@/lib/reviews";
import { Icon, type IconName } from "./Icons";
import { ReviewDeck } from "./ReviewDeck";

type Category = {
  label: string;
  score: number;
};

const categoryIcons: Record<string, IconName> = {
  Cleanliness: "sparkle",
  Accuracy: "check",
  "Check-in": "key",
  Communication: "chat",
  Location: "pin",
  Value: "tag",
};

function verdict(score: number) {
  if (score >= 4.9) return "Exceptional";
  if (score >= 4.75) return "Excellent";
  if (score >= 4.5) return "Very good";
  return "Good";
}

export function Stars({ score, size = 18 }: { score: number; size?: number }) {
  return (
    <span className="star-row" role="img" aria-label={`${score.toFixed(2)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((star) => (
        <i
          key={star}
          style={{
            width: size,
            height: size,
            ["--fill" as string]: `${Math.max(0, Math.min(1, score - star)) * 100}%`,
          }}
        />
      ))}
    </span>
  );
}

export function GuestScore({
  score,
  count,
  categories,
  airbnbUrl,
  superhost = false,
  live = false,
  reviews = [],
}: {
  score: number;
  count: number;
  categories: Category[];
  airbnbUrl: string;
  superhost?: boolean;
  live?: boolean;
  reviews?: Review[];
}) {
  const best = categories.reduce((top, item) => (item.score > top.score ? item : top), categories[0]);
  const withReviews = reviews.length > 0;

  const cats = (
    <ul className="rating-cats">
      {categories.map((item) => (
        <li key={item.label}>
          <span className="rating-cat-icon">
            <Icon name={categoryIcons[item.label] ?? "star"} size={withReviews ? 15 : 20} />
          </span>
          <span className="rating-cat-label">{item.label}</span>
          <span className="rating-cat-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(4, Math.min(100, (item.score - 4) * 100))}%` }} />
          </span>
          <strong>{item.score.toFixed(2)}</strong>
        </li>
      ))}
    </ul>
  );

  return (
    <section className={`rating${withReviews ? " has-reviews" : ""}`} aria-label="Guest rating">
      <div className="rating-summary">
        <p className="eyebrow">Guest rating</p>
        <div className="rating-score">
          <strong>{score.toFixed(2)}</strong>
          <span>/ 5</span>
        </div>
        <Stars score={score} size={22} />
        <p className="rating-verdict">{verdict(score)}</p>
        <p className="rating-meta">
          From {count} guest reviews on Airbnb{live ? ", read from the live listing" : ""}.
          {best ? ` Highest marks for ${best.label.toLowerCase()}.` : ""}
        </p>
        {superhost ? (
          <p className="rating-host">
            <Icon name="star" size={16} /> {brand.host} is an Airbnb Superhost
          </p>
        ) : null}
        {withReviews ? cats : (
          <a className="rating-link" href={airbnbUrl} target="_blank" rel="noreferrer">
            Read the reviews on Airbnb <Icon name="arrow" size={16} />
          </a>
        )}
      </div>

      {withReviews ? <ReviewDeck reviews={reviews} airbnbUrl={airbnbUrl} /> : cats}
    </section>
  );
}
