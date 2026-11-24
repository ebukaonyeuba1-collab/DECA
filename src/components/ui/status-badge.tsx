import { BOOKING_LABEL, VERIFICATION_LABEL, type BookingStatus, type VerificationStatus } from "@/lib/domain";
import { Badge } from "./badge";

const verificationTone = (s: VerificationStatus) => (s === "approved" ? "success" : s === "rejected" || s === "suspended" ? "danger" : s === "additional_information_required" ? "warning" : "neutral") as "success" | "danger" | "warning" | "neutral";
const bookingTone = (s: BookingStatus) => (s === "completed" ? "success" : s === "cancelled" || s === "disputed" || s === "refunded" ? "danger" : "neutral") as "success" | "danger" | "neutral";

export const VerificationBadge = ({ status }: { status: VerificationStatus }) => <Badge tone={verificationTone(status)}>{VERIFICATION_LABEL[status]}</Badge>;
export const BookingBadge = ({ status }: { status: BookingStatus }) => <Badge tone={bookingTone(status)}>{BOOKING_LABEL[status]}</Badge>;
