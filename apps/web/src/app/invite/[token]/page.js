"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Users, ShieldCheck, LinkIcon, Check, X } from "lucide-react";
import { toast } from "sonner";

import { OrbitMark } from "@/components/layout/Sidebar";
import { Button, Card, EmptyState, Spinner, Badge } from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";
import * as connectionService from "@/services/connection.service";
import { absoluteTime } from "@/lib/format";

/**
 * The invited person's page.
 *
 * Deliberately outside the dashboard: whoever opens this may have no Orbit
 * account at all. It shows who is asking and nothing else — no device, no
 * position, not even confirmation that the requester has anything to show.
 */
export default function InvitePage() {
  const { token } = useParams();
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await connectionService.resolveInvite(token);

        if (!cancelled) {
          setRequest(data);
          setError(null);
        }
      } catch (resolveError) {
        if (!cancelled) {
          setError(resolveError.message);
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

  const respond = useCallback(
    async (accept) => {
      setWorking(true);

      try {
        if (accept) {
          // An empty list means every device, which is the sensible default
          // when someone is answering from a link rather than the dashboard.
          await connectionService.acceptRequest(request.id, []);
          toast.success("You are now sharing. You can stop at any time.");
        } else {
          await connectionService.denyRequest(request.id);
          toast.success("Request declined. Nothing was shared.");
        }

        router.replace("/people");
      } catch (respondError) {
        toast.error(respondError.message);
        setWorking(false);
      }
    },
    [request, router]
  );

  // The address matters: a request addressed to someone else must not be
  // answerable just because this browser happens to be signed in.
  const addressedToMe =
    user && request && user.email.toLowerCase() === request.targetEmail.toLowerCase();

  return (
    <div className="grid min-h-dvh place-items-center px-6 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="focus-ring mx-auto mb-8 flex w-fit items-center gap-2.5 rounded-lg"
        >
          <OrbitMark />
          <span className="text-[15px] font-semibold tracking-tight">Orbit</span>
        </Link>

        {loading ? (
          <Card className="grid h-56 place-items-center">
            <Spinner />
          </Card>
        ) : error ? (
          <Card>
            <EmptyState
              icon={LinkIcon}
              title="This request isn't available"
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
          <Card className="animate-rise overflow-hidden">
            <div className="border-b border-line p-6 text-center">
              <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
                <Users className="size-5" />
              </span>
              <h1 className="text-lg font-semibold tracking-tight">
                {request.requesterName} wants to see your location
              </h1>
              <p className="mt-1 text-xs text-ink-muted">{request.requesterEmail}</p>

              {request.message && (
                <p className="mt-4 rounded-xl border border-line bg-void/50 px-3 py-2.5 text-xs italic text-ink-muted">
                  “{request.message}”
                </p>
              )}
            </div>

            <div className="space-y-3 p-6">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-positive" />
                <p className="text-xs leading-relaxed text-ink-muted">
                  If you accept, they can see where your devices are and whether
                  they are online. They cannot read your history, change your
                  settings, or stop you from revoking this.
                </p>
              </div>

              <p className="text-[11px] text-ink-faint">
                Expires {absoluteTime(request.expiresAt)}
              </p>
            </div>

            <div className="border-t border-line p-6 pt-4">
              {status === "loading" ? (
                <div className="grid place-items-center py-2">
                  <Spinner />
                </div>
              ) : !user ? (
                <>
                  <p className="mb-3 text-center text-xs text-ink-muted">
                    Sign in as{" "}
                    <span className="text-ink">{request.targetEmail}</span> to
                    answer this.
                  </p>
                  <div className="flex gap-2">
                    <Link href={`/login?next=/invite/${token}`} className="flex-1">
                      <Button className="w-full">Sign in</Button>
                    </Link>
                    <Link href="/register" className="flex-1">
                      <Button variant="secondary" className="w-full">
                        Create account
                      </Button>
                    </Link>
                  </div>
                </>
              ) : !addressedToMe ? (
                <div className="text-center">
                  <Badge tone="warning">Signed in as {user.email}</Badge>
                  <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                    This request was sent to{" "}
                    <span className="text-ink">{request.targetEmail}</span>. Sign
                    in with that account to answer it.
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    loading={working}
                    onClick={() => respond(true)}
                  >
                    <Check className="size-4" /> Accept
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={working}
                    onClick={() => respond(false)}
                  >
                    <X className="size-4" /> Deny
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-faint">
          Orbit never shares your location without your explicit agreement.
        </p>
      </div>
    </div>
  );
}
