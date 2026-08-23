"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Clock, LinkIcon, RefreshCw } from "lucide-react";

import { OrbitMark } from "@/components/layout/Sidebar";
import { OrbitMap } from "@/components/map/OrbitMap";
import { Button, Card, EmptyState, Spinner, StatusDot, Badge } from "@/components/ui";
import { deviceTypeLabel } from "@/lib/constants";
import { relativeTime, absoluteTime, formatAccuracy } from "@/lib/format";
import * as shareService from "@/services/share.service";

/**
 * The recipient's view of a shared device.
 *
 * Deliberately outside the dashboard layout: no sidebar, no session, no account
 * data. Everything rendered here comes from the public endpoint, which returns
 * a display name and one position and nothing else.
 */
export default function SharePage() {
  const { token } = useParams();

  const [share, setShare] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Re-read used by the refresh button and the poll below. The initial read
  // lives in its own effect so its state updates happen after an await.
  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      const data = await shareService.resolveShare(token);

      setShare(data);
      setError(null);
    } catch (loadError) {
      setError(loadError.message);
      setShare(null);
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await shareService.resolveShare(token);

        if (!cancelled) {
          setShare(data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
          setShare(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // No socket here - the recipient is not authenticated and has no room to
  // join. A slow poll is the honest way to keep a shared position current.
  useEffect(() => {
    if (!share) {
      return undefined;
    }

    const timer = setInterval(refresh, 30000);

    return () => clearInterval(timer);
  }, [share, refresh]);

  // Rendered as a device-shaped object so the same map component can draw it.
  const asDevice = share?.location
    ? {
        id: "shared",
        name: share.deviceName,
        type: share.deviceType,
        isOnline: share.isOnline,
        batteryLevel: null,
        lastSeen: share.location.timestamp,
        trackingEnabled: share.trackingEnabled,
        lastLocation: {
          latitude: share.location.latitude,
          longitude: share.location.longitude,
          accuracy: share.location.accuracy,
          battery: null,
          timestamp: share.location.timestamp,
        },
      }
    : null;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-4xl items-center gap-2.5 px-6">
        <OrbitMark />
        <span className="text-[15px] font-semibold tracking-tight">Orbit</span>
        <Badge tone="muted" className="ml-2">
          Shared location
        </Badge>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-12">
        {loading ? (
          <Card className="grid h-96 place-items-center">
            <Spinner />
          </Card>
        ) : error ? (
          <Card>
            <EmptyState
              icon={LinkIcon}
              title="This link isn't available"
              description={error}
              action={
                <Link href="/">
                  <Button variant="secondary" size="sm">
                    Go to Orbit
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-5">
                <StatusDot online={share.isOnline} />
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold tracking-tight">
                    {share.deviceName}
                  </h1>
                  <p className="text-xs text-ink-muted">
                    {deviceTypeLabel(share.deviceType)} ·{" "}
                    {share.isOnline ? "Online" : "Offline"}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  loading={refreshing}
                  onClick={refresh}
                >
                  {!refreshing && <RefreshCw className="size-3.5" />}
                  Refresh
                </Button>
              </div>

              <div className="h-[26rem] border-t border-line">
                {asDevice ? (
                  <OrbitMap
                    devices={[asDevice]}
                    focusedDeviceId="shared"
                    className="size-full"
                  />
                ) : (
                  <EmptyState
                    title="No position available"
                    description={
                      share.trackingEnabled
                        ? "This device hasn't reported a position yet."
                        : "Its owner has turned tracking off."
                    }
                  />
                )}
              </div>

              {share.location && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3.5 text-[11px] text-ink-muted">
                  <span>Updated {relativeTime(share.location.timestamp)}</span>
                  <span>{formatAccuracy(share.location.accuracy)}</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3" />
                    Link expires {absoluteTime(share.expiresAt)}
                  </span>
                </div>
              )}
            </Card>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-faint">
              You are seeing one device&apos;s position, shared deliberately by
              its owner. This link expires on its own and can be revoked at any
              time.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
