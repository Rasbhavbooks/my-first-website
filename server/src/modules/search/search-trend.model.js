import mongoose from "mongoose";

const searchTrendSchema = new mongoose.Schema({
  normalizedTerm: { type: String, required: true, unique: true, maxlength: 60 },
  displayTerm: { type: String, required: true, maxlength: 60 },
  searches: { type: Number, required: true, min: 1, default: 0 },
  lastSearchedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

searchTrendSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
searchTrendSchema.index({ searches: -1, lastSearchedAt: -1 });

const SearchTrend = mongoose.models.SearchTrend || mongoose.model("SearchTrend", searchTrendSchema);
export default SearchTrend;
