import type { Metadata } from "next";
import BookingClient from "./booking-client";

export const metadata: Metadata = {
  title: "เลือกวันสัมภาษณ์ — Relife Solutions",
};

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <BookingClient token={token} />;
}
