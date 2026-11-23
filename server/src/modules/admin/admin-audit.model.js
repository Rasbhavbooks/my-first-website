import mongoose from "mongoose";

const adminAuditSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "Reader", required: true, immutable: true },
  method: { type: String, enum: ["POST", "PUT", "PATCH", "DELETE"], required: true, immutable: true },
  path: { type: String, required: true, maxlength: 240, immutable: true },
  statusCode: { type: Number, required: true, min: 200, max: 299, immutable: true },
  occurredAt: { type: Date, required: true, default: Date.now, immutable: true },
}, { versionKey: false, strict: "throw" });

adminAuditSchema.index({ occurredAt: -1, _id: -1 });
adminAuditSchema.index({ actorId: 1, occurredAt: -1 });

const AdminAuditEvent = mongoose.models.AdminAuditEvent || mongoose.model("AdminAuditEvent", adminAuditSchema);
export default AdminAuditEvent;
